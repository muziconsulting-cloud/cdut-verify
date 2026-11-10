/**
 * The structured verdict — one report for a human and a machine.
 *
 * The existing verify functions return `reasons: string[]`, which is right for a
 * CLI and wrong for software: a caller cannot branch on prose. This module
 * returns stable codes for every failure, combines signature, payload, manifest,
 * completeness and revocation into one report, and keeps the human-readable
 * message alongside each code.
 */

import {
  canonicalTranscriptV1,
  canonicalTranscriptV2,
  manifestHash,
  transcriptIdV1,
  transcriptIdV2,
} from './canonical.ts'
import { validateManifest } from './manifest.ts'
import { validatePayload } from './payload.ts'
import { checkRevocation } from './revocation.ts'
import { keyId, readEnv, verifyCanonical } from './sign.ts'
import { verifyCompleteness } from './transcript.ts'
import type {
  AnyTranscript,
  ProgrammeManifest,
  ReasonCode,
  RevocationList,
  TranscriptV1Payload,
  TranscriptV2Payload,
  VerdictIssue,
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

const detectFormat = (transcript: AnyTranscript): 'cdut/1' | 'cdut/2' | 'unknown' => {
  const format = (transcript.payload as { format?: unknown }).format
  if (format === 'cdut/2') return 'cdut/2'
  if (format === undefined) return 'cdut/1'
  return 'unknown'
}

const plural = (count: number): string => (count === 1 ? 'issue' : 'issues')

/** Verify a transcript and return a structured verdict. */
export async function verifyReport(
  transcript: AnyTranscript,
  options: VerdictOptions = {},
): Promise<VerdictReport> {
  const format = detectFormat(transcript)
  const codes = new Set<ReasonCode>()
  const issues: VerdictIssue[] = []

  const add = (code: ReasonCode, message: string, moduleId?: string): void => {
    codes.add(code)
    const duplicate = issues.some(
      (issue) =>
        issue.code === code &&
        issue.moduleId === moduleId &&
        issue.message === message,
    )
    if (!duplicate) {
      issues.push(moduleId === undefined ? { code, message } : { code, message, moduleId })
    }
  }

  let valid = true

  if (format === 'unknown') {
    valid = false
    add('FORMAT_UNKNOWN', 'the transcript format is not recognised')
  } else {
    const payload = transcript.payload
    const expectedId =
      format === 'cdut/2'
        ? transcriptIdV2(payload as TranscriptV2Payload)
        : transcriptIdV1(payload as TranscriptV1Payload)

    if (transcript.id !== expectedId) {
      valid = false
      add('ID_MISMATCH', `the id does not derive from the content (expected ${expectedId})`)
    }

    if (!transcript.proof) {
      valid = false
      add('UNSIGNED', 'the transcript has no proof block')
    } else {
      const raw = options.publicKey ?? readEnv('AVC_PUBLIC_KEY')
      if (!raw) {
        valid = false
        add('KEY_UNKNOWN', 'no public key was supplied to verify against')
      } else {
        if (transcript.proof.kid !== keyId(raw)) {
          valid = false
          add('KEY_UNKNOWN', `the kid names a different key (${transcript.proof.kid})`)
        }
        const canonical =
          format === 'cdut/2'
            ? canonicalTranscriptV2(payload as TranscriptV2Payload)
            : canonicalTranscriptV1(payload as TranscriptV1Payload)
        const ok = await verifyCanonical(canonical, transcript.proof.signature, raw)
        if (!ok) {
          valid = false
          add('SIGNATURE_INVALID', 'the signature does not verify over the canonical bytes')
        }
      }
    }

    const payloadCheck = validatePayload(transcript)
    if (!payloadCheck.valid) {
      valid = false
      add(
        'PAYLOAD_INVALID',
        `the payload is malformed (${payloadCheck.issues.length} ${plural(payloadCheck.issues.length)})`,
      )
    }
  }

  let provable = false
  let complete = false

  if (options.revocation) {
    const revocation = checkRevocation(transcript, options.revocation)
    if (revocation.revoked) {
      add(
        'REVOKED',
        `the transcript was revoked${revocation.entry?.reason ? `: ${revocation.entry.reason}` : ''}`,
      )
    }
  }

  if (options.manifest) {
    const manifestCheck = validateManifest(options.manifest)
    if (!manifestCheck.valid) {
      add(
        'MANIFEST_INVALID',
        `the manifest is not publishable (${manifestCheck.issues.length} ${plural(manifestCheck.issues.length)})`,
      )
    }

    if (format === 'cdut/2') {
      const payload = transcript.payload as TranscriptV2Payload
      const hash = manifestHash(options.manifest)
      const idMatches = payload.programme.id === options.manifest.id
      const versionMatches = payload.programme.version === options.manifest.version
      const hashMatches = payload.programme.manifestHash === hash

      if (!idMatches) {
        add(
          'PROGRAMME_ID_MISMATCH',
          `the transcript is for ${payload.programme.id}, not ${options.manifest.id}`,
        )
      }
      if (!versionMatches) {
        add(
          'PROGRAMME_VERSION_MISMATCH',
          `the transcript commits to version ${payload.programme.version}, not ${options.manifest.version}`,
        )
      }
      if (!hashMatches) {
        add('MANIFEST_HASH_MISMATCH', 'the transcript commits to a different manifest hash')
      }

      if (idMatches && versionMatches && hashMatches && manifestCheck.valid && valid) {
        provable = true
        const completeness = verifyCompleteness(transcript, options.manifest)
        complete = completeness.complete

        for (const moduleId of completeness.missing) {
          add(
            'MODULE_MISSING',
            `the module ${moduleId} has no passing row on the transcript`,
            moduleId,
          )
        }
        for (const moduleId of completeness.extra) {
          add('MODULE_EXTRA', `the module ${moduleId} is not in the manifest`, moduleId)
        }
        if (completeness.credits < completeness.requiredCredits) {
          add(
            'CREDITS_SHORT',
            `the transcript has ${completeness.credits} credits but the award requires ${completeness.requiredCredits}`,
          )
        }
        for (const violation of completeness.prerequisiteViolations) {
          add(
            'PREREQUISITE_ORDER',
            `the module ${violation.moduleId} was passed before ${violation.missingPrerequisite}`,
            violation.moduleId,
          )
        }
      }
    }

    if (!provable) {
      add('NOT_PROVABLE', 'the transcript cannot be checked against this manifest')
    }
  } else {
    add('NOT_PROVABLE', 'no manifest was supplied, so completeness is not claimed')
  }

  if (valid) codes.add('OK')

  issues.sort((a, b) => {
    if (a.code !== b.code) return a.code < b.code ? -1 : 1
    const left = a.moduleId ?? ''
    const right = b.moduleId ?? ''
    if (left !== right) return left < right ? -1 : 1
    if (a.message !== b.message) return a.message < b.message ? -1 : 1
    return 0
  })

  return {
    transcriptId: transcript.id,
    format,
    valid,
    provable,
    complete,
    codes: [...codes].sort() as ReasonCode[],
    issues,
  }
}
