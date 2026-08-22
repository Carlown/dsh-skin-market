import { describe, expect, it } from 'vitest'
import { createSkinInstallCommand, createSkinInstallPrompt, createSubmissionPrompt, normalizeGitHubRepository, REGISTRY_REPOSITORY } from '../src/client/submission.ts'
import type { CatalogSkin } from '../src/client/types.ts'

describe('agent-assisted skin submission', () => {
  it('normalizes a public GitHub repository and generates an actionable PR prompt', () => {
    const repository = normalizeGitHubRepository('https://github.com/example/dsh-skin.git')
    expect(repository).toBe('https://github.com/example/dsh-skin')

    const prompt = createSubmissionPrompt(repository!)
    expect(prompt).toContain('皮肤仓库：https://github.com/example/dsh-skin')
    expect(prompt).toContain(`目标目录仓库：${REGISTRY_REPOSITORY}`)
    expect(prompt).toContain('完整 40 位 commit SHA')
    expect(prompt).toContain('npm run registry:check')
    expect(prompt).toContain('不要修改或提交生成的 data/catalog.json')
    expect(prompt).toContain('创建 PR')
    expect(prompt).toContain('不得读取 .env')
  })

  it('rejects non-repository and non-GitHub URLs', () => {
    expect(normalizeGitHubRepository('https://example.com/owner/repo')).toBeNull()
    expect(normalizeGitHubRepository('https://github.com/owner/repo/issues')).toBeNull()
    expect(createSubmissionPrompt('not a url')).toBe('')
  })

  it('generates a direct prompt that asks the agent to resolve the skin repository', () => {
    const prompt = createSubmissionPrompt()
    expect(prompt).toContain('如果当前工作区就是待提交的皮肤仓库')
    expect(prompt).toContain('否则先向我索要公开 GitHub 仓库地址')
    expect(prompt).toContain(`目标目录仓库：${REGISTRY_REPOSITORY}`)
  })

  it('generates a pinned installation fallback prompt with an exact build approval', () => {
    const skin = {
      id: 'dancingmemory.dskin', repo: 'https://github.com/dancingmemory/dskin', package: 'dskin', rowId: 'ui-skin-dskin',
      install: {
        target: 'github:dancingmemory/dskin#f24cf34bd21d23845a8b9bdaf3dbf46d01a952ed', version: '1.0.13', commit: 'f24cf34bd21d23845a8b9bdaf3dbf46d01a952ed',
        allowBuild: 'dskin@https://codeload.github.com/dancingmemory/dskin/tar.gz/f24cf34bd21d23845a8b9bdaf3dbf46d01a952ed',
      },
    } as CatalogSkin
    const prompt = createSkinInstallPrompt(skin)
    expect(prompt).toContain(skin.install.target)
    expect(prompt).toContain(skin.install.allowBuild!)
    expect(prompt).toContain('不得开启 dangerouslyAllowAllBuilds')
    expect(prompt).toContain('cordis.patch.yml')
    expect(prompt).toContain('必须先完成只读冲突检查')
    expect(prompt).toContain('停在安装前')
    expect(prompt).toContain('未经我确认不得修改任何 profile 文件，也不得执行安装')
    expect(prompt.indexOf('安装前只读检查')).toBeLessThan(prompt.indexOf('然后执行上面的固定安装命令'))
    expect(createSkinInstallCommand(skin)).toBe(`dsh plugin --profile web add "${skin.install.target}"`)
  })
})
