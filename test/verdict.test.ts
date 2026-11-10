/**
 * Workstream D: structured verdicts.
 *
 * `verifyTranscript` returns prose. Software needs codes it can branch on, and a
 * single report that combines genuineness, payload validity, manifest integrity,
 * completeness and revocation. These tests fail until `verifyReport` in
 * `src/verdict.ts` is implemented.
 *
 * Run only this file:
 *   bun test test/verdict.test.ts
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import {
  generateKeyPair,
  issueTranscriptV1,
  issueTranscriptV2,
  manifestHash,
  transcriptV1,
  transcriptV2,
  verifyReport,
} from '../src/index.ts'
import type {
  ProgrammeManifest,
  TranscriptV1,
  TranscriptV2,
  VerdictReport,
} from '../src/types.ts'

let keys: { privateKey: string; publicKey: string }

beforeAll(async () => {
  keys = await generateKeyPair()
})

const manifest: ProgrammeManifest = {
  id: 'BCOM-ACC',
  title: 'Bachelor of Commerce in Accounting',
  version: '2026.1',
  nqfLevel: 7,
  totalCredits: 75,
  passMark: 50,
  modules: [
    { id: 'ACC101', title: 'Accounting I', credits: 15, prerequisites: [] },
    { id: 'ACC102', title: 'Accounting II', credits: 15, prerequisites: ['ACC101'] },
    { id: 'ENG101', title: 'Academic English', credits: 15, prerequisites: [] },
    { id: 'MATH101', title: 'Quantitative Methods I', credits: 15, prerequisites: [] },
    { id: 'MATH102', title: 'Quantitative Methods II', credits: 15, prerequisites: ['MATH101'] },
  ],
}

const rows = (): TranscriptV2['payload']['modules'] => [
  { moduleId: 'MATH101', credits: 15, mark: 64, passedAt: '2026-01-10T00:00:00Z' },
  { moduleId: 'ENG101', credits: 15, mark: 81, passedAt: '2026-01-15T00:00:00Z' },
  { moduleId: 'ACC101', credits: 15, mark: 72, passedAt: '2026-02-10T00:00:00Z' },
  { moduleId: 'MATH102', credits: 15, mark: 59, passedAt: '2026-06-10T00:00:00Z' },
  { moduleId: 'ACC102', credits: 15, mark: 68, passedAt: '2026-07-10T00:00:00Z' },
]

async function makeTranscript(options?: {
  rows?: TranscriptV2['payload']['modules']
  against?: ProgrammeManifest
  programmeId?: string
  programmeVersion?: string
  manifestHashOverride?: string
}): Promise<TranscriptV2> {
  const against = options?.against ?? manifest
  const payload = transcriptV2({
    holder: { name: 'Fixture Student', pan: '0000 0000 0000 0000' },
    programme: {
      id: options?.programmeId ?? against.id,
      version: options?.programmeVersion ?? against.version,
      manifestHash: options?.manifestHashOverride ?? manifestHash(against),
    },
    modules: options?.rows ?? rows(),
    issuedAt: '2026-11-01T00:00:00Z',
  })
  return issueTranscriptV2(payload, keys)
}

const report = (transcript: TranscriptV2 | TranscriptV1): Promise<VerdictReport> =>
  verifyReport(transcript, { publicKey: keys.publicKey, manifest })

describe('verdict: the happy path', () => {
  test('a genuine, complete transcript reports OK and nothing else', async () => {
    const result = await report(await makeTranscript())
    expect(result.valid).toBe(true)
    expect(result.provable).toBe(true)
    expect(result.complete).toBe(true)
    expect(result.codes).toEqual(['OK'])
    expect(result.issues).toEqual([])
    expect(result.format).toBe('cdut/2')
  })
})

describe('verdict: genuineness', () => {
  test('a tampered payload reports an id mismatch and is not complete', async () => {
    const transcript = await makeTranscript()
    const tampered: TranscriptV2 = {
      ...transcript,
      payload: {
        ...transcript.payload,
        modules: transcript.payload.modules.map((row) =>
          row.moduleId === 'ACC102' ? { ...row, mark: 100 } : row,
        ),
      },
    }
    const result = await report(tampered)
    expect(result.valid).toBe(false)
    expect(result.complete).toBe(false)
    expect(result.codes).toContain('ID_MISMATCH')
  })

  test('a tampered proof reports an invalid signature', async () => {
    const transcript = await makeTranscript()
    const tampered: TranscriptV2 = {
      ...transcript,
      proof: { alg: 'EdDSA', kid: transcript.proof!.kid, signature: 'AAAA' },
    }
    const result = await report(tampered)
    expect(result.valid).toBe(false)
    expect(result.codes).toContain('SIGNATURE_INVALID')
  })

  test('an unsigned transcript reports UNSIGNED', async () => {
    const transcript = await makeTranscript()
    const result = await report({ ...transcript, proof: null })
    expect(result.valid).toBe(false)
    expect(result.codes).toContain('UNSIGNED')
  })
})

describe('verdict: completeness codes', () => {
  test('a missing module reports MODULE_MISSING with its id', async () => {
    const transcript = await makeTranscript({
      rows: rows().filter((row) => row.moduleId !== 'ACC102'),
    })
    const result = await report(transcript)
    expect(result.complete).toBe(false)
    expect(result.codes).toContain('MODULE_MISSING')
    expect(result.issues.find((issue) => issue.code === 'MODULE_MISSING')?.moduleId).toBe('ACC102')
  })

  test('a credit shortfall reports CREDITS_SHORT', async () => {
    const demanding: ProgrammeManifest = { ...manifest, totalCredits: 90 }
    const transcript = await makeTranscript({ against: demanding })
    const result = await report(transcript)
    expect(result.complete).toBe(false)
    expect(result.codes).toContain('CREDITS_SHORT')
  })

  test('a prerequisite passed out of order reports PREREQUISITE_ORDER', async () => {
    const transcript = await makeTranscript({
      rows: rows().map((row) =>
        row.moduleId === 'ACC102' ? { ...row, passedAt: '2026-02-01T00:00:00Z' } : row,
      ),
    })
    const result = await report(transcript)
    expect(result.complete).toBe(false)
    expect(result.codes).toContain('PREREQUISITE_ORDER')
    expect(result.issues.find((issue) => issue.code === 'PREREQUISITE_ORDER')?.moduleId).toBe(
      'ACC102',
    )
  })

  test('an extra module is reported but does not break completeness', async () => {
    const transcript = await makeTranscript({
      rows: [
        ...rows(),
        { moduleId: 'PHIL101', credits: 15, mark: 77, passedAt: '2026-03-01T00:00:00Z' },
      ],
    })
    const result = await report(transcript)
    expect(result.complete).toBe(true)
    expect(result.codes).toContain('MODULE_EXTRA')
  })
})

describe('verdict: a transcript must commit to this manifest', () => {
  test('a manifest hash mismatch is not provable', async () => {
    const other: ProgrammeManifest = {
      ...manifest,
      modules: manifest.modules.map((module) =>
        module.id === 'ACC101' ? { ...module, credits: 20 } : module,
      ),
    }
    const transcript = await makeTranscript({ manifestHashOverride: manifestHash(other) })
    const result = await report(transcript)
    expect(result.provable).toBe(false)
    expect(result.complete).toBe(false)
    expect(result.codes).toContain('MANIFEST_HASH_MISMATCH')
    expect(result.codes).toContain('NOT_PROVABLE')
  })

  test('a programme id mismatch is not provable', async () => {
    const transcript = await makeTranscript({ programmeId: 'BSC-CS' })
    const result = await report(transcript)
    expect(result.provable).toBe(false)
    expect(result.complete).toBe(false)
    expect(result.codes).toContain('PROGRAMME_ID_MISMATCH')
    expect(result.codes).toContain('NOT_PROVABLE')
  })

  test('a cdut/1 transcript is genuine but not provable', async () => {
    const payload = transcriptV1({
      pan: '0000 0000 0000 0000',
      agentName: 'fixture-agent',
      enrolments: [],
      issuedAt: '2026-11-01T00:00:00Z',
    })
    const transcript = await issueTranscriptV1(payload, keys)
    const result = await report(transcript)
    expect(result.valid).toBe(true)
    expect(result.provable).toBe(false)
    expect(result.complete).toBe(false)
    expect(result.codes).toContain('NOT_PROVABLE')
  })
})

describe('verdict: without a manifest', () => {
  test('genuineness is reported, completeness is not claimed', async () => {
    const transcript = await makeTranscript()
    const result = await verifyReport(transcript, { publicKey: keys.publicKey })
    expect(result.valid).toBe(true)
    expect(result.provable).toBe(false)
    expect(result.complete).toBe(false)
    expect(result.codes).toContain('OK')
  })
})

describe('verdict: codes are machine-friendly', () => {
  test('codes are sorted and unique', async () => {
    const transcript = await makeTranscript({
      rows: rows().filter((row) => row.moduleId !== 'ACC102'),
    })
    const result = await report(transcript)
    expect(result.codes).toEqual([...result.codes].sort())
    expect(new Set(result.codes).size).toBe(result.codes.length)
  })
})
