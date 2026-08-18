import { describe, expect, it } from 'vitest'
import { displayTitle, githubRepoLabel } from '../src/display-title.ts'

describe('display title cleanup', () => {
  it.each([
    ['DSH 皮肤插件：蓝鲸主题', '蓝鲸主题'],
    ['A DSH skin plugin that brings a neon palette', 'brings a neon palette'],
    ['DSKIN · DeepSeek Harness（DSH）玻璃主题', '玻璃主题'],
    ['DSH (DeepSeek Harness) 的 赛博朋克主题', '赛博朋克主题'],
    ['Third-party DSH WebUI enhancement plugin', 'enhancement plugin'],
    ['DeepSeek Harness: Ocean skin', 'Ocean skin'],
    ['DS Harness — Retro UI', 'Retro UI'],
    ['DSH Web 轻拟物主题', '轻拟物主题'],
  ])('removes a known leading prefix from %s', (input, expected) => {
    expect(displayTitle(input)).toBe(expected)
  })

  it('keeps a meaningful title when no prefix matches', () => {
    expect(displayTitle('Open Sea 海洋皮肤')).toBe('Open Sea 海洋皮肤')
    expect(displayTitle('DSH')).toBe('DSH')
  })

  it('normalizes a GitHub repository label', () => {
    expect(githubRepoLabel('https://github.com/FeatherHunter/dsh-opencode-palette/')).toBe('FeatherHunter/dsh-opencode-palette')
  })
})
