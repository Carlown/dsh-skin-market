import { describe, expect, it } from 'vitest'
import { MARKET_PROMPT, MARKET_REPOSITORY, skinPrompt } from '../site/prompts.ts'

describe('static catalog prompts', () => {
  it('generates the platform installation prompt', () => {
    expect(MARKET_PROMPT).toContain(MARKET_REPOSITORY)
    expect(MARKET_PROMPT).toContain('web profile')
    expect(MARKET_PROMPT).toContain('不要替我安装任何皮肤')
  })

  it('generates the requested one-line skin prompt', () => {
    expect(skinPrompt('https://github.com/example/dsh-skin')).toBe('帮我安装这个皮肤：https://github.com/example/dsh-skin')
  })
})
