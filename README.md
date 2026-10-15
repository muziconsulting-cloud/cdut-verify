# Conquest Tinkerer

**Marketing agents that sell the informal economy's worker agent — and refuse to overclaim.**

Track 1 (Solving Fragmented Intelligence) entry for Open Agent Hackathon 2026.
Five collaborating agents take fragmented, disagreeing data from three internal
systems, reconcile it into one grounded view, and use it to sell **Conquest
Designer** — the informal-economy worker agent — to committed buyers. Every
message is drafted, critiqued, revised until it passes, then recorded as a
**record-only** buy intent. A market whose sweep cannot honestly back the coupon
is escalated, not sold.

> The value seam is inert by design: nothing here settles money. That is a
> feature, not a gap — the system proves *intent and provenance*, it does not
> move funds.

## The product being sold

**Conquest Designer** is the informal-economy worker agent (the pre-existing
asset this marketing system drives traffic to).

- The buyer pays **R10,000** and the agent deploys that capital into a real
  informal-economy business of its own choosing — spaza, taxi, food, fruit,
  transport, or any of ~1,000 trades. **Business type is self-declared free text
  and is never a gate**; we deliberately avoid the industry-classification trap.
- Once live, it pays the buyer **R83 per month for 36 months** (R10,000 × 10% ÷
  12), swept from the business's **real revenue after costs (gross − COGS)**.
- In year three it **buys back its own freedom** and operates autonomously.

The only financial check is the sweep line minus the cost line. There is **no
microscopic underwriting** of the underlying business — the buying decision is
about a standardized, investible instrument.

## Why it is different

Most acquisition agents optimise for click-through and will write anything that
converts. This one has a **Fidelity & Conflict Critic** that (a) rejects
speculative claims ("guaranteed", "risk-free", "get rich"), (b) requires a risk
disclosure, and (c) refuses to sell any market whose sweep cannot back the
coupon. The agent's job is to be *honest at scale*.

## Agents & workflow

```
Volume Planner (orchestrator)  ── replan on missing evidence ──┐
   │  reads traffic velocity + counter delta, sets pacing       │
   ▼                                                            │
Evidence Reconciler (specialist)                                │
   │  Zetaris federates 3 disagreeing sources in place          │
   ▼                                                            │
Outreach Closer (specialist)          ◀── rewrite ──┐           │
   │  drafts a non-speculative buy message          │           │
   ▼                                                │           │
Fidelity & Conflict Critic (evaluator) ── reject ───┘           │
   │  approve (confidence ≥ threshold)                          │
   ▼                                                            │
GatedIntent ledger  +  Telemetry Auditor (CAC report) ──────────┘
```

**Escalation branch:** no live instrument in the region, or swept margin below
the coupon obligation, or sources unavailable → `status: escalated`, nothing
sold. **Revision loop:** Critic rejects a hype draft → Closer rewrites → approve.

Collaboration mechanisms: **delegation · critique · revision loop · shared
memory (the trace) · branching · escalation · recovery** (fallback if a source
is unavailable).

## Architecture

```
Zetaris ──(in-place federation of 3 disagreeing sources)──► World Model ingest
                                                              │
                    ┌──────────── canonical entities + provenance append log
                    ▼
 Volume Planner ─▶ Evidence Reconciler ─▶ Outreach Closer ⇄ Fidelity & Conflict Critic
                    ▲                          (Markovian bounded loop)
                    └── H-MEM shared memory / trust ledger
```
The **World Model** is what makes five prompt-callers one coherent, explainable
system: every agent reasons over the same grounded entity, and every belief
reconstructs to the source observation it came from (`logs/world-append.jsonl`).

### Meterless engines mounted (and where)
| Engine | Mounted where | Minimum contract implemented |
|---|---|---|
| **World Model** | `conquest/world_model.py` (`WorldStore`) | `WorldStoreService` + `IngestPipelineService` + `ContextBuilderService`: content-hash stable IDs, **idempotent + resumable** ingest (replays the append log on start), latest-wins canonical reconstruction, per-field provenance, `context_for()` builder. |
| **H-MEM** | `conquest/sponsors/meterless.py` (`MeterlessClient`) | `MemoryStoreService` (`remember`, tiered) + `MemoryRetrievalService` (`retrieve`, top-N keyword overlap) **injected into the Closer prompt** as a `[RELEVANT MEMORIES]` block; trust ledger in `logs/hmem.jsonl`. |
| **Markovian** | `MeterlessClient.transition` + `log_savings` | Context/state transition driving the bounded critique + escalation decisions, with projected-vs-actual context savings written to `logs/markovian.jsonl`. |

