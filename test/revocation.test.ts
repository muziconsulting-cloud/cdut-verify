/**
 * Workstream E: revocation and key rotation.
 *
 * A signature proves a transcript was issued. It does not prove the registrar
 * still stands behind it, and it does not survive a key being retired. These
 * tests fail until `src/revocation.ts` is implemented.
 *
 * Run only this file:
 *   bun test test/revocation.test.ts
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import {
  canonicalRevocationList,
  checkRevocation,
  generateKeyPair,
  issueRevocationList,
  issueTranscriptV2,
  keyId,
  manifestHash,
  transcriptV2,
  verifyRevocationList,
  verifyWithKeySet,
} from '../src/index.ts'
import type {
  KeySet,
  ProgrammeManifest,
  RevocationList,
  TranscriptV2,
} from '../src/types.ts'

let keys: { privateKey: string; publicKey: string }
let otherKeys: { privateKey: string; publicKey: string }

beforeAll(async () => {
  keys = await generateKeyPair()
  otherKeys = await generateKeyPair()
})

const manifest: ProgrammeManifest = {
  id: 'BCOM-ACC',
  title: 'Bachelor of Commerce in Accounting',
  version: '2026.1',
  nqfLevel: 7,
  totalCredits: 15,
  passMark: 50,
  modules: [{ id: 'ACC101', title: 'Accounting I', credits: 15, prerequisites: [] }],
}

async function makeTranscript(): Promise<TranscriptV2> {
  const payload = transcriptV2({
    holder: { name: 'Fixture Student', pan: '0000 0000 0000 0000' },
    programme: {
      id: manifest.id,
      version: manifest.version,
      manifestHash: manifestHash(manifest),
    },
    modules: [{ moduleId: 'ACC101', credits: 15, mark: 72, passedAt: '2026-02-10T00:00:00Z' }],
    issuedAt: '2026-11-01T00:00:00Z',
  })
  return issueTranscriptV2(payload, keys)
}

async function makeList(transcript: TranscriptV2): Promise<RevocationList> {
  return issueRevocationList(
    {
      issuer: 'Conquest Designer University — the Registrar',
      publishedAt: '2026-11-02T00:00:00Z',
      entries: [
        {
          transcriptId: transcript.id,
          revokedAt: '2026-11-03T00:00:00Z',
          reason: 'issued in error',
        },
        {
          transcriptId: 'cdut2-000000000000000000000000',
          revokedAt: '2026-11-04T00:00:00Z',
          reason: 'withdrawn for fraud',
        },
      ],
    },
    keys,
  )
}

describe('revocation: the list is signed like a transcript', () => {
  test('a signed list verifies with its public key', async () => {
    const list = await makeList(await makeTranscript())
    const result = await verifyRevocationList(list, keys.publicKey)
    expect(result.valid).toBe(true)
    expect(result.reasons).toEqual([])
  })

  test('a tampered list fails', async () => {
    const list = await makeList(await makeTranscript())
    const tampered: RevocationList = {
      ...list,
      entries: list.entries.map((entry) => ({ ...entry, reason: 'nothing to see here' })),
    }
    const result = await verifyRevocationList(tampered, keys.publicKey)
    expect(result.valid).toBe(false)
  })

  test('an unsigned list fails', async () => {
    const list = await makeList(await makeTranscript())
    const result = await verifyRevocationList({ ...list, proof: null }, keys.publicKey)
    expect(result.valid).toBe(false)
    expect(result.reasons.join(' ')).toMatch(/unsigned/i)
  })

  test('entry order does not change the canonical bytes', async () => {
    const list = await makeList(await makeTranscript())
    const reversed = { ...list, entries: [...list.entries].reverse() }
    expect(canonicalRevocationList(reversed)).toBe(canonicalRevocationList(list))
  })
})

describe('revocation: is this transcript on the list?', () => {
  test('a listed transcript is revoked and the reason is returned', async () => {
    const transcript = await makeTranscript()
    const list = await makeList(transcript)
    const result = checkRevocation(transcript, list)
    expect(result.revoked).toBe(true)
    expect(result.entry?.reason).toBe('issued in error')
  })

  test('an unlisted transcript is not revoked', async () => {
    const transcript = await makeTranscript()
    const list = await makeList(transcript)
    const other = await makeTranscript()
    const result = checkRevocation({ ...other, id: 'cdut2-111111111111111111111111' }, list)
    expect(result.revoked).toBe(false)
    expect(result.entry).toBeUndefined()
  })
})

describe('key set: rotation without keeping old keys trusted forever', () => {
  const keySet = (): KeySet => ({
    issuer: 'Conquest Designer University — the Registrar',
    keys: [
      {
        kid: keyId(keys.publicKey),
        publicKey: keys.publicKey,
        notBefore: '2026-01-01T00:00:00Z',
        notAfter: '2026-12-31T23:59:59Z',
      },
      {
        kid: keyId(otherKeys.publicKey),
        publicKey: otherKeys.publicKey,
        notBefore: '2027-01-01T00:00:00Z',
        notAfter: '2027-12-31T23:59:59Z',
      },
    ],
  })

  test('a transcript verifies inside its key window', async () => {
    const transcript = await makeTranscript()
    const result = await verifyWithKeySet(transcript, keySet(), '2026-06-01T00:00:00Z')
    expect(result.valid).toBe(true)
    expect(result.format).toBe('cdut/2')
  })

  test('an unknown kid is rejected', async () => {
    const transcript = await makeTranscript()
    const stranger: KeySet = {
      issuer: 'somewhere else',
      keys: [
        {
          kid: keyId(otherKeys.publicKey),
          publicKey: otherKeys.publicKey,
          notBefore: '2026-01-01T00:00:00Z',
          notAfter: '2027-12-31T23:59:59Z',
        },
      ],
    }
    const result = await verifyWithKeySet(transcript, stranger, '2026-06-01T00:00:00Z')
    expect(result.valid).toBe(false)
    expect(result.reasons.join(' ')).toMatch(/unknown key/i)
  })

  test('a key used before its window is rejected', async () => {
    const transcript = await makeTranscript()
    const result = await verifyWithKeySet(transcript, keySet(), '2025-12-31T00:00:00Z')
    expect(result.valid).toBe(false)
    expect(result.reasons.join(' ')).toMatch(/not yet valid/i)
  })

  test('a key used after its window is rejected even if a newer key exists', async () => {
    const transcript = await makeTranscript()
    const result = await verifyWithKeySet(transcript, keySet(), '2027-06-01T00:00:00Z')
    expect(result.valid).toBe(false)
    expect(result.reasons.join(' ')).toMatch(/expired/i)
  })

  test('the window is inclusive at both ends', async () => {
    const transcript = await makeTranscript()
    const start = await verifyWithKeySet(transcript, keySet(), '2026-01-01T00:00:00Z')
    const end = await verifyWithKeySet(transcript, keySet(), '2026-12-31T23:59:59Z')
    expect(start.valid).toBe(true)
    expect(end.valid).toBe(true)
  })
})
