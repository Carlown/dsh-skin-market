import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
// @ts-expect-error The documentation helper is intentionally plain ESM.
import { updateProjectDocs } from '../scripts/update-docs.mjs'

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('automated project documentation updates', () => {
  it('refreshes README stats and prepends recent entries without deleting manual notes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-doc-test-'))
    temporaryRoots.push(root)
    await mkdir(join(root, 'docs'))
    await writeFile(join(root, 'README.md'), '# Test\n\n查看[近期收录日志](./docs/recently-added.md)\n')
    await writeFile(join(root, 'docs/recently-added.md'), '# 近期收录\n\n## 手动记录\n')

    await updateProjectDocs({
      root,
      catalogCount: 142,
      syncAt: '2026-08-18T16:00:00.000Z',
      changes: [{ id: 'demo.skin', name: { zh: 'Demo' }, repo: 'https://github.com/example/demo', description: 'Demo\n skin', updatedAt: '2026-08-18T15:00:00.000Z', install: { version: '1.0.0', commit: 'a'.repeat(40) } }],
    })

    const readme = await readFile(join(root, 'README.md'), 'utf8')
    const recent = await readFile(join(root, 'docs/recently-added.md'), 'utf8')
    expect(readme).toContain('142 款')
    expect(recent).toContain('demo.skin')
    expect(recent).toContain('Demo skin')
    expect(recent).toContain('## 手动记录')
  })
})
