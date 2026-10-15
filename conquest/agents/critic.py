"""Agent 3 — Fidelity & Conflict Critic (evaluator / risk).

Three gates: (a) no-hype, (b) claims must be backed by the sweep (revenue − COGS
vs the R83/month coupon obligation), (c) source conflicts. Returns concrete
rewrite instructions or marks the case as escalated for unresolved conflict.
"""
from __future__ import annotations

import re

from ..models import Critique
from .base import Agent

# Speculative / hyperbolic terms the acquisition copy may NEVER use.
HYPE_TERMS = [
    "guaranteed", "guarantee", "risk-free", "riskless", "risk free",
    "can't lose", "cant lose", "no risk", "sure thing", "passive income",
    "get rich", "double your", "triple your", "10x", "100%", "to the moon",
    "insane", "explosive", "unstoppable", "guaranteed returns",
]

REQUIRED_DISCLOSURE = "not a deposit"

# Safe negations that mention a hype word but are actually reassuring. These are
# excised before scanning so "is not guaranteed" is not misread as "guaranteed".
SAFE_NEGATIONS = [
    r"not\s+guaranteed", r"non-?guaranteed", r"not\s+a\s+guarantee",
    r"no\s+guarantee", r"not\s+risk-?free",
]


class FidelityCritic(Agent):
    name = "Fidelity & Conflict Critic"

    def review(self, text: str, lead_id: str | None = None, evidence: dict | None = None) -> Critique:
        low = text.lower()
        scan = low
        for pattern in SAFE_NEGATIONS:
            scan = re.sub(pattern, " ", scan)
        violations = [t for t in HYPE_TERMS if re.search(rf"\b{re.escape(t)}\b", scan)]
        if REQUIRED_DISCLOSURE not in low:
            violations.append("missing_risk_disclosure")

        escalated = False
        if evidence:
            conflict = evidence.get("disagreement")
            if conflict in ("no_live_instrument_in_region", "sweep_below_coupon_obligation", "source_unavailable"):
                escalated = True
                if conflict not in violations:
                    violations.append(conflict)

        approved = not violations and not escalated
        confidence = 0.95 if approved else max(0.05, 0.5 - 0.1 * len(violations))
        instructions = ""
        if violations and not escalated:
            instructions = (
                "Remove: " + ", ".join(violations) +
                ". Restore a fixed, non-guaranteed benefit and the risk disclosure."
            )
        if escalated and not violations:
            instructions = "Do not sell: unresolved source conflict or under-backed sweep."

        self.think(
            "critique",
            system="You are a compliance critic. Reply APPROVE or REJECT plus reasons.",
            prompt=text,
            fallback=("APPROVE" if approved else "REJECT"),
        )
        critique = Critique(
            approved=approved,
            confidence=round(confidence, 2),
            violations=violations,
            rewrite_instructions=instructions,
        )
        self.trace("review", lead_id=lead_id, approved=approved, violations=len(violations), escalated=escalated)
        return critique
