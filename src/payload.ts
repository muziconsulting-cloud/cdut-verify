/**
 * Payload integrity — are the transcript's own fields well formed?
 *
 * Signature verification proves the bytes are the registrar's. It does not prove
 * the bytes make sense: a mark of 140, a negative credit value, an unparseable
 * timestamp or a manifest hash of the wrong length all survive a valid signature.
 * A verifier that reports "valid" for those has verified the wrong thing.
 */

import { transcriptIdV1, transcriptIdV2 } from './canonical.ts'
import type {
  AnyTranscript,
  PayloadIssue,
  PayloadValidation,
  TranscriptV1Payload,
  TranscriptV2Payload,
} from './types.ts'

const isNonEmpty = (value: unknown): boolean =>
  typeof value === 'string' && value.trim() !== ''

const isPositiveInteger = (value: unknown): boolean =>
  typeof value === 'number' && Number.isInteger(value) && value > 0

const isDate = (value: unknown): boolean =>
  typeof value === 'string' && Number.isFinite(Date.parse(value))

const isManifestHash = (value: unknown): boolean =>
  typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value)

/** Check a transcript payload's fields. Deterministic issue order. */
export function validatePayload(transcript: AnyTranscript): PayloadValidation {
  const issues: PayloadIssue[] = []
  const add = (code: PayloadIssue['code'], message: string, moduleId?: string): void => {
    issues.push(moduleId === undefined ? { code, message } : { code, message, moduleId })
  }

  const payload = transcript.payload as { format?: unknown }
  if (payload && payload.format !== undefined && payload.format !== 'cdut/2') {
    add('TRANSCRIPT_FORMAT_UNKNOWN', `the format ${String(payload.format)} is not recognised`)
    return { valid: false, issues }
  }

  if (payload?.format === 'cdut/2') {
    const v2 = transcript.payload as TranscriptV2Payload

    if (transcript.id !== transcriptIdV2(v2)) {
      add('TRANSCRIPT_ID_MISMATCH', 'the transcript id does not derive from the payload')
    }
    if (!isNonEmpty(v2.holder?.name)) {
      add('HOLDER_NAME_EMPTY', 'the holder name is empty')
    }
    if (!isDate(v2.issuedAt)) {
      add('ISSUED_AT_INVALID', `the issue timestamp ${String(v2.issuedAt)} is not a date`)
    }
    if (!isNonEmpty(v2.programme?.id)) {
      add('PROGRAMME_ID_EMPTY', 'the programme id is empty')
    }
    if (!isNonEmpty(v2.programme?.version)) {
      add('PROGRAMME_VERSION_EMPTY', 'the programme version is empty')
    }
    if (!isManifestHash(v2.programme?.manifestHash)) {
      add('MANIFEST_HASH_INVALID', 'the manifest hash is not 64 hex characters')
    }

    for (const row of v2.modules ?? []) {
      if (!isNonEmpty(row.moduleId)) {
        add('MODULE_ID_EMPTY', 'a module row has an empty id', row.moduleId)
      }
      if (!isPositiveInteger(row.credits)) {
        add(
          'MODULE_CREDITS_INVALID',
          `the module ${row.moduleId || '(no id)'} credits must be a positive integer`,
          row.moduleId,
        )
      }
      if (typeof row.mark !== 'number' || !Number.isFinite(row.mark) || row.mark < 0 || row.mark > 100) {
        add(
          'MODULE_MARK_OUT_OF_RANGE',
          `the module ${row.moduleId || '(no id)'} mark must be between 0 and 100`,
          row.moduleId,
        )
      }
      if (!isDate(row.passedAt)) {
        add(
          'MODULE_PASSED_AT_INVALID',
          `the module ${row.moduleId || '(no id)'} pass timestamp is not a date`,
          row.moduleId,
        )
      }
    }
  } else {
    const v1 = transcript.payload as TranscriptV1Payload

    if (transcript.id !== transcriptIdV1(v1)) {
      add('TRANSCRIPT_ID_MISMATCH', 'the transcript id does not derive from the payload')
    }
    if (!isNonEmpty(v1.pan)) {
      add('PAN_EMPTY', 'the holder PAN is empty')
    }
    if (!isNonEmpty(v1.agentName)) {
      add('AGENT_NAME_EMPTY', 'the agent name is empty')
    }
    if (!isDate(v1.issuedAt)) {
      add('ISSUED_AT_INVALID', `the issue timestamp ${String(v1.issuedAt)} is not a date`)
    }

    for (const enrolment of v1.degrees ?? []) {
      if (!isPositiveInteger(enrolment.slot)) {
        add('ENROLMENT_SLOT_INVALID', `the enrolment in ${enrolment.degree} has an invalid slot`)
      }
    }

    for (const assessment of v1.assessments ?? []) {
      if (!isPositiveInteger(assessment.attempt)) {
        add(
          'ASSESSMENT_ATTEMPT_INVALID',
          `the assessment ${assessment.id} has an invalid attempt number`,
        )
      }
      if (!isDate(assessment.assessedAt)) {
        add('ASSESSMENT_DATE_INVALID', `the assessment ${assessment.id} date is not a date`)
      }
    }
  }

  issues.sort((a, b) => {
    if (a.code !== b.code) return a.code < b.code ? -1 : 1
    const left = a.moduleId ?? ''
    const right = b.moduleId ?? ''
    if (left !== right) return left < right ? -1 : 1
    if (a.message !== b.message) return a.message < b.message ? -1 : 1
    return 0
  })

  return { valid: issues.length === 0, issues }
}
