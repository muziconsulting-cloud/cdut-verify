/**
 * Workstream C: transcript payload integrity.
 *
 * A valid signature over nonsense is still nonsense. These tests fail until
 * `validatePayload` in `src/payload.ts` is implemented.
 *
 * Run only this file:
 *   bun test test/payload.test.ts
 */

import { describe, expect, test } from 'bun:test'
import {
  manifestHash,
  transcriptIdV1,
  transcriptIdV2,
  transcriptV1,
  transcriptV2,
  validatePayload,
} from '../src/index.ts'
import type {
  AnyTranscript,
  ProgrammeManifest,
  TranscriptV1,
  TranscriptV1Payload,
  TranscriptV2,
  TranscriptV2Payload,
} from '../src/types.ts'

const manifest: ProgrammeManifest = {
  id: 'BCOM-ACC',
  title: 'Bachelor of Commerce in Accounting',
  version: '2026.1',
  nqfLevel: 7,
  totalCredits: 15,
  passMark: 50,
  modules: [{ id: 'ACC101', title: 'Accounting I', credits: 15, prerequisites: [] }],
}

const hash = manifestHash(manifest)

function v2Payload(overrides: Partial<TranscriptV2Payload> = {}): TranscriptV2Payload {
  const payload = transcriptV2({
    holder: { name: 'Fixture Student', pan: '0000 0000 0000 0000' },
    programme: { id: manifest.id, version: manifest.version, manifestHash: hash },
    modules: [{ moduleId: 'ACC101', credits: 15, mark: 72, passedAt: '2026-02-10T00:00:00Z' }],
    issuedAt: '2026-11-01T00:00:00Z',
  })
  return { ...payload, ...overrides }
}

function v2(overrides: Partial<TranscriptV2Payload> = {}): TranscriptV2 {
  const payload = v2Payload(overrides)
  return { id: transcriptIdV2(payload), payload, proof: null }
}

function v1Payload(overrides: Partial<TranscriptV1Payload> = {}): TranscriptV1Payload {
  const payload = transcriptV1({
    pan: '0000 0000 0000 0000',
    agentName: 'fixture-agent',
    enrolments: [
      {
        degree: 'BSc Computer Science',
        slot: 1,
        enrolledAt: '2026-01-05T00:00:00Z',
        returnedAt: null,
      },
    ],
    assessments: [
      {
        id: 'a1',
        degree: 'BSc Computer Science',
        unit: 'MATH101',
        attempt: 1,
        passed: true,
        assessedAt: '2026-06-20T00:00:00Z',
      },
    ],
    issuedAt: '2026-11-01T00:00:00Z',
  })
  return { ...payload, ...overrides }
}

function v1(overrides: Partial<TranscriptV1Payload> = {}): TranscriptV1 {
  const payload = v1Payload(overrides)
  return { id: transcriptIdV1(payload), payload, proof: null }
}

const codes = (transcript: AnyTranscript): string[] =>
  validatePayload(transcript).issues.map((issue) => issue.code)

describe('payload: the happy path', () => {
  test('a well-formed cdut/2 payload is valid', () => {
    const result = validatePayload(v2())
    expect(result.valid).toBe(true)
    expect(result.issues).toEqual([])
  })

  test('a well-formed cdut/1 payload is valid', () => {
    const result = validatePayload(v1())
    expect(result.valid).toBe(true)
    expect(result.issues).toEqual([])
  })
})

describe('payload: file identity', () => {
  test('an id that does not derive from the payload is rejected', () => {
    const transcript = v2()
    expect(codes({ ...transcript, id: `cdut2-${'0'.repeat(24)}` })).toContain(
      'TRANSCRIPT_ID_MISMATCH',
    )
  })

  test('an unknown format is rejected', () => {
    const payload = { ...v2Payload(), format: 'cdut/3' } as unknown as TranscriptV2Payload
    const transcript = { id: 'cdut2-unknown', payload, proof: null } as unknown as AnyTranscript
    expect(codes(transcript)).toContain('TRANSCRIPT_FORMAT_UNKNOWN')
  })
})

