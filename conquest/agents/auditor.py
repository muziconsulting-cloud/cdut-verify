"""Agent 4 — Telemetry Auditor (reporter).

Aggregates the Meterless meter and the trace into a per-lead audit record and the
Customer Acquisition Cost for each approved intent. Cost attribution uses only
the actions spent on that lead (matched windows, never a blended average).
"""
from __future__ import annotations

from ..models import AuditRecord
from .base import Agent


class TelemetryAuditor(Agent):
    name = "Telemetry Auditor"

    def record(self, lead_id: str, approved: bool, revisions: int,
               tokens: int, duration_ms: int, cac_cents: int,
               sources: list[str], actions: list[dict],
               status: str | None = None) -> AuditRecord:
        rec = AuditRecord(
            lead_id=lead_id,
            approved=approved,
            revisions=revisions,
            tokens=tokens,
            duration_ms=duration_ms,
            cac_cents=cac_cents,
            sources=sources,
            actions=actions,
        )
        self.trace("record", lead_id=lead_id,
                   status=status or ("approved" if approved else "rejected"))
        return rec
