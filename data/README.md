# Data

All data here is **synthetic** — no real personal or confidential information.

## Sources (three systems that disagree — the Track 1 problem)

| File | What it represents | Records |
|---|---|---|
| `sample/leads_sample.json` | Inbound buyer leads + run velocity | 6 leads |
| `sample/designer_register_sample.json` | Conquest Designer units live per market (with self-declared business type) | 5 markets |
| `sample/sweep_pool_sample.json` | The coupon sweep: gross revenue and COGS per market | 5 markets |

## The golden rule

The coupon is R83/month per unit (R10,000 × 10% ÷ 12). It is swept as **gross
revenue − COGS**. The only financial check is whether the swept margin can back
the coupon on the units live:

```
coverage = (gross_revenue_cents - cogs_cents) / (units_live * 8333)
```

- `coverage >= 1` → the market can honestly back the coupon → eligible to sell.
- `units_live == 0` → `no_live_instrument_in_region` → escalate.
- `coverage < 1` → `sweep_below_coupon_obligation` → escalate.

No microscopic underwriting of the underlying business is performed. The buying
decision is about the standardized instrument.

## Deliberate disagreement (for the demo)

| Market | units | sweep vs coupon | Outcome |
|---|---|---|---|
| Gauteng | 1840 | covered | sell (and catch a hype draft) |
| KwaZulu-Natal | 610 | covered | sell |
| Western Cape | 0 | no instrument | escalate |
| Limpopo | 95 | sweep below coupon | escalate |
| Eastern Cape | 420 | covered | sell |

## Usage note

In production these stand in for three real, *disagreeing* systems that Zetaris
federates in place: the inbound lead stream, the Conquest Designer register, and
the coupon sweep pool.

## Subset & size

Deliberately tiny (< 5 KB total). `SAMPLE_MODE=true` is the default, so the
pipeline runs with zero network access.

## Limitations

Synthetic values; not investment data; not production figures.