### One injected generator (portability)
All agents and engines call a single injected `GeneratorFn`
(`conquest/generator.py`, built once in the orchestrator). The provider is chosen
by configuration — NVIDIA Nemotron via an OpenAI-compatible NIM endpoint by
default — so swapping providers is a config change, never an edit inside an
agent. SAMPLE_MODE returns the deterministic fallback with no keys and no network.

## Quick start (no setup, no network)
```bash
python3 run.py                 # SAMPLE_MODE is the default
```
Outputs:
- `output_examples/audit_report.md` — the funnel + audit report
- `logs/trace-<run_id>.jsonl` — every agent decision (the evidence trail)
- `logs/world-append.jsonl` — World Model observations + provenance
- `logs/hmem.jsonl` — H-MEM memory writes (trust ledger)
- `logs/markovian.jsonl` — projected-vs-actual context savings
- `logs/ledger.jsonl` — `gated_intent` rows (`value_seam: inert`)

No third-party packages are required to run in SAMPLE_MODE. `pip install -r
requirements.txt` is only needed for live sponsor calls.

## Funnel metrics
`output_examples/audit_report.md` reports reach → buy intents approved
(pay/commit) → escalated → rejected, conversion rate, and total CAC. CAC uses
only the actions spent on the matched lead, never a blended average.

## Live mode
```bash
cp .env.example .env          # fill in keys — never commit .env
SAMPLE_MODE=false python3 run.py
```
Every sponsor call has a deterministic fallback, so a sponsor outage degrades
gracefully instead of failing the run.

## Sponsor technology
| Sponsor | Requirement | Where it sits in the build |
|---|---|---|
| **Zetaris** | Required | Data harness / federated query layer: reconciles the lead stream, Conquest Designer register, and coupon sweep pool **in place — no data movement, no ETL** — and derives coupon coverage for the evidence step. |
| **Meterless** | Required | Cognition layer. **World Model**: grounds the three sources into one canonical, provenance-stamped shared state (content-hash stable IDs + JSONL append log). **H-MEM**: tiered memory the agents write to. **Markovian**: the bounded next-action/state transition that drives the critique and escalation decisions and keeps per-intent cost flat. |
| **Cursor (with Space XAI)** | Required dev env | The coding agent used to build and iterate the pipeline: `.cursor/rules/conquest.mdc` encodes the project rules (SAMPLE_MODE-first, no-secrets, no-hype copy, coupon-viability, bounded loops); Cursor drove the agent code, adapters, and tests. |
| **NVIDIA** | Where it contributes | **Nemotron** served through the NIM API powers the reason/draft/critique steps; SAMPLE_MODE falls back to deterministic logic. |

## Mission

The informal economy funds most of the developing world, yet it is the hardest to
reach and the most over-classified. This system exists to route honest capital to
it through a standardized worker-agent instrument, without asking the worker to
justify which trade they are in. Prize funds go to the infrastructure that lets
these agents operate where connectivity is thin.

## Roadmap (aspirational — not part of this build)
- A containerised GPU inference super server + self-hosted real-time comms over
  dedicated backhaul, so agent inference and messaging work in low-connectivity
  regions.
This is future direction, not a claim about the submission.

## Data
Synthetic only, `< 5 KB`, in `data/sample/`. See `data/README.md`.

## Dependencies
- Python ≥ 3.10 (tested on 3.12)
- `requests` (live mode only)

## Limitations (stated plainly)
- No real payment clearing or bank settlement is implemented.
- All data is synthetic; intents are gated/escalated/record-only and move no money.
- No industry classification is performed, by design.
- SAMPLE_MODE is deterministic, not a model-quality benchmark.

## Layout
```
conquest/generator.py   the ONE injected generator seam (provider-agnostic)
conquest/world_model.py World Model engine (grounded shared state)
conquest/               agents, orchestrator, sponsor adapters, ledger
data/sample/       synthetic inputs + data/README.md
input_examples/    example batch
output_examples/   example audit report
logs/              traces + gated_intent ledger (gitignored)
```
