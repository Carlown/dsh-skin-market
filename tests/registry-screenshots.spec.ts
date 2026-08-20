import { describe, expect, it } from 'vitest'
import { displayScreenshots, mergeScreenshots } from '../scripts/registry-screenshots.mjs'

describe('registry screenshot merge', () => {
  it('prepends market captures and preserves upstream order', () => {
    expect(mergeScreenshots(
      ['https://market.example/home.png', 'https://market.example/conversation.png'],
      ['https://upstream.example/one.png', 'https://upstream.example/two.png'],
    )).toEqual([
      'https://market.example/home.png',
      'https://market.example/conversation.png',
      'https://upstream.example/one.png',
      'https://upstream.example/two.png',
    ])
  })

  it('deduplicates and drops repository cards only when market captures exist', () => {
    const repositoryCard = 'https://opengraph.githubassets.com/commit/owner/repo'
    expect(mergeScreenshots(['https://market.example/home.png'], [repositoryCard, 'https://market.example/home.png'])).toEqual([
      'https://market.example/home.png',
    ])
    expect(mergeScreenshots([], [repositoryCard])).toEqual([repositoryCard])
  })

  it('uses upstream screenshots instead of market captures when source is usable', () => {
    expect(displayScreenshots(
      ['https://pages.example/market.png'],
      ['https://raw.example/original.png'],
    )).toEqual(['https://raw.example/original.png'])
  })
})
