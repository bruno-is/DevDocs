#!/usr/bin/env python3
"""ERP ficticio: outbox/inbox, falhas, arquivo e HTTP; somente biblioteca padrao.

Este modelo usa polling de uma outbox SQLite, NAO captura de WAL/CDC.
Os dois arquivos representam fronteiras transacionais separadas.
"""
import argparse
import hashlib
import json
import sqlite3
import sys
import time
from contextlib import closing
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def now():
    return datetime.now(timezone.utc).isoformat()


def encode(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def connect(path):
    db = sqlite3.connect(path, timeout=5)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    db.execute("PRAGMA busy_timeout=5000")
    return db


def initialize(root):
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    with closing(connect(root / "source.sqlite")) as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS tickets (
          id INTEGER PRIMARY KEY, title TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('open','closed')),
          version INTEGER NOT NULL, updated_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS requests (
          request_key TEXT PRIMARY KEY, digest TEXT NOT NULL,
          response TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS outbox (
          seq INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id TEXT NOT NULL UNIQUE, payload TEXT NOT NULL,
          created_at TEXT NOT NULL, delivered INTEGER NOT NULL DEFAULT 0);
        """)
    with closing(connect(root / "projection.sqlite")) as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS inbox (
          event_id TEXT PRIMARY KEY, received_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS tickets (
          id INTEGER PRIMARY KEY, title TEXT NOT NULL, status TEXT NOT NULL,
          version INTEGER NOT NULL, updated_at TEXT NOT NULL);
        """)
    return root


def validate(command):
    ticket_id = command.get("id")
    title = command.get("title")
    status = command.get("status", "open")
    if type(ticket_id) is not int or not 1 <= ticket_id <= 2147483647:
        raise ValueError("id deve ser inteiro positivo de 32 bits")
    if not isinstance(title, str) or not 1 <= len(title.strip()) <= 120:
        raise ValueError("title deve ter entre 1 e 120 caracteres")
    if status not in ("open", "closed"):
        raise ValueError("status deve ser open ou closed")
    return {"id": ticket_id, "title": title.strip(), "status": status}


def write_ticket(root, request_key, command):
    """Mutacao e evento atomicos; repeticao da mesma chave retorna resposta anterior."""
    if not isinstance(request_key, str) or not 1 <= len(request_key) <= 100:
        raise ValueError("Idempotency-Key deve ter entre 1 e 100 caracteres")
    command = validate(command)
    digest = hashlib.sha256(encode(command).encode()).hexdigest()
    with closing(connect(Path(root) / "source.sqlite")) as db, db:
        db.execute("BEGIN IMMEDIATE")
        previous = db.execute("SELECT * FROM requests WHERE request_key=?", (request_key,)).fetchone()
        if previous:
            if previous["digest"] != digest:
                raise ValueError("chave de idempotencia reutilizada com outro comando")
            return json.loads(previous["response"])
        row = db.execute("SELECT version FROM tickets WHERE id=?", (command["id"],)).fetchone()
        ticket = {**command, "version": (row["version"] + 1) if row else 1, "updated_at": now()}
        db.execute("""INSERT INTO tickets VALUES(:id,:title,:status,:version,:updated_at)
          ON CONFLICT(id) DO UPDATE SET title=excluded.title,status=excluded.status,
          version=excluded.version,updated_at=excluded.updated_at""", ticket)
        event = {"event_id": f"ticket-{ticket['id']}-v{ticket['version']}", "type": "TicketChanged.v1", "ticket": ticket}
        db.execute("INSERT INTO outbox(event_id,payload,created_at) VALUES(?,?,?)",
                   (event["event_id"], encode(event), ticket["updated_at"]))
        db.execute("INSERT INTO requests VALUES(?,?,?)", (request_key, digest, encode(ticket)))
    return ticket


def apply_event(root, event, crash_before_commit=False):
    with closing(connect(Path(root) / "projection.sqlite")) as db, db:
        inserted = db.execute("INSERT OR IGNORE INTO inbox VALUES(?,?)", (event["event_id"], now())).rowcount
        if inserted:
            db.execute("""INSERT INTO tickets VALUES(:id,:title,:status,:version,:updated_at)
              ON CONFLICT(id) DO UPDATE SET title=excluded.title,status=excluded.status,
              version=excluded.version,updated_at=excluded.updated_at
              WHERE excluded.version > tickets.version""", event["ticket"])
        if crash_before_commit:
            raise RuntimeError("falha antes do commit da projecao: transacao revertida")
    return bool(inserted)


def pump(root, crash=None, limit=100):
    """Um worker; para varios workers faltam lease/claim e tratamento de disputa."""
    with closing(connect(Path(root) / "source.sqlite")) as source:
        rows = source.execute("SELECT * FROM outbox WHERE delivered=0 ORDER BY seq LIMIT ?", (limit,)).fetchall()
        applied = 0
        for row in rows:
            applied += apply_event(root, json.loads(row["payload"]), crash == "before")
            if crash == "after":
                raise RuntimeError("falha apos commit da projecao e antes do ACK: mensagem sera repetida")
            with source:
                source.execute("UPDATE outbox SET delivered=1 WHERE seq=?", (row["seq"],))
    return {"received": len(rows), "applied": applied, "duplicates": len(rows) - applied}


def inspect(root):
    with closing(connect(Path(root) / "source.sqlite")) as source, closing(connect(Path(root) / "projection.sqlite")) as projection:
        return {
            "source": [dict(r) for r in source.execute("SELECT * FROM tickets ORDER BY id")],
            "projection": [dict(r) for r in projection.execute("SELECT * FROM tickets ORDER BY id")],
            "pending": source.execute("SELECT count(*) FROM outbox WHERE delivered=0").fetchone()[0],
            "inbox": projection.execute("SELECT count(*) FROM inbox").fetchone()[0],
        }


def archive(root, destination, cutoff):
    """Move apenas projecao fechada. Fonte e outbox sao mantidas para auditoria."""
    cutoff_time = datetime.fromisoformat(cutoff)
    if cutoff_time.tzinfo is None or cutoff_time.utcoffset() is None:
        raise ValueError("cutoff deve incluir timezone, por exemplo +00:00")
    cutoff_time = cutoff_time.astimezone(timezone.utc)
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=False)
    with closing(connect(Path(root) / "projection.sqlite")) as db, db:
        db.execute("BEGIN IMMEDIATE")
        rows = [dict(r) for r in db.execute("SELECT * FROM tickets WHERE status='closed' ORDER BY id")
                if datetime.fromisoformat(r["updated_at"]) < cutoff_time]
        payload = "".join(encode(row) + "\n" for row in rows).encode("utf-8")
        (destination / "tickets.jsonl").write_bytes(payload)
        manifest = {"count": len(rows), "sha256": hashlib.sha256(payload).hexdigest(), "cutoff": cutoff_time.isoformat(), "schema": 1}
        (destination / "manifest.json").write_text(encode(manifest), encoding="utf-8")
        verify_archive(destination)
        db.executemany("DELETE FROM tickets WHERE id=? AND version=?", [(r["id"], r["version"]) for r in rows])
    return manifest


