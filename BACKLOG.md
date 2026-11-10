# Backlog: from a working verifier to a production one

The baseline works: canonical serialisation, content ids and Ed25519 signatures
pass 13 tests. Everything below is outstanding. The failing suites are the
specification; this file is the map, the order and the estimate.

Total: **50 hours**, about ten working sessions of five hours.

| # | Workstream | Hours | Test suite | Status |
|---|---|---|---|---|
| A | Programme completeness | 10 | `test/completeness.test.ts` | stub |
| B | Manifest integrity | 8 | `test/manifest.test.ts` | stub |
| C | Payload integrity | 7 | `test/payload.test.ts` | stub |
| D | Structured verdicts | 8 | `test/verdict.test.ts` | stub |
| E | Revocation and key rotation | 10 | `test/revocation.test.ts` | stub |
| F | CLI batch mode and report schema | 4 | — | not started |
| G | Adversarial hardening and docs | 3 | — | not started |

Workstreams A–E are anchored by failing tests, so "done" is unambiguous. F and G
are specified here because they depend on the shape D settles.

## A. Programme completeness — 10 hours

Implement `verifyCompleteness` in `src/transcript.ts`. A transcript commits to a
manifest hash; the verifier counts credits from the manifest, not from the rows,
and checks prerequisite order. Full contract in `TASK.md`.

**Done when** `bun test test/completeness.test.ts` is 12/12.

## B. Manifest integrity — 8 hours

Implement `validateManifest` in `src/manifest.ts`. A manifest is publishable only
if it is internally coherent:

- identity fields are non-empty;
- NQF level is an integer in 5–10, pass mark an integer in 1–100, total credits a
  positive integer;
- at least one module exists, module ids are unique, module credits are positive
  integers;
- every prerequisite names a module in the manifest, no module requires itself,
  and the prerequisite graph has no cycle;
- the sum of module credits can actually reach the award total.

Issues are returned in a deterministic order (code, then module id, then
message). `valid` is true only when `issues` is empty.

**Done when** `bun test test/manifest.test.ts` is 18/18.

## C. Payload integrity — 7 hours

Implement `validatePayload` in `src/payload.ts`. A signature over nonsense is
still nonsense, so the payload is checked before completeness:

- the id derives from the payload, and the format is one the verifier knows;
- cdut/2: holder name, programme id and version are non-empty; the manifest hash
  is 64 hex characters; `issuedAt` parses;
- every module row has a non-empty id, non-negative integer credits, a mark in
  0–100, and a parseable `passedAt`;
- cdut/1: pan and agent name are non-empty; enrolment slots and assessment
  attempts are positive integers; assessment dates parse.

**Done when** `bun test test/payload.test.ts` is 19/19.

## D. Structured verdicts — 8 hours

Implement `verifyReport` in `src/verdict.ts`. Prose reasons are for humans; a
caller needs stable codes. The report combines:

- genuineness: `UNSIGNED`, `ID_MISMATCH`, `SIGNATURE_INVALID`, key-set codes;
- payload validity: `PAYLOAD_INVALID` when `validatePayload` fails;
- manifest validity: `MANIFEST_INVALID` when `validateManifest` fails;
- completeness: `MODULE_MISSING`, `MODULE_EXTRA`, `CREDITS_SHORT`,
  `PREREQUISITE_ORDER`, `NOT_PROVABLE`;
- revocation: `REVOKED`.

`codes` is sorted and de-duplicated. `OK` is present when the transcript is
genuine, and completeness is either not asked for or satisfied. Every non-OK code
has at least one `issues` entry explaining it, with `moduleId` where one applies.

**Done when** `bun test test/verdict.test.ts` is 13/13.

## E. Revocation and key rotation — 10 hours

Implement `src/revocation.ts`.

- `issueRevocationList` signs the canonical list (entries sorted by transcript
  id), with the same proof shape as a transcript.
- `verifyRevocationList` checks that signature. An unsigned list is invalid.
- `checkRevocation` answers whether a transcript id appears on the list. It does
  not verify the list; the caller does that first.
- `verifyWithKeySet` selects the key by the transcript's `kid`, then checks the
  key's window against the supplied instant. Windows are inclusive. Unknown,
  not-yet-valid and expired keys each get a distinct reason.

**Done when** `bun test test/revocation.test.ts` is 11/11.

## F. CLI batch mode and report schema — 4 hours

Not started. The CLI currently verifies one file and prints prose reasons.

- `cdut-verify <dir> --batch --manifest <file>` verifies every `.cdut` file in a
  directory, continues past a bad file, and exits `1` if any file fails.
- `--json` emits the structured `VerdictReport` from D, plus a `summary` block:
  counts of verified, invalid, incomplete and revoked.
- Exit codes stay `0` / `1` / `2` as documented in `src/cli.ts`.

**Done when** a shell test covers a directory of one valid, one invalid and one
incomplete transcript.

## G. Adversarial hardening and docs — 3 hours

Not started.

- Property tests: canonical bytes are stable under key reordering, module
  reordering and prerequisite reordering; hashing is deterministic across runs.
- Malformed JSON, deeply nested payloads and non-string fields fail with a code,
  not a crash.
- README and `TASK.md` stay in step with the public API; every exported function
  has a doc comment.

**Done when** the full suite is green, typecheck is clean, and no runtime
dependency has been added.

## Deliberately out of scope

These are real ideas, but they belong to a different project and would turn a
verifier into a registrar:

- a network registry or revocation feed;
- PDF rendering of transcripts;
- issuing keys or storing student records;
- a web UI.

The verifier reads files and returns verdicts. It does not become the university.
