"""The collaboration loop that makes the agents do real work.

Pattern: Planner delegates -> Closer drafts -> Critic reviews -> on REJECT the
Closer revises (bounded) -> on APPROVE or exhaustion the ledger records a
gated_intent and the Auditor reports the CAC. Branches on confidence and has a
fallback path when Zetaris (the data source) is unavailable.
"""
from __future__ import annotations

import time
import uuid

from .agents import EvidenceReconciler, FidelityCritic, OutreachCloser, TelemetryAuditor, VolumePlanner
from .config import Config
from .ledger import Ledger
from .log import Tracer
from .models import GatedIntent, Lead, to_dict
from .generator import make_generator
from .sponsors import MeterlessClient, ZetarisClient
from .world_model import WorldStore


class Orchestrator:
    def __init__(self, cfg: Config, tracer: Tracer):
        self.cfg = cfg
        self.tracer = tracer
        self.run_id = tracer.run_id
        self.generate = make_generator(cfg)  # ONE injected generator, provider-agnostic
        self.meter = MeterlessClient(cfg)    # H-MEM (memory) + Markovian (reasoning)
        self.zetaris = ZetarisClient(cfg)    # data layer: in-place federation
        self.world = WorldStore(cfg)         # World Model: grounded shared state
        self.ledger = Ledger(cfg)

        self.planner = VolumePlanner(cfg, tracer, self.generate, self.meter)
        self.reconciler = EvidenceReconciler(cfg, tracer, self.generate, self.meter,
                                             self.zetaris, self.world)
        self.closer = OutreachCloser(cfg, tracer, self.generate, self.meter)
        self.critic = FidelityCritic(cfg, tracer, self.generate, self.meter)
        self.auditor = TelemetryAuditor(cfg, tracer, self.generate, self.meter)

    def run(self, leads: list[Lead], velocity: int, counter_delta: int) -> list[dict]:
        plan = self.planner.plan(velocity, counter_delta, len(leads))
        batch = leads[: plan["depth"]]
        self.tracer.event("orchestrator", "tick", pace=plan["pace"], batch=len(batch))

        records: list[dict] = []
        for lead in batch:
            records.append(self._process(lead, plan))
        return records

    def _process(self, lead: Lead, plan: dict) -> dict:
        start = time.monotonic()
        self.meter.reset()
        self.planner.delegate(lead.lead_id)

        # Evidence step, delegated to the Reconciler: Zetaris federates the three
        # disagreeing sources in place, then the World Model grounds them into one
        # canonical, sourced entity. Falls back explicitly if the source is down.
        evidence, entity_id, world_ctx = self.reconciler.reconcile(lead.region, lead.lead_id, self.run_id)

        interest = world_ctx["props"].get("stated_interest") or evidence.get("lead", {}).get("stated_interest", lead.stated_interest)
        revisions = 0
        critique = None
        draft = self.closer.draft(lead.region, interest)

        # Critique -> revision loop (bounded by the planner's budget).
        while True:
            critique = self.critic.review(draft.text, lead.lead_id, evidence)
            if critique.approved:
                break
            if revisions >= min(self.cfg.max_revisions, plan["revision_budget"]):
                break
            revisions += 1
            self.tracer.event("orchestrator", "revise", lead_id=lead.lead_id, revision=revisions)
            draft = self.closer.draft(lead.region, interest, revisions, critique.rewrite_instructions)

        escalated = bool(critique and any(v in getattr(critique, "violations", []) for v in ("no_live_instrument_in_region", "sweep_below_coupon_obligation", "source_unavailable")))
        approved = bool(critique and critique.approved)
        # Markovian: bounded next-action decision, not an ad-hoc if.
        decision = self.meter.transition(approved, critique.confidence if critique else 0.0,
                                          critique.violations if critique else ["no_critique"])
        approach = decision == "approve" and not escalated
        self.tracer.event("Markovian", "transition", lead_id=lead.lead_id, decision=decision, escalated=escalated)

        # Markovian evidence: O(1) carryover vs re-feeding retained history.
        steps = revisions + 1
        per_step = max(1, len(draft.text.split()))
        naive = sum(i * per_step for i in range(1, steps + 1))
        self.meter.log_savings(self.run_id, lead.lead_id, naive, steps * per_step)

        duration_ms = int((time.monotonic() - start) * 1000)
        cac = self.meter.accrued_cents()

        intent = GatedIntent(
            intent_id=f"GI-{uuid.uuid4().hex[:10]}",
            lead_id=lead.lead_id,
            status="gated" if approach else ("escalated" if escalated else "rejected"),
            message=draft.text,
            evidence={
                "sources": evidence.get("sources", []),
                "disagreement": evidence.get("disagreement"),
                "federation": evidence.get("federation"),
                "world_entity": entity_id,
                "provenance": world_ctx.get("provenance", {}),
                "decision": decision,
            },
            confidence=critique.confidence if critique else 0.0,
            cac_cents=cac,
        )
        self.ledger.write(intent)

        rec = self.auditor.record(
            lead_id=lead.lead_id,
            approved=approach,
            revisions=revisions,
            tokens=self.meter.tokens,
            duration_ms=duration_ms,
            cac_cents=cac,
            sources=evidence.get("sources", []),
            actions=list(self.meter.samples),
            status=intent.status,
        )
        return {"lead": to_dict(lead), "intent": to_dict(intent), "audit": to_dict(rec)}
