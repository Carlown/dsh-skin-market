import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { TShirtIcon } from '@phosphor-icons/react'
import { MarkGithubIcon, StarIcon } from '@primer/octicons-react'
import {
  Button,
  IconChevronLeftOutline14,
  IconChevronDownOutline14,
  IconCopyOutline16,
  IconDownloadOutline16,
  IconLoadingOutline16,
  IconRefreshOutline16,
  IconSearchOutline16,
  IconTrashOutline16,
  Input,
  Modal,
  Pill,
} from '@deepseek-ai/dsh-client-ui-primitives'
import css from './SkinMarket.module.css'
import { browserCatalogCache, type CatalogCache } from './catalog-cache.ts'
import { createSkinInstallPrompt, createSubmissionPrompt } from './submission.ts'
import { switchClientSkin, type ClientSkinRuntime } from './index.ts'
import type { CatalogSkin, InstalledClientPlugin, Operation, RuntimeSkin } from './types.ts'

export interface SkinMarketSectionProps {
  t: (key: string) => string
  clientRuntime?: ClientSkinRuntime
  catalogCache?: CatalogCache
}

type MutationKind = 'install' | 'activate' | 'deactivate' | 'update' | 'uninstall'

interface CatalogResponse {
  skins: CatalogSkin[]
}

interface ListScrollAnchor { skinId: string | null; offset: number; scrollTop: number }

export function captureListScroll(list: HTMLElement | null): ListScrollAnchor | null {
  if (list === null) return null
  const listTop = list.getBoundingClientRect().top
  const card = [...list.querySelectorAll<HTMLElement>('[data-skin-id]')].find(item => item.getBoundingClientRect().bottom > listTop)
  return { skinId: card?.dataset.skinId ?? null, offset: card === undefined ? 0 : card.getBoundingClientRect().top - listTop, scrollTop: list.scrollTop }
}

export function restoreListScroll(list: HTMLElement | null, anchor: ListScrollAnchor | null): void {
  if (list === null || anchor === null) return
  const card = anchor.skinId === null ? undefined : [...list.querySelectorAll<HTMLElement>('[data-skin-id]')].find(item => item.dataset.skinId === anchor.skinId)
  if (card === undefined) list.scrollTop = anchor.scrollTop
  else list.scrollTop += card.getBoundingClientRect().top - list.getBoundingClientRect().top - anchor.offset
}

interface MarketStateResponse {
  skins: RuntimeSkin[]
  installedClientPlugins?: InstalledClientPlugin[]
  runningAgentCount?: number
}

interface MarketUpdateStatus {
  currentVersion: string
  latestVersion: string
  updateAvailable: boolean
}

const phases: Record<Operation['phase'], string> = {
  queued: '正在排队…', resolving: '正在解析版本…', downloading: '正在安装…', validating: '正在验证…', activating: '正在切换…', done: '完成', failed: '操作失败',
}

const mutationLabels: Record<MutationKind, string> = {
  install: '安装中', activate: '使用中', deactivate: '停用中', update: '更新中', uninstall: '卸载中',
}

const RELOAD_PARAM = 'dsh-skin-reload'
const ACTIVATION_WARNING_KEY = 'dsh-skin-market:activation-warning-accepted'
export const CATALOG_BATCH_SIZE = 20

export function restartReloadUrl(href: string, instanceId: string): string {
  const url = new URL(href)
  url.searchParams.set(RELOAD_PARAM, instanceId)
  return url.toString()
}

