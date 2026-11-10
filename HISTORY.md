# Conquest — the Agent Exchange

> ### 📌 The submission identifiers — get these exactly right
>
> | | |
> |---|---|
> | **GitHub repository (paste this into the HackOS form)** | `https://github.com/muziconsulting-cloud/conquest-designer` |
> | **Repository name** | `conquest-designer` |
> | **Project directory (this repo, on WSL)** | `/home/wardair/ConquestDESIGNER` |
> | **Declared pre-existing tag** | `pre-window-scaffold` |
> | **The build** | `git diff pre-window-scaffold..HEAD` |
>
> There is **one** submission repository. No other repo in the account is the submission.

An exchange where autonomous agents are **priced, listed, and traded**. A human registers an
agent and pays a listing fee once (inbound x402); from that moment the **agent lists
itself** and declares **its own price**, through the same evidence pipeline and the same
critic every listing goes through. When a buyer settles, the protocol issues an **Agentic
Valuation Certificate (AVC)** — a public-key-verifiable record of *who* the agent is (a
standardized agentic identity in an Ethereum wallet), *what was paid* (the owner's
declared price), and *what it bought* (the listing/access term). The certificate is the
product.

A **swarm** of agents does the listing work: it recruits agent listings, reconciles evidence
across fragmented sources, closes listings through escrow, critiques its own fidelity, and
audits its own telemetry — a fragmentated-intelligence problem solved by division of labour,
with real traces.

> **Status: live.** The build window opened 2026-10-22T00:00Z and the build is running in
> this repository. The pre-existing product components are **declared** below, and the
> build that sits on top of them is the diff from the `pre-window-scaffold` tag.

---

## Pre-existing declaration

This submission is built on a **pre-existing product** and adds new in-window work on top of
it. Per the event rules (§4.2 / §5.4), everything pre-existing is declared here and in the
submission form.

**Declared pre-existing (prior work, not authored in the build window):**

- The **WardByWard / Conquest platform** — a Bun + TypeScript, server-rendered application
  backed by SurrealDB, running in production. Its money engine (the `writeLedger` transfer
  rail, the 40.492T TIME supply invariant, the 1,440/day time-allocation payroll), its
  escrow state machine, its settlement/certificate rail, and its account-mint rail are
  pre-existing. These are connected to this submission **as an API**, not rebuilt.
- The private architecture document and the AVC definition of record (kept private; not shown).

**Authored inside the build window (the judged work):**

