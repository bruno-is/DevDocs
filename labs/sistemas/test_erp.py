"""Teste de invariantes, falhas e HTTP sem Docker/rede externa."""
import io
import json
import runpy
import sqlite3
import tempfile
import threading
import unittest
from unittest.mock import patch
import urllib.error
import urllib.request
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path
import erp


class PipelineTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name)
        self.root = erp.initialize(self.base / "data")
        self.command = {"id": 1, "title": "Pedido sintetico", "status": "open"}

    def tearDown(self):
        self.temp.cleanup()

    def test_command_and_event_commit_together_and_request_repeats(self):
        first = erp.write_ticket(self.root, "req-1", self.command)
        second = erp.write_ticket(self.root, "req-1", self.command)
        self.assertEqual(first, second)
        self.assertEqual(erp.inspect(self.root)["pending"], 1)
        with self.assertRaises(ValueError):
            erp.write_ticket(self.root, "req-1", {**self.command, "title": "Outro"})

    def test_failed_projection_rolls_back_inbox_and_effect(self):
        erp.write_ticket(self.root, "req-1", self.command)
        with self.assertRaises(RuntimeError):
            erp.pump(self.root, "before")
        state = erp.inspect(self.root)
        self.assertEqual((state["inbox"], len(state["projection"]), state["pending"]), (0, 0, 1))
        self.assertEqual(erp.pump(self.root)["applied"], 1)

    def test_commit_before_ack_repeats_without_duplicate_effect(self):
        erp.write_ticket(self.root, "req-1", self.command)
        with self.assertRaises(RuntimeError):
            erp.pump(self.root, "after")
        state = erp.inspect(self.root)
        self.assertEqual((state["inbox"], len(state["projection"]), state["pending"]), (1, 1, 1))
        self.assertEqual(erp.pump(self.root), {"received": 1, "applied": 0, "duplicates": 1})
        self.assertEqual(erp.inspect(self.root)["pending"], 0)

    def test_old_event_cannot_regress_newer_projection(self):
        one = erp.write_ticket(self.root, "req-1", self.command)
        two = erp.write_ticket(self.root, "req-2", {**self.command, "status": "closed"})
        erp.apply_event(self.root, {"event_id": "newer", "ticket": two})
        erp.apply_event(self.root, {"event_id": "older", "ticket": one})
        self.assertEqual(erp.inspect(self.root)["projection"][0]["version"], 2)

    def test_archive_verifies_then_removes_projection_and_rehydrates(self):
        erp.write_ticket(self.root, "req-1", {**self.command, "status": "closed"})
        erp.pump(self.root)
        archive = self.base / "cold"
        manifest = erp.archive(self.root, archive, "9999-01-01T00:00:00+00:00")
        self.assertEqual(manifest["count"], 1)
        self.assertEqual(erp.inspect(self.root)["projection"], [])
        self.assertEqual(len(erp.inspect(self.root)["source"]), 1)
        erp.rehydrate(self.root, archive)
        self.assertEqual(len(erp.inspect(self.root)["projection"]), 1)
        (archive / "tickets.jsonl").write_text("corrompido", encoding="utf-8")
        with self.assertRaises(ValueError):
            erp.rehydrate(self.root, archive)

    def test_online_backup_recovers_source_then_replays_pending_event(self):
        erp.write_ticket(self.root, "req-1", self.command)
        restored = self.base / "backup"
        erp.backup(self.root, restored)
        self.assertEqual(erp.inspect(restored)["pending"], 1)
        erp.pump(restored)
        self.assertEqual(erp.inspect(restored)["projection"][0]["title"], self.command["title"])

    def test_archive_compares_instants_and_requires_timezone(self):
        ticket = erp.write_ticket(self.root, "req-1", {**self.command, "status": "closed"})
        erp.pump(self.root)
        written_at = datetime.fromisoformat(ticket["updated_at"])
        equal_cutoff = written_at.astimezone(timezone(timedelta(hours=3))).isoformat()
        equal_archive = self.base / "equal-cutoff"
        self.assertEqual(erp.archive(self.root, equal_archive, equal_cutoff)["count"], 0)
        self.assertEqual(len(erp.inspect(self.root)["projection"]), 1)
        later_cutoff = (written_at + timedelta(microseconds=1)).astimezone(
            timezone(timedelta(hours=-4))).isoformat()
        self.assertEqual(erp.archive(self.root, self.base / "later-cutoff", later_cutoff)["count"], 1)
        with self.assertRaisesRegex(ValueError, "timezone"):
            erp.archive(self.root, self.base / "naive-cutoff", "2026-10-25T12:00:00")
        self.assertFalse((self.base / "naive-cutoff").exists())

    def test_connector_rejects_invalid_config_without_retrying(self):
        error = urllib.error.HTTPError("http://127.0.0.1:58083", 400,
                                       "Bad Request", {}, io.BytesIO(b"invalid connector config"))
        script = Path(erp.__file__).with_name("register_connector.py")
        with patch("urllib.request.urlopen", side_effect=error) as request, patch("time.sleep") as pause:
            with self.assertRaisesRegex(SystemExit, "HTTP 400.*invalid connector config"):
                runpy.run_path(str(script), run_name="__main__")
            self.assertEqual(request.call_count, 1)
            pause.assert_not_called()

    def test_parallel_retries_produce_one_version_and_one_event(self):
        results, failures = [], []
        def attempt():
            try:
                results.append(erp.write_ticket(self.root, "same-key", self.command))
            except Exception as error:
                failures.append(error)
        threads = [threading.Thread(target=attempt) for _ in range(8)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        self.assertEqual(failures, [])
        self.assertEqual(len(results), 8)
        self.assertTrue(all(value == results[0] for value in results))
        self.assertEqual(erp.inspect(self.root)["pending"], 1)

    def test_http_write_state_metrics_and_invalid_request(self):
        server = erp.make_server(self.root, 0)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{server.server_address[1]}"
        try:
            request = urllib.request.Request(base + "/tickets", data=json.dumps(self.command).encode(),
                                             headers={"Idempotency-Key": "http-1", "Content-Type": "application/json"})
            with urllib.request.urlopen(request, timeout=5) as response:
                self.assertEqual(response.status, 201)
            with urllib.request.urlopen(base + "/state", timeout=5) as response:
                self.assertEqual(json.load(response)["pending"], 1)
            invalid = urllib.request.Request(base + "/tickets", data=b"[]")
            with self.assertRaises(urllib.error.HTTPError) as caught:
                urllib.request.urlopen(invalid, timeout=5)
            self.assertEqual(caught.exception.code, 400)
            caught.exception.close()
            with urllib.request.urlopen(base + "/metrics", timeout=5) as response:
                metrics = json.load(response)
                self.assertEqual((metrics["requests"], metrics["errors"], metrics["pending_events"]), (2, 1, 1))
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)


if __name__ == "__main__":
    unittest.main(verbosity=2)
