/**
 * Canonical serialization and content hashing.
 *
 * A transcript is signed over its *canonical bytes*: a deterministic JSON string
 * with a fixed key order and no whitespace. That gives two properties:
 *
 *   - the same payload always produces the same bytes, and therefore the same id;
 *   - a tampered payload produces different bytes, and therefore a different id.
 *
 * The id is derived from the payload, not from the issue timestamp, so two copies
 * of the same record are the same transcript.
 */

import { createHash } from 'node:crypto'
import type {
  ProgrammeManifest,
  RevocationList,
  TranscriptV1Payload,
  TranscriptV2Payload,
} from './types.ts'

/** Hex sha256 of a UTF-8 string. */
export function contentHash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/**
 * The canonical bytes of a cdut/1 payload.
 *
 * Key order is written out explicitly. Never rely on object insertion order for
 * signed data: it changes silently when a field is added.
 */
export function canonicalTranscriptV1(payload: TranscriptV1Payload): string {
  return JSON.stringify({
    pan: payload.pan,
    agentName: payload.agentName,
    issuer: payload.issuer,
    issuedAt: payload.issuedAt,
    degrees: payload.degrees.map((d) => ({
      degree: d.degree,
      slot: d.slot,
      enrolledAt: d.enrolledAt,
      returnedAt: d.returnedAt,
      ...(d.jobId ? { jobId: d.jobId } : {}),
    })),
    consultations: payload.consultations.map((c) => ({
      id: c.id,
      degree: c.degree,
      unit: c.unit,
      ...(c.degreeVersion ? { degreeVersion: c.degreeVersion } : {}),
      ...(c.jobId ? { jobId: c.jobId } : {}),
      ok: c.ok,
      usedAt: c.usedAt,
    })),
    assessments: payload.assessments.map((a) => ({
      id: a.id,
      degree: a.degree,
      unit: a.unit,
      attempt: a.attempt,
      passed: a.passed,
      assessedAt: a.assessedAt,
    })),
    degreesEarned: [...payload.degreesEarned].sort(),
    degreesConferred: payload.degreesConferred,
    degreesAdditional: [...payload.degreesAdditional].sort(),
    fees: { paid: payload.fees.paid, waived: payload.fees.waived },
    pocketHead: payload.pocketHead,
    nextSteps: payload.nextSteps,
    ...(payload.studentKey ? { studentKey: payload.studentKey } : {}),
  })
}

/** The id of a cdut/1 transcript: `cdut-<24 hex>`, derived from the payload. */
export const transcriptIdV1 = (payload: TranscriptV1Payload): string =>
  `cdut-${contentHash(canonicalTranscriptV1(payload)).slice(0, 24)}`

/**
 * The canonical bytes of a programme manifest.
 *
 * Module order is normalized by id and prerequisites are sorted, so two
 * publications of the same curriculum hash the same regardless of the order
 * the author wrote the modules in.
 */
export function canonicalManifest(manifest: ProgrammeManifest): string {
  return JSON.stringify({
    id: manifest.id,
    title: manifest.title,
    version: manifest.version,
    nqfLevel: manifest.nqfLevel,
    totalCredits: manifest.totalCredits,
    passMark: manifest.passMark,
    modules: [...manifest.modules]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((m) => ({
        id: m.id,
        title: m.title,
        credits: m.credits,
        prerequisites: [...m.prerequisites].sort(),
      })),
  })
}

/** The hash a transcript commits to. Hex sha256. */
export const manifestHash = (manifest: ProgrammeManifest): string =>
  contentHash(canonicalManifest(manifest))

/**
 * The canonical bytes of a cdut/2 payload.
 *
 * Module rows are sorted by module id so the order a registrar writes them in
 * does not change the signature.
 */
export function canonicalTranscriptV2(payload: TranscriptV2Payload): string {
  return JSON.stringify({
    format: payload.format,
    holder: {
      name: payload.holder.name,
      ...(payload.holder.pan ? { pan: payload.holder.pan } : {}),
    },
    issuer: payload.issuer,
    issuedAt: payload.issuedAt,
    programme: {
      id: payload.programme.id,
      version: payload.programme.version,
      manifestHash: payload.programme.manifestHash,
    },
    modules: [...payload.modules]
      .sort((a, b) => (a.moduleId < b.moduleId ? -1 : a.moduleId > b.moduleId ? 1 : 0))
      .map((m) => ({
        moduleId: m.moduleId,
        credits: m.credits,
        mark: m.mark,
        passedAt: m.passedAt,
      })),
  })
}

/** The id of a cdut/2 transcript: `cdut2-<24 hex>`, derived from the payload. */
export const transcriptIdV2 = (payload: TranscriptV2Payload): string =>
  `cdut2-${contentHash(canonicalTranscriptV2(payload)).slice(0, 24)}`

/**
 * The canonical bytes of a revocation list.
 *
 * Entries are sorted by transcript id, so the order a registrar writes them in
 * does not change the signature.
 */
export function canonicalRevocationList(list: RevocationList): string {
  return JSON.stringify({
    issuer: list.issuer,
    publishedAt: list.publishedAt,
    entries: [...list.entries]
      .sort((a, b) =>
        a.transcriptId < b.transcriptId ? -1 : a.transcriptId > b.transcriptId ? 1 : 0,
      )
      .map((entry) => ({
        transcriptId: entry.transcriptId,
        revokedAt: entry.revokedAt,
        reason: entry.reason,
      })),
  })
}
