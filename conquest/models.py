"""Typed records passed between agents and written to the audit trail."""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any


@dataclass
class Lead:
    """One synthetic inbound investor lead."""

    lead_id: str
    channel: str
    region: str
    stated_interest: str
    traffic_score: int = 0


@dataclass
class Draft:
    """A candidate acquisition message produced by the Outreach Closer."""

    text: str
    revision: int = 0
    rationale: str = ""


@dataclass
class Critique:
    """The Fidelity Critic's verdict on a draft."""

    approved: bool
    confidence: float
    violations: list[str] = field(default_factory=list)
    rewrite_instructions: str = ""


@dataclass
class GatedIntent:
    """A record-only intent row. NEVER a settled payment (value seam is inert)."""

    intent_id: str
    lead_id: str
    status: str  # 'gated' | 'rejected'
    message: str
    evidence: dict[str, Any]
    confidence: float
    cac_cents: int


@dataclass
class AuditRecord:
    """The Telemetry Auditor's per-lead report."""

    lead_id: str
    approved: bool
    revisions: int
    tokens: int
    duration_ms: int
    cac_cents: int
    sources: list[str]
    actions: list[dict[str, Any]] = field(default_factory=list)


def to_dict(obj: Any) -> dict[str, Any]:
    return asdict(obj)
