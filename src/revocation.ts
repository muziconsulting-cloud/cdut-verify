/**
 * Revocation and key rotation.
 *
 * A signature says a transcript was issued. It does not say the registrar still
 * stands behind it: a degree can be withdrawn for fraud, and a key can be
 * retired. Both are ordinary events in a real registrar, and a verifier that
 * ignores them is only checking the past.
 *
 * A revocation list is signed like a transcript. A key set lists every public
 * key with the window in which it was valid, so a transcript signed three years
 * ago still verifies today without keeping the old key trusted forever.
 */

import {
  canonicalRevocationList,
  canonicalTranscriptV1,
  canonicalTranscriptV2,
} from './canonical.ts'
import { keyId, readEnv, signCanonical, verifyCanonical } from './sign.ts'
import type {
  AnyTranscript,
  DocumentVerification,
  KeySet,
  RevocationEntry,
  RevocationList,
  TranscriptV1,
  TranscriptV2,
  VerificationResult,
} from './types.ts'
import type { SigningKeys } from './transcript.ts'

export interface RevocationInput {
  issuer: string
  publishedAt: string
  entries: RevocationEntry[]
}

const isV2 = (transcript: AnyTranscript): transcript is TranscriptV2 =>
  (transcript.payload as { format?: string }).format === 'cdut/2'

/** Sign a revocation list. Without keys the proof is null. */
export async function issueRevocationList(
  input: RevocationInput,
  keys?: SigningKeys,
): Promise<RevocationList> {
  const list: RevocationList = {
    issuer: input.issuer,
    publishedAt: input.publishedAt,
    entries: input.entries,
    proof: null,
  }

  if (!keys) return list

  const signature = await signCanonical(canonicalRevocationList(list), keys.privateKey)
  return {
    ...list,
    proof: { alg: 'EdDSA', kid: keyId(keys.publicKey), signature },
  }
}

/** Verify a revocation list's own signature. */
export async function verifyRevocationList(
  list: RevocationList,
  publicKey?: string,
): Promise<DocumentVerification> {
  const reasons: string[] = []

  if (!list.proof) {
    reasons.push('unsigned: no proof block')
    return { valid: false, reasons }
  }

  const raw = publicKey ?? readEnv('AVC_PUBLIC_KEY')
  if (!raw) {
    reasons.push('no public key to verify against')
    return { valid: false, reasons }
  }

  if (list.proof.kid !== keyId(raw)) {
    reasons.push(`the kid names a different key (${list.proof.kid})`)
  }

  const ok = await verifyCanonical(canonicalRevocationList(list), list.proof.signature, raw)
  if (!ok) {
    reasons.push('the signature does not verify over the canonical bytes')
  }

  return { valid: reasons.length === 0, reasons }
}

/** Is this transcript on the list? The list's signature is the caller's job. */
export function checkRevocation(
  transcript: AnyTranscript,
  list: RevocationList,
): { revoked: boolean; entry?: RevocationEntry } {
  const entry = list.entries.find((candidate) => candidate.transcriptId === transcript.id)
  return entry ? { revoked: true, entry } : { revoked: false }
}

/**
 * Verify a transcript against a published key set. The transcript's `kid`
 * selects the key; the key's window is checked against `at`.
 */
export async function verifyWithKeySet(
  transcript: AnyTranscript,
  keySet: KeySet,
  at?: string,
): Promise<VerificationResult> {
  const format: 'cdut/1' | 'cdut/2' = isV2(transcript) ? 'cdut/2' : 'cdut/1'
  const reasons: string[] = []

  if (!transcript.proof) {
    reasons.push('unsigned: no proof block')
    return { valid: false, format, reasons }
  }

  const entry = keySet.keys.find((candidate) => candidate.kid === transcript.proof!.kid)
  if (!entry) {
    reasons.push(`unknown key: no key in the set has kid ${transcript.proof.kid}`)
    return { valid: false, format, reasons }
  }

  const instant = Date.parse(at ?? new Date().toISOString())
  const notBefore = Date.parse(entry.notBefore)
  const notAfter = Date.parse(entry.notAfter)

  if (instant < notBefore) {
    reasons.push(`the key is not yet valid (notBefore ${entry.notBefore})`)
  } else if (instant > notAfter) {
    reasons.push(`the key is expired (notAfter ${entry.notAfter})`)
  }

  const canonical = isV2(transcript)
    ? canonicalTranscriptV2(transcript.payload)
    : canonicalTranscriptV1((transcript as TranscriptV1).payload)

  const ok = await verifyCanonical(canonical, transcript.proof.signature, entry.publicKey)
  if (!ok) {
    reasons.push('the signature does not verify over the canonical bytes')
  }

  return { valid: reasons.length === 0, format, reasons }
}
