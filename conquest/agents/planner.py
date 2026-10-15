"""Agent 1 — Volume Planner (orchestrator).

Reads inbound traffic velocity and the live counter delta, then sets the pacing
(number of leads to process this tick) and delegates each lead to the Closer.
It also decides whether a lead is worth spending a revision budget on.
"""
from __future__ import annotations

from .base import Agent


class VolumePlanner(Agent):
    name = "Volume Planner"

    def plan(self, velocity: int, counter_delta: int, batch_size: int) -> dict:
        """Return a bounded pacing plan. Never unbounded: capped at the batch."""
        pressure = max(0, velocity + counter_delta)
        if pressure >= 40:
            pace, depth = "high", min(batch_size, 6)
        elif pressure >= 15:
            pace, depth = "steady", min(batch_size, 4)
        else:
            pace, depth = "calm", min(batch_size, 2)

        fallback = f"pace={pace};depth={depth};budget={depth}"
        self.think(
            "plan",
            system="You are a traffic pacing orchestrator. Output a one-line plan.",
            prompt=f"velocity={velocity} counter_delta={counter_delta} batch={batch_size}",
            fallback=fallback,
        )
        plan = {"pace": pace, "depth": depth, "revision_budget": depth, "pressure": pressure}
        self.trace("plan", plan=str(plan))
        return plan

    def delegate(self, lead_id: str) -> None:
        self.trace("delegate", lead_id=lead_id)
