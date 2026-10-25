#!/usr/bin/env python3
"""Registro idempotente e verificacao finita do conector local."""
import json
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE = "http://127.0.0.1:58083"
config = json.loads(Path(__file__).with_name("connector.json").read_text(encoding="utf-8"))
request = urllib.request.Request(BASE + "/connectors/" + config["name"] + "/config",
                                 data=json.dumps(config["config"]).encode(),
                                 headers={"Content-Type": "application/json"}, method="PUT")
for attempt in range(60):
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            json.load(response)
        break
    except (urllib.error.URLError, TimeoutError) as error:
        if isinstance(error, urllib.error.HTTPError):
            detail = error.read().decode("utf-8", errors="replace")[:2000]
            error.close()
            if 400 <= error.code < 500 and error.code not in (409, 429):
                raise SystemExit(f"Configuracao rejeitada pelo Kafka Connect (HTTP {error.code}): {detail}")
        if attempt == 59:
            raise SystemExit("Kafka Connect nao respondeu; consulte docker compose logs connect")
        time.sleep(1)
for attempt in range(60):
    with urllib.request.urlopen(BASE + "/connectors/" + config["name"] + "/status", timeout=5) as response:
        status = json.load(response)
    tasks = status.get("tasks", [])
    if status["connector"]["state"] == "FAILED" or any(task["state"] == "FAILED" for task in tasks):
        print(json.dumps(status, indent=2))
        raise SystemExit("Conector falhou; investigue trace e logs antes de continuar")
    if status["connector"]["state"] == "RUNNING" and tasks and all(task["state"] == "RUNNING" for task in tasks):
        print(json.dumps(status, indent=2))
        break
    if attempt == 59:
        raise SystemExit("Conector nao atingiu RUNNING; consulte status e logs")
    time.sleep(1)
