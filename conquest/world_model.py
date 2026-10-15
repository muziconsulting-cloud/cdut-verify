"""Meterless World Model Agent Engine — headless shared world state.

The substrate that turns four prompt-callers into one coherent, explainable
system. It ingests the three disconnected sources (lead stream, instrument
ledger, coupon pool) as observations, derives canonical entities with
content-hash stable IDs, and keeps a provenance-stamped append log so any belief
("this region has no live instrument") reconstructs to the source observation it
came from.

Scope for this build (solo, bounded): entity store + content-hash IDs + canonical
reconstruction (latest-wins) + provenance + agent attribution + JSONL append log.
Enrichment queues, the relationship-maturity ladder, and the full operation
control plane are intentionally deferred and documented as such.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from .config import Config, LOG_DIR


def stable_id(kind: str, name: str) -> str:
    """Stable, content-derived ID: independent agents agree without coordination."""
    digest = hashlib.sha1(name.strip().lower().encode("utf-8")).hexdigest()[:12]
    return f"ent_{kind}_{digest}"


@dataclass
class Observation:
    entity_id: str
    source: str
    agent_id: str
    run_id: str
    props: dict[str, Any]
    at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class WorldStore:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self._obs: list[Observation] = []
        self._seen: set[str] = set()
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        self.path = LOG_DIR / "world-append.jsonl"
        self._load_seen()

    # ── idempotency / resumability ─────────────────────────────────────────────
    def _key(self, entity_id: str, source: str, props: dict[str, Any]) -> str:
        raw = f"{entity_id}|{source}|{json.dumps(props, sort_keys=True, default=str)}"
        return hashlib.sha1(raw.encode("utf-8")).hexdigest()

    def _load_seen(self) -> None:
        """Replay the append log so a crashed/re-run ingest does not duplicate."""
        if not self.path.exists():
            return
        for line in self.path.read_text(encoding="utf-8").splitlines():
            try:
                r = json.loads(line)
                props = r.get("props", {})
                self._seen.add(self._key(r["entity_id"], r["source"], props))
                self._obs.append(Observation(
                    r["entity_id"], r["source"], r.get("agent_id", "?"),
                    r.get("run_id", "?"), props, r.get("at", ""),
                ))
            except (ValueError, KeyError):
                continue

    # ── ingest ────────────────────────────────────────────────────────────────
    def observe(self, kind: str, name: str, source: str, agent_id: str,
                run_id: str, props: dict[str, Any]) -> str:
        entity_id = stable_id(kind, name)
        key = self._key(entity_id, source, props)
        if key in self._seen:
            return entity_id  # idempotent: re-ingesting the same fact is a no-op
        self._seen.add(key)
        obs = Observation(entity_id, source, agent_id, run_id, props)
        self._obs.append(obs)
        with self.path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(obs.__dict__, default=str) + "\n")
        return entity_id

    def ingest_federation(self, region: str, evidence: dict[str, Any], run_id: str) -> str:
        """Turn one Zetaris federation result into grounded source observations.

        We append each SOURCE separately (never a pre-merged row) so canonical
        reconstruction can attribute every field to the source it came from.
        """
        lead = evidence.get("lead", {}) or {}
        register = evidence.get("register", {}) or {}
        sweep = evidence.get("sweep", {}) or {}
        coupon = evidence.get("coupon", {}) or {}
        for source, chunk in (
            ("lead_log", lead),
            ("designer_register", register),
            ("sweep_pool", sweep),
            ("coupon", coupon),
        ):
            if chunk:
                self.observe("region", region, source, "orchestrator", run_id, dict(chunk))
        return stable_id("region", region)

    # ── canonical reconstruction (latest-wins) ─────────────────────────────────
    def canonical(self, entity_id: str) -> dict[str, Any]:
        rows = [o for o in self._obs if o.entity_id == entity_id]
        props: dict[str, Any] = {}
        provenance: dict[str, str] = {}
        for o in sorted(rows, key=lambda r: r.at):
            for k, v in o.props.items():
                if v not in (None, "", 0):
                    props[k] = v
                    provenance[k] = o.source
        return {"id": entity_id, "props": props, "provenance": provenance}

    def context_for(self, region: str, agent_id: str, run_id: str) -> dict[str, Any]:
        """The structured context payload an agent consumes (not a rendered string)."""
        entity_id = stable_id("region", region)
        canon = self.canonical(entity_id)
        return {
            "entity_id": entity_id,
            "props": canon["props"],
            "provenance": canon["provenance"],
            "agents": sorted({o.agent_id for o in self._obs if o.entity_id == entity_id}),
        }

    def append_count(self) -> int:
        return len(self._obs)
