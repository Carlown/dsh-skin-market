import { describe, expect, it } from 'vitest'
import { matchesCatalogSearch } from '../src/catalog-search.ts'

const skin = {
  name: { zh: '测试皮肤', en: 'Test Skin' },
  author: 'author',
  description: '终末地风格的深色主题',
  tags: ['dark'],
}

describe('catalog search', () => {
  it('matches title, description, author, and tags', () => {
    expect(matchesCatalogSearch(skin, '测试皮肤')).toBe(true)
    expect(matchesCatalogSearch(skin, 'test skin')).toBe(true)
    expect(matchesCatalogSearch(skin, '终末地')).toBe(true)
    expect(matchesCatalogSearch(skin, 'author')).toBe(true)
    expect(matchesCatalogSearch(skin, 'dark')).toBe(true)
  })

  it('treats a blank query as an unfiltered catalog', () => {
    expect(matchesCatalogSearch(skin, '  ')).toBe(true)
  })
})
