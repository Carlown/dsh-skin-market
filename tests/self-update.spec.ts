import { describe, expect, it, vi } from 'vitest'
import { compareVersions, createMarketUpdater, MARKET_GITHUB_TARGET, MARKET_PACKAGE_URL } from '../src/self-update.ts'

describe('market self update', () => {
  it('compares stable and prerelease semantic versions', () => {
    expect(compareVersions('0.1.16', '0.1.15')).toBeGreaterThan(0)
    expect(compareVersions('1.0.0', '1.0.0-rc.6')).toBeGreaterThan(0)
    expect(compareVersions('1.0.0-rc.7', '1.0.0-rc.6')).toBeGreaterThan(0)
    expect(compareVersions('0.1.15', '0.1.15')).toBe(0)
  })

  it('only installs when GitHub has a newer version and hides the update afterwards', async () => {
    const fetchLatest = vi.fn(async () => ({ ok: true, json: async () => ({ version: '0.1.16' }) })) as unknown as typeof fetch
    const runner = vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '', timedOut: false }))
    const updater = createMarketUpdater('web', runner, { currentVersion: '0.1.15', fetch: fetchLatest, cacheMs: 0 })

    await expect(updater.status()).resolves.toEqual({ currentVersion: '0.1.15', latestVersion: '0.1.16', updateAvailable: true })
    await expect(updater.update()).resolves.toEqual({ currentVersion: '0.1.16', latestVersion: '0.1.16', updateAvailable: false })
    expect(fetchLatest).toHaveBeenCalledWith(MARKET_PACKAGE_URL, expect.objectContaining({ headers: expect.objectContaining({ accept: 'application/json' }) }))
    expect(runner).toHaveBeenCalledWith('web', ['add', MARKET_GITHUB_TARGET])
    await expect(updater.status()).resolves.toEqual({ currentVersion: '0.1.16', latestVersion: '0.1.16', updateAvailable: false })
  })

  it('does not reinstall the same version', async () => {
    const runner = vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '', timedOut: false }))
    const updater = createMarketUpdater('web', runner, {
      currentVersion: '0.1.15',
      fetch: vi.fn(async () => ({ ok: true, json: async () => ({ version: '0.1.15' }) })) as unknown as typeof fetch,
      cacheMs: 0,
    })

    await expect(updater.update()).resolves.toMatchObject({ updateAvailable: false })
    expect(runner).not.toHaveBeenCalled()
  })
})
