import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { SquaresFourIcon, TShirtIcon, XIcon } from '@phosphor-icons/react'
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
import './media-hover.module.css'
import { compareCatalogOrder, hasCatalogPreview } from '../catalog-order.ts'
import { browserCatalogCache, type CatalogCache } from './catalog-cache.ts'
import { CLI_INSTALL_WARNING, createSkinInstallCommand, createSkinInstallPrompt, createSubmissionPrompt, REGISTRY_REPOSITORY } from './submission.ts'
import { switchClientSkin, type ClientSkinRuntime } from './index.ts'
import { displayTitle, githubRepoLabel } from '../display-title.ts'
import type { CatalogSkin, InstalledClientPlugin, Operation, RuntimeSkin } from './types.ts'

export interface SkinMarketSectionProps {
  t: (key: string) => string
  clientRuntime?: ClientSkinRuntime
  catalogCache?: CatalogCache
}

type MutationKind = 'install' | 'activate' | 'deactivate' | 'pin' | 'unpin' | 'update' | 'uninstall'

interface CatalogResponse {
  skins: CatalogSkin[]
}

interface ListScrollAnchor { skinId: string | null; offset: number; scrollTop: number }
type RestartTarget = { kind: 'skin'; skinId: string } | { kind: 'market-update' }

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
  operation?: Operation | null
  installedClientPlugins?: InstalledClientPlugin[]
  runningAgentCount?: number
}

interface MarketUpdateStatus {
  currentVersion: string
  latestVersion: string
  updateAvailable: boolean
}

const phases: Record<Operation['phase'], string> = {
  queued: '正在排队', resolving: '正在解析版本', downloading: '正在下载', installing: '正在写入插件', validating: '正在验证', activating: '正在切换', cancelling: '正在取消', cancelled: '已取消', done: '完成', failed: '操作失败',
}

const operationVerbs: Record<Operation['kind'], string> = {
  install: '安装', activate: '启用', deactivate: '停用', pin: '设为常驻', unpin: '取消常驻', update: '更新', uninstall: '卸载',
}

function elapsedLabel(startedAt: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000))
  if (seconds < 60) return `${seconds} 秒`
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`
}

function byteLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

function operationMeta(operation: Operation, now: number): string[] {
  const details = [`${operationVerbs[operation.kind]}任务`]
  if (operation.downloadedBytes !== undefined && operation.totalBytes !== undefined) {
    details.push(`${byteLabel(operation.downloadedBytes)} / ${byteLabel(operation.totalBytes)}`)
  } else if (operation.downloadedBytes !== undefined) {
    details.push(`已下载 ${byteLabel(operation.downloadedBytes)}`)
  }
  if (operation.bytesPerSecond !== undefined && operation.bytesPerSecond > 0) details.push(`${byteLabel(operation.bytesPerSecond)}/s`)
  details.push(`已用时 ${elapsedLabel(operation.startedAt, now)}`)
  return details
}

const mutationLabels: Record<MutationKind, string> = {
  install: '安装中', activate: '使用中', deactivate: '停用中', pin: '设置常驻中', unpin: '取消常驻中', update: '更新中', uninstall: '卸载中',
}

const RELOAD_PARAM = 'dsh-skin-reload'
const ACTIVATION_WARNING_KEY = 'dsh-skin-market:activation-warning-accepted'
const RESET_HELP_URL = `${REGISTRY_REPOSITORY}#页面异常时重置皮肤`
export const CATALOG_BATCH_SIZE = 20
const GALLERY_INTERVAL_MS = 5600
const HOME_COMPACT_ENTER_SCROLL = 72
const HOME_COMPACT_EXIT_SCROLL = 16

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
    skinId: id, installation: 'missing', activation: 'inactive', primary: false, pinned: false, installedVersion: null, installedAt: null, updateAvailable: false,
  }
}

function statusLabel(state: RuntimeSkin): string {
  if (state.installation === 'broken') return '安装异常'
  if (state.pinned && state.activation === 'active') return '常驻'
  if (state.activation === 'active') return '正在使用'
  if (state.activation === 'restart-required') return '需要重启'
  if (state.installation === 'installed') return '已安装'
  return '未安装'
}

function compactStatusLabel(state: RuntimeSkin): string {
  if (state.pinned && state.activation === 'active') return '常驻'
  if (state.activation === 'active') return '使用中'
  if (state.activation === 'restart-required') return '待重启'
  if (state.installation === 'broken') return '安装异常'
  if (state.installation === 'installed') return '已安装'
  return '未安装'
}

function displayDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '未知' : new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(date)
}

/**
 * `screenshots` can contain a GitHub repository card for entries that have no
 * usable preview. Market-supplemented screenshots are real previews even if
 * the upstream entry still carries the repository-card marker.
 */
export function hasSkinPreview(skin: Pick<CatalogSkin, 'review' | 'marketScreenshots' | 'listScreenshot' | 'screenshots'>): boolean {
  return hasCatalogPreview(skin)
}

export function compareSkinOrder(a: CatalogSkin, b: CatalogSkin, sortBy: 'stars' | 'latest'): number {
  return compareCatalogOrder(a, b, sortBy, skin => skin.githubStars, skin => skin.releaseUpdatedAt)
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
  const hasMarketScreenshots = (skin.marketScreenshots?.length ?? 0) > 0
  const placeholder = (!hasMarketScreenshots && skin.review?.preview === 'repository-card') || src === undefined || failed
  if (placeholder) return <div className={css.previewPlaceholder} data-preview-kind={kind} role="img" aria-label={`${skin.name.zh} 暂无界面截图`}><MarkGithubIcon aria-hidden="true" /><strong>{skin.author}</strong><small>暂无界面截图</small></div>
  return <img src={src} alt={alt} loading={loading} decoding="async" onLoad={event => { event.currentTarget.dataset.loaded = 'true' }} onError={() => setFailed(true)} />
}

const healthLabels = {
  readmeScreenshots: 'README 截图',
  compatibility: '兼容版本',
  installation: '市场安装就绪',
  installCommand: '安装命令',
  topic: 'dsh-plugin Topic',
} as const

