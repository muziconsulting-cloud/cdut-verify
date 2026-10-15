"""Agent 2 — Evidence Reconciler (specialist).

Owns the evidence step. It federates the three disagreeing internal sources in
place through Zetaris — no data movement, no ETL — grounds the result into the
World Model as one canonical, provenance-stamped entity, and hands the rest of
the loop a single sourced view of the market. Falls back explicitly when the
source is unavailable.
"""
from __future__ import annotations

from .base import Agent


class EvidenceReconciler(Agent):
    name = "Evidence Reconciler"

    def __init__(self, cfg, tracer, generate, meter, zetaris, world):
        super().__init__(cfg, tracer, generate, meter)
        self.zetaris = zetaris
        self.world = world

    def reconcile(self, region: str, lead_id: str, run_id: str) -> tuple[dict, str, dict]:
        try:
            evidence = self.zetaris.federate(lead_id)
        except Exception as exc:  # noqa: BLE001
            self.trace("source_fallback", lead_id=lead_id, error=str(exc))
            evidence = {"sources": ["local_fallback"], "federation": "fallback",
                        "disagreement": "source_unavailable"}

        entity_id = self.world.ingest_federation(region, evidence, run_id)
        world_ctx = self.world.context_for(region, self.name, run_id)
        self.trace("reconcile", lead_id=lead_id, entity=entity_id,
                   disagreement=evidence.get("disagreement"),
                   coverage=evidence.get("coupon", {}).get("coverage"))
        self.meter.remember(self.name, f"canonical:{entity_id}", world_ctx, tier="long")
        return evidence, entity_id, world_ctx
