import { describe, expect, it } from 'vitest'
import { canRestartSkin, mountRoutes, type WebServerService } from '../src/routes.ts'
import type { LoaderEntry } from '../src/types.ts'

describe('market routes', () => {
  it('allows restart when the selected skin is Host-active or restart-required', () => {
    const base = { skinId: 'skin', installation: 'installed', installedVersion: '1.0.0', updateAvailable: false } as const
    expect(canRestartSkin({ ...base, activation: 'active' })).toBe(true)
    expect(canRestartSkin({ ...base, activation: 'restart-required' })).toBe(true)
    expect(canRestartSkin({ ...base, activation: 'inactive' })).toBe(false)
    expect(canRestartSkin({ ...base, installation: 'missing', activation: 'restart-required' })).toBe(false)
  })

  it('registers the operation poller as a valid DSH prefix route', () => {
    const routes: Array<{ kind: 'exact' | 'prefix'; path: string }> = []
    const webServer: WebServerService = {
      register(route) {
        routes.push({ kind: route.kind, path: route.path })
        return () => undefined
      },
    }
    const dispose = mountRoutes({
      webServer,
      loader: { entries: (): Iterable<LoaderEntry> => [] },
    }, {
      profile: 'test',
      profileDir: '/tmp/dsh-skin-market-route-test-missing-profile',
      runner: async () => ({ exitCode: 0, stdout: '', stderr: '', timedOut: false }),
    })

    expect(routes).toContainEqual({ kind: 'prefix', path: '/dsh-skin-market/operations' })
    expect(routes).not.toContainEqual({ kind: 'prefix', path: '/dsh-skin-market/operations/' })
    dispose()
  })
})
