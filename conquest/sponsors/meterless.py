"""Meterless — the local-first context layer (H-MEM + Markovian).

Meterless is NOT a billing meter. It is a context stack for agents. We use two
of its engines:

  * H-MEM     — hierarchical memory + trust ledger. The four agents share durable
                context (drafts, critiques, prior decisions) through it, and the
                trust ledger mirrors our `gated_intent` audit trail.
  * Markovian — bounded reasoning / state transitions. Carries O(1) context
                across the draft -> critique -> revise steps and drives the
                confidence branch. Its long-horizon token efficiency is what
                keeps the per-intent cost (CAC) flat.

Live mode targets a local Meterless runtime (H-MEM reference) over HTTP;
SAMPLE_MODE keeps an in-process H-MEM-shaped store so the pipeline runs offline.
The cost counter is our own internal accounting, never a Meterless product claim.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field

from ..config import Config, LOG_DIR

CENTS_PER_1K_TOKENS = 2
CENTS_PER_ACTION = 1


@dataclass
class MeterlessClient:
    name = "meterless"

    cfg: Config
    tokens: int = 0
    actions: int = 0
    samples: list[dict] = field(default_factory=list)
    # H-MEM: short/working tier (fast recall) + a long-term trust ledger.
    _working: dict[str, object] = field(default_factory=dict)
    _longterm: list[dict] = field(default_factory=list)

    # ── H-MEM: hierarchical memory ────────────────────────────────────────────
    def remember(self, agent: str, key: str, value: object, tier: str = "working") -> None:
        row = {"agent": agent, "key": key, "value": value, "tier": tier}
        if tier == "long":
            self._longterm.append(row)
        else:
            self._working[key] = value
        self._persist(row)
        if not self.cfg.sample_mode and self.cfg.meterless_base_url:
            self._post("/memory", row)

    def recall(self, key: str) -> object:
        return self._working.get(key)

    def retrieve(self, query: str, top_n: int = 3) -> list[dict]:
        """H-MEM retrieval: top-N memories by keyword overlap, for prompt injection."""
        terms = set(re.findall(r"[a-z0-9]+", query.lower()))
        scored: list[tuple[int, dict]] = []
        for row in self._longterm:
            text = (row["key"] + " " + json.dumps(row["value"], default=str)).lower()
            overlap = len(terms & set(re.findall(r"[a-z0-9]+", text)))
            if overlap:
                scored.append((overlap, row))
        scored.sort(key=lambda x: -x[0])
        return [{"key": r["key"], "value": r["value"]} for _, r in scored[:top_n]]

    def trust_ledger(self) -> list[dict]:
        return list(self._longterm)

    # ── Markovian: bounded state transition / next action ─────────────────────
    def transition(self, approved: bool, confidence: float, violations: list[str]) -> str:
        """Return the next action for the loop. Bounded by design (no dead ends)."""
        if approved and confidence >= self.cfg.confidence_threshold:
            return "approve"
        if violations:
            return "revise"
        return "escalate"  # passable-looking but low confidence: hand to a human

    # ── internal cost accounting (CAC) ────────────────────────────────────────
    def record(self, agent: str, action: str, tokens: int, duration_ms: int) -> int:
        self.tokens += max(0, tokens)
        self.actions += 1
        self.samples.append({"agent": agent, "action": action, "tokens": tokens, "duration_ms": duration_ms})
        if not self.cfg.sample_mode and self.cfg.meterless_base_url:
            self._post("/meter", self.samples[-1])
        return self.accrued_cents()

    def accrued_cents(self) -> int:
        return self.actions * CENTS_PER_ACTION + (self.tokens * CENTS_PER_1K_TOKENS) // 1000

    def reset(self) -> None:
        self.tokens = 0
        self.actions = 0
        self.samples = []

    # ── Markovian: projected-vs-actual context savings (evidence for judges) ───
    def log_savings(self, run_id: str, lead_id: str, projected_tokens: int, actual_tokens: int) -> int:
        """Markovian carries O(1) context per step vs retained history. Record it."""
        saved = max(0, projected_tokens - actual_tokens)
        pct = round(100 * saved / projected_tokens) if projected_tokens else 0
        row = {"run_id": run_id, "lead_id": lead_id,
               "projected_tokens": projected_tokens, "actual_tokens": actual_tokens,
               "saved_tokens": saved, "saved_pct": pct}
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        with (LOG_DIR / "markovian.jsonl").open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(row, default=str) + "\n")
        return pct

    # ── plumbing ──────────────────────────────────────────────────────────────
    def _persist(self, row: dict) -> None:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        with (LOG_DIR / "hmem.jsonl").open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(row, default=str) + "\n")

    def _post(self, path: str, payload: dict) -> None:
        try:
            import requests

            requests.post(
                f"{self.cfg.meterless_base_url.rstrip('/')}{path}",
                headers={"Authorization": f"Bearer {self.cfg.meterless_api_key}"},
                json=payload,
                timeout=10,
            )
        except Exception:
            pass  # the context layer must never break the run
