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
 *
 * The task is in `BACKLOG.md` (workstream E) and `test/revocation.test.ts`.
 */

import type {
  AnyTranscript,
  DocumentVerification,
  KeySet,
  RevocationEntry,
  RevocationList,
  VerificationResult,
} from './types.ts'
import type { SigningKeys } from './transcript.ts'

export interface RevocationInput {
  issuer: string
  publishedAt: string
  entries: RevocationEntry[]
}

/** Sign a revocation list. Without keys the proof is null. */
export async function issueRevocationList(
  _input: RevocationInput,
  _keys?: SigningKeys,
): Promise<RevocationList> {
  throw new Error('issueRevocationList is not implemented yet — see BACKLOG.md, workstream E')
}

/** Verify a revocation list's own signature. */
export async function verifyRevocationList(
  _list: RevocationList,
  _publicKey?: string,
): Promise<DocumentVerification> {
  throw new Error('verifyRevocationList is not implemented yet — see BACKLOG.md, workstream E')
}

/** Is this transcript on the list? The list's signature is the caller's job. */
export function checkRevocation(
  _transcript: AnyTranscript,
  _list: RevocationList,
): { revoked: boolean; entry?: RevocationEntry } {
  throw new Error('checkRevocation is not implemented yet — see BACKLOG.md, workstream E')
}

/**
 * Verify a transcript against a published key set. The transcript's `kid`
 * selects the key; the key's window is checked against `at`.
 */
export async function verifyWithKeySet(
  _transcript: AnyTranscript,
  _keySet: KeySet,
  _at?: string,
): Promise<VerificationResult> {
  throw new Error('verifyWithKeySet is not implemented yet — see BACKLOG.md, workstream E')
}
