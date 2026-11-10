/**
 * Workstream B: manifest integrity.
 *
 * A manifest is the document a transcript is checked against. If the manifest is
 * incoherent, every completeness result built on it is meaningless. These tests
 * fail until `validateManifest` in `src/manifest.ts` is implemented.
 *
 * Run only this file:
 *   bun test test/manifest.test.ts
 */

import { describe, expect, test } from 'bun:test'
import { validateManifest } from '../src/index.ts'
import type { ManifestModule, ProgrammeManifest } from '../src/types.ts'

const base = (): ProgrammeManifest => ({
  id: 'BCOM-ACC',
  title: 'Bachelor of Commerce in Accounting',
  version: '2026.1',
  nqfLevel: 7,
  totalCredits: 30,
  passMark: 50,
  modules: [
    { id: 'ACC101', title: 'Accounting I', credits: 15, prerequisites: [] },
    { id: 'ACC102', title: 'Accounting II', credits: 15, prerequisites: ['ACC101'] },
  ],
})

const withModules = (modules: ManifestModule[]): ProgrammeManifest => ({
  ...base(),
  totalCredits: modules.reduce((total, module) => total + module.credits, 0),
  modules,
})

const codes = (manifest: ProgrammeManifest): string[] =>
  validateManifest(manifest).issues.map((issue) => issue.code)

describe('manifest: the happy path', () => {
  test('a coherent manifest is valid with no issues', () => {
    const result = validateManifest(base())
    expect(result.valid).toBe(true)
    expect(result.issues).toEqual([])
  })
})

describe('manifest: identity fields', () => {
  test('an empty id is rejected', () => {
    expect(codes({ ...base(), id: '  ' })).toContain('MANIFEST_ID_EMPTY')
  })

  test('an empty title is rejected', () => {
    expect(codes({ ...base(), title: '' })).toContain('MANIFEST_TITLE_EMPTY')
  })

  test('an empty version is rejected', () => {
    expect(codes({ ...base(), version: '' })).toContain('MANIFEST_VERSION_EMPTY')
  })
})

describe('manifest: numeric bounds', () => {
  test('an NQF level outside 5-10 is rejected', () => {
    expect(codes({ ...base(), nqfLevel: 4 })).toContain('MANIFEST_NQF_OUT_OF_RANGE')
    expect(codes({ ...base(), nqfLevel: 11 })).toContain('MANIFEST_NQF_OUT_OF_RANGE')
    expect(codes({ ...base(), nqfLevel: 7.5 })).toContain('MANIFEST_NQF_OUT_OF_RANGE')
  })

  test('NQF 5 and NQF 10 are accepted', () => {
    expect(validateManifest({ ...base(), nqfLevel: 5 }).valid).toBe(true)
    expect(validateManifest({ ...base(), nqfLevel: 10 }).valid).toBe(true)
  })

  test('a total credit value that is not a positive integer is rejected', () => {
    expect(codes({ ...base(), totalCredits: 0 })).toContain('MANIFEST_TOTAL_CREDITS_INVALID')
    expect(codes({ ...base(), totalCredits: -15 })).toContain('MANIFEST_TOTAL_CREDITS_INVALID')
    expect(codes({ ...base(), totalCredits: 12.5 })).toContain('MANIFEST_TOTAL_CREDITS_INVALID')
  })

  test('a pass mark outside 1-100 is rejected', () => {
    expect(codes({ ...base(), passMark: 0 })).toContain('MANIFEST_PASS_MARK_INVALID')
    expect(codes({ ...base(), passMark: 101 })).toContain('MANIFEST_PASS_MARK_INVALID')
  })
})

describe('manifest: modules', () => {
  test('a manifest with no modules is rejected', () => {
    expect(codes({ ...base(), modules: [] })).toContain('MANIFEST_NO_MODULES')
  })

  test('a duplicate module id is rejected and named', () => {
    const result = validateManifest(
      withModules([
        { id: 'ACC101', title: 'Accounting I', credits: 15, prerequisites: [] },
        { id: 'ACC101', title: 'Accounting I again', credits: 15, prerequisites: [] },
      ]),
    )
    const issue = result.issues.find((row) => row.code === 'MODULE_ID_DUPLICATE')
    expect(issue?.moduleId).toBe('ACC101')
  })

  test('an empty module id is rejected', () => {
    expect(
      codes(withModules([{ id: ' ', title: 'Accounting I', credits: 15, prerequisites: [] }])),
    ).toContain('MODULE_ID_EMPTY')
  })

  test('an empty module title is rejected', () => {
    expect(
      codes(withModules([{ id: 'ACC101', title: '', credits: 15, prerequisites: [] }])),
    ).toContain('MODULE_TITLE_EMPTY')
  })

  test('module credits must be a positive integer', () => {
    expect(
      codes(withModules([{ id: 'ACC101', title: 'Accounting I', credits: 0, prerequisites: [] }])),
    ).toContain('MODULE_CREDITS_INVALID')
    expect(
      codes(withModules([{ id: 'ACC101', title: 'Accounting I', credits: -5, prerequisites: [] }])),
    ).toContain('MODULE_CREDITS_INVALID')
    expect(
      codes(withModules([{ id: 'ACC101', title: 'Accounting I', credits: 7.5, prerequisites: [] }])),
    ).toContain('MODULE_CREDITS_INVALID')
  })
})

describe('manifest: prerequisite graph', () => {
  test('a prerequisite that names no module is rejected', () => {
    const result = validateManifest(
      withModules([{ id: 'ACC101', title: 'Accounting I', credits: 30, prerequisites: ['GHOST'] }]),
    )
    expect(result.issues.map((row) => row.code)).toContain('MODULE_PREREQUISITE_UNKNOWN')
    expect(result.issues.find((row) => row.code === 'MODULE_PREREQUISITE_UNKNOWN')?.moduleId).toBe(
      'ACC101',
    )
  })

  test('a module that requires itself is rejected', () => {
    const result = validateManifest(
      withModules([{ id: 'ACC101', title: 'Accounting I', credits: 30, prerequisites: ['ACC101'] }]),
    )
    expect(result.issues.map((row) => row.code)).toContain('MODULE_PREREQUISITE_SELF')
  })

  test('a prerequisite cycle is rejected', () => {
    const result = validateManifest(
      withModules([
        { id: 'ACC101', title: 'Accounting I', credits: 15, prerequisites: ['ACC102'] },
        { id: 'ACC102', title: 'Accounting II', credits: 15, prerequisites: ['ACC101'] },
      ]),
    )
    expect(result.issues.map((row) => row.code)).toContain('MODULE_PREREQUISITE_CYCLE')
  })

  test('a credit total no student can reach is rejected', () => {
    const unsatisfiable = { ...base(), totalCredits: 100 }
    expect(codes(unsatisfiable)).toContain('MANIFEST_CREDITS_UNSATISFIABLE')
  })
})

describe('manifest: deterministic output', () => {
  test('two calls produce the same issue list and order', () => {
    const broken: ProgrammeManifest = {
      ...base(),
      id: '',
      nqfLevel: 12,
      modules: [
        { id: 'ACC101', title: '', credits: 0, prerequisites: ['GHOST'] },
        { id: 'ACC101', title: 'duplicate', credits: 15, prerequisites: [] },
      ],
    }
    const first = validateManifest(broken)
    const second = validateManifest(broken)
    expect(first).toEqual(second)
    const keys = first.issues.map((row) => `${row.code}:${row.moduleId ?? ''}`)
    expect(keys).toEqual([...keys].sort())
  })
})