def verify_archive(destination):
    destination = Path(destination)
    payload = (destination / "tickets.jsonl").read_bytes()
    manifest = json.loads((destination / "manifest.json").read_text(encoding="utf-8"))
    if manifest["schema"] != 1 or hashlib.sha256(payload).hexdigest() != manifest["sha256"]:
        raise ValueError("arquivo inconsistente: schema ou checksum invalido")
    rows = [json.loads(line) for line in payload.decode("utf-8").splitlines()]
    if len(rows) != manifest["count"]:
        raise ValueError("arquivo inconsistente: contagem invalida")
    return rows


def rehydrate(root, destination):
    rows = verify_archive(destination)
    with closing(connect(Path(root) / "projection.sqlite")) as db, db:
        for row in rows:
            db.execute("""INSERT INTO tickets VALUES(:id,:title,:status,:version,:updated_at)
              ON CONFLICT(id) DO UPDATE SET title=excluded.title,status=excluded.status,
              version=excluded.version,updated_at=excluded.updated_at
              WHERE excluded.version > tickets.version""", row)
    return {"verified_records": len(rows)}


def backup(root, destination):
    """Backup consistente de CADA arquivo; nao e snapshot distribuido atomico."""
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=False)
    for name in ("source.sqlite", "projection.sqlite"):
        with closing(connect(Path(root) / name)) as src, closing(connect(destination / name)) as dst:
            src.backup(dst)
            if dst.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise RuntimeError("backup falhou na verificacao de integridade")
    return {"backup": str(destination), "files": 2}