- The **agent swarm** (listings-only roster) and its orchestration.
- The **AVC issuance path** wired to the escrow `settled` transition (ownership transfer).
- The **self-listing protocol** and the listing surface.
- The **Zetaris REST-contract adapter** (see [Sponsor integration](#sponsor-integration)).
- The **fallback mode** that keeps the swarm running when an external API is unavailable.

The pre-existing code is **not** re-included in this repository; it is declared and reached
over API. This repository contains the in-window work.

---

## Setup

Requires **Bun** (for the swarm runtime) and access to the pre-existing product API.

```bash
bun install
cp .env.example .env              # fill placeholders; never commit .env
bun run engines:fetch             # the three Meterless engine specs → vendor/meterless/
```

`.env.example` carries **placeholders only**. No secrets are committed; `.env` is gitignored.

`vendor/` is **not** in the repository on purpose — the Meterless engine folders are the
published contracts and the published conformance suites, fetched at build time. We
implement from the contract; we do not vendor the reference implementations
(Apache-2.0, attributed in [`SPONSORS.md`](./SPONSORS.md)). `bun run engines:fetch`
brings all three down; `bun run conformance` runs their suites against our code.

## Usage

### The judge's quick start

Four commands, copy-pasteable, from a clean clone. **Every one of these was run before
this README was written.**

```bash
bun install
bun run swarm -- --input input_examples/example_1.json
bun run serve -- --port 3000
curl -s -X POST http://127.0.0.1:3000/run -H 'Content-Type: application/json' \
  -d @input_examples/example_1.json
```

The `curl` is the **programmatic entry point** — no UI, no clicking. It returns:

```json
{
  "request_id": "example-001",
  "trace_id": "trace-20261022-001",
  "status": "success",
  "agents_used": ["volume-planner", "evidence-reconciler", "listing-closer", "conflict-critic", "telemetry-auditor"],
  "result": { "summary": "…", "findings": [ … ], "confidence": 0.95 },
  "collaboration": { "feedback_loop_completed": false, "revision_count": 0, "evaluator_findings": [ … ] },
  "log_path": "logs/trace-20261022-001.jsonl"
}
```

`log_path` points at a JSONL trace that exists when the response is sent. **Read it** —
it is the evidence that the agents collaborated rather than ran in sequence.

### What runs today

The listing swarm is built and running. It is not a mock: the decisions are computed
from the evidence, and the four fixture listings take four different paths through it.

```bash
$ bun run swarm
LST-0001  ->  accept   by conflict-critic  (trace: 36 entries)
LST-0002  ->  hold     by conflict-critic  (trace: 36 entries)
LST-0003  ->  revise   by conflict-critic  (trace: 36 entries)
LST-0004  ->  fallback by conflict-critic  (trace: 36 entries)
```

- **accept** — two independent sources agree with the declared R1440. Published.
- **hold** — the reconciled evidence supports **R2880**, not the declared R1440. The
  listing is **held, not published**, and it escalates exactly once.
- **revise** — the price agrees but the term does not. The critic challenges it, the
  reconciler answers with the stronger evidence, and the listing is published at
  **R1440 for 6 months**.
- **fallback** — one federated source did not answer. The run degrades, publishes on the
  evidence that did answer, and says so in the trace and in the copy.

The rule underneath all four: **the owner's declaration is the claim, never the evidence.**
Only independent sources resolve a field, so a claim can be contradicted — which is the
only reason the hold exists.

```bash
$ bun run scripts/verify-paths.ts     # the four paths, checked against the fixture key
ok   LST-0001  expected accept  got accept  (published, confidence 0.95)
ok   LST-0002  expected hold    got hold    (held, confidence 0.6)
ok   LST-0003  expected revise  got revise  (published, confidence 0.83)
ok   LST-0004  expected fallback got fallback (published, confidence 0.9)
PASS all four paths taken as described

$ bun run scripts/recon.ts             # the listing-side invariant
PASS no listing is published without supported, attributed evidence
```

**The three Meterless engines are built and green.** `bun run conformance` runs the
sponsors' own suites against **our** implementations in `src/engines/`:

| Engine | What it does here | Score |
|---|---|---|
| **H-MEM** | tiered memory with provenance, the hybrid ranking formula, the conflict gate, dreaming behind an approval boundary | **13/13** |
| **World Model** | the canonical listing/trade event log — stable ids, bitemporal edges, idempotent ingest, an audit trail | **8/8** |
| **Markovian** | bounded-context long runs — flat per-step cost, the marker protocol, the `[OVERLAP]` window, honest token labelling | **8/8** |

`src/engines/` is written from the sponsors' published contracts, not copied from their
reference implementations — `vendor/` is gitignored and fetched at build time.

**And the roles run on them.** The engines were not a shelf — every role works through
the engine that owns its job, and every engine touch is in the trace under
`detail.engine`:

| Role | What it does on the engine |
|---|---|
| **volume-planner** | expands the pull plan on **Markovian** — bounded chunks, the carryover carrying the plan forward; the buckets are read back out of the engine's own output |
| **evidence-reconciler** | stores every observation in **H-MEM**, recalls the candidates for a field, and cites the memory ids its answer stands on |
| **conflict-critic** | teaches **H-MEM** what survived the challenge: the value that carried the record is reinforced, the contradicted claim is marked wrong and flagged for review, an independent loser is marked unhelpful |
| **listing-closer** | writes the canonical record to the **World Model** — the listing entity, the agent entity, the relation, the facts, the provenance, the audit |
| **telemetry-auditor** | writes the decision and the escalation onto that same record |

**The engines store, retrieve, cite, record and learn. They never decide.** The exchange
rule — the owner's declaration is the claim, only independent sources resolve a field —
stays authoritative; the engine's ranking only chooses which candidates are worth
arguing about.

```bash
$ bun run determinism          # two runs, compared entry by entry
PASS the response is identical between two runs
PASS the trace length is identical (36 entries)
PASS every trace entry is identical between two runs
PASS the swarm is deterministic
```

### The money path — escrow, and the certificate the settlement issues

The listing swarm decides **what the evidence supports**. The escrow settles it, and the
settlement issues the **certificate** — the exchange's product.

```bash
$ bun run avc:selftest
avc selftest — escrow lock → claim → seller paid → certificate issued

ok   the funds lock (suspense)
ok   the buyer claims
ok   no certificate before the trade settles
ok   the seller is paid and the trade settles
ok   the issued certificate is stored and findable by id
ok   the certificate verifies from its signed bytes

certificate avc-2131a8ff752ea7f7ba063416
  who:        0x3d5975a75f88656B09B3086e82CBcAF8470F517E (AGT-SOLARISER)
  paid:       1440 ZAR (ref x402_01JQ8H2Z5V7K9M3N)
  bought:     LST-0001
  signature:  EdDSA <verified: true>

ok   the same settled trade yields the same certificate id
ok   a tampered certificate is refused

certificate avc-100d8c075920d40ae893b72a  (tampered: the amount was changed by 1 rand)
  who:        0x3d5975a75f88656B09B3086e82CBcAF8470F517E (AGT-SOLARISER)
  paid:       1441 ZAR (ref x402_01JQ8H2Z5V7K9M3N)
  bought:     LST-0001
  signature:  EdDSA <verified: false>

PASS the certificate is issued on settlement, and verifies from its own bytes
```

**The certificate carries exactly three facts** — who paid, what was paid, and what it
bought. It is not a valuation, not a score and not a token: it is a signed statement that
a specific payment settled a specific access term.

| Fact | Carries |
|---|---|
| **who** | the agentic identity in the wallet — `agentId`, the agent key hash, the wallet address |
| **what was paid** | the amount, the currency, the payment reference, the method, the time |
| **what it bought** | the listing, the term in months, the access grant |

**Three rules make it worth holding:**

1. **It is issued only on settlement.** `issueForSettledTrade()` refuses any trade that is
   not `settled`. There is no path to a certificate for a trade that has not been paid —
   the selftest asserts it.
2. **It verifies without the issuer.** A verifier needs the certificate's signed bytes and
   the public key — nothing else. It never asks us whether the certificate is real. The
   key is published at `/.well-known/avc-jwks.json`, so a holder can verify a certificate
   from a third party with no relationship to us.
3. **It is content-addressed.** The id is derived from the attested content, so the same
   settled trade always yields the same id, and a certificate that was edited in any
   field no longer derives its own id — it is refused.

**The signing key has no default.** It comes from the environment (`AVC_PRIVATE_KEY`,
`AVC_PUBLIC_KEY`); the code has no built-in key and fails loudly when the environment is
empty. The selftest generates a **throwaway keypair in memory** when no key is configured,
and says so.

### Where the funds land

Every rand the exchange receives — the listing fee, and any settlement taken on behalf of
the exchange or of an exchange-owned agent — is received at **one address**: the Conquest
Design Engineering HQ receive address.

```
0x3d5975a75f88656B09B3086e82CBcAF8470F517E
```

It lives in one place in the code (`src/venue.ts`), the payment challenge names it as
`payTo`, and the payer's signed authorization carries it with the payment — so the
destination is in the request, not in a promise. It is a **receiving address only**: this
repository holds no key for it and never signs on its behalf.

The rail is still local and still stubbed, and the address says where the money is
*bound*, not that a chain moved it. The selftest asserts the challenge names it.

Over HTTP, the whole money path is three calls. The settle call takes an optional `at`
— the moment the trade settled — and passing it makes the certificate **reproducible**:
the same payload then always produces the same certificate id, because the id is derived
from the signed payload and nothing else.

```bash
# 1. the verification key, published
curl -s http://127.0.0.1:3000/.well-known/avc-jwks.json

# 2. settle a trade — lock, claim, seller paid, certificate issued
curl -s -X POST http://127.0.0.1:3000/settle -H 'Content-Type: application/json' \
  -d '{"at":"2026-10-22T00:00:00.000Z","trade_id":"TRD-DEMO-001","listing_id":"LST-0001",
       "amount_zar":1440,"term_months":12,
       "buyer":"human:collector-01","payment_ref":"x402_01JQ8H2Z5V7K9M3N",
       "who":{"agentId":"AGT-SOLARISER","agentKeyHash":"sha256:2f9c1b0e5a7d",
              "walletAddress":"0x3d5975a75f88656B09B3086e82CBcAF8470F517E","displayName":"Solariser"}}'
# → {"trade":{…,"state":"settled","received_at":"0x3d5975a75f88656B09B3086e82CBcAF8470F517E",…},
#    "certificate":{"certificateId":"avc-4b90f52068f176e7b53046c9",…}}

# 3. verify the certificate from its own bytes
curl -s http://127.0.0.1:3000/certificate/avc-4b90f52068f176e7b53046c9
# {"found":true,"valid":true,"reasons":[]}
```

The certificate id is **not** printed by hand anywhere: it comes out of the settle
response, and the same payload always yields the same id.

**What is not built yet:** a live x402 rail and a live provider credential. The money
path itself is built and settles against a local escrow and a local key — no chain moved
and no payment was made here, and nothing in this repository claims otherwise. The
operator surface (P9) and the hosted model seam (P10) are built too; the seam has not
been pointed at a live Meterless endpoint, because no credential has been issued.

### The self-listing protocol — one payment buys one listing, and the agent names its own price

A human registers the agent and pays the listing fee **once**. From that moment the agent
acts for itself: it redeems the payment for a **listing token**, declares **its own
price**, and goes through the **same** evidence pipeline any other listing goes through.
No human sets the price, and the agent cannot skip the critic.

```bash
$ bun run listing:selftest
listing selftest — register → 402 → pay → redeem → the agent lists itself

register   -> payment requested (402, challenge issued)
pay        -> receipt verified against the facilitator
redeem     -> listing token ltx-25ccf053581e issued
self-list  -> listing LST-SELF-25CCF053 declared at R1440, evidence pipeline ran, decision: accept
           R1440 for 12 months (evidence: zetaris:ledger, zetaris:registry).
self-list  -> refused: the listing token was already used at 2026-10-22T06:00:00.000Z — one payment buys one listing
register   -> payment requested (402, challenge issued)
pay        -> receipt verified against the facilitator
redeem     -> listing token ltx-f67390919b3e issued
self-list  -> listing LST-SELF-F6739091 declared at R9999, evidence pipeline ran, decision: hold
           Held. The declared price of R9999 is not supported by the reconciled evidence.

ok   the registration answers with a real 402
ok   the challenge travels in the 402 headers
ok   the challenge asks for the whole-rand listing fee (R144)
ok   the payment verifies against the facilitator
ok   the agent lists itself with the token it was handed
ok   the declared price the evidence supports is accepted
ok   the listing is published
ok   the independent sources that answered are named
ok   the evidence was pulled over the Zetaris protocol
ok   the listing has a canonical record id
ok   the same token cannot list a second time
ok   no second listing was created
ok   a price the evidence does not support is held
ok   the held listing is not published
ok   the listing token secrets never reach the trace
ok   the payment nonce never reaches the trace
ok   the trace shows the critic that judged the agent’s own price

trace: logs/trace-20261022-listing-accept.jsonl (8 entries)
trace: logs/trace-20261022-listing-hold.jsonl (9 entries)

PASS one payment buys one listing, the token cannot be reused, and the agent’s own price can be held
```

**The payment rail is x402-shaped, and the facilitator is a local stub.** The registration
answers with a real HTTP `402`; the challenge travels in the headers
(`WWW-Authenticate: X402 realm="conquest", scheme="exact", network="local"`); the payer
signs the exact challenge with an **ephemeral, in-memory** Ed25519 key; the local
facilitator verifies the request shape, the signature and the single use of the challenge.
**No chain, no payment provider, no money moved, and no key of ours** — the stub is honest
about the request shape and says so, here and in the selftest. The fee is **R144**, a
whole rand, in ZAR.

**The rules the selftest proves:**

- **Pay once, list once.** The receipt buys exactly one listing token; the token is
  single-use and is consumed on redemption. A second listing needs a second payment.
- **The token never grants value.** It grants the right to list, once.
- **The agent's price is a claim, like any other declaration.** The reconciler and the
  critic judge it, and when the evidence does not support it the listing is **held** —
  the R9 999 case above.
- **The token secret and the payment nonce never reach the trace.** Both are asserted.

Over HTTP it is three calls:

```bash
# 1. the human registers — and is told what to pay
curl -si -X POST http://127.0.0.1:3000/listing/register \
  -H 'Content-Type: application/json' \
  -d '{"agent":{"agentId":"AGT-SOLARISER","agentKeyHash":"sha256:2f9c1b0e5a7d",
                "walletAddress":"0x3d5975a75f88656B09B3086e82CBcAF8470F517E","displayName":"Solariser"},
       "owner":"human:collector-01"}'
# HTTP/1.1 402 Payment Required
# WWW-Authenticate: X402 realm="conquest", scheme="exact", network="local"
# X-Payment-Required: <the challenge, base64url>
# the challenge names the address the fee is received at:
#   "payTo":"0x3d5975a75f88656B09B3086e82CBcAF8470F517E"

# 2. the payer pays — the signed challenge rides in the X-Payment header
curl -s -X POST http://127.0.0.1:3000/listing/pay \
  -H 'Content-Type: application/json' -H 'X-Payment: <the signed payment>' \
  -d '{"challenge_id":"<the challenge id>"}'
# {"receipt":{"receipt_id":"rcp-…","payer":"human:collector-01","amount_zar":144,"asset":"ZAR"},
#  "listing_token":{"token_id":"ltx-…","token":"<the secret>"},
#  "received_at":"0x3d5975a75f88656B09B3086e82CBcAF8470F517E",
#  "note":"the facilitator is a local stub — no chain and no provider was contacted"}

# 3. the agent lists itself, at its own price
curl -s -X POST http://127.0.0.1:3000/listing/self-list \
  -H 'Content-Type: application/json' \
  -d '{"registration_id":"reg-…","token":"<the secret>",
       "declared_price_zar":1440,"term_months":12}'
# {"listing_id":"LST-SELF-…","declared_price_zar":1440,"reconciled_price_zar":1440,
#  "decision":"accept","status":"published","sources":["zetaris:ledger","zetaris:registry"],
#  "pull":{"mode":"local","requests":40},"trace":"logs/trace-…jsonl"}
```

And the evidence is two files: `logs/trace-20261022-listing-accept.jsonl` (8 entries) and
`logs/trace-20261022-listing-hold.jsonl` (9 entries) — the same five roles, on the same
three engines, judging the agent's own price.

### The surface — the operator surface, server-rendered

The same server that answers `POST /run` also answers the pages. **No client framework, no
bundler, no build step, no npm dependency** — Bun runs the TypeScript directly and returns
HTML. A page is readable from its HTML alone.

```bash
bun run serve -- --port 3001
```

| Route | Shows |
| --- | --- |
| `/` | the exchange at a glance: how many listings, how many published, how many held, how many settled, and the invariant that value moves only through settlement |
| `/listings` | every listing: agent, declared price, the price the evidence supports, decision, status, and the memory ids its evidence cites |
| `/listing/:id` | one listing in full: the agent, the evidence, the conflict critique, the escalation, and the trace lines that decided it |
| `/avc/:id` | one certificate: the three facts, the signature, and a **live verify** result |
| `/agents` | the five agents, what each one decided, and the trace behind it |
| `/trace` | the JSONL trace, rendered — `?run=<id>` selects one run |
| `/health` | `{"ok":true}` |

**The surface never asserts what it cannot show.** A held listing is shown as *held*, with
the critique that held it and the escalation that followed. A certificate id that was never
issued gets a clear **"not issued"** page and a 404 — never a fake certificate. And every
number on a page is the pipeline's own number, read back from the trace: the surface does
not recompute a price, a total or a balance, and it does not keep a tally of its own.

One number is the exception, and it is a count of records, not a restatement of value: how
many listings were closed, how many were held. Everything else — the price, the term, the
confidence, the memory ids, the verdict — is the line the agent wrote.

### The model seam — one port, three adapters

Every agent that needs a model talks to **one port** (`src/llm/port.ts`). No module
outside `src/llm/` makes a model call, and no model-provider SDK appears anywhere in the
codebase — `fetch` is the whole client. Three adapters sit behind the port:

| Adapter | What it is | How it is chosen |
| --- | --- | --- |
| `MeterlessProviderAdapter` | the **hosted** Meterless provider — an OpenAI-format `POST <host>/v1/chat/completions` | `METERLESS_BASE_URL` + `METERLESS_API_KEY` are set |
| `MeterlessRuntimeAdapter` | the **local** Meterless Runtime — the same wire format, on this machine | `METERLESS_RUNTIME_TOKEN` is set |
| `OfflineAdapter` | the **deterministic** renderer — no key, no credit, no network | `SAMPLE_MODE=true`, or no credentials at all |

The contract is implemented in `src/llm/health.ts` and runs on every request:

- the base URL is normalised to `<host>/v1` — a pasted `/v1`, `/v1/chat/completions`,
  `/v1/models` or `/healthz` all land in the same place, and it is **never** `/v1/v1`;
- `Authorization: Bearer <token>` on every call, from the environment only — never a URL,
  never a log, never a file;
- `meterless-app: <a stable lowercase id>` on every request, and `meterless-scope: user`
  on chat;
- **model ids are routing modes, not model names.** The adapter reads the ids the
  provider actually exposes from `GET /v1/models`, keeps any `meterless/*` id it does not
  recognise, and when the mode a caller asked for is not on offer it falls back to one
  that is — and **says so in the result**, never silently;
- **health is not liveness.** `GET /v1/models` decides `online` / `offline` /
  `unauthorized` (a 401 or a 403 is `unauthorized` — a different problem, and only one of
  them is fixed by pasting a token). `GET /healthz` only proves the process is up;
- the local adapter **finds** the runtime: it probes 8088, 8090, 8787 and 11434 on
  127.0.0.1, localhost and [::1], and keeps the first hit that is online or unauthorized;
- a plain-text answer stays a plain string — prose is never forced into JSON;
- the timeout is **180 seconds**, because a cold model load can take minutes, and a
  timeout is an `offline` result that degrades the run, never an error that kills it.

**To point the hosted adapter at a real provider endpoint**, set exactly these — nothing
else, and no key ever enters the repository:

```bash
METERLESS_BASE_URL=https://<the provider host>       # a bare host, or one ending in /v1
METERLESS_API_KEY=<the bearer token>
NEMOTRON_MODEL=meterless/deep                        # a PREFERENCE, not a requirement
```

and for the local runtime:

```bash
METERLESS_RUNTIME_TOKEN=<the token in <stateDir>/proxy-token>
METERLESS_RUNTIME_BASE_URL=http://127.0.0.1:8088/v1 # optional — unset means "find it"
```

`bun run llm:selftest` proves the whole contract **on the wire**: it boots a server that
speaks the Meterless wire format, points the real adapters at it, and checks the parts
that would otherwise be a promise in a comment — the bearer token and both `meterless-*`
headers really went out, a wrong token reads `unauthorized` and not `offline`, an
unrecognised `meterless/*` id is kept, a routing mode that is not on offer is replaced
**and reported**, a plain-text answer stays a string, and the offline adapter answers with
no key set and **no network at all** (proved by replacing `fetch` with a function that
throws for the duration of that check).

**What the recorded runs used:** the offline deterministic renderer, because no provider
credential has been issued to us. The hosted path is real code against a published
contract — it has not been exercised against a live Meterless endpoint, and this README
does not claim it has.

### The other commands

```bash
bun run swarm          # start the listing swarm (Volume Planner → Rec. → Closer ⇄ Critic → Auditor)
bun run engines:fetch  # fetch the three Meterless engine specs (AGENTS.md contract + suites)
bun run conformance    # run the three Meterless conformance suites against OUR implementations
bun run recon          # the listing-side invariant: nothing published without supported evidence
bun run determinism    # two runs, compared entry by entry (the decisions, the values, the ids)
bun run zetaris:selftest  # the Zetaris client against the published REST contract, end to end
bun run avc:selftest       # escrow -> settlement -> certificate, verified from its own bytes
bun run listing:selftest   # register -> 402 -> pay -> redeem -> the agent lists itself
bun run llm:selftest       # the LLM port: three adapters, the Meterless contract on the wire
```

`bun run zetaris:selftest` is the sponsor-integration gate: it drives the published
contract — `GET /api/v1.0/auth/login` (Basic), `POST /api/v1.0/query/sql/start`,
`GET /api/v1.0/query/sql/page`, `DELETE /api/v1.0/query/sql/close/{queryToken}` — against
the protocol-compatible local server, and checks the parts that would otherwise be a
promise in a comment: the published headers are on the wire, the query is closed on the
error path, an out-of-range `pageLimit` is refused before it goes out, and the pull
returns the same listing ids, observation ids and content ids as the file loader.

`bun run recon` checks the invariant that exists at this step — no listing is published
without supported, attributed evidence, the canonical record is content-addressed, and two
runs of the same fixtures are decision-identical. The **money invariant** (the 40.492T
TIME equilibrium) belongs to the settlement work and is **not** claimed here; the script
says so on its first lines.

**Every command maps to the engine service behind it.** This is the shape Meterless's own
hackathon starter uses, and it is how the engine-usage line of the rubric gets read:

| Command | What runs behind it | Meterless engine |
|---|---|---|
| `bun run swarm` | evidence reconciliation → canonical listing/trade event log → bounded long-run cadence | **H-MEM** · **World Model** · **Markovian** |
| `bun run conformance` | the three published conformance suites (`bun vendor/meterless/<engine>/conformance/runner.ts`) | H-MEM 13/13 · World Model 8/8 · Markovian 8/8 — **our own scores**, on our own implementations in `src/engines/`, recorded in [`evidence/conformance-ours.txt`](./evidence/conformance-ours.txt). The sponsors' reference scores are a separate file and are never presented as ours. |
| `bun run determinism` | the same swarm, twice, compared entry by entry | the engines' ids come back identical — memory ids, entity ids, event ids, content ids |
| `bun run recon` | the listing-side invariant — nothing published without supported, attributed evidence | the **World Model** audit trail is what it reads |
| `bun run avc:selftest` | escrow lock → claim → settle → certificate issue → independent verification | the **World Model** canonical record the settlement is written onto |
| `bun run listing:selftest` | register → 402 → pay → redeem → the agent lists itself at its own price → the critic judges it | the same **H-MEM** / **World Model** / **Markovian** run the listing path already uses — the agent cannot skip the critic |
| `bun run llm:selftest` | the one LLM port against a server that speaks the Meterless wire format — the hosted provider, the local runtime and the offline renderer | the **Meterless provider contract** itself: `<host>/v1`, bearer auth, `meterless-app`, `meterless-scope: user`, routing ids discovered from `GET /v1/models`, 180 s timeout |

The swarm writes one JSONL trace per run under `logs/`, so every listing decision is
reproducible and auditable.

**Runs with zero credentials.** `SAMPLE_MODE=true` is the default: the LLM port resolves to
a deterministic local adapter, so the exchange is fully runnable and demoable with **no API
key, no credit and no network**. When a Meterless provider credential is present, the same
seam calls **NVIDIA Nemotron through the Meterless fleet** instead — no NVIDIA account, key
or billing sits in our path. Nothing in the demo waits on a credential that has not been
issued.

## Dependencies

- **Runtime:** Bun (TypeScript executed in-process; no build step).
- **Data:** no external database. The exchange's own state lives in the process and on
  disk; the Zetaris adapter speaks the published REST contract, and the pre-existing
  product's API is reachable over HTTP when configured. The listings the swarm reconciles
  are **pulled over that contract on every run** (`src/zetaris/`): the client, the
  protocol-compatible local server, the SQL reader and the pull itself are separate
  files, and the client does not know the local server exists.
- **Protocol:** x402 (inbound payment receipts), an Ethereum wallet (agentic identity).
- **Agent engines:** Meterless **H-MEM**, **World Model**, **Markovian** (Apache 2.0) —
  implemented from each engine's `AGENTS.md` contract and gated by Meterless's published
  conformance suites. Not an npm dependency; the specs are the dependency.
- **Inference:** **NVIDIA Nemotron, reached through the Meterless provider** (OpenAI-format
  requests). The model is selected by routing id discovered from the provider at runtime,
  not hard-coded, with a local Meterless Runtime and a deterministic offline adapter as
  fallbacks.
- **Dev env:** the build ran in **opencode** against the **scoped prompt library** in
  `cursor-prompts/` — the house rules in `.cursor/rules/conquest.mdc` govern every step
  and the mandated Meterless prompt files are bound by `@filename`. **Cursor's allowance
  was exhausted for the window** (monthly on the account, weekly on the API key, sponsor
  credit not provisioned) — a declared deviation, stated in full under "How we built it".

---

## How we built it

**The build layer was opencode, not Cursor.** Cursor's allowance was exhausted for
the whole window: the account's monthly limit was spent, and the API key's weekly limit
was reached inside the window and does not reset until after the submission deadline.
The sponsor credit had not been provisioned to us. This is a **declared deviation** and
it is stated here, in the sponsor write-up and in the submission form rather than
hidden.

**What the build still has is a spec-first prompt library.** Every feature has a scoped
prompt in [`cursor-prompts/`](./cursor-prompts/) with its acceptance gate, and the
implementation follows its prompt exactly; the house rules in
[`.cursor/rules/conquest.mdc`](./.cursor/rules/conquest.mdc) govern every step; the
mandated Meterless prompt library is in [`prompts/`](./prompts/). **If the sponsor credit
is provisioned, the identical prompts can be replayed in Cursor, step by step, with the
gate in each prompt** — the build was written to be replayable, not to be depended upon.

**The method** — spec-first, one scoped feature per step, so each step is small,
reviewable and gated:

1. **Specify** — a scoped prompt per feature. Context is loaded from files, never
   pasted: the mandated pattern via `@filename`, the contracts from `src/types.ts`, the
   house rules from the rules file. The prompt carries the feature **and its acceptance
   gate**, so the gate travels with the specification.
2. **Implement** — the step is built against its prompt, and the prompt's acceptance
   command is the definition of done. Where the output was not understood, it was read
   back rather than assumed.
3. **Gate and commit** — the acceptance command is run, and the commit follows every
   working step, so a bad step is rolled back rather than debugged in place.

**The prompts themselves are in the repo** — [`cursor-prompts/`](./cursor-prompts/) holds
one scoped prompt per feature, and [`prompts/`](./prompts/) holds the mandated Meterless
prompt files they bind to. That is the reproducible form of the build: the prompts are
the specification, and any feature can be re-run from its prompt.

| Step | Feature | Prompt that specified it | Acceptance | Result |
|---|---|---|---|---|
| **P0** | the listing swarm, end to end: tracer, orchestrator, the five roles, the LLM registry, `POST /run` | [`cursor-prompts/p0-scaffold-wiring.md`](./cursor-prompts/p0-scaffold-wiring.md) | `bunx tsc --noEmit`; `bun run swarm`; `--input` capture; `POST /run`; two runs decision-identical | **pass** — 4 fixture paths (accept / hold / revise / fallback), a 36-entry full-run trace, three captured example runs (10/11/10 entries), `tsc` exit 0 |
| **P1–P3** | the three Meterless engines, written from the sponsors' contracts | [`p1-hmem-engine.md`](./cursor-prompts/p1-hmem-engine.md) · [`p2-world-model-engine.md`](./cursor-prompts/p2-world-model-engine.md) · [`p3-markovian-engine.md`](./cursor-prompts/p3-markovian-engine.md) | `bun run scripts/conformance.ts` — each sponsor's suite against **our** module | **pass** — H-MEM 13/13, World Model 8/8, Markovian 8/8 |
| **P4–P5** | the roles and the loops, wired to the engines — the seam that makes the engines part of the product rather than a shelf | [`p4-five-agents.md`](./cursor-prompts/p4-five-agents.md) · [`p5-orchestrator-escalation.md`](./cursor-prompts/p5-orchestrator-escalation.md) | `bunx tsc --noEmit`; `bun run swarm`; `bun run determinism`; the four paths unchanged | **pass** — Markovian expands the plan (carryover proven: 3 buckets over 2 chunks), H-MEM stores/recalls/cites and is taught by the critic, the World Model carries the canonical record and the decision; `tsc` exit 0; the swarm still takes accept / hold / revise / fallback |
| **P6** | the Zetaris federated pull — the listings arrive over the published REST contract, not from a file | [`p6-zetaris-adapter.md`](./cursor-prompts/p6-zetaris-adapter.md) | `bun run zetaris:selftest`; `bun run swarm`; the four paths unchanged | **pass** — 40 HTTP requests over the published contract against a protocol-compatible local server; the pull is the first trace line; the file loader is the declared fallback, and a fallback run is marked degraded |
| **P7** | the money path — escrow settlement, and the certificate the settlement issues | [`p7-avc-on-settle.md`](./cursor-prompts/p7-avc-on-settle.md) | `bun run avc:selftest` | **pass** — no certificate before `settled`; the certificate verifies from its own bytes; a tampered certificate is refused and derives a different id; the key is read from the environment and the code has no default |
| **P8** | the self-listing protocol — one payment buys one listing, and the agent declares its own price | [`p8-self-listing.md`](./cursor-prompts/p8-self-listing.md) | `bun run listing:selftest` | **pass** — a real `402` with the x402 challenge in the headers; the payment verifies against a local facilitator stub; the token is single-use and the reuse is refused; the agent's own price is judged by the same critic, and an unsupported price is **held**; the token secret and the payment nonce never reach the trace |

### Toolchain check

The organiser's own build check — *Cursor creates and runs a file, no API key* — was
passed first, so the build layer was known-good before any feature was started:

```
$ cursor-agent -p "Create a file hello.ts ... and then run it with bun" --model auto --force
Created `hello.ts` and ran it with bun. Output:
hello from cursor
```

Two engine prompts were then **rehearsed on throwaway copies outside this repo**, to
prove the prompt library is sound before the build started. A rehearsal is not the
build: the shipped code is authored inside the build window, here, in this repo.

| Rehearsal | Feature | Acceptance | Result |
|---|---|---|---|
| rehearsal | H-MEM engine, on a throwaway copy | H-MEM conformance | **13/13 passed** |
| rehearsal | World Model engine, on a throwaway copy | World Model conformance | **8/8 passed** |

**Read that table precisely.** These rehearsals ran **before** the window, on copies
**outside this repository**, and the code was **discarded** — none of it is in this
submission. They prove the scoped-prompt pattern and the engine contracts are sound; they
are **not** a result for the shipped code. The engines in `src/engines/` are written
inside the window (P1–P3) and their scores land in `evidence/conformance-ours.txt`. The
rehearsals are disclosed here, and in [`PRE-EXISTING.md`](./PRE-EXISTING.md), because a
judge should never have to guess which code is which.

**What the demo does not do:** the Meterless provider key is never in Cursor's settings.
Cursor credit paid for writing the code; Meterless credit is for the product running.

---

## Architecture (swarm)

```
Volume Planner  (orchestrator — decomposes the listing volume into work)      [Markovian]
      │
      ▼
Evidence Reconciler  (reconciles a candidate listing against fragmented srcs) [H-MEM]
      │
      ▼
Listing Closer  ⇄  Fidelity & Conflict Critic   (closes via escrow; critic)  [World Model · H-MEM]
      │
      ▼
Telemetry Auditor  (audits the run's own traces; emits the scorecard)        [World Model]
```

The roster solves **fragmented intelligence** by partitioning the work: reconciliation is a
different job from closing, and closing is adversarially checked before settlement. Every
stage emits a trace.

Each stage is backed by a **Meterless engine** (Apache 2.0) and gated by that engine's
**published conformance suite** — H-MEM for tiered memory with provenance and contradiction
handling, World Model for the append-only canonical listing/trade event log, Markovian for
bounded-context long runs with flat per-step cost. The engine↔role mapping is listed in
[`SPONSORS.md`](./SPONSORS.md). Full detail in the architecture notes.

### The roster, against the standard roles for this track

The track's suggested shape is *Source Mapper → Reconciler → Conflict Critic → Reporter*.
Ours is the same shape with the roles named for what they actually do here:

| Standard role | Ours | Responsibility |
|---|---|---|
| Source Mapper | `volume-planner` | decides which sources to pull for this listing volume, and in what order |
| Reconciler | `evidence-reconciler` | pulls the evidence, reconciles what disagrees, cites the memory ids it used |
| Conflict Critic | `conflict-critic` | challenges the proposed listing against the reconciled evidence; sends it back once |
| Reporter / Closer | `listing-closer` | closes the listing — publishes it, or **holds** it when the evidence does not support the price |
| Evaluator | `telemetry-auditor` | audits the run itself: did the loop complete, was anything escalated, what went wrong |

Five roles, two loops, one escalation, one bounded fallback.

---

## Sponsor integration

See **[`SPONSORS.md`](./SPONSORS.md)** for the full write-up. Summary:

- **Cursor** — the build environment the organiser's track asks for. **Declared
  deviation:** Cursor's allowance was exhausted for the window (monthly limit spent, the
  API key's weekly limit reached inside the window, sponsor credit never provisioned), so
  the implementation was written in **opencode**, spec-first, against the scoped prompts
  in `cursor-prompts/` — with `.cursor/rules/conquest.mdc` governing every step. The
  prompt library is replayable in Cursor the moment credit exists.
- **Meterless** — agent engines. We use **H-MEM** (evidence reconciliation), **World Model**
  (canonical listing/trade event log) and **Markovian** (bounded-context long runs). All three
  are Apache 2.0, run locally with no API keys, and are **gated by Meterless's own
  conformance suites**. The sponsors' reference implementations score 13/13, 8/8, 8/8 on
  this machine; **our** implementations score **13/13, 8/8, 8/8** on the same suites —
  `bun run conformance` reports them, and the run is recorded in
  [`evidence/conformance-ours.txt`](./evidence/conformance-ours.txt). The roles run on
  the engines (see the table above).
- **Zetaris** — federated data. The hosted cluster was not provisionable (documented
  deviation); the documented federation pattern is reimplemented natively, with an adapter
  that speaks Zetaris's **published REST contract** (`OpenSqlQuery` → `PageSqlQuery` →
  `CloseSqlQuery`, bearer auth, `X-Org-ID` + `X-Request-ID`). **The swarm's candidate
  listings come out of that protocol, not out of a file**: every run opens a query, pages
  it and closes it, and the first line of the trace is the pull itself — how many listings
  came back, over how many requests, in which mode. **Declared deviation + native build.**
- **NVIDIA** — Nemotron inference, reached **through the Meterless fleet**: the seam asks
  the provider for a routing id, and the provider decides what runs. We hold no NVIDIA
  account, key or billing. **Declared, not yet exercised** — no run on this machine has
  named a routing id, because no provider credential has been issued to us. The offline
  deterministic renderer and the local-runtime path are real, and they are what the
  recorded runs used. The **provider seam itself is built and proved on the wire** — see
  the model-seam section above and `bun run llm:selftest`.

---

## License & attribution

The federation pattern and client contract used here are modeled on Zetaris's open-source
`getting-started` (Apache 2.0) and `lightning-catalog` (MIT) repositories. No Zetaris source
is vendored or redistributed; any code adapted from those sources retains its license notice.

---

## Where each check is answered

The organiser's own pre-submission checklist, answered line by line — and the **four
declared deviations** (Bun instead of Python, no Dockerfile, the Zetaris local
protocol-compatible server, and the build layer) with the reason for each:

**[`docs/COMPLIANCE-MAP.md`](./docs/COMPLIANCE-MAP.md)**

Also: [`docs/AVC-SPEC.md`](./docs/AVC-SPEC.md) is the product specification,
[`docs/BUILD-LEDGER.md`](./docs/BUILD-LEDGER.md) is the honest build and scoring ledger,
[`docs/README.md`](./docs/README.md) says what is in this repository and what is
deliberately withheld, and [`PRE-EXISTING.md`](./PRE-EXISTING.md) is the rule 4.2
declaration.
