"""The gated_intent ledger.

Record-only. This never settles value: every row is written with status 'gated'
or 'rejected'. Live mode targets SurrealDB over HTTP POST /sql (the same raw
interface the pre-existing WardByWard backend uses); otherwise it appends JSONL.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from .config import Config, LOG_DIR
from .models import GatedIntent, to_dict


class Ledger:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        self.path = LOG_DIR / "ledger.jsonl"

    def write(self, intent: GatedIntent) -> str:
        intent = GatedIntent(**{**to_dict(intent), "status": intent.status})
        row = to_dict(intent)
        row["at"] = datetime.now(timezone.utc).isoformat()
        row["value_seam"] = "inert"  # explicit: no settlement

        if not self.cfg.sample_mode and self.cfg.surreal_url:
            self._write_surreal(row)
        with self.path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(row, default=str) + "\n")
        return intent.intent_id

    def _write_surreal(self, row: dict) -> None:
        try:
            import requests

            sql = f"CREATE gated_intent CONTENT {json.dumps(row)};"
            requests.post(
                f"{self.cfg.surreal_url.rstrip('/')}/sql",
                headers={
                    "Authorization": f"Basic {self._basic()}",
                    "surreal-ns": self.cfg.surreal_ns,
                    "surreal-db": self.cfg.surreal_db,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                data=sql,
                timeout=15,
            )
        except Exception:
            pass  # ledger falls back to the JSONL copy above

    def _basic(self) -> str:
        import base64

        raw = f"{self.cfg.surreal_user}:{self.cfg.surreal_pass}".encode()
        return base64.b64encode(raw).decode()
