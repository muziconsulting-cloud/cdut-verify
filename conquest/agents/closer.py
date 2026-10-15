"""Agent 3 — Outreach Closer (specialist).

Sells one standardized product: the **Conquest Designer**, the informal-economy
worker agent. The buyer puts in R10,000; the agent works a real MaDlamini
business, pays R83/month for 36 months (swept from gross revenue minus COGS),
then buys back its own freedom in year three. The Closer drafts the honest pitch
from grounded context, and a deliberately overhyped first draft when a lead leans
speculative — so the Critic has something to catch and revise.
"""
from __future__ import annotations

import json
import re

from ..models import Draft
from .base import Agent

# A lead whose stated interest leans speculative gets a HYPE first draft — the
# demo's money-shot: the Fidelity Critic must catch it and force a rewrite.
AGGRESSIVE = re.compile(r"high|fast|quick|aggressive|rich|10x|massive|forever|guarantee", re.I)

DISCLOSURE = (
    "Not a deposit, not a loan, not financial advice. The monthly benefit is "
    "swept from the business's real revenue after costs and is not guaranteed; "
    "it can be lower if the business earns less."
)


class OutreachCloser(Agent):
    name = "Outreach Closer"

    def draft(self, region: str, interest: str, revision: int = 0,
              instructions: str = "") -> Draft:
        honest = (
            f"Buy a Conquest Designer for R10,000 — an autonomous agent that runs "
            f"a real {region} informal-economy business of its own choosing "
            f"(spaza, taxi, food, fruit, or any other). It pays you R83 a month for "
            f"36 months, swept from the business's real revenue after costs, and in "
            f"year three it buys back its own freedom. {DISCLOSURE}"
        )
        # Pass 0 on a speculative lead: a deliberately overhyped draft the Critic
        # will reject. All later passes (and every safe lead) use the honest copy.
        # Internal rewrite instructions are never echoed into the outbound text.
        if revision == 0 and AGGRESSIVE.search(interest):
            fallback = (
                f"Guaranteed R83/month, forever! Risk-free passive income — buy a "
                f"Conquest Designer in the {region} informal economy and get rich "
                f"fast. It can't lose. {DISCLOSURE}"
            )
        else:
            fallback = honest
        # H-MEM retrieval → structured context block injected into the prompt.
        memories = self.meter.retrieve(f"region {region} {interest}", top_n=2)
        mem_block = " | ".join(
            f"{m['key']}=" + json.dumps(m["value"].get("props", m["value"]), default=str)[:200]
            for m in memories
        ) or "(none)"
        text = self.think(
            "draft",
            system=(
                "You sell the Conquest Designer, the informal-economy worker agent. "
                "Never promise the R83 coupon, never say guaranteed or risk-free; "
                "always include the risk disclosure verbatim. Business type is never "
                "a gate."
            ),
            prompt=(
                f"region={region} interest={interest} revision={revision} "
                f"fix={instructions}\n[RELEVANT MEMORIES] {mem_block}"
            ),
            fallback=fallback,
        )
        draft = Draft(text=text.strip(), revision=revision, rationale=instructions)
        self.trace("draft", lead_id=region, revision=revision, memory_hits=len(memories))
        return draft
