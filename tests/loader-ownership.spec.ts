import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { parseInsertedLoaderRows, primaryLoaderCandidates } from '../src/loader-ownership.ts'
import { parseInsertedLoaderRows as parseIngestRows, primaryLoaderIdFromPatch } from '../scripts/loader-rows.mjs'

const dependencyFirstPatch = `- insert:
    - id: better-sidebar
      name: dsh-better-sidebar
    - id: endfield-ui
      name: '@rison/dsh-endfield-ui'
`

describe('loader ownership parsing', () => {
  it('selects the package row even when a dependency row appears first', () => {
    const rows = parseInsertedLoaderRows(parse(dependencyFirstPatch), '@rison/dsh-endfield-ui')
    expect(primaryLoaderCandidates(rows, '@rison/dsh-endfield-ui')).toEqual([{
      id: 'endfield-ui', name: '@rison/dsh-endfield-ui', packageName: '@rison/dsh-endfield-ui',
    }])
  })

  it('uses only inserted rows and ignores top-level override ids', () => {
    const rows = parseInsertedLoaderRows({ id: 'override-only', name: 'other-plugin', insert: [{ id: 'owned', name: 'owned-plugin' }] }, 'owner')
    expect(rows).toEqual([{ id: 'owned', name: 'owned-plugin', packageName: 'owner' }])
  })

  it('blocks missing and ambiguous primary rows during ingestion', () => {
    expect(primaryLoaderIdFromPatch('- insert:\n    - id: dependency\n      name: dsh-better-sidebar\n', '@rison/dsh-endfield-ui')).toMatchObject({
      id: null,
      reason: expect.stringContaining('no loader named'),
    })
    expect(primaryLoaderIdFromPatch(`- insert:\n    - id: one\n      name: '@rison/dsh-endfield-ui'\n    - id: two\n      name: '@rison/dsh-endfield-ui'\n`, '@rison/dsh-endfield-ui')).toMatchObject({
      id: null,
      reason: expect.stringContaining('multiple loaders'),
    })
  })

  it('keeps the ingest parser and runtime parser aligned', () => {
    expect(parseIngestRows(dependencyFirstPatch)).toEqual([
      { id: 'better-sidebar', name: 'dsh-better-sidebar' },
      { id: 'endfield-ui', name: '@rison/dsh-endfield-ui' },
    ])
  })
})
