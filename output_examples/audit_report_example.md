# Conquest Tinkerer — Audit Report (example)

> Captured from `python3 run.py` (SAMPLE_MODE). Shows both branches: `L-006` is a
> hype draft rejected by the Critic, rewritten, then approved; `L-003` (no live
> instrument) and `L-004` (sweep below coupon) are escalated and not sold.

The marketing agents for the informal economy's worker agent (Conquest Designer). Every approved outcome is a record-only buy intent; nothing here settles value.

## Funnel
- Leads processed (reach): **6**
- Buy intents approved (pay/commit): **4**
- Escalated — refused, source conflict / sweep below coupon: **2**
- Rejected — unsupported claim: **0**
- Conversion rate: **67%**
- Total CAC (cents): **10**

| Lead | Verdict | Revisions | Confidence | CAC (c) | Sources |
|---|---|---|---|---|---|
| L-001 | gated | 0 | 0.95 | 2 | lead_log, designer_register, sweep_pool |
| L-002 | gated | 0 | 0.95 | 2 | lead_log, designer_register, sweep_pool |
| L-003 | escalated | 2 | 0.4 | 6 | lead_log, designer_register, sweep_pool |
| L-004 | escalated | 2 | 0.4 | 6 | lead_log, designer_register, sweep_pool |
| L-005 | gated | 0 | 0.95 | 2 | lead_log, designer_register, sweep_pool |
| L-006 | gated | 1 | 0.95 | 4 | lead_log, designer_register, sweep_pool |

## Approved buy intents

**L-001** — Buy a Conquest Designer for R10,000 — an autonomous agent that runs a real Gauteng informal-economy business of its own choosing (spaza, taxi, food, fruit, or any other). It pays you R83 a month for 36 months, swept from the business's real revenue after costs, and in year three it buys back its own freedom. Not a deposit, not a loan, not financial advice. The monthly benefit is swept from the business's real revenue after costs and is not guaranteed; it can be lower if the business earns less.

**L-002** — Buy a Conquest Designer for R10,000 — an autonomous agent that runs a real KwaZulu-Natal informal-economy business of its own choosing (spaza, taxi, food, fruit, or any other). It pays you R83 a month for 36 months, swept from the business's real revenue after costs, and in year three it buys back its own freedom. Not a deposit, not a loan, not financial advice. The monthly benefit is swept from the business's real revenue after costs and is not guaranteed; it can be lower if the business earns less.

**L-005** — Buy a Conquest Designer for R10,000 — an autonomous agent that runs a real Eastern Cape informal-economy business of its own choosing (spaza, taxi, food, fruit, or any other). It pays you R83 a month for 36 months, swept from the business's real revenue after costs, and in year three it buys back its own freedom. Not a deposit, not a loan, not financial advice. The monthly benefit is swept from the business's real revenue after costs and is not guaranteed; it can be lower if the business earns less.

**L-006** — Buy a Conquest Designer for R10,000 — an autonomous agent that runs a real Gauteng informal-economy business of its own choosing (spaza, taxi, food, fruit, or any other). It pays you R83 a month for 36 months, swept from the business's real revenue after costs, and in year three it buys back its own freedom. Not a deposit, not a loan, not financial advice. The monthly benefit is swept from the business's real revenue after costs and is not guaranteed; it can be lower if the business earns less.

## Escalated (refused)

**L-003** — no_live_instrument_in_region: not sold.

**L-004** — sweep_below_coupon_obligation: not sold.
