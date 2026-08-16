import { describe, expect, it } from 'vitest'
import { canRestartSkin, mountRoutes, runningAgentCount, waitForRestartSafety, type AgentLike, type WebServerService } from '../src/routes.ts'
import type { LoaderEntry } from '../src/types.ts'

describe('market routes', () => {
  it('blocks restart while an Agent is running and waits for idle maintenance', async () => {
    const idle = { status: 'idle', whenIdle: async () => undefined } satisfies AgentLike
    const running = { status: 'running', whenIdle: async () => undefined } satisfies AgentLike
    const host = { agents: { list: () => [idle, running] } }

    expect(runningAgentCount(host)).toBe(1)
    await expect(waitForRestartSafety(host)).rejects.toThrow('检测到 1 个 Agent 正在运行')

    let maintenanceFinished = false
    const maintaining = { status: 'idle', whenIdle: async () => { maintenanceFinished = true } } satisfies AgentLike
    await expect(waitForRestartSafety({ agents: { list: () => [maintaining] } })).resolves.toBeUndefined()
    expect(maintenanceFinished).toBe(true)
  })

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
      agents: { list: () => [] },
      loader: { entries: (): Iterable<LoaderEntry> => [] },
    }, {
      profile: 'test',
      profileDir: '/tmp/dsh-skin-market-route-test-missing-profile',
      runner: async () => ({ exitCode: 0, stdout: '', stderr: '', timedOut: false }),
    })

    expect(routes).toContainEqual({ kind: 'prefix', path: '/dsh-skin-market/operations' })
    expect(routes).not.toContainEqual({ kind: 'prefix', path: '/dsh-skin-market/operations/' })
    expect(routes).not.toContainEqual({ kind: 'exact', path: '/dsh-skin-market/catalog/refresh' })
    expect(routes).toContainEqual({ kind: 'exact', path: '/dsh-skin-market/market-update' })
    dispose()
  })
})
