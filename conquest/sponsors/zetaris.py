"""Zetaris — federated data virtualization.

The marketing agents must reconcile THREE sources that do not agree:
  1. the inbound lead stream      (lead_log)
  2. the Conquest Designer register (designer_register) — units live per market
  3. the coupon sweep pool         (sweep_pool) — gross revenue and COGS

Zetaris presents them as one virtual view so we do not move payloads between
systems. Live mode POSTs a query to ZETARIS_BASE_URL; SAMPLE_MODE joins the local
JSON samples and derives the ONLY financial check the model needs: whether
revenue - COGS can back the R83/month coupon on the units live.
"""
from __future__ import annotations

import json
from typing import Any

from ..config import Config, SAMPLE_DIR

# R10,000 x 10% / 12 months, in whole cents. The standardized coupon obligation.
COUPON_CENTS_PER_UNIT = 8333


class ZetarisClient:
    name = "zetaris"

    def __init__(self, cfg: Config):
        self.cfg = cfg

    def _load(self, name: str) -> list[dict[str, Any]]:
        path = SAMPLE_DIR / name
        if not path.exists():
            return []
        data = json.loads(path.read_text(encoding="utf-8"))
        # leads file is an object {velocity, counter_delta, leads:[...]}; others array.
        if isinstance(data, dict):
            return data.get("leads", [])
        return data

    def federate(self, lead_id: str) -> dict[str, Any]:
        """Return a merged, sourced view of the three sources for one lead."""
        if self.cfg.sample_mode or not self.cfg.zetaris_base_url:
            return self._federate_sample(lead_id)
        return self._federate_live(lead_id)

    # ── offline federation ────────────────────────────────────────────────────
    def _federate_sample(self, lead_id: str) -> dict[str, Any]:
        leads = self._load("leads_sample.json")
        register = self._load("designer_register_sample.json")
        sweep = self._load("sweep_pool_sample.json")

        lead = next((x for x in leads if x.get("lead_id") == lead_id), None) or {}
        region = lead.get("region")
        market = next((x for x in register if x.get("region") == region), {})
        pool = next((x for x in sweep if x.get("region") == region), {})

        units = int(market.get("units_live", 0) or 0)
        revenue = int(pool.get("gross_revenue_cents", 0) or 0)
        cogs = int(pool.get("cogs_cents", 0) or 0)
        sweepable = max(0, revenue - cogs)
        due = units * COUPON_CENTS_PER_UNIT
        coverage = round(sweepable / due, 2) if due else None

        # The golden rule, as a single conflicting-source signal.
        conflict = None
        if units == 0:
            conflict = "no_live_instrument_in_region"
        elif due and sweepable < due:
            conflict = "sweep_below_coupon_obligation"

        evidence = {
            "sources": ["lead_log", "designer_register", "sweep_pool"],
            "lead": lead,
            "register": market,
            "sweep": pool,
            "coupon": {
                "per_unit_cents": COUPON_CENTS_PER_UNIT,
                "units": units,
                "due_cents": due,
                "sweepable_cents": sweepable,
                "coverage": coverage,
            },
            "disagreement": conflict,
            "federation": "zetaris(sample)" if self.cfg.sample_mode else "zetaris",
        }
        return evidence

    # ── live federation ───────────────────────────────────────────────────────
    def _federate_live(self, lead_id: str) -> dict[str, Any]:
        import requests

        resp = requests.post(
            f"{self.cfg.zetaris_base_url.rstrip('/')}/query",
            headers={"Authorization": f"Bearer {self.cfg.zetaris_api_key}"},
            json={"sql": "SELECT * FROM conquest_view WHERE lead_id = ?", "params": [lead_id]},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        data.setdefault("sources", ["lead_log", "designer_register", "sweep_pool"])
        data["federation"] = "zetaris(live)"
        return data
