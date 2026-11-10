/**
 * Baseline tests: the verifier that already works.
 *
 * These must stay green. They cover cdut/1 and cdut/2 signing, id derivation,
 * tamper detection, wrong-key rejection and canonical stability.
 *
 * The completeness task lives in `completeness.test.ts` and is expected to fail
 * until `verifyCompleteness` is implemented.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import {
  canonicalManifest,
  canonicalTranscriptV2,
  generateKeyPair,
  hashManifest,
  issueTranscriptV1,
  issueTranscriptV2,
  manifestHash,
  transcriptIdV1,
  transcriptIdV2,
  transcriptV1,
  transcriptV2,
  verifyTranscriptV1,
  verifyTranscriptV2,
} from '../src/index.ts'
import type { ProgrammeManifest, TranscriptV1, TranscriptV2 } from '../src/types.ts'

let keys: { privateKey: string; publicKey: string }
let otherKeys: { privateKey: string; publicKey: string }

beforeAll(async () => {
  keys = await generateKeyPair()
  otherKeys = await generateKeyPair()
})

async function makeV1(): Promise<TranscriptV1> {
  const payload = transcriptV1({
    pan: '0000 0000 0000 0000',
    agentName: 'fixture-agent',
    enrolments: [
      { degree: 'BSc Computer Science', slot: 1, enrolledAt: '2026-01-05T00:00:00Z', returnedAt: null },
    ],
    assessments: [
      { id: 'a1', degree: 'BSc Computer Science', unit: 'MATH101', attempt: 1, passed: true, assessedAt: '2026-06-20T00:00:00Z' },
    ],
    degreesEarned: ['BSc Computer Science'],
    fees: { paid: 0, waived: 0 },
    pocketHead: 'genesis',
    issuedAt: '2026-11-01T00:00:00Z',
  })
  return issueTranscriptV1(payload, keys)
}

const manifest: ProgrammeManifest = {
  id: 'BCOM-ACC',
  title: 'Bachelor of Commerce in Accounting',
  version: '2026.1',
  nqfLevel: 7,
  totalCredits: 75,
  passMark: 50,
  modules: [
    { id: 'MATH101', title: 'Quantitative Methods I', credits: 15, prerequisites: [] },
    { id: 'MATH102', title: 'Quantitative Methods II', credits: 15, prerequisites: ['MATH101'] },
    { id: 'ENG101', title: 'Academic English', credits: 15, prerequisites: [] },
    { id: 'ACC101', title: 'Accounting I', credits: 15, prerequisites: [] },
    { id: 'ACC102', title: 'Accounting II', credits: 15, prerequisites: ['ACC101'] },
  ],
}

async function makeV2(overrides?: Partial<Parameters<typeof transcriptV2>[0]>): Promise<TranscriptV2> {
  const payload = transcriptV2({
    holder: { name: 'Fixture Student', pan: '0000 0000 0000 0000' },
    programme: { id: manifest.id, version: manifest.version, manifestHash: manifestHash(manifest) },
    modules: [
      { moduleId: 'ACC101', credits: 15, mark: 72, passedAt: '2026-02-10T00:00:00Z' },
      { moduleId: 'ACC102', credits: 15, mark: 68, passedAt: '2026-07-10T00:00:00Z' },
      { moduleId: 'ENG101', credits: 15, mark: 81, passedAt: '2026-01-15T00:00:00Z' },
      { moduleId: 'MATH101', credits: 15, mark: 64, passedAt: '2026-01-10T00:00:00Z' },
      { moduleId: 'MATH102', credits: 15, mark: 59, passedAt: '2026-06-10T00:00:00Z' },
    ],
    issuedAt: '2026-11-01T00:00:00Z',
    ...overrides,
  })
  return issueTranscriptV2(payload, keys)
}

describe('cdut/1', () => {
  test('a signed transcript verifies with its public key', async () => {
    const transcript = await makeV1()
    const result = await verifyTranscriptV1(transcript, keys.publicKey)
    expect(result.valid).toBe(true)
    expect(result.format).toBe('cdut/1')
    expect(result.reasons).toEqual([])
  })

  test('the id derives from the payload', async () => {
    const transcript = await makeV1()
    expect(transcript.id).toBe(transcriptIdV1(transcript.payload))
    expect(transcript.id).toMatch(/^cdut-[0-9a-f]{24}$/)
  })

  test('a tampered payload fails', async () => {
    const transcript = await makeV1()
    const tampered: TranscriptV1 = {
      ...transcript,
      payload: { ...transcript.payload, agentName: 'someone-else' },
    }
    const result = await verifyTranscriptV1(tampered, keys.publicKey)
    expect(result.valid).toBe(false)
    expect(result.reasons.join(' ')).toContain('id does not derive')
  })

  test('a different key fails', async () => {
    const transcript = await makeV1()
    const result = await verifyTranscriptV1(transcript, otherKeys.publicKey)
    expect(result.valid).toBe(false)
    expect(result.reasons.join(' ')).toContain('kid names a different key')
  })

  test('an unsigned transcript fails', async () => {
    const payload = transcriptV1({
      pan: '0000 0000 0000 0000',
      agentName: 'fixture-agent',
      enrolments: [],
      issuedAt: '2026-11-01T00:00:00Z',
    })
    const result = await verifyTranscriptV1({ id: transcriptIdV1(payload), payload, proof: null }, keys.publicKey)
    expect(result.valid).toBe(false)
    expect(result.reasons.join(' ')).toContain('unsigned')
  })
})

describe('cdut/2', () => {
  test('a signed transcript verifies with its public key', async () => {
    const transcript = await makeV2()
    const result = await verifyTranscriptV2(transcript, keys.publicKey)
    expect(result.valid).toBe(true)
    expect(result.format).toBe('cdut/2')
  })

  test('the id derives from the payload', async () => {
    const transcript = await makeV2()
    expect(transcript.id).toBe(transcriptIdV2(transcript.payload))
    expect(transcript.id).toMatch(/^cdut2-[0-9a-f]{24}$/)
  })

  test('a tampered mark fails', async () => {
    const transcript = await makeV2()
    const modules = transcript.payload.modules.map((m) =>
      m.moduleId === 'ACC102' ? { ...m, mark: 100 } : m,
    )
    const tampered: TranscriptV2 = {
      ...transcript,
      payload: { ...transcript.payload, modules },
    }
    const result = await verifyTranscriptV2(tampered, keys.publicKey)
    expect(result.valid).toBe(false)
  })

  test('module order does not change the id or the signature', async () => {
    const a = await makeV2()
    const reversed = [...a.payload.modules].reverse()
    const b = await makeV2({ modules: reversed })
    expect(b.id).toBe(a.id)
    expect(canonicalTranscriptV2(b.payload)).toBe(canonicalTranscriptV2(a.payload))
    expect((await verifyTranscriptV2(b, keys.publicKey)).valid).toBe(true)
  })

  test('an unsigned transcript fails', async () => {
    const payload = transcriptV2({
      holder: { name: 'Fixture Student' },
      programme: { id: manifest.id, version: manifest.version, manifestHash: manifestHash(manifest) },
      modules: [],
      issuedAt: '2026-11-01T00:00:00Z',
    })
    const result = await verifyTranscriptV2({ id: transcriptIdV2(payload), payload, proof: null }, keys.publicKey)
    expect(result.valid).toBe(false)
    expect(result.reasons.join(' ')).toContain('unsigned')
  })
})

describe('manifest hashing', () => {
  test('the hash is stable and 64 hex characters', () => {
    expect(manifestHash(manifest)).toBe(manifestHash(manifest))
    expect(manifestHash(manifest)).toMatch(/^[0-9a-f]{64}$/)
  })

  test('module and prerequisite order do not change the hash', () => {
    const reordered: ProgrammeManifest = {
      ...manifest,
      modules: [...manifest.modules]
        .reverse()
        .map((m) => ({ ...m, prerequisites: [...m.prerequisites].reverse() })),
    }
    expect(manifestHash(reordered)).toBe(manifestHash(manifest))
    expect(canonicalManifest(reordered)).toBe(canonicalManifest(manifest))
  })

  test('a credit change changes the hash', () => {
    const changed: ProgrammeManifest = {
      ...manifest,
      modules: manifest.modules.map((m) =>
        m.id === 'MATH101' ? { ...m, credits: 20 } : m,
      ),
    }
    expect(manifestHash(changed)).not.toBe(manifestHash(manifest))
  })
})
