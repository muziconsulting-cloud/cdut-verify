/**
 * Issue and verify `.cdut` transcripts, and check them against a programme
 * manifest.
 *
 * Verification is deliberately split in two:
 *
 *   verifyTranscript(transcript)          — is this file genuine? It checks the
 *                                           id derives from the payload and the
 *                                           Ed25519 signature verifies.
 *
 *   verifyCompleteness(transcript, manifest)
 *                                         — is this programme complete? It checks
 *                                           the transcript's manifest hash, the
 *                                           required modules, the credits and the
 *                                           prerequisite order.
 *
 * Neither needs a network, a database or the issuer. Everything is checked from
 * the file's own bytes plus a public key and, for completeness, the manifest.
 */

import { createHash } from 'node:crypto'
import {
  canonicalManifest,
  canonicalTranscriptV1,
  canonicalTranscriptV2,
  manifestHash,
  transcriptIdV1,
  transcriptIdV2,
} from './canonical.ts'
import { keyId, readEnv, signCanonical, verifyCanonical } from './sign.ts'
import type {
  AnyTranscript,
  CompletenessResult,
  PrerequisiteViolation,
  ProgrammeManifest,
  Proof,
  TranscriptModuleRow,
  TranscriptV1,
  TranscriptV1Payload,
  TranscriptV2,
  TranscriptV2Payload,
  VerificationResult,
} from './types.ts'

export const TRANSCRIPT_ISSUER = 'Conquest Designer University — the Registrar'
export const CDUT_MEDIA_TYPE = 'application/cdut+json'

/** Explicit signing material. When omitted, the environment is read. */
export interface SigningKeys {
  privateKey: string
  publicKey: string
}

function signingKeys(keys?: SigningKeys): SigningKeys | undefined {
  if (keys) return keys
  const privateKey = readEnv('AVC_PRIVATE_KEY')
  const publicKey = readEnv('AVC_PUBLIC_KEY')
  if (!privateKey || !publicKey) return undefined
  return { privateKey, publicKey }
}

function isV2(transcript: AnyTranscript): transcript is TranscriptV2 {
  return (transcript.payload as { format?: string }).format === 'cdut/2'
}

/* ------------------------------------------------------------------------- *
 * cdut/1 — the original transcript
 * ------------------------------------------------------------------------- */

/** Build a cdut/1 payload from rows. Pure: rows in, payload out. */
export function transcriptV1(input: {
  pan: string
  agentName: string
  enrolments: Array<{ degree: string; slot: number; enrolledAt: string; returnedAt: string | null; jobId?: string }>
  consultations?: Array<{ id: string; degree: string; unit: string; degreeVersion?: string; jobId?: string; ok: boolean; usedAt: string }>
  assessments?: Array<{ id: string; degree: string; unit: string; attempt: number; passed: boolean; assessedAt: string }>
  degreesEarned?: string[]
  degreesConferred?: { conferred: string[]; additional: string[] }
  fees?: { paid: number; waived: number }
  pocketHead?: string
  nextSteps?: string[]
  studentKey?: string
  issuedAt?: string
}): TranscriptV1Payload {
  const earned = input.degreesEarned ?? []
  return {
    pan: input.pan,
    agentName: input.agentName,
    issuer: TRANSCRIPT_ISSUER,
    issuedAt: input.issuedAt ?? new Date().toISOString(),
    degrees: input.enrolments.map((e) => ({
      degree: e.degree,
      slot: e.slot,
      enrolledAt: e.enrolledAt,
      returnedAt: e.returnedAt,
      ...(e.jobId ? { jobId: e.jobId } : {}),
    })),
    consultations: (input.consultations ?? []).map((c) => ({
      id: c.id,
      degree: c.degree,
      unit: c.unit,
      ...(c.degreeVersion ? { degreeVersion: c.degreeVersion } : {}),
      ...(c.jobId ? { jobId: c.jobId } : {}),
      ok: c.ok,
      usedAt: c.usedAt,
    })),
    assessments: (input.assessments ?? []).map((a) => ({
      id: a.id,
      degree: a.degree,
      unit: a.unit,
      attempt: a.attempt,
      passed: a.passed,
      assessedAt: a.assessedAt,
    })),
    degreesEarned: earned,
    degreesConferred: input.degreesConferred?.conferred ?? earned.slice(0, 5),
    degreesAdditional: input.degreesConferred?.additional ?? earned.slice(5),
    fees: input.fees ?? { paid: 0, waived: 0 },
    pocketHead: input.pocketHead ?? '',
    nextSteps: (input.nextSteps ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 12),
    ...(input.studentKey ? { studentKey: input.studentKey } : {}),
  }
}

