/**
 * The shapes the verifier understands.
 *
 * Two transcript formats live here:
 *
 *   cdut/1  — the original `.cdut`: a signed record of enrolments and assessments.
 *             It proves *what was attempted and passed*, but it carries no
 *             programme manifest, so it cannot prove that a programme is complete.
 *
 *   cdut/2  — the same signed record plus a `programme` block (id, version and the
 *             hash of the programme manifest) and a row for every module passed.
 *             It can be checked against a manifest to answer "is this degree
 *             complete?", not just "is this file genuine?".
 *
 * Nothing in this file imports from a private tree. These are the public shapes.
 */

/** One assessment attempt. Attempts are never erased: a fail is part of the record. */
export interface Assessment {
  id: string
  degree: string
  unit: string
  attempt: number
  passed: boolean
  assessedAt: string
}

/** An enrolment in a programme. A returned enrolment stays on the record. */
export interface Enrolment {
  degree: string
  slot: number
  enrolledAt: string
  returnedAt: string | null
  jobId?: string
}

/** A consultation with a programme unit, and whether it succeeded. */
export interface Usage {
  id: string
  degree: string
  unit: string
  degreeVersion?: string
  jobId?: string
  ok: boolean
  usedAt: string
}

/** The holder of a cdut/1 transcript. */
export interface Student {
  pan: string
  agentName: string
  publicKey?: string
}

/** The exact fields a cdut/1 transcript signs. */
export interface TranscriptV1Payload {
  pan: string
  agentName: string
  issuer: string
  issuedAt: string
  /** Held and returned enrolments alike: the record survives the return. */
  degrees: Array<{ degree: string; slot: number; enrolledAt: string; returnedAt: string | null; jobId?: string }>
  consultations: Array<{ id: string; degree: string; unit: string; degreeVersion?: string; jobId?: string; ok: boolean; usedAt: string }>
  assessments: Assessment[]
  degreesEarned: string[]
  degreesConferred: string[]
  degreesAdditional: string[]
  fees: { paid: number; waived: number }
  pocketHead: string
  nextSteps: string[]
  studentKey?: string
}

/** A detached Ed25519 signature. */
export interface Proof {
  alg: 'EdDSA'
  kid: string
  signature: string
}

/** A cdut/1 transcript file. The id derives from the payload. */
export interface TranscriptV1 {
  id: string
  payload: TranscriptV1Payload
  proof: Proof | null
}

/** One module in a programme manifest. */
export interface ManifestModule {
  /** Stable module code, e.g. `MATH101`. */
  id: string
  title: string
  /** Credits at 1 credit = 10 notional hours. */
  credits: number
  /** Module ids that must be passed before this module can be credited. */
  prerequisites: string[]
}

/**
 * The published description of a programme. This is the document a transcript
 * is checked against. Its canonical hash is what the transcript commits to.
 */
export interface ProgrammeManifest {
  /** Stable programme code, e.g. `BCOM-ACC`. */
  id: string
  title: string
  /** Programme version. A curriculum change bumps this and the hash. */
  version: string
  /** NQF level, 5–10 for higher education. */
  nqfLevel: number
  /** Total credits required for the award. */
  totalCredits: number
  /** Pass mark as a percentage. A module below this is not credited. */
  passMark: number
  modules: ManifestModule[]
}

/** The programme a cdut/2 transcript was issued for. */
export interface ProgrammeRef {
  id: string
  version: string
  /** Hex sha256 of the canonical manifest the transcript was issued against. */
  manifestHash: string
}

/** One module row on a cdut/2 transcript. */
export interface TranscriptModuleRow {
  moduleId: string
  /** The credits the row claims. Completeness uses the manifest's value, not this one. */
  credits: number
  /** Percentage mark, 0–100. */
  mark: number
  /** ISO timestamp of the pass. Used to check prerequisite ordering. */
  passedAt: string
}

/** The exact fields a cdut/2 transcript signs. */
export interface TranscriptV2Payload {
  format: 'cdut/2'
  holder: { name: string; pan?: string }
  issuer: string
  issuedAt: string
  programme: ProgrammeRef
  modules: TranscriptModuleRow[]
}

/** A cdut/2 transcript file. The id derives from the payload. */
export interface TranscriptV2 {
  id: string
  payload: TranscriptV2Payload
  proof: Proof | null
}

export type AnyTranscript = TranscriptV1 | TranscriptV2

/** The result of checking a transcript's own bytes and signature. */
export interface VerificationResult {
  valid: boolean
  format: 'cdut/1' | 'cdut/2'
  reasons: string[]
}

/** A module credited before one of its prerequisites was passed. */
export interface PrerequisiteViolation {
  moduleId: string
  missingPrerequisite: string
}

/** A machine-readable reason code. Strings are for humans; codes are for software. */
export type ReasonCode =
  | 'OK'
  | 'UNSIGNED'
  | 'SIGNATURE_INVALID'
  | 'ID_MISMATCH'
  | 'KEY_UNKNOWN'
  | 'KEY_NOT_YET_VALID'
  | 'KEY_EXPIRED'
  | 'REVOKED'
  | 'FORMAT_UNKNOWN'
  | 'PROGRAMME_ID_MISMATCH'
  | 'PROGRAMME_VERSION_MISMATCH'
  | 'MANIFEST_HASH_MISMATCH'
  | 'MANIFEST_INVALID'
  | 'PAYLOAD_INVALID'
  | 'NOT_PROVABLE'
  | 'MODULE_MISSING'
  | 'MODULE_EXTRA'
  | 'CREDITS_SHORT'
  | 'PREREQUISITE_ORDER'

