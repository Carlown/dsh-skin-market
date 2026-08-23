import { describe, expect, it } from 'vitest'
import { createDshPluginAddCommand, createInstallCommand, quoteInstallTarget } from '../src/install-command.ts'

describe('portable DSH install commands', () => {
  it('uses double quotes for targets containing cmd metacharacters', () => {
    const target = `github:owner/repo#${'a'.repeat(40)}&path:/packages/skin`
    expect(quoteInstallTarget(target)).toBe(`"${target}"`)
    expect(createDshPluginAddCommand(target)).toBe(`dsh plugin --profile web add "${target}"`)
    expect(createInstallCommand(target)).toBe([
      `pnpm add "${target}" --dir "$HOME/.dsh/profiles/web"`,
      `pnpm add "${target}" --dir "$env:USERPROFILE\\.dsh\\profiles\\web"`,
    ].join('\n'))
  })

  it('keeps npm and root-repo targets on dsh plugin add', () => {
    const target = `github:owner/repo#${'a'.repeat(40)}`
    expect(createInstallCommand(target)).toBe(`dsh plugin --profile web add "${target}"`)
  })

  it('rejects command-breaking target text instead of emitting an unsafe command', () => {
    expect(() => quoteInstallTarget('github:owner/repo\"broken')).toThrow('unsupported command characters')
    expect(() => quoteInstallTarget('github:owner/repo\nnext')).toThrow('unsupported command characters')
  })
})
