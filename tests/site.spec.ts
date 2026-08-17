import { describe, expect, it } from 'vitest'
import { MARKET_CLI_COMMAND, MARKET_PROMPT, MARKET_REPOSITORY, skinCommand, skinPrompt } from '../site/prompts.ts'

describe('static catalog prompts', () => {
  it('generates the platform installation prompt', () => {
    expect(MARKET_PROMPT).toContain(MARKET_REPOSITORY)
    expect(MARKET_PROMPT).toContain(MARKET_CLI_COMMAND)
    expect(MARKET_PROMPT).toContain('web profile')
    expect(MARKET_PROMPT).toContain('不要替我安装任何皮肤')
  })

  it('asks the agent to install the selected skin through the market', () => {
    const prompt = skinPrompt('https://github.com/example/dsh-skin')
    expect(prompt).toContain('请帮我安装这个 DSH Web 皮肤：https://github.com/example/dsh-skin')
  })

  it('adds a review-first guard to unverified skin prompts', () => {
    const prompt = skinPrompt('https://github.com/example/dsh-skin', false)

    expect(prompt).toContain('请帮我安装这个 DSH Web 皮肤：https://github.com/example/dsh-skin')
    expect(prompt).toContain('先只读检查仓库')
    expect(prompt).toContain('等待我确认后再安装')
    expect(prompt).toContain('不要直接安装')
  })

  it('generates a command for the catalog-pinned skin target', () => {
    const target = `github:example/dsh-skin#${'a'.repeat(40)}`
    const command = skinCommand(target)

    expect(command).toBe(`dsh plugin --profile web add '${target}'`)
  })
})