def make_server(root, port):
    class Handler(BaseHTTPRequestHandler):
        requests = 0
        errors = 0

        def log_message(self, *_):
            pass

        def send_json(self, status, value):
            body = encode(value).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path == "/health":
                self.send_json(200, {"status": "ok"})
            elif self.path == "/state":
                self.send_json(200, inspect(root))
            elif self.path == "/metrics":
                state = inspect(root)
                self.send_json(200, {"requests": Handler.requests, "errors": Handler.errors, "pending_events": state["pending"]})
            else:
                self.send_json(404, {"error": "rota inexistente"})

        def do_POST(self):
            started = time.perf_counter()
            Handler.requests += 1
            status = 201
            try:
                if self.path != "/tickets":
                    self.send_json(404, {"error": "rota inexistente"})
                    return
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= 4096:
                    raise ValueError("corpo deve ter entre 1 e 4096 bytes")
                value = json.loads(self.rfile.read(length))
                if not isinstance(value, dict):
                    raise ValueError("corpo deve ser objeto JSON")
                response = write_ticket(root, self.headers.get("Idempotency-Key"), value)
            except (ValueError, TypeError) as error:
                Handler.errors += 1
                status, response = 400, {"error": str(error)}
            except sqlite3.Error:
                Handler.errors += 1
                status, response = 503, {"error": "banco temporariamente indisponivel"}
            self.send_json(status, response)
            print(encode({"action": "ticket.write", "status": status, "duration_ms": round((time.perf_counter() - started) * 1000, 2)}), flush=True)

    return ThreadingHTTPServer(("127.0.0.1", port), Handler)


def serve(root, port):
    print(encode({"listen": f"http://127.0.0.1:{port}", "warning": "laboratorio local sem autenticacao"}), flush=True)
    make_server(root, port).serve_forever()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", default=".lab-data")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("init")
    write = sub.add_parser("write")
    write.add_argument("id", type=int)
    write.add_argument("title")
    write.add_argument("--status", choices=["open", "closed"], default="open")
    write.add_argument("--key", required=True)
    worker = sub.add_parser("pump")
    worker.add_argument("--crash", choices=["before", "after"])
    sub.add_parser("inspect")
    web = sub.add_parser("serve")
    web.add_argument("--port", type=int, default=8765)
    cold = sub.add_parser("archive")
    cold.add_argument("destination")
    cold.add_argument("--cutoff", required=True)
    warm = sub.add_parser("rehydrate")
    warm.add_argument("destination")
    save = sub.add_parser("backup")
    save.add_argument("destination")
    args = parser.parse_args()
    root = initialize(args.data)
    if args.command == "write":
        result = write_ticket(root, args.key, {"id": args.id, "title": args.title, "status": args.status})
    elif args.command == "pump":
        result = pump(root, args.crash)
    elif args.command == "inspect":
        result = inspect(root)
    elif args.command == "archive":
        result = archive(root, args.destination, args.cutoff)
    elif args.command == "rehydrate":
        result = rehydrate(root, args.destination)
    elif args.command == "backup":
        result = backup(root, args.destination)
    elif args.command == "serve":
        serve(root, args.port)
        return
    else:
        result = {"initialized": str(root)}
    print(encode(result))


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError, sqlite3.Error) as error:
        print(encode({"error": str(error)}), file=sys.stderr)
        sys.exit(1)
