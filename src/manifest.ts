/**
 * Manifest integrity — is this curriculum publishable at all?
 *
 * A transcript commits to a manifest hash, so the verifier can only be as honest
 * as the manifest is coherent. A manifest with a duplicate module id, a
 * prerequisite that names a module that does not exist, a prerequisite cycle, or
 * a credit total no student can reach is not a curriculum: it is a document that
 * cannot be checked.
 */

import type {
  ManifestIssue,
  ManifestModule,
  ManifestValidation,
  ProgrammeManifest,
} from './types.ts'

const isNonEmpty = (value: unknown): boolean =>
  typeof value === 'string' && value.trim() !== ''

const isPositiveInteger = (value: unknown): boolean =>
  typeof value === 'number' && Number.isInteger(value) && value > 0

/**
 * Module ids that sit on a prerequisite cycle. Self-references are reported
 * separately as MODULE_PREREQUISITE_SELF, so they are skipped here.
 */
function modulesOnCycles(modules: ManifestModule[]): string[] {
  const ids = new Set<string>()
  for (const module of modules) {
    if (isNonEmpty(module.id)) ids.add(module.id)
  }

  const edges = new Map<string, string[]>()
  for (const module of modules) {
    if (!isNonEmpty(module.id)) continue
    const prerequisites = Array.isArray(module.prerequisites) ? module.prerequisites : []
    edges.set(
      module.id,
      prerequisites.filter((id) => ids.has(id) && id !== module.id),
    )
  }

  const WHITE = 0
  const GREY = 1
  const BLACK = 2
  const colour = new Map<string, number>()
  const stack: string[] = []
  const onCycle = new Set<string>()

  const visit = (node: string): void => {
    colour.set(node, GREY)
    stack.push(node)
    for (const next of edges.get(node) ?? []) {
      const state = colour.get(next) ?? WHITE
      if (state === GREY) {
        const start = stack.indexOf(next)
        if (start >= 0) {
          for (let index = start; index < stack.length; index += 1) {
            onCycle.add(stack[index]!)
          }
        }
      } else if (state === WHITE) {
        visit(next)
      }
    }
    stack.pop()
    colour.set(node, BLACK)
  }

  for (const id of edges.keys()) {
    if ((colour.get(id) ?? WHITE) === WHITE) visit(id)
  }

  return [...onCycle].sort()
}

/** Check that a manifest is internally coherent. Deterministic issue order. */
export function validateManifest(manifest: ProgrammeManifest): ManifestValidation {
  const issues: ManifestIssue[] = []
  const add = (code: ManifestIssue['code'], message: string, moduleId?: string): void => {
    issues.push(moduleId === undefined ? { code, message } : { code, message, moduleId })
  }

  if (!isNonEmpty(manifest.id)) {
    add('MANIFEST_ID_EMPTY', 'the manifest id is empty')
  }
  if (!isNonEmpty(manifest.title)) {
    add('MANIFEST_TITLE_EMPTY', 'the manifest title is empty')
  }
  if (!isNonEmpty(manifest.version)) {
    add('MANIFEST_VERSION_EMPTY', 'the manifest version is empty')
  }

  if (
    typeof manifest.nqfLevel !== 'number' ||
    !Number.isInteger(manifest.nqfLevel) ||
    manifest.nqfLevel < 5 ||
    manifest.nqfLevel > 10
  ) {
    add('MANIFEST_NQF_OUT_OF_RANGE', `the NQF level ${manifest.nqfLevel} is outside 5-10`)
  }

  if (!isPositiveInteger(manifest.totalCredits)) {
    add('MANIFEST_TOTAL_CREDITS_INVALID', 'the total credits must be a positive integer')
  }

  if (
    typeof manifest.passMark !== 'number' ||
    !Number.isFinite(manifest.passMark) ||
    manifest.passMark < 1 ||
    manifest.passMark > 100
  ) {
    add('MANIFEST_PASS_MARK_INVALID', 'the pass mark must be between 1 and 100')
  }

  const modules = Array.isArray(manifest.modules) ? manifest.modules : []
  if (modules.length === 0) {
    add('MANIFEST_NO_MODULES', 'the manifest has no modules')
  }

  const seen = new Set<string>()
  const reportedDuplicate = new Set<string>()
  for (const module of modules) {
    if (!isNonEmpty(module.id)) {
      add('MODULE_ID_EMPTY', 'a module has an empty id')
    } else if (seen.has(module.id)) {
      if (!reportedDuplicate.has(module.id)) {
        reportedDuplicate.add(module.id)
        add('MODULE_ID_DUPLICATE', `the module id ${module.id} appears more than once`, module.id)
      }
    } else {
      seen.add(module.id)
    }

    if (!isNonEmpty(module.title)) {
      add('MODULE_TITLE_EMPTY', `the module ${module.id || '(no id)'} has an empty title`, module.id)
    }

    if (!isPositiveInteger(module.credits)) {
      add(
        'MODULE_CREDITS_INVALID',
        `the module ${module.id || '(no id)'} credits must be a positive integer`,
        module.id,
      )
    }
  }

  const known = new Set(
    modules.filter((module) => isNonEmpty(module.id)).map((module) => module.id),
  )
  for (const module of modules) {
    const prerequisites = Array.isArray(module.prerequisites) ? module.prerequisites : []
    for (const prerequisite of prerequisites) {
      if (prerequisite === module.id) {
        add('MODULE_PREREQUISITE_SELF', `the module ${module.id} requires itself`, module.id)
      } else if (!known.has(prerequisite)) {
        add(
          'MODULE_PREREQUISITE_UNKNOWN',
          `the module ${module.id} requires ${prerequisite}, which is not in the manifest`,
          module.id,
        )
      }
    }
  }

  for (const id of modulesOnCycles(modules)) {
    add('MODULE_PREREQUISITE_CYCLE', `the module ${id} is part of a prerequisite cycle`, id)
  }

  if (isPositiveInteger(manifest.totalCredits)) {
    const reachable = modules.reduce(
      (total, module) => total + (isPositiveInteger(module.credits) ? module.credits : 0),
      0,
    )
    if (reachable < manifest.totalCredits) {
      add(
        'MANIFEST_CREDITS_UNSATISFIABLE',
        `the modules offer ${reachable} credits but the award requires ${manifest.totalCredits}`,
      )
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
