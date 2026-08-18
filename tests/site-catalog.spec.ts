import { describe, expect, it, vi } from 'vitest'
import { fetchLiveCatalog, fetchLiveCatalogWithFallback } from '../site/catalog.ts'

describe('live site catalog', () => {
  it('loads the published catalog without browser caching', async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ schemaVersion: 1, skins: [{ id: 'skin.example' }] }),
    }))

    await expect(fetchLiveCatalog<{ id: string }>('/dsh-skin-market/catalog.json', fetcher)).resolves.toEqual([{ id: 'skin.example' }])
    expect(fetcher).toHaveBeenCalledWith('/dsh-skin-market/catalog.json', {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })
  })

  it('rejects failed or malformed catalog responses', async () => {
    await expect(fetchLiveCatalog('/catalog.json', async () => ({ ok: false, status: 503, json: async () => ({}) }))).rejects.toThrow('HTTP 503')
    await expect(fetchLiveCatalog('/catalog.json', async () => ({ ok: true, status: 200, json: async () => ({ schemaVersion: 2, skins: [] }) }))).rejects.toThrow('目录版本不受支持')
  })

  it('falls back to the bundled Pages catalog when the remote catalog is unavailable', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ schemaVersion: 1, skins: [{ id: 'fallback.skin' }] }) })

    await expect(fetchLiveCatalogWithFallback<{ id: string }>('/raw/catalog.json', '/pages/catalog.json', fetcher)).resolves.toEqual([{ id: 'fallback.skin' }])
    expect(fetcher).toHaveBeenNthCalledWith(1, '/raw/catalog.json', { cache: 'no-store', headers: { accept: 'application/json' } })
    expect(fetcher).toHaveBeenNthCalledWith(2, '/pages/catalog.json', { cache: 'no-store', headers: { accept: 'application/json' } })
  })
})
