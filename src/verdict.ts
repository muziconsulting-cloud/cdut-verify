/**
 * The structured verdict — one report for a human and a machine.
 *
 * The existing verify functions return `reasons: string[]`, which is right for a
 * CLI and wrong for software: a caller cannot branch on prose. This module
 * returns stable codes for every failure, combines signature, payload, manifest,
 * completeness and revocation into one report, and keeps the human-readable
 * message alongside each code.
 *
 * The task is in `BACKLOG.md` (workstream D) and `test/verdict.test.ts`.
 */

import type {
  AnyTranscript,
  ProgrammeManifest,
  RevocationList,
  VerdictReport,
} from './types.ts'

export interface VerdictOptions {
  /** The key to verify the transcript against. Falls back to AVC_PUBLIC_KEY. */
  publicKey?: string
  /** When supplied, completeness is checked and `provable` can become true. */
  manifest?: ProgrammeManifest
  /** When supplied, a revoked transcript is reported as such. */
  revocation?: RevocationList
  /** The instant used for key windows and revocation. Defaults to now. */
  at?: string
}

/** Verify a transcript and return a structured verdict. */
export async function verifyReport(
  _transcript: AnyTranscript,
  _options: VerdictOptions = {},
): Promise<VerdictReport> {
  throw new Error('verifyReport is not implemented yet — see BACKLOG.md, workstream D')
}