export function restoreMarketStyleOrder(root: ParentNode = document, marker = css.filterPill): void {
  for (const style of root.querySelectorAll<HTMLStyleElement>('style')) {
    const ownsMarketCss = style.dataset.plugin === 'dsh-skin-market'
      || style.textContent?.includes(`.${marker}`) === true
    if (ownsMarketCss) style.parentNode?.appendChild(style)
  }
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  let body: T & { error?: string }
  try {
    body = await response.json() as T & { error?: string }
  } catch {
    throw new Error(response.ok
      ? '皮肤市场服务未返回有效数据，请确认 Host 插件已经更新'
      : `皮肤市场请求失败（HTTP ${response.status}）`)
  }
  if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`)
  return body
}

function runtimeFor(states: RuntimeSkin[], id: string): RuntimeSkin {
  return states.find(item => item.skinId === id) ?? {
    skinId: id, installation: 'missing', activation: 'inactive', installedVersion: null, updateAvailable: false,
  }
}

function statusLabel(state: RuntimeSkin): string {
  if (state.installation === 'broken') return '安装异常'
  if (state.activation === 'active') return '正在使用'
  if (state.activation === 'restart-required') return '需要重启'
  if (state.installation === 'installed') return '已安装'
  return '未安装'
}

function displayDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '未知' : new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(date)
}

interface PreviewMediaProps {
  skin: CatalogSkin
  src?: string
  alt: string
  kind: 'list' | 'avatar' | 'hero' | 'thumbnail' | 'recommendation'
  loading?: 'eager' | 'lazy'
}

function PreviewMedia({ skin, src, alt, kind, loading }: PreviewMediaProps) {
  const [failed, setFailed] = useState(false)
  const placeholder = skin.review?.preview === 'repository-card' || src === undefined || failed
  if (placeholder) return <div className={css.previewPlaceholder} data-preview-kind={kind} role="img" aria-label={`${skin.name.zh} 暂无界面截图`}><MarkGithubIcon aria-hidden="true" /><strong>{skin.author}</strong><small>暂无界面截图</small></div>
  return <img src={src} alt={alt} loading={loading} decoding="async" onLoad={event => { event.currentTarget.dataset.loaded = 'true' }} onError={() => setFailed(true)} />
}

const healthLabels = {
  readmeScreenshots: 'README 截图',
  compatibility: '兼容版本',
  installation: '一键安装准备',
} as const

export function SkinMarketSection({ t, clientRuntime, catalogCache = browserCatalogCache }: SkinMarketSectionProps) {
  const [skins, setSkins] = useState<CatalogSkin[]>([])
  const [states, setStates] = useState<RuntimeSkin[]>([])
  const [installedClientPlugins, setInstalledClientPlugins] = useState<InstalledClientPlugin[]>([])
  const [loading, setLoading] = useState(true)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string>('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'installed'>('all')
  const [sortBy, setSortBy] = useState<'stars' | 'latest'>('stars')
  const [visibleCount, setVisibleCount] = useState(CATALOG_BATCH_SIZE)
  const [shotIndex, setShotIndex] = useState(0)
  const [busy, setBusy] = useState<Operation | null>(null)
  const [mutation, setMutation] = useState<{ skinId: string; kind: MutationKind } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmUninstall, setConfirmUninstall] = useState(false)
  const [activationWarningAccepted, setActivationWarningAccepted] = useState(() => {
    try { return window.localStorage.getItem(ACTIVATION_WARNING_KEY) === 'true' } catch { return false }
  })
  const [confirmRestart, setConfirmRestart] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [runningAgents, setRunningAgents] = useState<number | null>(null)
  const [restartCheckFinished, setRestartCheckFinished] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [showSubmission, setShowSubmission] = useState(false)
  const [submissionCopied, setSubmissionCopied] = useState(false)
  const [installPromptCopied, setInstallPromptCopied] = useState<string | null>(null)
  const [marketUpdate, setMarketUpdate] = useState<MarketUpdateStatus | null>(null)
  const [marketUpdating, setMarketUpdating] = useState(false)
  const [showMarketUpdated, setShowMarketUpdated] = useState(false)
  const [settingsNavIconHost, setSettingsNavIconHost] = useState<HTMLElement | null>(null)
  const skinListRef = useRef<HTMLDivElement | null>(null)
  const pendingScrollAnchor = useRef<ListScrollAnchor | null>(null)
  const skinsRef = useRef<CatalogSkin[]>([])
  const selectedIdRef = useRef('')
  const userSelectedRef = useRef(false)

  const acceptCatalog = useCallback((incoming: CatalogSkin[], runtimeStates: RuntimeSkin[] = []) => {
    pendingScrollAnchor.current = captureListScroll(skinListRef.current)
    const nextSkins = [...incoming]
    const selectedBeforeRefresh = selectedIdRef.current
    if (selectedBeforeRefresh !== '' && !nextSkins.some(skin => skin.id === selectedBeforeRefresh)) {
      const selectedSkin = skinsRef.current.find(skin => skin.id === selectedBeforeRefresh)
      if (selectedSkin !== undefined) nextSkins.push(selectedSkin)
    }
    skinsRef.current = nextSkins
    setSkins(nextSkins)
    setSelectedId(value => {
      const active = runtimeStates.find(item => item.activation === 'active')
      const activeId = active !== undefined && nextSkins.some(skin => skin.id === active.skinId) ? active.skinId : null
      const next = !userSelectedRef.current && activeId !== null
        ? activeId
        : value !== '' && nextSkins.some(skin => skin.id === value)
          ? value
          : nextSkins[0]?.id ?? ''
      selectedIdRef.current = next
      return next
    })
  }, [])

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true)
      if (skinsRef.current.length === 0) setCatalogLoading(true)
    }
    try {
      const catalogRequest = json<CatalogResponse>('/dsh-skin-market/catalog').then(catalog => {
        if (showLoading) setCatalogLoading(false)
        return catalog
      })
      const stateRequest = json<MarketStateResponse>('/dsh-skin-market/state').then(state => {
        if (showLoading) setLoading(false)
        return state
      })
      const [catalog, state] = await Promise.all([catalogRequest, stateRequest])
      acceptCatalog(catalog.skins, state.skins)
      void catalogCache.write(catalog.skins).catch(() => undefined)
      setStates(state.skins)
      setInstalledClientPlugins(state.installedClientPlugins ?? [])
      setRunningAgents(typeof state.runningAgentCount === 'number' && Number.isInteger(state.runningAgentCount) ? state.runningAgentCount : null)
    } finally {
      if (showLoading) {
        setLoading(false)
        setCatalogLoading(false)
      }
    }
  }, [acceptCatalog, catalogCache])

  const checkMarketUpdate = useCallback(async () => {
    try {
      const status = await json<MarketUpdateStatus>('/dsh-skin-market/market-update')
      if (typeof status.updateAvailable === 'boolean' && typeof status.currentVersion === 'string' && typeof status.latestVersion === 'string') {
        setMarketUpdate(status)
      }
    } catch { /* update availability must never disturb catalog browsing */ }
  }, [])

  const updateMarket = useCallback(async () => {
    setError(null)
    setMarketUpdating(true)
    try {
      const status = await json<MarketUpdateStatus>('/dsh-skin-market/market-update', { method: 'POST' })
      setMarketUpdate(status)
      setShowMarketUpdated(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setMarketUpdating(false)
    }
  }, [])

  const openRestartConfirm = useCallback(async () => {
    setError(null)
    setRunningAgents(null)
    setRestartCheckFinished(false)
    setConfirmRestart(true)
    try {
      const state = await json<MarketStateResponse>('/dsh-skin-market/state', { cache: 'no-store' })
      setRunningAgents(typeof state.runningAgentCount === 'number' && Number.isInteger(state.runningAgentCount) ? state.runningAgentCount : null)
      setRestartCheckFinished(true)
    } catch (reason) {
      setRestartCheckFinished(true)
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }, [])

  useEffect(() => {
    let disposed = false
    void (async () => {
      const cached = await catalogCache.read()
      if (disposed) return
      if (cached !== null && cached.length > 0) {
        acceptCatalog(cached)
        setCatalogLoading(false)
      }
      await refresh(true).catch(reason => setError(reason instanceof Error ? reason.message : String(reason)))
    })()
    return () => { disposed = true }
  }, [acceptCatalog, catalogCache, refresh])
  useEffect(() => { void checkMarketUpdate() }, [checkMarketUpdate])
  useEffect(() => {
    const timer = window.setInterval(() => {
      refresh(false).catch(() => undefined)
      void checkMarketUpdate()
    }, 5 * 60 * 1000)
    const refreshOnFocus = () => {
      refresh(false).catch(() => undefined)
      void checkMarketUpdate()
    }
    window.addEventListener('focus', refreshOnFocus)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshOnFocus)
    }
  }, [checkMarketUpdate, refresh])
  useLayoutEffect(() => {
    restoreListScroll(skinListRef.current, pendingScrollAnchor.current)
    pendingScrollAnchor.current = null
  }, [skins])
  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has(RELOAD_PARAM)) return
    url.searchParams.delete(RELOAD_PARAM)
    window.history.replaceState(window.history.state, '', url)
  }, [])
  useEffect(() => {
    const style = document.createElement('style')
    style.dataset.dshSkinMarketWide = 'true'
    style.textContent = '@media (min-width: 960px){[role="dialog"]:has([data-dsh-skin-market]){width:min(1280px,calc(100vw - 48px));height:min(860px,calc(100vh - 48px))}}'
    document.head.appendChild(style)
    return () => style.remove()
  }, [])
  useEffect(() => {
    const market = document.querySelector('[data-dsh-skin-market]')
    const currentNav = market?.closest('[role="dialog"]')?.querySelector('nav button[aria-current="true"]')
    const defaultIcon = currentNav?.querySelector('svg')
    if (!(currentNav instanceof HTMLElement) || !(defaultIcon instanceof SVGElement)) return
    const host = document.createElement('span')
    host.className = css.settingsNavIcon
    host.setAttribute('aria-hidden', 'true')
    defaultIcon.dataset.dshSkinMarketDefaultIcon = 'hidden'
    defaultIcon.insertAdjacentElement('beforebegin', host)
    setSettingsNavIconHost(host)
    return () => {
      defaultIcon.removeAttribute('data-dsh-skin-market-default-icon')
      host.remove()
    }
  }, [])

  const selected = skins.find(skin => skin.id === selectedId) ?? skins[0]
  const state = selected === undefined ? null : runtimeFor(states, selected.id)
  const compatibilityUnverified = selected?.review?.compatibility === 'unverified'
  const manualOnly = selected?.review?.installation === 'manual-only'
  const autoInstallable = !compatibilityUnverified && !manualOnly
  const filtered = useMemo(() => skins.filter(skin => {
    const haystack = `${skin.name.zh} ${skin.name.en} ${skin.author} ${skin.tags.join(' ')}`.toLowerCase()
    if (!haystack.includes(query.trim().toLowerCase())) return false
    if (filter === 'installed') return runtimeFor(states, skin.id).installation !== 'missing'
    return true
  }).sort((a, b) => sortBy === 'latest' ? Date.parse(b.releaseUpdatedAt) - Date.parse(a.releaseUpdatedAt) : b.githubStars - a.githubStars), [skins, states, filter, query, sortBy])
  const visibleSkins = useMemo(() => {
    const visible = filtered.slice(0, visibleCount)
    const selectedSkin = filtered.find(skin => skin.id === selectedId)
    if (selectedSkin !== undefined && !visible.some(skin => skin.id === selectedSkin.id)) visible.push(selectedSkin)
    return visible
  }, [filtered, selectedId, visibleCount])

  useEffect(() => { setVisibleCount(CATALOG_BATCH_SIZE) }, [filter, query, sortBy])

  const run = useCallback(async (kind: MutationKind) => {
    if (selected === undefined) return false
    setError(null)
    setMutation({ skinId: selected.id, kind })
    try {
      const result = await json<{ operationId: string }>(`/dsh-skin-market/${kind}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ skinId: selected.id }),
      })
      for (;;) {
        const operation = await json<Operation>(`/dsh-skin-market/operations/${result.operationId}`)
        setBusy(operation)
        if (operation.phase === 'done') {
          setBusy(null)
          let needsRestart = false
          if (kind === 'deactivate' || kind === 'uninstall') {
            await clientRuntime?.setActive(selected.package, false)
          } else if (kind === 'activate' && clientRuntime !== undefined) {
            // Match uninstall-then-use semantics: wait for every old skin to
            // finish disposing before loading the selected skin.
            needsRestart = !(await switchClientSkin(clientRuntime, skins.map(skin => skin.package), selected.package))
            restoreMarketStyleOrder()
          }
          await refresh()
          if (needsRestart) {
            setStates(value => value.map(item => item.skinId === selected.id
              ? { ...item, activation: 'restart-required' }
              : item))
            await openRestartConfirm()
          }
          return true
        }
        if (operation.phase === 'failed') throw new Error(operation.message ?? '操作失败')
        await new Promise(resolve => setTimeout(resolve, 600))
      }
    } catch (reason) {
      setBusy(null)
      await refresh().catch(() => undefined)
      setError(reason instanceof Error ? reason.message : String(reason))
      return false
    } finally {
      setMutation(null)
    }
  }, [clientRuntime, openRestartConfirm, refresh, selected, skins])

  const activateSelected = useCallback(() => {
    try { window.localStorage.setItem(ACTIVATION_WARNING_KEY, 'true') } catch { /* storage may be unavailable */ }
    setActivationWarningAccepted(true)
    void run('activate')
  }, [run])

  const installAndActivate = useCallback(async () => {
    if (await run('install')) activateSelected()
  }, [activateSelected, run])

  const restartNow = useCallback(async () => {
    if (selected === undefined) return
    setRestarting(true)
    setError(null)
    try {
      const accepted = await json<{ instanceId: string }>('/dsh-skin-market/restart', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ skinId: selected.id }),
      })
      const deadline = Date.now() + 90_000
      while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 500))
        try {
          const next = await json<{ instanceId: string }>('/dsh-skin-market/state', { cache: 'no-store' })
          if (next.instanceId !== accepted.instanceId) {
            window.location.replace(restartReloadUrl(window.location.href, next.instanceId))
            return
          }
        } catch { /* the old process is releasing its port */ }
      }
      throw new Error('DeepSeek Harness 重启超时，请手动刷新页面')
    } catch (reason) {
      setConfirmRestart(false)
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setRestarting(false)
    }
  }, [selected])

  const select = (id: string) => { userSelectedRef.current = true; selectedIdRef.current = id; setSelectedId(id); setShotIndex(0); setShowDetail(true); setError(null); setInstallPromptCopied(null) }
  const recommendations = selected?.recommendations.map(id => skins.find(skin => skin.id === id)).filter((skin): skin is CatalogSkin => skin !== undefined) ?? []
  const submissionPrompt = createSubmissionPrompt()
  const copySubmissionPrompt = async () => {
    await navigator.clipboard.writeText(submissionPrompt)
    setSubmissionCopied(true)
  }
  const copyInstallPrompt = async () => {
    if (selected === undefined) return
    await navigator.clipboard.writeText(createSkinInstallPrompt(selected))
    setInstallPromptCopied(selected.id)
  }

  return (
    <section className={css.root} data-dsh-skin-market data-detail={showDetail ? 'open' : 'closed'}>
      {settingsNavIconHost !== null && createPortal(<TShirtIcon size={16} weight="regular" aria-hidden="true" />, settingsNavIconHost)}
      <aside className={css.catalog} aria-label={t('catalog')}>
        <div className={css.catalogHeader}>
          <div className={css.catalogTitle}>
            <div className={css.catalogTitleMain}>
              <h2>{t('title')}</h2>
              {marketUpdate?.updateAvailable === true && <Button
                className={`${css.nativeOutline} ${css.marketUpdateButton}`}
                variant="outline"
                size="sm"
                icon={marketUpdating ? <IconLoadingOutline16 /> : <IconDownloadOutline16 />}
                aria-label={`更新皮肤市场到 ${marketUpdate.latestVersion}`}
                title={`发现新版本 ${marketUpdate.latestVersion}`}
                disabled={marketUpdating}
                data-updating={marketUpdating ? 'true' : undefined}
                onClick={() => { void updateMarket() }}
              ><span className={css.marketUpdateLabel}>{marketUpdating ? '更新中' : '更新'}</span></Button>}
            </div>
            <Button className={css.nativeOutline} variant="outline" size="sm" onClick={() => { setShowSubmission(true); setSubmissionCopied(false) }}>提交皮肤</Button>
          </div>
          <Input value={query} onChange={event => setQuery(event.currentTarget.value)} icon={<IconSearchOutline16 />} placeholder={t('search')} aria-label={t('search')} />
          <div className={css.filterBar}>
            <div className={css.filters}>
              <Pill className={css.filterPill} data-active={filter === 'all' ? 'true' : undefined} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>全部</Pill>
              <Pill className={css.filterPill} data-active={filter === 'installed' ? 'true' : undefined} aria-pressed={filter === 'installed'} onClick={() => setFilter('installed')}>已安装</Pill>
            </div>
            <Button className={css.sortButton} variant="ghost" size="sm" onClick={() => setSortBy(value => value === 'stars' ? 'latest' : 'stars')}>
              {sortBy === 'stars' ? 'Stars' : '最新'} <IconChevronDownOutline14 />
            </Button>
          </div>
        </div>
        <div className={css.skinList} ref={skinListRef} onScroll={event => {
          const list = event.currentTarget
          if (filtered.length > visibleCount && list.scrollHeight - list.scrollTop - list.clientHeight < 320) {
            setVisibleCount(value => Math.min(filtered.length, value + CATALOG_BATCH_SIZE))
          }
        }}>
          {catalogLoading && skins.length === 0 ? <div className={css.listSkeleton} role="status" aria-label="正在加载皮肤列表"><span className={css.srOnly}>正在加载皮肤列表…</span>{Array.from({ length: 8 }, (_, index) => <div className={css.skeletonCard} key={index} aria-hidden="true"><span /><span><i /><i /></span><i /></div>)}</div> : visibleSkins.map(skin => {
            const itemState = runtimeFor(states, skin.id)
            const mutationLabel = mutation?.skinId === skin.id ? mutationLabels[mutation.kind] : null
            return <Button key={skin.id} variant="ghost" className={css.skinCard} data-skin-id={skin.id} data-selected={skin.id === selected?.id} aria-current={skin.id === selected?.id ? 'true' : undefined} onClick={() => select(skin.id)}>
              <PreviewMedia key={`${skin.id}:${skin.listScreenshot ?? skin.screenshots[0] ?? 'missing'}:list`} skin={skin} src={skin.listScreenshot ?? skin.screenshots[0]} alt={`${skin.name.zh} 界面预览`} kind="list" loading="lazy" />
              <span className={css.skinCardBody}>
                <span className={css.cardTitle}>{skin.name.zh}</span>
                <span className={css.cardMetaLine}>
                  <span className={css.cardMeta}>{skin.author}</span>
                  <span className={css.cardStars} title={`GitHub Stars 快照，更新于 ${displayDate(skin.starsUpdatedAt)}`}><StarIcon size={12} aria-hidden="true" /> {skin.githubStars}</span>
                </span>
              </span>
              <Pill className={mutationLabel !== null || itemState.updateAvailable ? `${css.cardStatus} ${css.cardStatusUpdate}` : css.cardStatus}>{mutationLabel ?? (itemState.updateAvailable ? '可更新' : itemState.installation === 'missing' && skin.review?.installation === 'manual-only' ? '手动安装' : itemState.installation === 'missing' && skin.review?.compatibility === 'unverified' ? '待验证' : statusLabel(itemState))}</Pill>
            </Button>
          })}
          {!catalogLoading && visibleCount < filtered.length && <div className={css.loadMoreHint} aria-hidden="true"><span /><span /></div>}
          {!catalogLoading && filtered.length === 0 && <p className={css.empty}>没有匹配的皮肤</p>}
          {!loading && filter === 'installed' && installedClientPlugins.map(plugin => <div className={`${css.skinCard} ${css.externalPlugin}`} key={plugin.package}>
            <span className={css.skinCardBody}>
              <span className={css.cardTitle}>{plugin.package}</span>
              <span className={css.cardMetaLine}>市场外客户端插件 · {plugin.version ?? '版本未知'} · {plugin.registered ? `已注册 ${plugin.rowIds.join(', ')}` : '尚未发现 loader 注册项'}</span>
            </span>
            <Pill className={css.cardStatus}>市场外</Pill>
          </div>)}
          {!loading && selected === undefined && error !== null && <div className={css.error} role="alert">{error}</div>}
        </div>
      </aside>

      <main className={css.detail}>
        {loading ? <div className={css.detailSkeleton} role="status" aria-label="正在加载皮肤详情"><p className={css.srOnly}>正在加载皮肤详情…</p><div><span /><i /></div><span /><span /><span /></div> : selected !== undefined && state !== null ? <>
          <Button className={`${css.mobileBack} ${css.nativeOutline}`} variant="outline" size="sm" icon={<IconChevronLeftOutline14 />} onClick={() => setShowDetail(false)}>返回列表</Button>
          <header className={css.detailHeader}>
            <div className={css.skinAvatar}><PreviewMedia key={`${selected.id}:${selected.listScreenshot ?? selected.screenshots[0] ?? 'missing'}:avatar`} skin={selected} src={selected.listScreenshot ?? selected.screenshots[0]} alt="" kind="avatar" /></div>
            <div className={css.titleBlock}>
              <h2>{selected.name.zh}</h2>
              <p className={css.author}>{selected.author}</p>
              <p className={css.description}>{selected.description}</p>
              <p className={css.version}>版本 {selected.install.version}<span aria-hidden="true"> · </span>{compatibilityUnverified ? 'DSH 兼容性待验证' : `兼容 DSH ${selected.compatibility.dsh}`}<Pill className={state.activation === 'active' ? `${css.status} ${css.statusActive}` : css.status}>{compatibilityUnverified && state.installation === 'missing' ? '待验证' : statusLabel(state)}</Pill></p>
            </div>
          </header>

          <div className={css.actionRow}>
              {state.installation === 'missing' && <>
                {autoInstallable && <Button className={css.nativePrimary} variant="primary" size="sm" icon={<IconDownloadOutline16 />} disabled={busy !== null} onClick={() => void installAndActivate()}>安装并使用</Button>}
                <Button className={autoInstallable ? css.nativeOutline : css.nativePrimary} variant={autoInstallable ? 'outline' : 'primary'} size="sm" icon={<IconCopyOutline16 />} disabled={busy !== null} onClick={() => void copyInstallPrompt()}>{installPromptCopied === selected.id ? '安装提示词已复制' : '复制安装提示词'}</Button>
                {!autoInstallable && <Button className={css.nativeOutline} variant="outline" size="sm" icon={<MarkGithubIcon size={16} />} disabled={busy !== null} title="前往 GitHub 查看维护者提供的手动安装方式" onClick={() => window.open(selected.repo, '_blank', 'noopener,noreferrer')}>{compatibilityUnverified ? '待验证，手动安装' : '查看安装说明'}</Button>}
              </>}
              {state.installation === 'installed' && state.activation === 'inactive' && <Button className={css.nativePrimary} variant="primary" size="sm" disabled={busy !== null} onClick={activateSelected}>使用</Button>}
              {state.activation === 'restart-required' && <Button className={css.nativePrimary} variant="primary" size="sm" disabled={busy !== null} onClick={() => void openRestartConfirm()}>重启以应用</Button>}
              {state.activation === 'active' && <Button className={css.nativeOutline} variant="outline" size="sm" disabled={busy !== null} onClick={() => void run('deactivate')}>停用</Button>}
              {state.updateAvailable && <Button className={`${state.activation === 'active' ? css.nativePrimary : css.nativeOutline} ${css.compactActionIcon}`} variant={state.activation === 'active' ? 'primary' : 'outline'} size="sm" icon={<IconRefreshOutline16 />} disabled={busy !== null} onClick={() => void run('update')}>更新</Button>}
              {state.installation !== 'missing' && <Button className={`${css.nativeOutline} ${css.iconOnlyButton} ${css.compactActionIcon}`} variant="outline" size="sm" icon={<IconTrashOutline16 />} aria-label="卸载" title="卸载" disabled={busy !== null} onClick={() => setConfirmUninstall(true)} />}
              <span className={css.actionDivider} aria-hidden="true" />
              <span className={css.repoMeta}>
                <span className={css.stars} title={`GitHub Stars 快照，更新于 ${displayDate(selected.starsUpdatedAt)}`}><StarIcon size={16} aria-hidden="true" /> {selected.githubStars}</span>
                <a className={css.repoLink} href={selected.repo} target="_blank" rel="noreferrer" title={selected.repo}><MarkGithubIcon size={16} aria-hidden="true" /><span>{selected.repo.replace('https://', '')}</span></a>
              </span>
          </div>

          {state.installation === 'installed' && state.activation === 'inactive' && !activationWarningAccepted && <p className={css.notice} role="note">首次启用提示：请先在设置 → 插件中停用其他皮肤、主题和外观插件，避免全局样式冲突。点击“使用”即表示已确认。</p>}

          {busy !== null && <div className={css.operation} role="status"><IconLoadingOutline16 size={16} /> {phases[busy.phase]}</div>}
          {error !== null && <div className={css.error} role="alert">{error}</div>}

          <div className={css.hero}>
            <PreviewMedia key={`${selected.id}:${selected.screenshots[shotIndex] ?? selected.screenshots[0] ?? 'missing'}:hero`} skin={selected} src={selected.screenshots[shotIndex] ?? selected.screenshots[0]} alt={`${selected.name.zh} 大图预览`} kind="hero" />
          </div>
          {selected.screenshots.length > 1 && <div className={css.thumbnails} aria-label="截图选择">
            {selected.screenshots.map((shot, index) => <Button variant="ghost" key={shot} data-selected={index === shotIndex} onClick={() => setShotIndex(index)}><PreviewMedia skin={selected} src={shot} alt={`${selected.name.zh} 截图 ${index + 1}`} kind="thumbnail" loading="lazy" /></Button>)}
          </div>}

          <div className={css.aboutGrid}>
            <article><h3>关于此皮肤</h3><p>{selected.description}</p><div className={css.tags}>{selected.tags.map(tag => <Pill className={css.staticPill} key={tag}>{tag}</Pill>)}</div><dl className={css.metadata}><div><dt>许可证</dt><dd>{selected.license.code}</dd></div><div><dt>代码商业使用</dt><dd>{selected.license.commercialUse ? '许可证允许' : '未获授权'}</dd></div><div><dt>模式</dt><dd>{selected.modes.join(' / ')}</dd></div></dl>{compatibilityUnverified && !manualOnly && <p className={css.notice}>维护者尚未声明 DSH 兼容范围，市场暂不提供自动安装。可复制安装提示词交给 Agent 验证安装，或前往 GitHub 查看说明。</p>}{manualOnly && <p className={css.notice}>该仓库距离市场的一键安装规范还差少量信息；可参考右侧仓库健康建议完善，当前请按维护者说明安装。</p>}{selected.review?.preview === 'repository-card' && <p className={css.notice}>该仓库暂无可识别的皮肤截图，市场使用本地占位卡，不会加载 GitHub 仓库图片。</p>}{selected.marketScreenshots?.length && <p className={css.notice}>前 {selected.marketScreenshots.length} 张截图由市场在隔离 DSH 中实机补录；仓库截图按原顺序排在后面。维护者可向目录仓库提交 PR 删除或替换补录图。</p>}{selected.license.notice && <p className={css.notice}>{selected.license.notice}</p>}</article>
            <aside className={css.changelog}><h3>仓库健康</h3>{selected.health ? <><ol className={css.healthList}>{Object.entries(selected.health.checks).map(([key, value]) => <li key={key}><strong>{healthLabels[key as keyof typeof healthLabels]}</strong><span data-health={value}>{value === 'pass' ? '符合要求' : '建议完善'}</span></li>)}</ol>{selected.health.suggestions.map(suggestion => <p className={css.healthSuggestion} key={suggestion}>{suggestion}</p>)}</> : <p className={css.healthSuggestion}>等待下一次仓库健康扫描。</p>}<h3 className={css.collectionTitle}>收录信息</h3><ol><li><strong>{selected.install.version}</strong><span>版本快照更新于 {displayDate(selected.releaseUpdatedAt)}</span></li><li><strong>Stars</strong><span>{selected.githubStars}，更新于 {displayDate(selected.starsUpdatedAt)}</span></li><li><strong>兼容</strong><span>{compatibilityUnverified ? '等待维护者声明 DSH 兼容范围' : `支持 DSH ${selected.compatibility.dsh}`}</span></li></ol><a href={selected.repo} target="_blank" rel="noreferrer">查看仓库详情</a></aside>
          </div>

          <section className={css.recommendations}><h3>更多推荐</h3><div>{recommendations.map(skin => <Button variant="ghost" key={skin.id} onClick={() => select(skin.id)}><PreviewMedia skin={skin} src={skin.listScreenshot ?? skin.screenshots[0]} alt="" kind="recommendation" loading="lazy" /><span><strong>{skin.name.zh}</strong><small><StarIcon size={12} aria-hidden="true" /> {skin.githubStars}</small></span></Button>)}</div></section>
        </> : <div className={css.loading}>暂无可展示的皮肤详情</div>}
      </main>

      <Modal open={confirmUninstall} onClose={() => setConfirmUninstall(false)} title="卸载皮肤" closeLabel="关闭" description={state?.activation === 'active' ? '当前皮肤会先停用并恢复 DSH 默认外观，然后删除安装包。' : '将从当前 DSH profile 删除这个皮肤安装包。'} footer={<><Button className={css.nativeOutline} variant="outline" size="sm" onClick={() => setConfirmUninstall(false)}>取消</Button><Button className={css.nativePrimary} variant="primary" size="sm" onClick={() => { setConfirmUninstall(false); void run('uninstall') }}>确认卸载</Button></>} />
      <Modal open={confirmRestart} onClose={() => { if (!restarting) setConfirmRestart(false) }} title="需要重启 DSH 应用此皮肤" closeLabel="关闭" description={restarting ? '正在重新启动 DSH，请稍候…' : runningAgents === null && !restartCheckFinished ? '正在检查是否有 Agent 运行。状态确认前不能重启。' : runningAgents === null ? '当前 Host 尚未加载安全检查。请确认没有 Agent 正在运行、重要内容已保存；你可以继续完成这一次升级重启。新版本加载后会自动检测 Agent 状态。' : runningAgents > 0 ? `检测到 ${runningAgents} 个 Agent 正在运行，现在不能重启。请等待任务完全结束后再试，否则可能中断任务并导致会话历史无法加载。` : 'Agent 状态检查已通过。但重启仍会关闭所有会话连接；即使回复已经停止显示，也请确认重要内容已保存，且没有即将开始的新任务。'} footer={<><Button className={css.nativeOutline} variant="outline" size="sm" disabled={restarting} onClick={() => setConfirmRestart(false)}>稍后</Button><Button className={css.nativePrimary} variant="primary" size="sm" disabled={restarting || (runningAgents === null && !restartCheckFinished) || (runningAgents ?? 0) > 0} onClick={() => void restartNow()}>{restarting ? '正在重启…' : runningAgents === null && !restartCheckFinished ? '正在检查…' : runningAgents === null ? '我已确认无任务，仍然重启' : runningAgents > 0 ? '有任务运行中' : '确认无任务，立即重启'}</Button></>} />
      <Modal
        open={showMarketUpdated}
        onClose={() => setShowMarketUpdated(false)}
        title="皮肤市场已更新"
        closeLabel="关闭"
        description={`新版本 ${marketUpdate?.latestVersion ?? ''} 已安装。重启 DSH Web 后生效，当前选择和已安装皮肤不会改变。`}
        footer={<Button className={css.nativePrimary} variant="primary" size="sm" onClick={() => setShowMarketUpdated(false)}>知道了</Button>}
      />
      <Modal
        open={showSubmission}
        onClose={() => setShowSubmission(false)}
        title="提交你的皮肤"
        closeLabel="关闭"
        description="复制下面的提示词交给你的 Agent，它会确认皮肤仓库、完成检查并准备市场 PR。"
        footer={<><Button className={css.nativeOutline} variant="outline" size="sm" onClick={() => setShowSubmission(false)}>关闭</Button><Button className={css.nativePrimary} variant="primary" size="sm" onClick={() => void copySubmissionPrompt()}>{submissionCopied ? '已复制' : '复制提示词'}</Button></>}
      >
        <div className={css.submission}>
          <textarea aria-label="Agent 投稿提示词" readOnly value={submissionPrompt} rows={16} />
          <small>提示词不会授权 Agent 安装皮肤到你的 DSH，也不会把 Topic 收录等同于安全审核。</small>
        </div>
      </Modal>
    </section>
  )
}
