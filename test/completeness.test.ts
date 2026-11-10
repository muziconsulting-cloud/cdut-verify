/**
 * The task: programme-manifest completeness verification.
 *
 * Every test in this file fails until `verifyCompleteness` in `src/transcript.ts`
 * is implemented. The contract is in `TASK.md`.
 *
 * Run only this file:
 *   bun test test/completeness.test.ts
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import {
  generateKeyPair,
  issueTranscriptV1,
  issueTranscriptV2,
  manifestHash,
  transcriptV1,
  transcriptV2,
  verifyCompleteness,
} from '../src/index.ts'
import type { ProgrammeManifest, TranscriptV1, TranscriptV2 } from '../src/types.ts'

let keys: { privateKey: string; publicKey: string }

beforeAll(async () => {
  keys = await generateKeyPair()
})

/**
 * A five-module, 75-credit programme at NQF 7. The prerequisite chain is real:
 * MATH102 needs MATH101, ACC102 needs ACC101.
 */
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

/** All five modules passed, in prerequisite order. */
const completeRows = (): TranscriptV2['payload']['modules'] => [
  { moduleId: 'MATH101', credits: 15, mark: 64, passedAt: '2026-01-10T00:00:00Z' },
  { moduleId: 'ENG101', credits: 15, mark: 81, passedAt: '2026-01-15T00:00:00Z' },
  { moduleId: 'ACC101', credits: 15, mark: 72, passedAt: '2026-02-10T00:00:00Z' },
  { moduleId: 'MATH102', credits: 15, mark: 59, passedAt: '2026-06-10T00:00:00Z' },
  { moduleId: 'ACC102', credits: 15, mark: 68, passedAt: '2026-07-10T00:00:00Z' },
]

async function makeTranscript(options?: {
  rows?: TranscriptV2['payload']['modules']
  manifest?: ProgrammeManifest
  programmeId?: string
  programmeVersion?: string
  manifestHashOverride?: string
}): Promise<TranscriptV2> {
  const against = options?.manifest ?? manifest
  const payload = transcriptV2({
    holder: { name: 'Fixture Student', pan: '0000 0000 0000 0000' },
    programme: {
      id: options?.programmeId ?? against.id,
      version: options?.programmeVersion ?? against.version,
      manifestHash: options?.manifestHashOverride ?? manifestHash(against),
    },
    modules: options?.rows ?? completeRows(),
    issuedAt: '2026-11-01T00:00:00Z',
  })
  return issueTranscriptV2(payload, keys)
}

describe('completeness: the happy path', () => {
  test('a transcript with every required module is complete', async () => {
    const result = verifyCompleteness(await makeTranscript(), manifest)
    expect(result.provable).toBe(true)
    expect(result.complete).toBe(true)
    expect(result.credits).toBe(75)
    expect(result.requiredCredits).toBe(75)
    expect(result.missing).toEqual([])
    expect(result.extra).toEqual([])
    expect(result.prerequisiteViolations).toEqual([])
    expect(result.reasons).toEqual([])
    expect(result.programme).toEqual({
      id: 'BCOM-ACC',
      title: 'Bachelor of Commerce in Accounting',
      version: '2026.1',
      nqfLevel: 7,
    })
  })
})

describe('completeness: missing and failed modules', () => {
  test('a missing module makes the programme incomplete and names it', async () => {
    const rows = completeRows().filter((m) => m.moduleId !== 'ACC102')
    const result = verifyCompleteness(await makeTranscript({ rows }), manifest)
    expect(result.provable).toBe(true)
    expect(result.complete).toBe(false)
    expect(result.missing).toEqual(['ACC102'])
    expect(result.credits).toBe(60)
  })

  test('a failed module is not credited', async () => {
    const rows = completeRows().map((m) =>
      m.moduleId === 'ACC102' ? { ...m, mark: 40 } : m,
    )
    const result = verifyCompleteness(await makeTranscript({ rows }), manifest)
    expect(result.complete).toBe(false)
    expect(result.missing).toEqual(['ACC102'])
    expect(result.credits).toBe(60)
  })

  test('credits below the award total are incomplete even with no missing module', async () => {
    const demanding: ProgrammeManifest = { ...manifest, totalCredits: 90 }
    const result = verifyCompleteness(await makeTranscript({ manifest: demanding }), demanding)
    expect(result.provable).toBe(true)
    expect(result.missing).toEqual([])
    expect(result.credits).toBe(75)
    expect(result.requiredCredits).toBe(90)
    expect(result.complete).toBe(false)
    expect(result.reasons.join(' ')).toMatch(/credit/i)
  })
})

