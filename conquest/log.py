"""Structured trace logging — the evidence of how the agents worked.

Writes newline-delimited JSON to logs/trace.jsonl and echoes a readable line to
stdout, so judges can see the full decision path for every lead.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone

from .config import LOG_DIR


class Tracer:
    def __init__(self, run_id: str):
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        self.run_id = run_id
        self.path = LOG_DIR / f"trace-{run_id}.jsonl"
        self._fh = self.path.open("w", encoding="utf-8")

    def event(self, agent: str, action: str, **fields: object) -> None:
        row = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "run_id": self.run_id,
            "agent": agent,
            "action": action,
            **fields,
        }
        self._fh.write(json.dumps(row, default=str) + "\n")
        self._fh.flush()
        tail = " ".join(f"{k}={v}" for k, v in fields.items() if k in {"lead_id", "approved", "revision", "status"})
        print(f"[{agent:<16}] {action:<24} {tail}", file=sys.stdout)

    def close(self) -> None:
        self._fh.close()