/** Issue a cdut/1 transcript. Without keys the proof is null. */
export async function issueTranscriptV1(
  payload: TranscriptV1Payload,
  keys?: SigningKeys,
): Promise<TranscriptV1> {
  const id = transcriptIdV1(payload)
  const material = signingKeys(keys)
  if (!material) return { id, payload, proof: null }
  const signature = await signCanonical(canonicalTranscriptV1(payload), material.privateKey)
  const proof: Proof = { alg: 'EdDSA', kid: keyId(material.publicKey), signature }
  return { id, payload, proof }
}

/* ------------------------------------------------------------------------- *
 * cdut/2 — the programme-bearing transcript
 * ------------------------------------------------------------------------- */

/** Build a cdut/2 payload. The caller supplies the manifest hash it commits to. */
export function transcriptV2(input: {
  holder: { name: string; pan?: string }
  programme: { id: string; version: string; manifestHash: string }
  modules: Array<{ moduleId: string; credits: number; mark: number; passedAt: string }>
  issuedAt?: string
}): TranscriptV2Payload {
  return {
    format: 'cdut/2',
    holder: input.holder,
    issuer: TRANSCRIPT_ISSUER,
    issuedAt: input.issuedAt ?? new Date().toISOString(),
    programme: input.programme,
    modules: input.modules,
  }
}

/** Issue a cdut/2 transcript. Without keys the proof is null. */
export async function issueTranscriptV2(
  payload: TranscriptV2Payload,
  keys?: SigningKeys,
): Promise<TranscriptV2> {
  const id = transcriptIdV2(payload)
  const material = signingKeys(keys)
  if (!material) return { id, payload, proof: null }
  const signature = await signCanonical(canonicalTranscriptV2(payload), material.privateKey)
  const proof: Proof = { alg: 'EdDSA', kid: keyId(material.publicKey), signature }
  return { id, payload, proof }
}

/* ------------------------------------------------------------------------- *
 * Verification
 * ------------------------------------------------------------------------- */

/** Verify a cdut/1 transcript from its own bytes and a public key. */
export async function verifyTranscriptV1(
  transcript: TranscriptV1,
  publicKey?: string,
): Promise<VerificationResult> {
  const reasons: string[] = []
  const expectedId = transcriptIdV1(transcript.payload)
  if (transcript.id !== expectedId) {
    reasons.push(`the id does not derive from the content (expected ${expectedId})`)
  }
  if (!transcript.proof) {
    reasons.push('unsigned: no proof block (issued without a key)')
    return { valid: false, format: 'cdut/1', reasons }
  }
  const raw = publicKey ?? readEnv('AVC_PUBLIC_KEY')
  if (!raw) {
    reasons.push('no public key to verify against')
    return { valid: false, format: 'cdut/1', reasons }
  }
  if (transcript.proof.kid !== keyId(raw)) {
    reasons.push(`the kid names a different key (${transcript.proof.kid})`)
  }
  const ok = await verifyCanonical(
    canonicalTranscriptV1(transcript.payload),
    transcript.proof.signature,
    raw,
  )
  if (!ok) reasons.push('the signature does not verify over the canonical bytes')
  return { valid: reasons.length === 0, format: 'cdut/1', reasons }
}

/** Verify a cdut/2 transcript from its own bytes and a public key. */
export async function verifyTranscriptV2(
  transcript: TranscriptV2,
  publicKey?: string,
): Promise<VerificationResult> {
  const reasons: string[] = []
  const expectedId = transcriptIdV2(transcript.payload)
  if (transcript.id !== expectedId) {
    reasons.push(`the id does not derive from the content (expected ${expectedId})`)
  }
  if (!transcript.proof) {
    reasons.push('unsigned: no proof block (issued without a key)')
    return { valid: false, format: 'cdut/2', reasons }
  }
  const raw = publicKey ?? readEnv('AVC_PUBLIC_KEY')
  if (!raw) {
    reasons.push('no public key to verify against')
    return { valid: false, format: 'cdut/2', reasons }
  }
  if (transcript.proof.kid !== keyId(raw)) {
    reasons.push(`the kid names a different key (${transcript.proof.kid})`)
  }
  const ok = await verifyCanonical(
    canonicalTranscriptV2(transcript.payload),
    transcript.proof.signature,
    raw,
  )
  if (!ok) reasons.push('the signature does not verify over the canonical bytes')
  return { valid: reasons.length === 0, format: 'cdut/2', reasons }
}

/** Verify either format. The format is read from the payload, never the file name. */
export async function verifyTranscript(
  transcript: AnyTranscript,
  publicKey?: string,
): Promise<VerificationResult> {
  return isV2(transcript)
    ? verifyTranscriptV2(transcript, publicKey)
    : verifyTranscriptV1(transcript as TranscriptV1, publicKey)
}

/* ------------------------------------------------------------------------- *
 * Completeness
 * ------------------------------------------------------------------------- */

