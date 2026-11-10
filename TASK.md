# Task: make the verifier production-grade

`cdut-verify` verifies `.cdut` academic transcripts offline. The baseline already
works: canonical serialisation, content ids and Ed25519 signatures pass 13 tests.
The verification core is not finished.

This is a specification-first repository. The failing suites are the contract;
`BACKLOG.md` is the map and the estimate. Nothing here is a hidden test.

```sh
bun install
bun test:baseline     # 13 pass — must stay green
bun test:task         # 73 fail — the work
bun run typecheck
```

| # | Workstream | Hours | Suite |
|---|---|---|---|
| A | Programme completeness | 10 | `test/completeness.test.ts` |
| B | Manifest integrity | 8 | `test/manifest.test.ts` |
| C | Payload integrity | 7 | `test/payload.test.ts` |
| D | Structured verdicts | 8 | `test/verdict.test.ts` |
| E | Revocation and key rotation | 10 | `test/revocation.test.ts` |
| F | CLI batch mode | 4 | specified in `BACKLOG.md` |
| G | Hardening and docs | 3 | specified in `BACKLOG.md` |

A–E are anchored by tests. Start with A, then B and C (D depends on both), then E.

## Definition of done

- `bun test` is green: 86 tests, 0 failures.
- `bun run typecheck` is clean.
- No runtime dependency is added.
- No test is weakened, skipped or deleted to make the suite pass.
- The public API stays backward compatible: existing exports keep their names
  and behaviour.

## Workstream A — programme completeness

Implement `verifyCompleteness` in `src/transcript.ts`.

### Why this is not just signature checking

`verifyTranscript` answers "is this file genuine?". A genuine file can still be
for a different programme, an older curriculum, or a half-finished degree.
`verifyCompleteness` answers the harder question: given this transcript and this
published manifest, did the holder actually complete the award?

### Inputs

- `transcript: AnyTranscript` — a `cdut/1` or `cdut/2` file. The format is read
  from `payload.format`, never from a file name or a caller hint.
- `manifest: ProgrammeManifest` — the published programme: id, title, version,
  NQF level, total credits, pass mark, and modules with credits and prerequisites.

### Contract

#### 1. A `cdut/1` transcript is not provable

`cdut/1` has no programme block, so it cannot be checked against a manifest.
Return `provable: false`, `complete: false`, and a reason matching
`/cdut\/1|manifest/i`.

#### 2. The transcript must commit to *this* manifest

Before counting anything, check the signed programme block against the manifest:

- **id mismatch** → `provable: false`, reason matching `/programme/i`.
- **version mismatch** → `provable: false`, reason matching `/programme/i`.
- **manifest hash mismatch** → `provable: false`, reason matching
  `/manifest hash/i`. Compare `payload.programme.manifestHash` with
  `manifestHash(manifest)` from `src/canonical.ts`.

When `provable` is false, `complete` is false. Nothing else is claimed.

#### 3. Only a passing module is credited

For each module row on the transcript:

- Find the module in the manifest by `moduleId`.
- A row is a pass when `row.mark >= manifest.passMark`.
- A row whose `moduleId` is not in the manifest is **extra**: report it, but do
  not count it and do not let it break completeness.
- If the same module appears more than once, the earliest passing `passedAt`
  counts.

**Credits come from the manifest, not from the row.** A transcript that claims
999 credits for a 15-credit module still earns 15. The manifest is the authority
on what a module is worth.

#### 4. Missing modules

`missing` is every manifest module id with no passing row, sorted
lexicographically. `extra` is every transcript module id not in the manifest,
de-duplicated and sorted.

#### 5. Prerequisite order

For every passed manifest module, every prerequisite must also be passed, and its
`passedAt` must be **less than or equal to** the dependent module's `passedAt`.
If the prerequisite is absent or passed later, record:

```ts
{ moduleId: 'ACC102', missingPrerequisite: 'ACC101' }
```

Sort violations by `moduleId`, then by `missingPrerequisite`. A module whose
prerequisite is absent is both `missing` (the prerequisite) and a violation (the
dependent module).

#### 6. Credits and the award total

`credits` is the sum of manifest credits over manifest modules that were passed.
`requiredCredits` is `manifest.totalCredits`. A transcript can have no missing
module and still be short of the award total; that is incomplete, with a reason
matching `/credit/i`.

#### 7. The result

`complete` is true only when all of these hold:

- `provable` is true;
- `missing` is empty;
- `credits >= requiredCredits`;
- `prerequisiteViolations` is empty.

`reasons` explains every failure in plain English — one entry per problem is
fine. It is empty exactly when the programme is complete.

When `provable` is true, include the `programme` block echoed from the manifest:

```ts
{ id, title, version, nqfLevel }
```

### Acceptance

```sh
bun test test/completeness.test.ts   # 12 pass, 0 fail
```

## What good work looks like

- The happy path is complete, with 75 credits and no reasons.
- A failed module is missing, not credited.
- Credits are taken from the manifest even when a row inflates them.
- An extra module is reported but does not break completeness.
- Prerequisite violations are precise about which module and which prerequisite.
- A mismatched programme id, version or manifest hash is not provable, and the
  reason says which check failed.
- B–E return deterministic output: two calls with the same input produce the same
  result and the same issue order.
- A malformed input produces an issue code, never a crash.
