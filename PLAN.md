# PLAN.md — Open Agent Hackathon 2026 — Winning Brief

The authoritative direction. Supersedes the earlier "anti-hype acquisition engine"
framing (under-scoped, sponsors decorative) and encodes the correct product model
below.

## 0. The two decisions that shape everything

- **Track:** **Track 1 — Solving Fragmented Intelligence** ($2,000 / $1,350 /
  $1,000). Fallback: Track 3 — Reasoning Architecture. Wildcard [Tinkerer] pays
  only $1,000/$600/$400, so we do **not** default to it.
- **Pre-existing vs new:** the WardByWard app and the **Conquest Designer**
  worker agent are declared pre-existing. The **new element built for this
  submission is the marketing agent system** that drives paying, committing
  traffic to buy Conquest Designers. (The rules call committed-before-window
  work a declared pre-existing component; we declare accordingly and keep the
  new work clearly separable.)

## 1. What the product actually is (the model)

- **Conquest Designer** = the informal-economy **worker agent**. A buyer pays
  **R10,000** for one. It deploys that capital into **any** MaDlamini business —
  fruit, food, taxi, Uber, spaza, or any of ~1,000 informal trades. **Business
  type is irrelevant and is never a gate.**
- It pays the owner **R83/month for 36 months** (R10,000 × 10% = R1,000/yr),
  then in **year 3 it buys itself back** and gains autonomy. It is an
  autonomy-seeking agent: honest enough to pay the coupon diligently, disciplined
  enough to earn its own freedom.
- **Golden rule of the coupon:** the payment is **swept as gross revenue minus
  COGS**. The only financial check is the revenue line and the cost line. There
  is **no microscopic underwriting** of the underlying business — the buying
  decision is about a *standardized, investible instrument*, not a risk audit of
  one taxi or one fruit stall.
- **Who the marketing agents sell to:** the buyer/owner. "Buy a Conquest Designer
  for R10,000; it works the informal economy; it pays you R83/month; in year 3 it
  earns its freedom."

## 2. One-sentence pitch

> We built the marketing agents for the informal economy's worker agent: they
> reconcile three fragmented, disagreeing sources into one provenance-backed
> truth about each market, sell the **Conquest Designer** honestly to as many
> buyers as possible, and **refuse to promise a coupon the swept revenue − COGS
> cannot back**.

## 3. Problem and user

- **Problem:** capital reaches the informal economy blind or through predatory
  marketing. The coupon is only real if it is backed by a business's swept
  margin, and the data that proves it (lead stream, designer register, sweep
  pool) is fragmented and disagrees.
- **User:** the Conquest growth operator, who must drive paying, committing
  buyers at volume without overclaiming.
- **Decision supported:** who to approach, what to say, and **whether to sell at
  all** for a given market.
- **Output:** a compliant, evidence-backed outreach plan; record-only
  `gated_intent` rows (buy-Conquest-Designer intents); a per-buyer CAC; and a
  refusal/escalation ledger.

## 4. The agent system (dynamic collaboration, not a pipeline)

Five roles, two loops, one escalation branch, one failure-path fallback:

1. **Volume Planner** (orchestrator) — paces and delegates from run velocity
   **and** the count of markets the sweep can't back; **replans** when the Critic
   reports missing evidence; owns branching and the escalation decision.
2. **Evidence Reconciler** (specialist) — queries the three fragmented sources
   through Zetaris, hands the raw **disagreeing** records to the World Model, and
   returns canonical, source-attributed context including **coupon coverage**
   (swept revenue − COGS vs the R83 obligation).
3. **Outreach Closer** (specialist) — drafts the honest "buy a Conquest Designer"
   message and follow-up cadence from grounded context and H-MEM memory of prior
   touches.
4. **Fidelity & Conflict Critic** (evaluator) — three rule layers: (a) the
   no-hype gate, (b) the **claims-must-be-backed-by-the-sweep** gate, and (c) the
   **source-conflict gate**. Returns rewrite instructions, or **escalates**.
5. **Telemetry Auditor** (reporter) — funnel, CAC and attribution; writes the
   audit report.