/** One issue in a structured verdict. */
export interface VerdictIssue {
  code: ReasonCode
  message: string
  moduleId?: string
}

/**
 * The structured verdict a verifier returns.
 *
 * `valid` is about the file: id, signature and (when supplied) key set.
 * `provable` is about completeness: it is false when no manifest was supplied,
 * when the transcript is cdut/1, or when the transcript commits to a different
 * manifest. `complete` is true only when the programme is provably complete.
 */
export interface VerdictReport {
  transcriptId: string
  format: 'cdut/1' | 'cdut/2' | 'unknown'
  valid: boolean
  provable: boolean
  complete: boolean
  /** Sorted, de-duplicated. `OK` is present when the transcript is genuine. */
  codes: ReasonCode[]
  issues: VerdictIssue[]
}

/** Why a manifest is not publishable. */
export type ManifestIssueCode =
  | 'MANIFEST_ID_EMPTY'
  | 'MANIFEST_TITLE_EMPTY'
  | 'MANIFEST_VERSION_EMPTY'
  | 'MANIFEST_NQF_OUT_OF_RANGE'
  | 'MANIFEST_TOTAL_CREDITS_INVALID'
  | 'MANIFEST_PASS_MARK_INVALID'
  | 'MANIFEST_NO_MODULES'
  | 'MODULE_ID_EMPTY'
  | 'MODULE_ID_DUPLICATE'
  | 'MODULE_TITLE_EMPTY'
  | 'MODULE_CREDITS_INVALID'
  | 'MODULE_PREREQUISITE_UNKNOWN'
  | 'MODULE_PREREQUISITE_SELF'
  | 'MODULE_PREREQUISITE_CYCLE'
  | 'MANIFEST_CREDITS_UNSATISFIABLE'

export interface ManifestIssue {
  code: ManifestIssueCode
  message: string
  moduleId?: string
}

/** The result of checking that a manifest is internally coherent. */
export interface ManifestValidation {
  valid: boolean
  /** Deterministic order: by code, then moduleId, then message. */
  issues: ManifestIssue[]
}

/** Why a transcript payload is malformed. */
export type PayloadIssueCode =
  | 'TRANSCRIPT_ID_MISMATCH'
  | 'TRANSCRIPT_FORMAT_UNKNOWN'
  | 'HOLDER_NAME_EMPTY'
  | 'ISSUED_AT_INVALID'
  | 'PROGRAMME_ID_EMPTY'
  | 'PROGRAMME_VERSION_EMPTY'
  | 'MANIFEST_HASH_INVALID'
  | 'MODULE_ID_EMPTY'
  | 'MODULE_CREDITS_INVALID'
  | 'MODULE_MARK_OUT_OF_RANGE'
  | 'MODULE_PASSED_AT_INVALID'
  | 'PAN_EMPTY'
  | 'AGENT_NAME_EMPTY'
  | 'ENROLMENT_SLOT_INVALID'
  | 'ASSESSMENT_ATTEMPT_INVALID'
  | 'ASSESSMENT_DATE_INVALID'

export interface PayloadIssue {
  code: PayloadIssueCode
  message: string
  moduleId?: string
}

/** The result of checking a transcript payload's own fields. */
export interface PayloadValidation {
  valid: boolean
  /** Deterministic order: by code, then moduleId, then message. */
  issues: PayloadIssue[]
}

/** One revoked transcript. Revocation is by transcript id, not by holder. */
export interface RevocationEntry {
  transcriptId: string
  revokedAt: string
  reason: string
}

/**
 * A signed revocation list. The registrar publishes it; a verifier checks the
 * signature before believing a transcript is revoked.
 */
export interface RevocationList {
  issuer: string
  publishedAt: string
  entries: RevocationEntry[]
  proof: Proof | null
}

/** One key in a published key set. Windows are inclusive. */
export interface KeySetEntry {
  kid: string
  publicKey: string
  notBefore: string
  notAfter: string
}

/** A published key set, used to verify transcripts across key rotation. */
export interface KeySet {
  issuer: string
  keys: KeySetEntry[]
}

/** The result of checking a signature over a non-transcript document. */
export interface DocumentVerification {
  valid: boolean
  reasons: string[]
}

/** The result of checking a transcript against a programme manifest. */
export interface CompletenessResult {
  /**
   * Whether the transcript could be checked against this manifest at all.
   * False for cdut/1, for a manifest-hash mismatch, or for a programme
   * id/version mismatch. `complete` is always false when `provable` is false.
   */
  provable: boolean
  complete: boolean
  programme?: { id: string; title: string; version: string; nqfLevel: number }
  /** Credits earned, counted from the manifest and only for passing modules. */
  credits: number
  /** Credits the manifest requires for the award. */
  requiredCredits: number
  /** Manifest module ids with no passing row on the transcript. */
  missing: string[]
  /** Transcript module ids that are not in the manifest. */
  extra: string[]
  prerequisiteViolations: PrerequisiteViolation[]
  reasons: string[]
}