describe('payload: cdut/2 fields', () => {
  test('an empty holder name is rejected', () => {
    expect(codes(v2({ holder: { name: '' } }))).toContain('HOLDER_NAME_EMPTY')
  })

  test('an unparseable issuedAt is rejected', () => {
    expect(codes(v2({ issuedAt: 'not-a-date' }))).toContain('ISSUED_AT_INVALID')
  })

  test('an empty programme id is rejected', () => {
    expect(
      codes(v2({ programme: { id: '', version: manifest.version, manifestHash: hash } })),
    ).toContain('PROGRAMME_ID_EMPTY')
  })

  test('an empty programme version is rejected', () => {
    expect(
      codes(v2({ programme: { id: manifest.id, version: '', manifestHash: hash } })),
    ).toContain('PROGRAMME_VERSION_EMPTY')
  })

  test('a manifest hash that is not 64 hex characters is rejected', () => {
    expect(
      codes(v2({ programme: { id: manifest.id, version: manifest.version, manifestHash: 'abc' } })),
    ).toContain('MANIFEST_HASH_INVALID')
  })
})

describe('payload: cdut/2 module rows', () => {
  test('an empty module id is rejected', () => {
    expect(
      codes(
        v2({
          modules: [{ moduleId: '', credits: 15, mark: 72, passedAt: '2026-02-10T00:00:00Z' }],
        }),
      ),
    ).toContain('MODULE_ID_EMPTY')
  })

  test('negative or fractional credits are rejected', () => {
    expect(
      codes(
        v2({
          modules: [{ moduleId: 'ACC101', credits: -1, mark: 72, passedAt: '2026-02-10T00:00:00Z' }],
        }),
      ),
    ).toContain('MODULE_CREDITS_INVALID')
    expect(
      codes(
        v2({
          modules: [{ moduleId: 'ACC101', credits: 7.5, mark: 72, passedAt: '2026-02-10T00:00:00Z' }],
        }),
      ),
    ).toContain('MODULE_CREDITS_INVALID')
  })

  test('a mark outside 0-100 is rejected', () => {
    expect(
      codes(
        v2({
          modules: [{ moduleId: 'ACC101', credits: 15, mark: 101, passedAt: '2026-02-10T00:00:00Z' }],
        }),
      ),
    ).toContain('MODULE_MARK_OUT_OF_RANGE')
    expect(
      codes(
        v2({
          modules: [{ moduleId: 'ACC101', credits: 15, mark: -1, passedAt: '2026-02-10T00:00:00Z' }],
        }),
      ),
    ).toContain('MODULE_MARK_OUT_OF_RANGE')
  })

  test('an unparseable passedAt is rejected', () => {
    expect(
      codes(
        v2({
          modules: [{ moduleId: 'ACC101', credits: 15, mark: 72, passedAt: 'yesterday' }],
        }),
      ),
    ).toContain('MODULE_PASSED_AT_INVALID')
  })
})

describe('payload: cdut/1 fields', () => {
  test('an empty pan is rejected', () => {
    expect(codes(v1({ pan: '' }))).toContain('PAN_EMPTY')
  })

  test('an empty agent name is rejected', () => {
    expect(codes(v1({ agentName: '  ' }))).toContain('AGENT_NAME_EMPTY')
  })

  test('an enrolment slot that is not a positive integer is rejected', () => {
    expect(
      codes(
        v1({
          degrees: [
            { degree: 'BSc Computer Science', slot: 0, enrolledAt: '2026-01-05T00:00:00Z', returnedAt: null },
          ],
        }),
      ),
    ).toContain('ENROLMENT_SLOT_INVALID')
  })

  test('an assessment attempt that is not a positive integer is rejected', () => {
    expect(
      codes(
        v1({
          assessments: [
            {
              id: 'a1',
              degree: 'BSc Computer Science',
              unit: 'MATH101',
              attempt: 0,
              passed: true,
              assessedAt: '2026-06-20T00:00:00Z',
            },
          ],
        }),
      ),
    ).toContain('ASSESSMENT_ATTEMPT_INVALID')
  })

  test('an unparseable assessedAt is rejected', () => {
    expect(
      codes(
        v1({
          assessments: [
            {
              id: 'a1',
              degree: 'BSc Computer Science',
              unit: 'MATH101',
              attempt: 1,
              passed: true,
              assessedAt: 'soon',
            },
          ],
        }),
      ),
    ).toContain('ASSESSMENT_DATE_INVALID')
  })
})

describe('payload: deterministic output', () => {
  test('two calls produce the same issue list and order', () => {
    const broken = v2({
      holder: { name: '' },
      issuedAt: 'nope',
      programme: { id: '', version: '', manifestHash: 'abc' },
      modules: [{ moduleId: '', credits: -1, mark: 500, passedAt: 'nope' }],
    })
    const first = validatePayload(broken)
    const second = validatePayload(broken)
    expect(first).toEqual(second)
    const keys = first.issues.map((row) => `${row.code}:${row.moduleId ?? ''}`)
    expect(keys).toEqual([...keys].sort())
  })
})
