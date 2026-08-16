// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import React from 'react'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => {
  const icon = () => React.createElement('span', { 'aria-hidden': true })
  return {
    Button: ({ icon: leading, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode }) => React.createElement('button', props, leading, children),
    Input: ({ icon: leading, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ReactNode }) => React.createElement('label', null, leading, React.createElement('input', props)),
    Pill: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => React.createElement('button', props, children),
    Modal: ({ open, title, description, footer, children }: { open: boolean; title: string; description?: string; footer?: React.ReactNode; children?: React.ReactNode }) => open ? React.createElement('div', { role: 'dialog', 'aria-label': title }, description, children, footer) : null,
    IconChevronLeftOutline14: icon, IconChevronDownOutline14: icon, IconDownloadOutline16: icon, IconLinkOutline16: icon, IconLoadingOutline16: icon,
    IconRefreshOutline16: icon, IconSearchOutline16: icon, IconTrashOutline16: icon,
  }
})

import { restartReloadUrl, restoreMarketStyleOrder, SkinMarketSection } from '../../src/client/SkinMarketSection.tsx'
import { createClientSkinRuntime, missingPrimitives } from '../../src/client/index.ts'

const skin = {
  id: 'test.skin', name: { zh: '测试皮肤', en: 'Test Skin' }, author: 'author', description: 'description', repo: 'https://github.com/a/b', package: 'skin',
  tags: ['dark'], modes: ['dark'], install: { version: '1.0.0', commit: 'a'.repeat(40) }, compatibility: { dsh: '0.1.0-rc.6', platform: ['web'] },
  screenshots: ['https://example.com/preview.png'], license: { code: 'MIT', commercialUse: true }, githubStars: 42, starsStale: false, recommendations: [], updatedAt: '2026-08-16T00:00:00Z',
}

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('client market', () => {
  it('cache-busts the full document exactly once after a DSH restart', () => {
    const result = new URL(restartReloadUrl('http://127.0.0.1:8081/?view=market', 'new-instance'))
    expect(result.searchParams.get('view')).toBe('market')
    expect(result.searchParams.get('dsh-skin-reload')).toBe('new-instance')
  })

  it('restores market style priority after a skin is hot-loaded', () => {
    const market = document.createElement('style')
    market.textContent = '.generated-filter-marker{}'
    const skinStyle = document.createElement('style')
    skinStyle.dataset.plugin = 'skin-package'
    document.head.append(market, skinStyle)

    restoreMarketStyleOrder(document, 'generated-filter-marker')

    expect(document.head.lastElementChild).toBe(market)
    market.remove()
    skinStyle.remove()
  })

  it('hot-disables and re-enables an existing client skin entry', async () => {
    const update = vi.fn(async () => undefined)
    const runtime = createClientSkinRuntime({ entries: () => [{ options: { name: 'skin-package' }, update }] })

    await expect(runtime.setActive('skin-package', false)).resolves.toBe(true)
    expect(update).toHaveBeenLastCalledWith({ disabled: true }, false, true)
    await expect(runtime.setActive('skin-package', true)).resolves.toBe(true)
    expect(update).toHaveBeenLastCalledWith({ disabled: null }, false, true)
    await expect(runtime.setActive('missing-package', false)).resolves.toBe(false)
  })

  it('guards missing native primitives', () => {
    expect(missingPrimitives({ Button: true })).toEqual(['Input', 'Modal', 'Pill'])
  })

  it('shows list and detail loading hints, then defaults to the active skin', async () => {
    const activeSkin = { ...skin, id: 'test.active', name: { zh: '当前皮肤', en: 'Active Skin' } }
    let resolveCatalog!: (value: unknown) => void
    let resolveState!: (value: unknown) => void
    vi.stubGlobal('fetch', vi.fn((url: string) => new Promise(resolve => {
      if (url.endsWith('/catalog')) resolveCatalog = resolve
      else resolveState = resolve
    })))

    render(<SkinMarketSection t={key => key} />)
    expect(screen.getByText('正在加载皮肤列表…')).toBeTruthy()
    expect(screen.getByText('正在加载皮肤详情…')).toBeTruthy()
    expect(screen.queryByText('没有匹配的皮肤')).toBeNull()

    resolveCatalog({ ok: true, json: async () => ({ skins: [skin, activeSkin] }) })
    resolveState({ ok: true, json: async () => ({ skins: [
      { skinId: skin.id, installation: 'installed', activation: 'inactive', installedVersion: '1.0.0', updateAvailable: false },
      { skinId: activeSkin.id, installation: 'installed', activation: 'active', installedVersion: '1.0.0', updateAvailable: false },
    ] }) })

    expect(await screen.findByRole('heading', { name: '当前皮肤' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /当前皮肤 界面预览/ }).getAttribute('aria-current')).toBe('true')
    expect(screen.queryByText('正在加载皮肤列表…')).toBeNull()
    expect(screen.queryByText('正在加载皮肤详情…')).toBeNull()
  })

  it('keeps list and detail visible while refreshing after an operation', async () => {
    let catalogCalls = 0
    let stateCalls = 0
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/catalog')) {
        catalogCalls += 1
        if (catalogCalls > 1) return await new Promise(() => undefined)
        return { ok: true, json: async () => ({ skins: [skin] }) }
      }
      if (url.endsWith('/state')) {
        stateCalls += 1
        if (stateCalls > 1) return await new Promise(() => undefined)
        return { ok: true, json: async () => ({ skins: [{ skinId: skin.id, installation: 'installed', activation: 'active', installedVersion: '1.0.0', updateAvailable: false }] }) }
      }
      if (url.endsWith('/deactivate') && init?.method === 'POST') return { ok: true, json: async () => ({ operationId: 'deactivate-1' }) }
      if (url.endsWith('/operations/deactivate-1')) return { ok: true, json: async () => ({ id: 'deactivate-1', phase: 'done' }) }
      throw new Error(`Unexpected request: ${url}`)
    }))

    render(<SkinMarketSection t={key => key} />)
    fireEvent.click(await screen.findByRole('button', { name: '停用' }))
    await waitFor(() => expect(catalogCalls).toBe(2))

    expect(screen.getByRole('heading', { name: '测试皮肤' })).toBeTruthy()
    expect(screen.queryByText('正在加载皮肤列表…')).toBeNull()
    expect(screen.queryByText('正在加载皮肤详情…')).toBeNull()
  })

  it('uses DSH action priority and icons for inactive and active skins', async () => {
    let active = false
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/catalog')) return { ok: true, json: async () => ({ skins: [skin] }) }
      return { ok: true, json: async () => ({ skins: [{ skinId: skin.id, installation: 'installed', activation: active ? 'active' : 'inactive', installedVersion: '1.0.0', updateAvailable: true }] }) }
    }))
    render(<SkinMarketSection t={key => key} />)
    const use = await screen.findByRole('button', { name: '使用' })
    const inactiveUpdate = screen.getByRole('button', { name: '更新' })
    expect(use.getAttribute('variant')).toBe('primary')
    expect(inactiveUpdate.getAttribute('variant')).toBe('outline')
    expect(use.querySelector('[aria-hidden="true"]')).toBeNull()
    expect(inactiveUpdate.querySelector('[aria-hidden="true"]')).toBeTruthy()
    active = true
    cleanup()
    render(<SkinMarketSection t={key => key} />)
    const stop = await screen.findByRole('button', { name: '停用' })
    const activeUpdate = screen.getByRole('button', { name: '更新' })
    const uninstall = screen.getByRole('button', { name: '卸载' })
    expect(stop.getAttribute('variant')).toBe('outline')
    expect(activeUpdate.getAttribute('variant')).toBe('primary')
    expect(uninstall.getAttribute('variant')).toBe('outline')
    expect(stop.querySelector('[aria-hidden="true"]')).toBeNull()
    expect(activeUpdate.querySelector('[aria-hidden="true"]')).toBeTruthy()
    expect(uninstall.querySelector('[aria-hidden="true"]')).toBeTruthy()
    expect(uninstall.textContent).toBe('')
  })

  it('uses the DSH outline capsule for the mobile back action', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith('/catalog') ? { skins: [skin] } : { skins: [] } })))
    render(<SkinMarketSection t={key => key} />)
    const back = await screen.findByRole('button', { name: '返回列表' })
    expect(back.getAttribute('variant')).toBe('outline')
    expect(back.querySelector('[aria-hidden="true"]')).toBeTruthy()
  })

  it('replaces Use with a restart confirmation when activation needs restart', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith('/catalog') ? { skins: [skin] } : { skins: [{ skinId: skin.id, installation: 'installed', activation: 'restart-required', installedVersion: '1.0.0', updateAvailable: false }] } })))
    render(<SkinMarketSection t={key => key} />)

    const restart = await screen.findByRole('button', { name: '重启以应用' })
    expect(screen.queryByRole('button', { name: '使用' })).toBeNull()
    fireEvent.click(restart)
    expect(screen.getByRole('dialog', { name: '需要重启 DSH 应用此皮肤' })).toBeTruthy()
    expect(screen.getByText('重新启动会中断当前正在运行的 Agent。')).toBeTruthy()
    expect(screen.getByRole('button', { name: '稍后' })).toBeTruthy()
  })

  it('asks for restart immediately after Use when the client entry is absent', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/catalog')) return { ok: true, json: async () => ({ skins: [skin] }) }
      if (url.endsWith('/state')) return { ok: true, json: async () => ({ skins: [{ skinId: skin.id, installation: 'installed', activation: 'inactive', installedVersion: '1.0.0', updateAvailable: false }] }) }
      if (url.endsWith('/activate') && init?.method === 'POST') return { ok: true, json: async () => ({ operationId: 'activate-1' }) }
      if (url.endsWith('/operations/activate-1')) return { ok: true, json: async () => ({ id: 'activate-1', phase: 'done' }) }
      throw new Error(`Unexpected request: ${url}`)
    }))
    const clientRuntime = { setActive: vi.fn(async () => false) }
    render(<SkinMarketSection t={key => key} clientRuntime={clientRuntime} />)

    fireEvent.click(await screen.findByRole('button', { name: '使用' }))
    expect(await screen.findByRole('dialog', { name: '需要重启 DSH 应用此皮肤' })).toBeTruthy()
    expect(clientRuntime.setActive).toHaveBeenCalledWith(skin.package, true)
  })

  it('filters the catalog from the native search input', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith('/catalog') ? { skins: [skin] } : { skins: [] } })))
    render(<SkinMarketSection t={key => key} />)
    await waitFor(() => expect(screen.getAllByText('测试皮肤')).toHaveLength(2))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'missing' } })
    expect(screen.getByText('没有匹配的皮肤')).toBeTruthy()
  })

  it('offers All and Installed filters with Stars and latest sorting', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith('/catalog') ? { skins: [skin] } : { skins: [] } })))
    render(<SkinMarketSection t={key => key} />)
    await waitFor(() => expect(screen.getByRole('button', { name: '全部' })).toBeTruthy())
    expect(screen.queryByRole('button', { name: '精选' })).toBeNull()
    expect(screen.getByRole('button', { name: '已安装' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '全部' }).getAttribute('data-active')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '已安装' }))
    expect(screen.getByRole('button', { name: '已安装' }).getAttribute('data-active')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Stars' }))
    expect(screen.getByRole('button', { name: '最新' })).toBeTruthy()
  })

  it('shows Stars in list rows and marks the selected skin', async () => {
    const secondSkin = { ...skin, id: 'test.second', name: { zh: '第二皮肤', en: 'Second Skin' }, githubStars: 7 }
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith('/catalog') ? { skins: [skin, secondSkin] } : { skins: [] } })))
    render(<SkinMarketSection t={key => key} />)

    const first = await screen.findByRole('button', { name: /测试皮肤 界面预览/ })
    const second = screen.getByRole('button', { name: /第二皮肤 界面预览/ })
    expect(first.getAttribute('aria-current')).toBe('true')
    expect(second.getAttribute('aria-current')).toBeNull()
    expect(first.textContent).toContain('42')
    expect(second.textContent).toContain('7')

    fireEvent.click(second)
    expect(first.getAttribute('aria-current')).toBeNull()
    expect(second.getAttribute('aria-current')).toBe('true')
  })

  it('shows an installing status on the matching list row immediately', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/catalog')) return { ok: true, json: async () => ({ skins: [skin] }) }
      if (url.endsWith('/state')) return { ok: true, json: async () => ({ skins: [] }) }
      if (init?.method === 'POST') return await new Promise(() => undefined)
      throw new Error(`Unexpected request: ${url}`)
    }))
    render(<SkinMarketSection t={key => key} />)

    const installAndApply = await screen.findByRole('button', { name: '安装并应用' })
    const installOnly = screen.getByRole('button', { name: '安装' })
    expect(installAndApply.getAttribute('variant')).toBe('primary')
    expect(installOnly.getAttribute('variant')).toBe('outline')
    fireEvent.click(installOnly)
    expect(await screen.findByRole('button', { name: /测试皮肤 界面预览.*安装中/ })).toBeTruthy()
  })

  it('sends unverified skins to GitHub instead of one-click installation', async () => {
    const unverified = { ...skin, review: { compatibility: 'unverified' as const, preview: 'repository-card' as const }, compatibility: { dsh: 'unverified', platform: ['web'] } }
    const open = vi.fn()
    vi.stubGlobal('open', open)
    const fetchMock = vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith('/catalog') ? { skins: [unverified] } : { skins: [] } }))
    vi.stubGlobal('fetch', fetchMock)
    render(<SkinMarketSection t={key => key} />)

    const install = await screen.findByRole('button', { name: '待验证，手动安装' })
    fireEvent.click(install)
    expect(open).toHaveBeenCalledWith(unverified.repo, '_blank', 'noopener,noreferrer')
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/install'))).toBe(false)
    expect(screen.getByText('维护者尚未声明 DSH 兼容范围，市场暂不提供一键安装；你可以前往 GitHub 查看手动安装方式。')).toBeTruthy()
    expect(screen.getByText('该仓库没有可识别的皮肤截图，当前展示的是 GitHub 仓库卡片，并非界面预览。')).toBeTruthy()
  })

  it('generates and copies an agent PR prompt without submitting to GitHub', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith('/catalog') ? { skins: [skin] } : { skins: [] } })))

    render(<SkinMarketSection t={key => key} />)
    await waitFor(() => expect(screen.getByRole('button', { name: '提交皮肤' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: '提交皮肤' }))
    fireEvent.change(screen.getByRole('textbox', { name: '皮肤 GitHub 仓库' }), { target: { value: 'https://github.com/example/my-skin' } })

    const prompt = screen.getByRole('textbox', { name: 'Agent 投稿提示词' }) as HTMLTextAreaElement
    expect(prompt.value).toContain('皮肤仓库：https://github.com/example/my-skin')
    fireEvent.click(screen.getByRole('button', { name: '复制提示词' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(prompt.value))
    expect(screen.getByRole('button', { name: '已复制' })).toBeTruthy()
  })
})