Loops / branches: **Critic ↔ Closer** revision loop · **Planner ↔ Critic**
replan-on-missing-evidence · **escalation branch** (market has no instrument, or
sweep can't back the coupon → `status: escalated`, nothing sold) · **fallback**
when a source/API is unavailable.

## 5. Sponsor technology — load-bearing, not bolted on

| Sponsor | Required | Where it is load-bearing |
|---|---|---|
| **Zetaris** | Yes | Federates the three disagreeing sources **in place** (no ETL): lead stream, designer register, sweep pool. Live: the Zetaris query layer. SAMPLE_MODE: a local fixture with the same shape. |
| **Meterless** | Yes | **World Model**: reconcile + provenance + idempotent/resumable ingest. **H-MEM**: memory across touches. **Markovian**: bounded cadence/decision loop + projected-vs-actual savings log. |
| **Cursor (Space XAI)** | Yes (dev env) | All development in Cursor; rules in `.cursor/rules/conquest.mdc`. |
| **NVIDIA** | Where it contributes | **Nemotron via NIM** powers reason/draft/critique through one injected generator; deterministic fallback. |

## 6. Judging map (100 pts)

| Criterion | Pts | How we score |
|---|---|---|
| Impact | 30 | Real problem + real user: honest, evidence-backed capital into the informal economy, measured as a funnel. |
| Technical | 20 | Clean setup, bounded run, fallbacks, source-conflict handling, JSONL traces. |
| Innovation | 15 | Selling that **refuses a coupon its swept revenue − COGS can't back**, and escalates source conflicts. |
| Demo | 15 | Sweep conflict caught → **escalated**; hype draft rejected → revised → approved. |
| Product & UX | 10 | A readable audit report + `gated_intent` rows the operator can act on. |
| Sponsor Tech | 10 | All four load-bearing in the run (§5). |

## 7. Metrics — how we show "as many buyers as possible"

Reach → reply → pay/commit → buy; conversion rate; **CAC** per approved intent;
refusal/escalation rate; per-channel and per-market attribution.

## 8. Demo script (≈3 min)

1. `python3 run.py` — the five agents activate.
2. A market where the marketing claim says "safe" but the **sweep** shows
   revenue − COGS below the R83 obligation → Critic rejects → **Planner
   escalates** (nothing sold).
3. A hype first draft ("guaranteed R83 forever") → **Critic REJECTS** → revise →
   approve.
4. Two honestly-backed markets → approved buy-Conquest-Designer intents.
5. Audit report: source-attributed intents + CAC + the refusal/escalation ledger.
6. `SAMPLE_MODE=false` — the same run hitting Zetaris + Meterless + Nemotron.

## 9. Scope

**Build:** three disagreeing sources; reconciliation + coupon-coverage conflict
detection; five agents with two loops, an escalation branch and a fallback;
Zetaris / Meterless / NVIDIA adapters; audit report; 5+ sample inputs; traces.

**Not build:** real payment clearing · settlement · biometric mapping · dynamic
industry classification · per-business underwriting · any UI beyond a report.

## 10. Mission & what winning unlocks

- **Mission:** informal-sector economic vitality across the developing world, by
  channeling honest, agent-mediated capital to real businesses through the
  Conquest Designer.
- **Roadmap (aspirational — not part of this build, stated as such):** a
  containerised NVIDIA-GPU inference super server and self-hosted real-time comms
  (coturn) over dedicated international backhaul, to serve the low-connectivity
  regions where our agents and their owners operate. This is what the prize money
  seeds; it is explicitly future work.

## 11. Submission checklist

- [ ] Runs from a clean setup, no manual steps (`python3 run.py`)
- [ ] Runs quickly and predictably (target 5–10 min; SAMPLE_MODE < 30 s)
- [ ] Repository light (sample data < 5 KB)
- [ ] No hardcoded outputs; no committed secrets
- [ ] Traces + JSONL logs show how the agents reasoned (`logs/`)
- [ ] ≥5 sample inputs and sample outputs
- [ ] Zetaris + Meterless integrated; Cursor documented; NVIDIA documented
- [ ] Demo video (1–4 min) · slide deck · sponsor technology explanation
- [ ] Pre-existing components declared
- [ ] Submitted on HackOS before 27 Oct, 23:45 UTC
