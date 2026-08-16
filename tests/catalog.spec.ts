import { describe, expect, it, vi } from 'vitest'
import { catalogWithStars, recommend, repositorySlug } from '../src/catalog.ts'
import { loadCatalog } from '../src/catalog.ts'

describe('catalog', () => {
  it('contains pinned, curated install targets', () => {
    const catalog = loadCatalog()
    expect(catalog.skins.length).toBeGreaterThanOrEqual(3)
    for (const skin of catalog.skins) {
      expect(skin.install.commit).toMatch(/^[0-9a-f]{40}$/)
      expect(skin.install.target).toContain(skin.install.commit)
      expect(repositorySlug(skin.repo)).toContain('/')
    }
  })

  it('ranks only other skins and caps recommendations at four', () => {
    const catalog = loadCatalog()
    const result = recommend(catalog.skins[0], catalog.skins, new Map())
    expect(result).not.toContain(catalog.skins[0].id)
    expect(result).toHaveLength(Math.min(4, catalog.skins.length - 1))
  })

  it('serves scheduled Stars snapshots without browser-time GitHub requests', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const catalog = loadCatalog()
    const result = await catalogWithStars('/unused-profile')
    expect(result[0]).toMatchObject({ githubStars: catalog.skins[0].starsSnapshot, starsStale: false, starsUpdatedAt: catalog.skins[0].starsUpdatedAt })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
