/**
 * Manifest integrity — is this curriculum publishable at all?
 *
 * A transcript commits to a manifest hash, so the verifier can only be as honest
 * as the manifest is coherent. A manifest with a duplicate module id, a
 * prerequisite that names a module that does not exist, a prerequisite cycle, or
 * a credit total no student can reach is not a curriculum: it is a document that
 * cannot be checked.
 *
 * The task is in `BACKLOG.md` (workstream B) and `test/manifest.test.ts`.
 */

import type { ManifestValidation, ProgrammeManifest } from './types.ts'

/** Check that a manifest is internally coherent. Deterministic issue order. */
export function validateManifest(_manifest: ProgrammeManifest): ManifestValidation {
  throw new Error('validateManifest is not implemented yet — see BACKLOG.md, workstream B')
}
