/**
 * Payload integrity — are the transcript's own fields well formed?
 *
 * Signature verification proves the bytes are the registrar's. It does not prove
 * the bytes make sense: a mark of 140, a negative credit value, an unparseable
 * timestamp or a manifest hash of the wrong length all survive a valid signature.
 * A verifier that reports "valid" for those has verified the wrong thing.
 *
 * The task is in `BACKLOG.md` (workstream C) and `test/payload.test.ts`.
 */

import type { AnyTranscript, PayloadValidation } from './types.ts'

/** Check a transcript payload's fields. Deterministic issue order. */
export function validatePayload(_transcript: AnyTranscript): PayloadValidation {
  throw new Error('validatePayload is not implemented yet — see BACKLOG.md, workstream C')
}
