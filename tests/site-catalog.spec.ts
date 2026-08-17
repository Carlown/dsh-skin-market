import { describe, expect, it, vi } from 'vitest'
import { fetchLiveCatalog } from '../site/catalog.ts'

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
})
