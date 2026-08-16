import { describe, expect, it } from 'vitest'
import { createSubmissionPrompt, normalizeGitHubRepository, REGISTRY_REPOSITORY } from '../src/client/submission.ts'

describe('agent-assisted skin submission', () => {
  it('normalizes a public GitHub repository and generates an actionable PR prompt', () => {
    const repository = normalizeGitHubRepository('https://github.com/example/dsh-skin.git')
    expect(repository).toBe('https://github.com/example/dsh-skin')

    const prompt = createSubmissionPrompt(repository!)
    expect(prompt).toContain('皮肤仓库：https://github.com/example/dsh-skin')
    expect(prompt).toContain(`目标目录仓库：${REGISTRY_REPOSITORY}`)
    expect(prompt).toContain('完整 40 位 commit SHA')
    expect(prompt).toContain('npm run registry')
    expect(prompt).toContain('创建 PR')
    expect(prompt).toContain('不得读取 .env')
  })

  it('rejects non-repository and non-GitHub URLs', () => {
    expect(normalizeGitHubRepository('https://example.com/owner/repo')).toBeNull()
    expect(normalizeGitHubRepository('https://github.com/owner/repo/issues')).toBeNull()
    expect(createSubmissionPrompt('not a url')).toBe('')
  })
})