describe('completeness: prerequisites', () => {
  test('a module passed before its prerequisite is a violation', async () => {
    const rows = completeRows().map((m) =>
      m.moduleId === 'ACC102' ? { ...m, passedAt: '2026-02-01T00:00:00Z' } : m,
    )
    const result = verifyCompleteness(await makeTranscript({ rows }), manifest)
    expect(result.complete).toBe(false)
    expect(result.prerequisiteViolations).toEqual([
      { moduleId: 'ACC102', missingPrerequisite: 'ACC101' },
    ])
  })

  test('a module whose prerequisite is absent is both missing and a violation', async () => {
    const rows = completeRows().filter((m) => m.moduleId !== 'ACC101')
    const result = verifyCompleteness(await makeTranscript({ rows }), manifest)
    expect(result.complete).toBe(false)
    expect(result.missing).toEqual(['ACC101'])
    expect(result.prerequisiteViolations).toEqual([
      { moduleId: 'ACC102', missingPrerequisite: 'ACC101' },
    ])
  })
})

describe('completeness: the transcript must commit to this manifest', () => {
  test('a manifest hash mismatch is not provable', async () => {
    const other: ProgrammeManifest = {
      ...manifest,
      modules: manifest.modules.map((m) =>
        m.id === 'ACC101' ? { ...m, credits: 20 } : m,
      ),
    }
    const transcript = await makeTranscript({ manifestHashOverride: manifestHash(other) })
    const result = verifyCompleteness(transcript, manifest)
    expect(result.provable).toBe(false)
    expect(result.complete).toBe(false)
    expect(result.reasons.join(' ')).toMatch(/manifest hash/i)
  })

  test('a programme id mismatch is not provable', async () => {
    const transcript = await makeTranscript({ programmeId: 'BSC-CS' })
    const result = verifyCompleteness(transcript, manifest)
    expect(result.provable).toBe(false)
    expect(result.complete).toBe(false)
    expect(result.reasons.join(' ')).toMatch(/programme/i)
  })

  test('a programme version mismatch is not provable', async () => {
    const transcript = await makeTranscript({ programmeVersion: '2025.2' })
    const result = verifyCompleteness(transcript, manifest)
    expect(result.provable).toBe(false)
    expect(result.complete).toBe(false)
    expect(result.reasons.join(' ')).toMatch(/programme/i)
  })
})

describe('completeness: cdut/1 cannot prove completeness', () => {
  test('a cdut/1 transcript reports completeness as not provable', async () => {
    const payload = transcriptV1({
      pan: '0000 0000 0000 0000',
      agentName: 'fixture-agent',
      enrolments: [],
      issuedAt: '2026-11-01T00:00:00Z',
    })
    const transcript: TranscriptV1 = await issueTranscriptV1(payload, keys)
    const result = verifyCompleteness(transcript, manifest)
    expect(result.provable).toBe(false)
    expect(result.complete).toBe(false)
    expect(result.reasons.join(' ')).toMatch(/cdut\/1|manifest/i)
  })
})

describe('completeness: arithmetic uses the manifest, not the row', () => {
  test('a row claiming inflated credits cannot inflate the total', async () => {
    const rows = completeRows().map((m) =>
      m.moduleId === 'MATH101' ? { ...m, credits: 999 } : m,
    )
    const result = verifyCompleteness(await makeTranscript({ rows }), manifest)
    expect(result.provable).toBe(true)
    expect(result.credits).toBe(75)
    expect(result.complete).toBe(true)
  })

  test('a module not in the manifest is reported as extra but does not break completeness', async () => {
    const rows: TranscriptV2['payload']['modules'] = [
      ...completeRows(),
      { moduleId: 'PHIL101', credits: 15, mark: 77, passedAt: '2026-03-01T00:00:00Z' },
    ]
    const result = verifyCompleteness(await makeTranscript({ rows }), manifest)
    expect(result.extra).toEqual(['PHIL101'])
    expect(result.credits).toBe(75)
    expect(result.complete).toBe(true)
  })
})
