#!/usr/bin/env python3
"""Entry point. Runs the full agent pipeline end to end.

  python run.py                 # SAMPLE_MODE offline, no setup, deterministic
  python run.py --input FILE    # run a specific lead batch
  SAMPLE_MODE=false python run.py   # talk to live Zetaris / Meterless / NVIDIA

Outputs: an audit report to output_examples/audit_report.md, a trace to
logs/trace-<run_id>.jsonl, and gated_intent rows to logs/ledger.jsonl.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone

from conquest.config import SAMPLE_DIR, OUT_DIR, load_config
from conquest.log import Tracer
from conquest.models import Lead
from conquest.orchestrator import Orchestrator


def load_leads(path: str) -> tuple[list[Lead], int, int]:
    data = json.loads(open(path, encoding="utf-8").read())
    leads = [Lead(**x) for x in data.get("leads", [])]
    return leads, int(data.get("velocity", 0)), int(data.get("counter_delta", 0))


def render_report(run_id: str, records: list[dict]) -> str:
    approved = [r for r in records if r["intent"]["status"] == "gated"]
    escalated = [r for r in records if r["intent"]["status"] == "escalated"]
    rejected = [r for r in records if r["intent"]["status"] not in ("gated", "escalated")]
    total_cac = sum(r["audit"]["cac_cents"] for r in approved)
    lines = [
        f"# Conquest Tinkerer — Audit Report ({run_id})",
        "",
        "The marketing agents for the informal economy's worker agent (Conquest "
        "Designer). Every approved outcome is a record-only buy intent; nothing "
        "here settles value.",
        "",
        "## Funnel",
        f"- Leads processed (reach): **{len(records)}**",
        f"- Buy intents approved (pay/commit): **{len(approved)}**",
        f"- Escalated — refused, source conflict / sweep below coupon: **{len(escalated)}**",
        f"- Rejected — unsupported claim: **{len(rejected)}**",
        f"- Conversion rate: **{round(100 * len(approved) / len(records)) if records else 0}%**",
        f"- Total CAC (cents): **{total_cac}**",
        "",
        "| Lead | Verdict | Revisions | Confidence | CAC (c) | Sources |",
        "|---|---|---|---|---|---|",
    ]
    for r in records:
        a, i = r["audit"], r["intent"]
        lines.append(
            f"| {a['lead_id']} | {i['status']} | {a['revisions']} | "
            f"{i['confidence']} | {a['cac_cents']} | {', '.join(a['sources'])} |"
        )
    lines += ["", "## Approved buy intents", ""]
    for r in approved:
        lines += [f"**{r['intent']['lead_id']}** — {r['intent']['message']}", ""]
    if escalated:
        lines += ["## Escalated (refused)", ""]
        for r in escalated:
            reason = r["intent"]["evidence"].get("disagreement") or "unsupported"
            lines += [f"**{r['intent']['lead_id']}** — {reason}: not sold.", ""]
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default=str(SAMPLE_DIR / "leads_sample.json"))
    args = ap.parse_args()

    cfg = load_config()
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    mode = "SAMPLE" if cfg.sample_mode else "LIVE"
    print(f"Conquest Tinkerer — run {run_id} ({mode} mode)")

    leads, velocity, delta = load_leads(args.input)
    tracer = Tracer(run_id)
    try:
        orch = Orchestrator(cfg, tracer)
        records = orch.run(leads, velocity, delta)
    finally:
        tracer.close()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    report = render_report(run_id, records)
    (OUT_DIR / "audit_report.md").write_text(report, encoding="utf-8")
    print(f"\nWrote {OUT_DIR / 'audit_report.md'}")
    print(f"Trace: logs/trace-{run_id}.jsonl  •  Ledger: logs/ledger.jsonl")
    return 0


if __name__ == "__main__":
    sys.exit(main())