export function SkinMarketSection({ t, clientRuntime, catalogCache = browserCatalogCache }: SkinMarketSectionProps) {
  const [skins, setSkins] = useState<CatalogSkin[]>([])
  const [states, setStates] = useState<RuntimeSkin[]>([])
  const [installedClientPlugins, setInstalledClientPlugins] = useState<InstalledClientPlugin[]>([])
  const [loading, setLoading] = useState(true)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string>('')
  const [query, setQuery] = useState('')
  const [homeQuery, setHomeQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'installed'>('all')
  const [sortBy, setSortBy] = useState<'stars' | 'latest'>('stars')
  const [visibleCount, setVisibleCount] = useState(CATALOG_BATCH_SIZE)
  const [homeVisibleCount, setHomeVisibleCount] = useState(CATALOG_BATCH_SIZE)
  const [installedSlots, setInstalledSlots] = useState(5)
  const [shotIndex, setShotIndex] = useState(0)
  const [galleryPaused, setGalleryPaused] = useState(false)
  const [carouselEpoch, setCarouselEpoch] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [busy, setBusy] = useState<Operation | null>(null)
  const [operationClock, setOperationClock] = useState(Date.now())
  const [mutation, setMutation] = useState<{ skinId: string; kind: MutationKind } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmUninstall, setConfirmUninstall] = useState(false)
  const [confirmPin, setConfirmPin] = useState(false)
  const [activationWarningAccepted, setActivationWarningAccepted] = useState(() => {
    try { return window.localStorage.getItem(ACTIVATION_WARNING_KEY) === 'true' } catch { return false }
  })
  const [confirmRestart, setConfirmRestart] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [runningAgents, setRunningAgents] = useState<number | null>(null)
  const [restartCheckFinished, setRestartCheckFinished] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [browserOpen, setBrowserOpen] = useState(false)
  const [browserOrigin, setBrowserOrigin] = useState<'discover' | 'installed'>('discover')
  const [showSubmission, setShowSubmission] = useState(false)
  const [submissionCopied, setSubmissionCopied] = useState(false)
  const [showInstallOptions, setShowInstallOptions] = useState(false)
  const [installCopied, setInstallCopied] = useState<string | null>(null)
  const [marketUpdate, setMarketUpdate] = useState<MarketUpdateStatus | null>(null)
  const [marketUpdating, setMarketUpdating] = useState(false)
  const [restartTarget, setRestartTarget] = useState<RestartTarget | null>(null)
  const [settingsNavIconHost, setSettingsNavIconHost] = useState<HTMLElement | null>(null)
  const [homeCompact, setHomeCompact] = useState(false)
  const skinListRef = useRef<HTMLDivElement | null>(null)
  const homeRef = useRef<HTMLElement | null>(null)
  const detailRef = useRef<HTMLElement | null>(null)
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
      const active = runtimeStates.find(item => item.primary) ?? runtimeStates.find(item => item.activation === 'active')
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
      setBusy(state.operation ?? null)
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

  const openRestartConfirm = useCallback(async (skinId?: string, kind: RestartTarget['kind'] = 'skin') => {
    setError(null)
    setRunningAgents(null)
    setRestartCheckFinished(false)
    setRestartTarget(kind === 'market-update' ? { kind } : { kind, skinId: skinId ?? selectedIdRef.current })
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

  const updateMarket = useCallback(async () => {
    setError(null)
    setMarketUpdating(true)
    try {
      const status = await json<MarketUpdateStatus>('/dsh-skin-market/market-update', { method: 'POST' })
      setMarketUpdate(status)
      await openRestartConfirm(undefined, 'market-update')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setMarketUpdating(false)
    }
  }, [openRestartConfirm])

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
  useLayoutEffect(() => {
    if (detailRef.current !== null) detailRef.current.scrollTop = 0
  }, [selectedId])
  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has(RELOAD_PARAM)) return
    url.searchParams.delete(RELOAD_PARAM)
    window.history.replaceState(window.history.state, '', url)
  }, [])
  useLayoutEffect(() => {
    const home = homeRef.current
    if (home === null || typeof ResizeObserver === 'undefined') return
    const updateSlots = () => {
      const width = home.clientWidth
      setInstalledSlots(width < 560 ? 2 : width < 820 ? 3 : width < 1080 ? 4 : 5)
    }
    updateSlots()
    const observer = new ResizeObserver(updateSlots)
    observer.observe(home)
    return () => observer.disconnect()
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
  const shotCount = selected?.screenshots.length ?? 0
  const state = selected === undefined ? null : runtimeFor(states, selected.id)
  const compatibilityUnverified = selected?.review?.compatibility === 'unverified'
  const manualOnly = selected?.review?.installation === 'manual-only'
  const autoInstallable = !manualOnly
  const filtered = useMemo(() => skins.filter(skin => {
    const haystack = `${skin.name.zh} ${skin.name.en} ${skin.author} ${skin.tags.join(' ')}`.toLowerCase()
    if (!haystack.includes(query.trim().toLowerCase())) return false
    if (filter === 'installed') return runtimeFor(states, skin.id).installation !== 'missing'
    return true
  }).sort((a, b) => compareSkinOrder(a, b, sortBy)), [skins, states, filter, query, sortBy])
  const visibleSkins = useMemo(() => {
    const visible = filtered.slice(0, visibleCount)
    const selectedSkin = filtered.find(skin => skin.id === selectedId)
    if (selectedSkin !== undefined && !visible.some(skin => skin.id === selectedSkin.id)) visible.push(selectedSkin)
    return visible
  }, [filtered, selectedId, visibleCount])

  const installedSkins = useMemo(() => skins.filter(skin => runtimeFor(states, skin.id).installation !== 'missing').sort((a, b) => {
    const aState = runtimeFor(states, a.id)
    const bState = runtimeFor(states, b.id)
    if (aState.activation === 'active' && bState.activation !== 'active') return -1
    if (bState.activation === 'active' && aState.activation !== 'active') return 1
    const recent = Date.parse(bState.installedAt ?? '') - Date.parse(aState.installedAt ?? '')
    return Number.isNaN(recent) || recent === 0 ? b.githubStars - a.githubStars : recent
  }), [skins, states])
  const discoverySkins = useMemo(() => skins.filter(skin => {
    const haystack = `${skin.name.zh} ${skin.name.en} ${skin.author} ${skin.tags.join(' ')}`.toLowerCase()
    return haystack.includes(homeQuery.trim().toLowerCase())
  }).sort((a, b) => compareSkinOrder(a, b, sortBy)), [homeQuery, skins, sortBy])
  const visibleDiscoverySkins = useMemo(() => discoverySkins.slice(0, homeVisibleCount), [discoverySkins, homeVisibleCount])
  const installedRowSkins = installedSkins.length > installedSlots ? installedSkins.slice(0, Math.max(1, installedSlots - 1)) : installedSkins
  const installedOverflow = installedSkins.length > installedRowSkins.length

  useEffect(() => {
    const isNarrow = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 959px)').matches
    const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!browserOpen || (!showDetail && isNarrow) || galleryPaused || lightboxOpen || shotCount < 2 || reduceMotion) return
    const timer = window.setTimeout(() => setShotIndex(current => (current + 1) % shotCount), GALLERY_INTERVAL_MS)
    return () => window.clearTimeout(timer)
  }, [browserOpen, carouselEpoch, galleryPaused, lightboxOpen, selected?.id, shotCount, shotIndex, showDetail])

  useEffect(() => {
    setGalleryPaused(false)
    setLightboxOpen(false)
    setCarouselEpoch(current => current + 1)
  }, [selected?.id])

  useEffect(() => {
    if (!lightboxOpen) return
    const handleLightboxKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        setLightboxOpen(false)
        return
      }
      if (shotCount < 2) return
      if (event.key === 'ArrowLeft') setShotIndex(current => (current - 1 + shotCount) % shotCount)
      if (event.key === 'ArrowRight') setShotIndex(current => (current + 1) % shotCount)
    }
    window.addEventListener('keydown', handleLightboxKeys, true)
    return () => window.removeEventListener('keydown', handleLightboxKeys, true)
  }, [lightboxOpen, shotCount])

  const setCarouselPausedState = (paused: boolean) => {
    setGalleryPaused(paused)
    setCarouselEpoch(current => current + 1)
  }

  const moveShot = (direction: -1 | 1) => {
    if (shotCount > 1) setShotIndex(current => (current + direction + shotCount) % shotCount)
  }

  useEffect(() => { setVisibleCount(CATALOG_BATCH_SIZE) }, [filter, query, sortBy])
  useEffect(() => { setHomeVisibleCount(CATALOG_BATCH_SIZE) }, [homeQuery, sortBy])
  useEffect(() => {
    if (busy === null) return
    setOperationClock(Date.now())
    const timer = window.setInterval(() => setOperationClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [busy?.id])

  const cancelOperation = useCallback(async () => {
    if (busy === null || busy.id === 'pending' || busy.cancelable !== true) return
    const operationId = busy.id
    setError(null)
    setBusy(current => current?.id === operationId ? { ...current, phase: 'cancelling', cancelable: false } : current)
    try {
      await json<Operation>(`/dsh-skin-market/operations/${operationId}/cancel`, { method: 'POST' })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
      await refresh().catch(() => undefined)
    }
  }, [busy, refresh])

  const runForSkin = useCallback(async (skinId: string, kind: MutationKind) => {
    const target = skins.find(skin => skin.id === skinId)
    if (target === undefined) return false
    const targetState = runtimeFor(states, target.id)
    setError(null)
    setMutation({ skinId: target.id, kind })
    setBusy({ id: 'pending', kind, skinId: target.id, phase: 'queued', startedAt: new Date().toISOString() })
    try {
      const result = await json<{ operationId: string }>(`/dsh-skin-market/${kind}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ skinId: target.id }),
      })
      for (;;) {
        const operation = await json<Operation>(`/dsh-skin-market/operations/${result.operationId}`)
        setBusy(operation)
        if (operation.phase === 'done') {
          setBusy(null)
          // Updating a skin that is already in use replaces its package on
          // disk, but the loaded client module still belongs to the old
          // package. Reuse the existing restart confirmation flow so the
          // reviewed version is loaded by a fresh DSH process.
          let needsRestart = kind === 'update'
            && (targetState.activation === 'active' || targetState.activation === 'restart-required')
          if (kind === 'deactivate' || kind === 'uninstall') {
            await clientRuntime?.setActive(target.package, false)
          } else if (kind === 'unpin' && targetState.primary !== true) {
            await clientRuntime?.setActive(target.package, false)
          } else if (kind === 'pin' && clientRuntime !== undefined) {
            needsRestart = !(await clientRuntime.setActive(target.package, true))
            restoreMarketStyleOrder()
          } else if (kind === 'activate' && clientRuntime !== undefined) {
            const pinnedPackages = states
              .filter(item => item.pinned)
              .map(item => skins.find(skin => skin.id === item.skinId)?.package)
              .filter((packageName): packageName is string => packageName !== undefined)
            needsRestart = !(await switchClientSkin(clientRuntime, skins.map(skin => skin.package), target.package, pinnedPackages))
            restoreMarketStyleOrder()
          }
          await refresh()
          if (needsRestart) {
            setStates(value => value.map(item => item.skinId === target.id
              ? { ...item, activation: 'restart-required' }
              : item))
            await openRestartConfirm(target.id)
          }
          return true
        }
        if (operation.phase === 'cancelled') {
          setBusy(null)
          await refresh()
          return false
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
  }, [clientRuntime, openRestartConfirm, refresh, skins, states])

  const run = useCallback(async (kind: MutationKind) => selected === undefined ? false : runForSkin(selected.id, kind), [runForSkin, selected])

  const activateSelected = useCallback(() => {
    try { window.localStorage.setItem(ACTIVATION_WARNING_KEY, 'true') } catch { /* storage may be unavailable */ }
    setActivationWarningAccepted(true)
    void run('activate')
  }, [run])

  const installAndActivate = useCallback(async () => {
    if (await run('install')) activateSelected()
  }, [activateSelected, run])

  const restartNow = useCallback(async () => {
    const target = restartTarget ?? { kind: 'skin' as const, skinId: selectedIdRef.current }
    if (target.kind === 'skin' && target.skinId === '') return
    setRestarting(true)
    setError(null)
    try {
      const accepted = await json<{ instanceId: string }>('/dsh-skin-market/restart', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(target.kind === 'market-update' ? { reason: 'market-update' } : { skinId: target.skinId }),
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
  }, [restartTarget])

  const chooseSkin = (id: string) => { userSelectedRef.current = true; selectedIdRef.current = id; setSelectedId(id); setShotIndex(0); setLightboxOpen(false); setError(null); setInstallCopied(null); setShowInstallOptions(false) }
  const select = (id: string) => { chooseSkin(id); setShowDetail(true) }
  const openBrowser = (id: string, origin: 'discover' | 'installed') => {
    chooseSkin(id)
    setBrowserOrigin(origin)
    setFilter(origin === 'installed' ? 'installed' : 'all')
    setQuery('')
    setShowDetail(origin === 'discover')
    setBrowserOpen(true)
  }
  const openInstalledBrowser = (id?: string) => {
    const target = id ?? installedSkins.find(skin => runtimeFor(states, skin.id).activation === 'active')?.id ?? installedSkins[0]?.id
    if (target !== undefined) openBrowser(target, 'installed')
  }
  const closeBrowser = () => { setLightboxOpen(false); setBrowserOpen(false); setShowDetail(false) }
  const openCardInstall = (skin: CatalogSkin) => {
    if (skin.review?.installation === 'manual-only') {
      chooseSkin(skin.id)
      setInstallCopied(null)
      setShowInstallOptions(true)
      return
    }
    void runForSkin(skin.id, 'install')
  }
  const activateCard = (skinId: string) => {
    try { window.localStorage.setItem(ACTIVATION_WARNING_KEY, 'true') } catch { /* storage may be unavailable */ }
    setActivationWarningAccepted(true)
    void runForSkin(skinId, 'activate')
  }
  const recommendations = selected?.recommendations.map(id => skins.find(skin => skin.id === id)).filter((skin): skin is CatalogSkin => skin !== undefined) ?? []
  const submissionPrompt = createSubmissionPrompt()
  const copySubmissionPrompt = async () => {
    await navigator.clipboard.writeText(submissionPrompt)
    setSubmissionCopied(true)
  }
  const copyInstallOption = async (method: 'prompt' | 'command') => {
    if (selected === undefined) return
    await navigator.clipboard.writeText(method === 'prompt' ? createSkinInstallPrompt(selected) : createSkinInstallCommand(selected))
    setInstallCopied(`${selected.id}:${method}`)
  }
  const renderHomeCard = (skin: CatalogSkin, location: 'installed' | 'discover') => {
    const itemState = runtimeFor(states, skin.id)
    const cardMutation = mutation?.skinId === skin.id ? mutation : null
    const needsInstall = itemState.installation === 'missing' || itemState.installation === 'broken'
    const actionCount = cardMutation !== null || needsInstall
      ? 1
      : itemState.installation === 'installed'
        ? Number(itemState.activation === 'inactive' || itemState.activation === 'active') + Number(itemState.updateAvailable)
        : 0
    const stateText = itemState.installation === 'broken'
      ? '安装异常'
      : itemState.activation === 'active'
        ? compactStatusLabel(itemState)
        : itemState.activation === 'restart-required'
          ? '待重启'
          : itemState.installation === 'installed'
            ? '已安装'
            : null
    const open = () => location === 'installed' ? openInstalledBrowser(skin.id) : openBrowser(skin.id, 'discover')
    return <article className={css.homeCard} data-active={itemState.activation === 'active' ? 'true' : undefined} data-actions={actionCount} key={`${location}:${skin.id}`}>
      <Button variant="ghost" className={`${css.homeCardOpen} dsh-skin-media-hover`} aria-current={itemState.activation === 'active' ? 'true' : undefined} aria-label={location === 'installed' ? `${skin.name.zh} 已安装卡片` : `${skin.name.zh} 界面预览`} onClick={open}>
        <span className={css.homeCardMedia}><PreviewMedia skin={skin} src={skin.listScreenshot ?? skin.screenshots[0]} alt={`${skin.name.zh} 界面预览`} kind="recommendation" loading="lazy" /></span>
        <span className={css.homeCardCopy}>
          <span className={css.homeCardTitleRow}><strong title={skin.name.zh}>{skin.name.zh}</strong>{location === 'discover' && <span className={css.feedMeta}><StarIcon size={12} aria-hidden="true" /> {skin.githubStars}</span>}</span>
          <span className={css.homeCardDescription} title={skin.description}>{displayTitle(skin.description)}</span>
          <small className={css.homeCardFooter}><span title={githubRepoLabel(skin.repo)}>{githubRepoLabel(skin.repo)}</span>{stateText !== null && <span className={itemState.activation === 'active' ? `${css.cardStatus} ${css.cardStatusActive}` : itemState.installation === 'broken' ? `${css.cardStatus} ${css.cardStatusUpdate}` : css.cardStatus}>{stateText}</span>}</small>
        </span>
      </Button>
      {actionCount > 0 && <div className={css.cardInlineActions} role="group" aria-label={`${skin.name.zh} 操作`}>
        {cardMutation !== null ? <span className={css.cardActionProgress}><IconLoadingOutline16 />{mutationLabels[cardMutation.kind]}</span> : <>
          {needsInstall && <Button className={css.cardAction} variant="ghost" size="sm" disabled={mutation !== null} title={skin.review?.installation === 'manual-only' ? '复制安装提示词' : '直接安装到当前 DSH'} onClick={() => openCardInstall(skin)}>安装</Button>}
          {itemState.installation === 'installed' && itemState.activation === 'inactive' && <Button className={css.cardAction} variant="ghost" size="sm" disabled={mutation !== null} onClick={() => activateCard(skin.id)}>使用</Button>}
          {itemState.installation === 'installed' && itemState.activation === 'active' && <Button className={css.cardAction} variant="ghost" size="sm" disabled={mutation !== null} onClick={() => { void runForSkin(skin.id, 'deactivate') }}>停用</Button>}
          {itemState.installation === 'installed' && itemState.updateAvailable && <Button className={css.cardAction} variant="ghost" size="sm" disabled={mutation !== null} onClick={() => { void runForSkin(skin.id, 'update') }}>更新</Button>}
        </>}
      </div>}
    </article>
  }

  return (
    <section className={css.root} data-dsh-skin-market data-detail={showDetail ? 'open' : 'closed'} data-browser-open={browserOpen ? 'true' : 'false'}>
      {settingsNavIconHost !== null && createPortal(<TShirtIcon size={16} weight="regular" aria-hidden="true" />, settingsNavIconHost)}
      <main className={css.home} hidden={browserOpen} ref={homeRef} onScroll={event => {
        const home = event.currentTarget
        setHomeCompact(current => current
          ? home.scrollTop > HOME_COMPACT_EXIT_SCROLL
          : home.scrollTop > HOME_COMPACT_ENTER_SCROLL)
        if (discoverySkins.length > homeVisibleCount && home.scrollHeight - home.scrollTop - home.clientHeight < 560) {
          setHomeVisibleCount(value => Math.min(discoverySkins.length, value + CATALOG_BATCH_SIZE))
        }
      }}>
        <header className={css.homeHeader} data-compact={homeCompact ? 'true' : undefined}>
          <div className={css.homeTitleRow}>
            <div><h2>{t('title')}</h2><p>{skins.length} 款社区皮肤</p></div>
            <div className={css.homeActions}>
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
              <a className={css.nativeOutline} href={REGISTRY_REPOSITORY} target="_blank" rel="noreferrer"><MarkGithubIcon size={15} aria-hidden="true" /> GitHub</a>
              <Button className={css.nativeOutline} variant="outline" size="sm" onClick={() => { setShowSubmission(true); setSubmissionCopied(false) }}>提交皮肤</Button>
            </div>
          </div>
          <Input className={css.homeSearch} value={homeQuery} onChange={event => setHomeQuery(event.currentTarget.value)} icon={<IconSearchOutline16 />} placeholder={t('search')} aria-label={t('search')} />
          <div className={css.homeSearchPlaceholder} aria-hidden="true" />
          {busy !== null && <div className={`${css.operation} ${css.homeOperation}`} role="status"><IconLoadingOutline16 size={16} /> {phases[busy.phase]}</div>}
        </header>

        <div className={css.homeContent}>
          {homeQuery.trim() === '' && (loading || installedSkins.length > 0) && <section className={css.homeSection} aria-labelledby="installed-skins-title">
            <div className={css.homeSectionTitle}><h3 id="installed-skins-title">已安装</h3><span>当前使用优先，其余按最近安装排序</span></div>
            {loading ? <div className={css.installedRow} style={{ '--installed-columns': installedSlots } as CSSProperties} role="status" aria-label="正在加载已安装皮肤"><span className={css.srOnly}>正在加载已安装皮肤…</span>{Array.from({ length: installedSlots }, (_, index) => <article className={css.installedSkeletonCard} key={index} aria-hidden="true"><span /><span><i /><i /></span></article>)}</div> : <div className={css.installedRow} style={{ '--installed-columns': installedSlots } as CSSProperties}>
              {installedRowSkins.map(skin => renderHomeCard(skin, 'installed'))}
              {installedOverflow && <Button variant="ghost" className={`${css.homeCard} ${css.installedMoreCard}`} onClick={() => openInstalledBrowser()}><SquaresFourIcon size={24} aria-hidden="true" /><strong>查看全部已安装</strong></Button>}
            </div>}
          </section>}

          <section className={css.homeSection} aria-labelledby="discover-skins-title">
            <div className={css.homeSectionTitle}>
              <h3 id="discover-skins-title">{homeQuery.trim() === '' ? '发现更多' : '搜索结果'}</h3>
              <Button className={css.sortButton} variant="ghost" size="sm" onClick={() => setSortBy(value => value === 'stars' ? 'latest' : 'stars')}>{sortBy === 'stars' ? 'Stars' : '最新'} <IconChevronDownOutline14 /></Button>
            </div>
            {catalogLoading && skins.length === 0 ? <div className={css.homeLoading}><IconLoadingOutline16 /> 正在加载皮肤…</div> : visibleDiscoverySkins.length > 0 ? <div className={css.discoveryGrid}>
              {visibleDiscoverySkins.map(skin => renderHomeCard(skin, 'discover'))}
            </div> : <p className={css.empty}>没有匹配的皮肤</p>}
            {error !== null && !browserOpen && <div className={css.homeError} role="alert">{error}</div>}
            {!catalogLoading && homeVisibleCount < discoverySkins.length && <div className={css.homeLoadMore} aria-hidden="true"><span /><span /></div>}
          </section>
        </div>
      </main>

      <section className={css.browser} hidden={!browserOpen} role="dialog" aria-modal="true" aria-label="皮肤详情">
        <button type="button" className={css.browserBackdrop} aria-hidden="true" tabIndex={-1} onClick={closeBrowser} />
        <div className={css.browserPanel}>
        <header className={css.browserTitlebar}>
          <span><strong>{browserOrigin === 'installed' ? '已安装皮肤' : '皮肤详情'}</strong><small>{selected === undefined ? '' : githubRepoLabel(selected.repo)}</small></span>
          <Button className={`${css.browserClose} ${css.nativeOutline}`} variant="outline" size="sm" icon={<XIcon size={15} />} aria-label="关闭皮肤详情" title="关闭当前详情，返回皮肤市场" onClick={closeBrowser}>关闭详情</Button>
        </header>
      <aside className={css.catalog} aria-label={t('catalog')}>
        <div className={css.catalogHeader}>
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
              <span className={`${css.skinCardPreview} dsh-skin-media-hover`}><PreviewMedia key={`${skin.id}:${skin.listScreenshot ?? skin.screenshots[0] ?? 'missing'}:list`} skin={skin} src={skin.listScreenshot ?? skin.screenshots[0]} alt={`${skin.name.zh} 界面预览`} kind="list" loading="lazy" /></span>
              <span className={css.skinCardBody}>
                <span className={css.cardTitle}>{skin.name.zh}</span>
                <span className={css.cardDescription} title={skin.description}>{displayTitle(skin.description)}</span>
                <span className={css.cardMetaLine}>
                  <span className={css.cardMeta} title={githubRepoLabel(skin.repo)}>{githubRepoLabel(skin.repo)}</span>
                  <span className={css.cardStars} title={`GitHub Stars 快照，更新于 ${displayDate(skin.starsUpdatedAt)}`}><StarIcon size={12} aria-hidden="true" /> {skin.githubStars}</span>
                </span>
              </span>
              <span className={mutationLabel !== null ? `${css.cardStatus} ${css.cardStatusUpdate}` : itemState.activation === 'active' ? `${css.cardStatus} ${css.cardStatusActive}` : itemState.updateAvailable ? `${css.cardStatus} ${css.cardStatusUpdate}` : css.cardStatus}>{mutationLabel ?? (itemState.activation === 'active' ? compactStatusLabel(itemState) : itemState.updateAvailable ? '可更新' : itemState.installation === 'missing' && skin.review?.installation === 'manual-only' ? '手动安装' : compactStatusLabel(itemState))}</span>
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
          {!loading && browserOpen && selected === undefined && error !== null && <div className={css.error} role="alert">{error}</div>}
        </div>
      </aside>

      <main className={css.detail} ref={detailRef} aria-label="皮肤详情内容">
        {loading ? <div className={css.detailSkeleton} role="status" aria-label="正在加载皮肤详情"><p className={css.srOnly}>正在加载皮肤详情…</p><div><span /><i /></div><span /><span /><span /></div> : selected !== undefined && state !== null ? <>
          <Button className={`${css.mobileBack} ${css.nativeOutline}`} variant="outline" size="sm" icon={<IconChevronLeftOutline14 />} onClick={() => browserOrigin === 'discover' ? closeBrowser() : setShowDetail(false)}>{browserOrigin === 'discover' ? '返回发现' : '返回列表'}</Button>
          <header className={css.detailHeader}>
            <div className={css.skinAvatar}><PreviewMedia key={`${selected.id}:${selected.listScreenshot ?? selected.screenshots[0] ?? 'missing'}:avatar`} skin={selected} src={selected.listScreenshot ?? selected.screenshots[0]} alt="" kind="avatar" /></div>
            <div className={css.titleBlock}>
              <h2>{selected.name.zh}</h2>
              <p className={css.description} title={selected.description}>{displayTitle(selected.description)}</p>
              <p className={css.author}>{githubRepoLabel(selected.repo)}</p>
              <p className={css.version}>版本 {selected.install.version}<span aria-hidden="true"> · </span>{compatibilityUnverified ? 'DSH 兼容性待验证' : `兼容 DSH ${selected.compatibility.dsh}`}<Pill className={state.activation === 'active' ? `${css.status} ${css.statusActive}` : css.status}>{statusLabel(state)}</Pill></p>
            </div>
          </header>

          <div className={css.actionRow}>
              {state.installation === 'missing' && <>
                {autoInstallable && <Button className={css.nativePrimary} variant="primary" size="sm" icon={<IconDownloadOutline16 />} disabled={busy !== null} onClick={() => void installAndActivate()}>安装并使用</Button>}
                {autoInstallable && <Button className={css.nativeOutline} variant="outline" size="sm" disabled={busy !== null} onClick={() => void run('install')}>仅安装</Button>}
                {autoInstallable && <Button className={css.nativeOutline} variant="outline" size="sm" disabled={busy !== null} onClick={() => { setInstallCopied(null); setShowInstallOptions(true) }}>其他安装方式</Button>}
                {manualOnly && <Button className={css.nativeOutline} variant="outline" size="sm" icon={<MarkGithubIcon size={16} />} disabled={busy !== null} title="前往 GitHub 查看维护者提供的手动安装方式" onClick={() => window.open(selected.repo, '_blank', 'noopener,noreferrer')}>查看安装说明</Button>}
              </>}
              {state.installation === 'installed' && state.activation === 'inactive' && <Button className={css.nativePrimary} variant="primary" size="sm" disabled={busy !== null} onClick={activateSelected}>使用</Button>}
              {state.installation === 'installed' && state.activation === 'inactive' && <Button className={`${css.nativeOutline} ${css.pinAction}`} variant="outline" size="sm" aria-pressed="false" title="在不替换当前主皮肤的情况下启用并常驻，适合宠物、音效等可叠加插件；多个皮肤可能发生冲突" disabled={busy !== null} onClick={() => setConfirmPin(true)}>常驻使用</Button>}
              {state.activation === 'restart-required' && <Button className={css.nativePrimary} variant="primary" size="sm" disabled={busy !== null} onClick={() => void openRestartConfirm()}>重启以应用</Button>}
              {state.activation === 'active' && <Button className={css.nativeOutline} variant="outline" size="sm" disabled={busy !== null} onClick={() => void run('deactivate')}>停用</Button>}
              {state.activation === 'active' && <Button className={`${css.nativeOutline} ${css.pinAction}`} variant="outline" size="sm" aria-pressed={state.pinned === true} title={state.pinned ? '取消后，如果它不是当前主皮肤，将立即停用；以后切换皮肤时也不会再保留' : '切换其他皮肤时仍保持启用，适合宠物、音效等可叠加插件；多个皮肤可能发生冲突'} disabled={busy !== null} onClick={() => state.pinned ? void run('unpin') : setConfirmPin(true)}>{state.pinned ? '取消常驻' : '常驻使用'}</Button>}
              {state.activation === 'restart-required' && state.pinned && <Button className={`${css.nativeOutline} ${css.pinAction}`} variant="outline" size="sm" aria-pressed="true" title="取消常驻并撤销待重启的启用状态" disabled={busy !== null} onClick={() => void run('unpin')}>取消常驻</Button>}
              {state.updateAvailable && <Button className={`${state.activation === 'active' && !state.pinned ? css.nativePrimary : css.nativeOutline} ${css.compactActionIcon}`} variant={state.activation === 'active' && !state.pinned ? 'primary' : 'outline'} size="sm" icon={<IconRefreshOutline16 />} disabled={busy !== null} onClick={() => void run('update')}>更新</Button>}
              {state.installation !== 'missing' && <Button className={`${css.nativeOutline} ${css.iconOnlyButton} ${css.compactActionIcon}`} variant="outline" size="sm" icon={<IconTrashOutline16 />} aria-label="卸载" title="卸载" disabled={busy !== null} onClick={() => setConfirmUninstall(true)} />}
              <span className={css.actionDivider} aria-hidden="true" />
              <span className={css.repoMeta}>
                <span className={css.stars} title={`GitHub Stars 快照，更新于 ${displayDate(selected.starsUpdatedAt)}`}><StarIcon size={16} aria-hidden="true" /> {selected.githubStars}</span>
                <a className={css.repoLink} href={selected.repo} target="_blank" rel="noreferrer" title={selected.repo}><MarkGithubIcon size={16} aria-hidden="true" /><span>{selected.repo.replace('https://', '')}</span></a>
              </span>
          </div>

          {state.installation === 'installed' && state.activation === 'inactive' && !activationWarningAccepted && <p className={css.notice} role="note">首次启用提示：请先在设置 → 插件中停用其他皮肤、主题和外观插件，避免全局样式冲突。点击“使用”即表示已确认。</p>}

          {busy !== null && <div className={css.operation} role="status" aria-live="polite">
            <IconLoadingOutline16 size={16} />
            <strong>{phases[busy.phase]}“{skins.find(skin => skin.id === busy.skinId)?.name.zh ?? busy.skinId}”</strong>
            <span className={css.operationMeta}>{operationMeta(busy, operationClock).map(item => <small key={item}>· {item}</small>)}</span>
            {busy.cancelable === true && <Button className={`${css.nativeOutline} ${css.operationCancel}`} variant="outline" size="sm" onClick={() => void cancelOperation()}>取消</Button>}
          </div>}
          {error !== null && <div className={css.error} role="alert">{error}</div>}

          <div className={css.galleryGroup} data-paused={galleryPaused ? 'true' : 'false'} onMouseEnter={() => setCarouselPausedState(true)} onMouseLeave={() => setCarouselPausedState(false)} onFocusCapture={() => setCarouselPausedState(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setCarouselPausedState(false) }}>
            <div className={css.hero}>
              <button className={`${css.heroOpen} dsh-skin-media-hover`} aria-label={`全屏查看 ${selected.name.zh} 截图 ${shotIndex + 1}`} onClick={() => setLightboxOpen(true)}>
                <PreviewMedia key={`${selected.id}:${selected.screenshots[shotIndex] ?? selected.screenshots[0] ?? 'missing'}:hero`} skin={selected} src={selected.screenshots[shotIndex] ?? selected.screenshots[0]} alt={`${selected.name.zh} 大图预览`} kind="hero" />
              </button>
              {shotCount > 1 && <><Button className={`${css.heroNav} ${css.heroPrev}`} variant="ghost" icon={<IconChevronLeftOutline14 size={18} />} aria-label="上一张截图" onClick={() => moveShot(-1)} /><Button className={`${css.heroNav} ${css.heroNext}`} variant="ghost" icon={<IconChevronLeftOutline14 size={18} />} aria-label="下一张截图" onClick={() => moveShot(1)} /></>}
            </div>
            {selected.screenshots.length > 1 && <div className={css.thumbnails} aria-label="截图选择">
              {selected.screenshots.map((shot, index) => <Button className="dsh-skin-media-hover" variant="ghost" key={shot} data-selected={index === shotIndex} onClick={() => { setShotIndex(index); setCarouselEpoch(current => current + 1) }}><PreviewMedia skin={selected} src={shot} alt={`${selected.name.zh} 截图 ${index + 1}`} kind="thumbnail" loading="lazy" />{index === shotIndex && <span className={css.thumbnailProgress} key={`${selected.id}:${shotIndex}:${carouselEpoch}`} aria-hidden="true" />}</Button>)}
            </div>}
          </div>

          <div className={css.aboutGrid}>
            <article><h3>关于此皮肤</h3><p>{selected.description}</p><div className={css.tags}>{selected.tags.map(tag => <Pill className={css.staticPill} key={tag}>{tag}</Pill>)}</div><dl className={css.metadata}><div><dt>许可证</dt><dd>{selected.license.code}</dd></div><div><dt>代码商业使用</dt><dd>{selected.license.commercialUse ? '许可证允许' : '未获授权'}</dd></div><div><dt>模式</dt><dd>{selected.modes.join(' / ')}</dd></div></dl>{compatibilityUnverified && !manualOnly && <p className={css.notice}>市场已具备自动安装所需信息，但维护者尚未声明 DSH 兼容范围。仍可安装；建议先确认当前 DSH Web 版本，并留意安装后的界面表现。</p>}{manualOnly && <p className={css.notice}>该仓库距离市场的一键安装规范还差少量信息；可参考右侧仓库健康建议完善，当前请按维护者说明安装。</p>}{selected.review?.preview === 'repository-card' && !(selected.marketScreenshots?.length) && <p className={css.notice}>该仓库暂无可识别的皮肤截图，市场使用本地占位卡，不会加载 GitHub 仓库图片。</p>}{selected.marketScreenshots?.length && <p className={css.notice}>前 {selected.marketScreenshots.length} 张截图由市场在隔离 DSH 中实机补录；仓库截图按原顺序排在后面。维护者可向目录仓库提交 PR 删除或替换补录图。</p>}{selected.license.notice && <p className={css.notice}>{selected.license.notice}</p>}</article>
            <aside className={css.changelog}><h3>仓库健康</h3>{selected.health ? <><ol className={css.healthList}>{Object.entries(selected.health.checks).map(([key, value]) => <li key={key}><strong>{healthLabels[key as keyof typeof healthLabels]}</strong><span data-health={value}>{value === 'pass' ? '符合要求' : '建议完善'}</span></li>)}</ol>{selected.health.suggestions.map(suggestion => <p className={css.healthSuggestion} key={suggestion}>{suggestion}</p>)}</> : <p className={css.healthSuggestion}>等待下一次仓库健康扫描。</p>}<h3 className={css.collectionTitle}>收录信息</h3><ol><li><strong>{selected.install.version}</strong><span>版本快照更新于 {displayDate(selected.releaseUpdatedAt)}</span></li><li><strong>Stars</strong><span>{selected.githubStars}，更新于 {displayDate(selected.starsUpdatedAt)}</span></li><li><strong>兼容</strong><span>{compatibilityUnverified ? '等待维护者声明 DSH 兼容范围' : `支持 DSH ${selected.compatibility.dsh}`}</span></li></ol><a href={selected.repo} target="_blank" rel="noreferrer">查看仓库详情</a></aside>
          </div>

          <section className={css.recommendations}><h3>更多推荐</h3><div>{recommendations.map(skin => renderHomeCard(skin, 'discover'))}</div></section>
        </> : <div className={css.loading}>暂无可展示的皮肤详情</div>}
      </main>
        </div>
      </section>

      {lightboxOpen && selected !== undefined && createPortal(<section className={css.lightbox} role="dialog" aria-modal="true" aria-label={`${selected.name.zh} 全屏截图查看`}>
        <Button className={css.lightboxClose} variant="ghost" icon={<XIcon size={20} />} aria-label="关闭全屏查看" onClick={() => setLightboxOpen(false)} />
        {shotCount > 1 && <Button className={`${css.lightboxNav} ${css.lightboxPrev}`} variant="ghost" icon={<IconChevronLeftOutline14 size={26} />} aria-label="上一张截图" onClick={() => moveShot(-1)} />}
        <button className={css.lightboxStage} aria-label="退出全屏查看" onClick={() => setLightboxOpen(false)}><PreviewMedia key={`${selected.id}:${selected.screenshots[shotIndex] ?? selected.screenshots[0] ?? 'missing'}:lightbox`} skin={selected} src={selected.screenshots[shotIndex] ?? selected.screenshots[0]} alt={`${selected.name.zh} 全屏截图 ${shotIndex + 1}`} kind="hero" /></button>
        {shotCount > 1 && <Button className={`${css.lightboxNav} ${css.lightboxNext}`} variant="ghost" icon={<IconChevronLeftOutline14 size={26} />} aria-label="下一张截图" onClick={() => moveShot(1)} />}
        {shotCount > 1 && <div className={css.lightboxThumbnails} aria-label="全屏截图选择">{selected.screenshots.map((shot, index) => <Button className="dsh-skin-media-hover" variant="ghost" key={shot} data-selected={index === shotIndex} aria-label={`查看截图 ${index + 1}`} onClick={() => setShotIndex(index)}><PreviewMedia skin={selected} src={shot} alt="" kind="thumbnail" loading="lazy" /></Button>)}</div>}
      </section>, document.body)}

      <Modal open={confirmUninstall} onClose={() => setConfirmUninstall(false)} title="卸载皮肤" closeLabel="关闭" description={state?.activation === 'active' ? '当前皮肤会先停用并恢复 DSH 默认外观，然后删除安装包。' : '将从当前 DSH profile 删除这个皮肤安装包。'} footer={<><Button className={css.nativeOutline} variant="outline" size="sm" onClick={() => setConfirmUninstall(false)}>取消</Button><Button className={css.nativePrimary} variant="primary" size="sm" onClick={() => { setConfirmUninstall(false); void run('uninstall') }}>确认卸载</Button></>} />
      <Modal open={confirmPin} onClose={() => setConfirmPin(false)} title="常驻使用此皮肤" closeLabel="关闭" description="开启后，切换其他皮肤时不会自动停用此皮肤。适合宠物、音效等可叠加插件；多个皮肤可能同时修改样式、页面结构或功能，相关冲突风险由用户自行承担。" footer={<><Button className={css.nativeOutline} variant="outline" size="sm" onClick={() => setConfirmPin(false)}>取消</Button><Button className={css.nativePrimary} variant="primary" size="sm" onClick={() => { setConfirmPin(false); void run('pin') }}>确认常驻</Button></>}><p className={css.pinWarning}>如果发生冲突或页面无法操作，请停止 DSH，然后查看 <a href={RESET_HELP_URL} target="_blank" rel="noreferrer">页面异常时重置皮肤</a> 中的修复命令。</p></Modal>
      <Modal
        open={showInstallOptions}
        onClose={() => setShowInstallOptions(false)}
        title={`安装 ${selected?.name.zh ?? '皮肤'}`}
        closeLabel="关闭"
        description={manualOnly ? '该皮肤暂不支持市场直接安装，请复制提示词交给 Agent 处理。' : '任选一种，不用都执行。'}
        footer={manualOnly ? <><Button className={css.nativeOutline} variant="outline" size="sm" onClick={() => setShowInstallOptions(false)}>取消</Button><Button className={css.nativePrimary} variant="primary" size="sm" onClick={() => void copyInstallOption('prompt')}>{installCopied === `${selected?.id}:prompt` ? '提示词已复制' : '复制提示词'}</Button></> : <Button className={css.nativeOutline} variant="outline" size="sm" onClick={() => setShowInstallOptions(false)}>关闭</Button>}
      >
        <div className={css.installOptions}>
          <div><strong>提示词</strong><span className={css.copyCapsule}><code title={selected === undefined ? '' : createSkinInstallPrompt(selected)}>{selected === undefined ? '' : createSkinInstallPrompt(selected)}</code><Button className={`${css.nativeOutline} ${css.copyCapsuleButton}`} variant="outline" size="sm" icon={<IconCopyOutline16 />} aria-label={installCopied === `${selected?.id}:prompt` ? '提示词已复制' : '复制提示词'} title="复制提示词" onClick={() => void copyInstallOption('prompt')} /></span></div>
          {!manualOnly && <div><strong>命令</strong><span className={css.copyCapsule}><code title={selected === undefined ? '' : createSkinInstallCommand(selected)}>{selected === undefined ? '' : createSkinInstallCommand(selected)}</code><Button className={`${css.nativeOutline} ${css.copyCapsuleButton}`} variant="outline" size="sm" icon={<IconCopyOutline16 />} aria-label={installCopied === `${selected?.id}:command` ? '命令已复制' : '复制命令'} title="复制命令" onClick={() => void copyInstallOption('command')} /></span><small>{CLI_INSTALL_WARNING}</small></div>}
        </div>
      </Modal>
      <Modal open={confirmRestart} onClose={() => { if (!restarting) setConfirmRestart(false) }} title={restartTarget?.kind === 'market-update' ? '需要重启 DSH 应用皮肤市场更新' : '需要重启 DSH 应用此皮肤'} closeLabel="关闭" description={restarting ? '正在重新启动 DSH，请稍候…' : runningAgents === null && !restartCheckFinished ? '正在检查是否有 Agent 运行。状态确认前不能重启。' : runningAgents === null ? '当前 Host 尚未加载安全检查。请确认没有 Agent 正在运行、重要内容已保存；你可以继续完成这一次升级重启。新版本加载后会自动检测 Agent 状态。' : runningAgents > 0 ? `检测到 ${runningAgents} 个 Agent 正在运行，现在不能重启。请等待任务完全结束后再试，否则可能中断任务并导致会话历史无法加载。` : restartTarget?.kind === 'market-update' ? `Agent 状态检查已通过。但重启仍会关闭所有会话连接；即使回复已经停止显示，也请确认重要内容已保存，且没有即将开始的新任务。皮肤市场新版本 ${marketUpdate?.latestVersion ?? ''} 将在重启后生效。` : 'Agent 状态检查已通过。但重启仍会关闭所有会话连接；即使回复已经停止显示，也请确认重要内容已保存，且没有即将开始的新任务。'} footer={<><Button className={css.nativeOutline} variant="outline" size="sm" disabled={restarting} onClick={() => setConfirmRestart(false)}>稍后</Button><Button className={css.nativePrimary} variant="primary" size="sm" disabled={restarting || (runningAgents === null && !restartCheckFinished) || (runningAgents ?? 0) > 0} onClick={() => void restartNow()}>{restarting ? '正在重启…' : runningAgents === null && !restartCheckFinished ? '正在检查…' : runningAgents === null ? '我已确认无任务，仍然重启' : runningAgents > 0 ? '有任务运行中' : '确认无任务，立即重启'}</Button></>} />
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
