import { describe, expect, it } from 'vitest'
import { createDshPluginAddCommand, quoteInstallTarget } from '../src/install-command.ts'

describe('portable DSH install commands', () => {
  it('uses double quotes for targets containing cmd metacharacters', () => {
    const target = `github:owner/repo#${'a'.repeat(40)}&path:packages/skin`
    expect(quoteInstallTarget(target)).toBe(`"${target}"`)
    expect(createDshPluginAddCommand(target)).toBe(`dsh plugin --profile web add "${target}"`)
  })

  it('rejects command-breaking target text instead of emitting an unsafe command', () => {
    expect(() => quoteInstallTarget('github:owner/repo\"broken')).toThrow('unsupported command characters')
    expect(() => quoteInstallTarget('github:owner/repo\nnext')).toThrow('unsupported command characters')
  })
})