/**
 * Check a transcript against a programme manifest.
 *
 * This is the task. The signature only says the file is genuine; this function
 * answers whether the programme was actually completed.
 *
 * The contract is written out in `TASK.md`. The baseline tests in
 * `test/transcript.test.ts` pass today; `test/completeness.test.ts` fails until
 * this function is implemented.
 *
 * @param transcript a cdut/1 or cdut/2 transcript
 * @param manifest   the published programme manifest to check it against
 */
export function verifyCompleteness(
  transcript: AnyTranscript,
  manifest: ProgrammeManifest,
): CompletenessResult {
  const requiredCredits = manifest.totalCredits
  const empty: CompletenessResult = {
    provable: false,
    complete: false,
    credits: 0,
    requiredCredits,
    missing: [],
    extra: [],
    prerequisiteViolations: [],
    reasons: [],
  }

  if (!isV2(transcript)) {
    return {
      ...empty,
      reasons: [
        'a cdut/1 transcript carries no programme manifest, so completeness cannot be proved against it',
      ],
    }
  }

  const payload = transcript.payload as TranscriptV2Payload
  const reasons: string[] = []
  const hash = manifestHash(manifest)

  if (payload.programme.id !== manifest.id) {
    reasons.push(
      `the transcript is for programme ${payload.programme.id}, not ${manifest.id}`,
    )
  }
  if (payload.programme.version !== manifest.version) {
    reasons.push(
      `the transcript commits to programme version ${payload.programme.version}, not ${manifest.version}`,
    )
  }
  if (payload.programme.manifestHash !== hash) {
    reasons.push(
      `the transcript commits to manifest hash ${payload.programme.manifestHash}, not ${hash}`,
    )
  }

  if (reasons.length > 0) {
    return { ...empty, reasons }
  }

  const rows = new Map<string, TranscriptModuleRow>()
  for (const row of payload.modules ?? []) rows.set(row.moduleId, row)

  const passes = (row: TranscriptModuleRow | undefined): boolean =>
    row !== undefined && row.mark >= manifest.passMark

  const manifestIds = new Set(manifest.modules.map((module) => module.id))
  const missing: string[] = []
  const extra: string[] = []
  let credits = 0

  for (const module of manifest.modules) {
    if (passes(rows.get(module.id))) {
      credits += module.credits
    } else {
      missing.push(module.id)
    }
  }

  for (const row of payload.modules ?? []) {
    if (!manifestIds.has(row.moduleId)) extra.push(row.moduleId)
  }

  const prerequisiteViolations: PrerequisiteViolation[] = []
  for (const module of manifest.modules) {
    const row = rows.get(module.id)
    if (!passes(row)) continue
    for (const prerequisiteId of module.prerequisites) {
      const prerequisite = rows.get(prerequisiteId)
      if (!passes(prerequisite)) {
        prerequisiteViolations.push({
          moduleId: module.id,
          missingPrerequisite: prerequisiteId,
        })
      } else if (Date.parse(prerequisite!.passedAt) > Date.parse(row!.passedAt)) {
        prerequisiteViolations.push({
          moduleId: module.id,
          missingPrerequisite: prerequisiteId,
        })
      }
    }
  }

  missing.sort()
  extra.sort()
  prerequisiteViolations.sort((a, b) => {
    if (a.moduleId !== b.moduleId) return a.moduleId < b.moduleId ? -1 : 1
    if (a.missingPrerequisite !== b.missingPrerequisite) {
      return a.missingPrerequisite < b.missingPrerequisite ? -1 : 1
    }
    return 0
  })

  if (credits < requiredCredits) {
    reasons.push(
      `the transcript has ${credits} credits but the award requires ${requiredCredits}`,
    )
  }
  if (missing.length > 0) {
    reasons.push(`missing modules: ${missing.join(', ')}`)
  }
  if (prerequisiteViolations.length > 0) {
    reasons.push(
      `prerequisite order: ${prerequisiteViolations
        .map((violation) => `${violation.moduleId} before ${violation.missingPrerequisite}`)
        .join(', ')}`,
    )
  }

  const complete =
    missing.length === 0 &&
    credits >= requiredCredits &&
    prerequisiteViolations.length === 0

  return {
    provable: true,
    complete,
    programme: {
      id: manifest.id,
      title: manifest.title,
      version: manifest.version,
      nqfLevel: manifest.nqfLevel,
    },
    credits,
    requiredCredits,
    missing,
    extra,
    prerequisiteViolations,
    reasons,
  }
}

/** Convenience: the manifest hash a registrar would publish. */
export function hashManifest(manifest: ProgrammeManifest): string {
  return manifestHash(manifest)
}

/** Convenience: the canonical manifest bytes, for publishing or diffing. */
export function canonicaliseManifest(manifest: ProgrammeManifest): string {
  return canonicalManifest(manifest)
}

/** Convenience: a content id for arbitrary bytes, used by callers and tests. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}
