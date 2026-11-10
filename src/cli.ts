#!/usr/bin/env bun
/**
 * cdut-verify — verify a `.cdut` transcript offline.
 *
 *   cdut-verify <transcript.cdut> [--manifest <manifest.json>] [--key <public-key>]
 *
 * Without --manifest it checks that the file is genuine (id and signature).
 * With --manifest it also checks that the programme is complete.
 *
 * Exit codes:
 *   0  genuine, and complete when a manifest was supplied
 *   1  not genuine, or incomplete
 *   2  usage error, unreadable file, or invalid JSON
 *
 * The public key can be passed with --key or set as AVC_PUBLIC_KEY. There is no
 * built-in key.
 */

import { readFileSync } from 'node:fs'
import { verifyCompleteness, verifyTranscript } from './transcript.ts'
import type { AnyTranscript, ProgrammeManifest } from './types.ts'

interface Args {
  file: string
  manifest?: string
  key?: string
}

const USAGE = `cdut-verify — verify a .cdut transcript offline

Usage:
  cdut-verify <transcript.cdut> [--manifest <manifest.json>] [--key <public-key>]

Options:
  --manifest <file>   also check the transcript against a programme manifest
  --key <base64url>   Ed25519 public key (or set AVC_PUBLIC_KEY)
  -h, --help          show this help

Exit: 0 genuine/complete, 1 invalid/incomplete, 2 usage or parse error.`

function parseArgs(argv: string[]): Args | 'help' {
  const args: Args = { file: '' }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg) continue
    if (arg === '-h' || arg === '--help') return 'help'
    if (arg === '--manifest') {
      const value = argv[i + 1]
      if (!value) throw new Error('--manifest needs a file')
      args.manifest = value
      i += 1
      continue
    }
    if (arg === '--key') {
      const value = argv[i + 1]
      if (!value) throw new Error('--key needs a value')
      args.key = value
      i += 1
      continue
    }
    if (arg.startsWith('-')) throw new Error(`unknown option: ${arg}`)
    if (args.file) throw new Error(`unexpected argument: ${arg}`)
    args.file = arg
  }
  if (!args.file) throw new Error('no transcript file given')
  return args
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

async function main(): Promise<number> {
  let args: Args | 'help'
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`)
    return 2
  }
  if (args === 'help') {
    console.log(USAGE)
    return 0
  }

  let transcript: AnyTranscript
  let manifest: ProgrammeManifest | undefined
  try {
    transcript = readJson<AnyTranscript>(args.file)
    if (args.manifest) manifest = readJson<ProgrammeManifest>(args.manifest)
  } catch (error) {
    console.error(`could not read input: ${error instanceof Error ? error.message : String(error)}`)
    return 2
  }

  const verification = await verifyTranscript(transcript, args.key)
  const result: Record<string, unknown> = {
    format: verification.format,
    valid: verification.valid,
    reasons: verification.reasons,
  }

  if (manifest) {
    const completeness = verifyCompleteness(transcript, manifest)
    result.completeness = completeness
    if (!verification.valid || !completeness.complete) {
      console.log(JSON.stringify(result, null, 2))
      return 1
    }
  } else if (!verification.valid) {
    console.log(JSON.stringify(result, null, 2))
    return 1
  }

  console.log(JSON.stringify(result, null, 2))
  return 0
}

process.exit(await main())
