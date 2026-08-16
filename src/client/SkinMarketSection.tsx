import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { TShirtIcon } from '@phosphor-icons/react'
import { MarkGithubIcon, StarIcon } from '@primer/octicons-react'
import {
  Button,
  IconChevronLeftOutline14,
  IconChevronDownOutline14,
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
import { createSubmissionPrompt } from './submission.ts'
import type { ClientSkinRuntime } from './index.ts'
import type { CatalogSkin, Operation, RuntimeSkin } from './types.ts'

export interface SkinMarketSectionProps {
  t: (key: string) => string
  clientRuntime?: ClientSkinRuntime
}

type MutationKind = 'install' | 'activate' | 'deactivate' | 'update' | 'uninstall'

const phases: Record<Operation['phase'], string> = {
  queued: '正在排队…', resolving: '正在解析版本…', downloading: '正在安装…', validating: '正在验证…', activating: '正在切换…', done: '完成', failed: '操作失败',
}

const mutationLabels: Record<MutationKind, string> = {
  install: '安装中', activate: '使用中', deactivate: '停用中', update: '更新中', uninstall: '卸载中',
}

const RELOAD_PARAM = 'dsh-skin-reload'

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
  const body = await response.json() as T & { error?: string }
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

export function SkinMarketSection({ t, clientRuntime }: SkinMarketSectionProps) {
  const [skins, setSkins] = useState<CatalogSkin[]>([])
  const [states, setStates] = useState<RuntimeSkin[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string>('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'installed'>('all')
  const [sortBy, setSortBy] = useState<'stars' | 'latest'>('stars')
  const [shotIndex, setShotIndex] = useState(0)
  const [busy, setBusy] = useState<Operation | null>(null)
  const [mutation, setMutation] = useState<{ skinId: string; kind: MutationKind } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmUninstall, setConfirmUninstall] = useState(false)
  const [confirmRestart, setConfirmRestart] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [showSubmission, setShowSubmission] = useState(false)
  const [submissionRepository, setSubmissionRepository] = useState('')
  const [submissionCopied, setSubmissionCopied] = useState(false)
  const [settingsNavIconHost, setSettingsNavIconHost] = useState<HTMLElement | null>(null)

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const [catalog, state] = await Promise.all([
        json<{ skins: CatalogSkin[] }>('/dsh-skin-market/catalog'),
        json<{ skins: RuntimeSkin[] }>('/dsh-skin-market/state'),
      ])
      setSkins(catalog.skins)
      setStates(state.skins)
      setSelectedId(value => {
        if (value !== '' && catalog.skins.some(skin => skin.id === value)) return value
        const active = state.skins.find(item => item.activation === 'active')
        if (active !== undefined && catalog.skins.some(skin => skin.id === active.skinId)) return active.skinId
        return catalog.skins[0]?.id ?? ''
      })
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  useEffect(() => { refresh(true).catch(reason => setError(reason instanceof Error ? reason.message : String(reason))) }, [refresh])
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
  const filtered = useMemo(() => skins.filter(skin => {
    const haystack = `${skin.name.zh} ${skin.name.en} ${skin.author} ${skin.tags.join(' ')}`.toLowerCase()
    if (!haystack.includes(query.trim().toLowerCase())) return false
    if (filter === 'installed') return runtimeFor(states, skin.id).installation !== 'missing'
    return true
  }).sort((a, b) => sortBy === 'latest' ? Date.parse(b.releaseUpdatedAt) - Date.parse(a.releaseUpdatedAt) : b.githubStars - a.githubStars), [skins, states, filter, query, sortBy])

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
            await Promise.all(skins
              .filter(skin => skin.id !== selected.id)
              .map(skin => clientRuntime.setActive(skin.package, false)))
            needsRestart = !(await clientRuntime.setActive(selected.package, true))
            restoreMarketStyleOrder()
          }
          await refresh()
          if (needsRestart) {
            setStates(value => value.map(item => item.skinId === selected.id
              ? { ...item, activation: 'restart-required' }
              : item))
            setConfirmRestart(true)
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
  }, [clientRuntime, refresh, selected, skins])

  const installAndActivate = useCallback(async () => {
    if (await run('install')) await run('activate')
  }, [run])

  const restartNow = useCallback(async () => {
    if (selected === undefined) return
    setRestarting(true)
    setError(null)
    try {
      const accepted = await json<{ instanceId: string }>('/dsh-skin-market/restart', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ skinId: selected.id }),
      })
      const deadline = Date.now() + 45_000
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

  const select = (id: string) => { setSelectedId(id); setShotIndex(0); setShowDetail(true); setError(null) }
  const recommendations = selected?.recommendations.map(id => skins.find(skin => skin.id === id)).filter((skin): skin is CatalogSkin => skin !== undefined) ?? []
  const submissionPrompt = createSubmissionPrompt(submissionRepository)
  const copySubmissionPrompt = async () => {
    if (submissionPrompt === '') return
    await navigator.clipboard.writeText(submissionPrompt)
    setSubmissionCopied(true)
  }

  return (
    <section className={css.root} data-dsh-skin-market data-detail={showDetail ? 'open' : 'closed'}>
      {settingsNavIconHost !== null && createPortal(<TShirtIcon size={16} weight="regular" aria-hidden="true" />, settingsNavIconHost)}
      <aside className={css.catalog} aria-label={t('catalog')}>
        <div className={css.catalogHeader}>
          <div className={css.catalogTitle}>
            <h2>{t('title')}</h2>
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
        <div className={css.skinList}>
          {loading ? <div className={css.listLoading} role="status"><IconLoadingOutline16 size={16} />正在加载皮肤列表…</div> : filtered.map(skin => {
            const itemState = runtimeFor(states, skin.id)
            const mutationLabel = mutation?.skinId === skin.id ? mutationLabels[mutation.kind] : null
            return <Button key={skin.id} variant="ghost" className={css.skinCard} data-selected={skin.id === selected?.id} aria-current={skin.id === selected?.id ? 'true' : undefined} onClick={() => select(skin.id)}>
              <img src={skin.screenshots[0]} alt={`${skin.name.zh} 界面预览`} loading="lazy" />
              <span className={css.skinCardBody}>
                <span className={css.cardTitle}>{skin.name.zh}</span>
                <span className={css.cardMetaLine}>
                  <span className={css.cardMeta}>{skin.author}</span>
                  <span className={css.cardStars} title={`GitHub Stars 快照，更新于 ${displayDate(skin.starsUpdatedAt)}`}><StarIcon size={12} aria-hidden="true" /> {skin.githubStars}</span>
                </span>
              </span>
              <Pill className={mutationLabel !== null || itemState.updateAvailable ? `${css.cardStatus} ${css.cardStatusUpdate}` : css.cardStatus}>{mutationLabel ?? (itemState.updateAvailable ? '可更新' : skin.review?.compatibility === 'unverified' && itemState.installation === 'missing' ? '待验证' : statusLabel(itemState))}</Pill>
            </Button>
          })}
          {!loading && filtered.length === 0 && <p className={css.empty}>没有匹配的皮肤</p>}
        </div>
      </aside>

      <main className={css.detail}>
        {loading ? <div className={css.loading} role="status"><IconLoadingOutline16 size={16} />正在加载皮肤详情…</div> : selected !== undefined && state !== null ? <>
          <Button className={`${css.mobileBack} ${css.nativeOutline}`} variant="outline" size="sm" icon={<IconChevronLeftOutline14 />} onClick={() => setShowDetail(false)}>返回列表</Button>
          <header className={css.detailHeader}>
            <img className={css.skinAvatar} src={selected.screenshots[0]} alt="" />
            <div className={css.titleBlock}>
              <h2>{selected.name.zh}</h2>
              <p className={css.author}>{selected.author}</p>
              <p className={css.description}>{selected.description}</p>
              <p className={css.version}>版本 {selected.install.version}<span aria-hidden="true"> · </span>{compatibilityUnverified ? 'DSH 兼容性待验证' : `兼容 DSH ${selected.compatibility.dsh}`}<Pill className={state.activation === 'active' ? `${css.status} ${css.statusActive}` : css.status}>{compatibilityUnverified && state.installation === 'missing' ? '待验证' : statusLabel(state)}</Pill></p>
            </div>
          </header>

          <div className={css.actionRow}>
              {state.installation === 'missing' && (compatibilityUnverified
                ? <Button className={css.nativeOutline} variant="outline" size="sm" icon={<MarkGithubIcon size={16} />} disabled={busy !== null} title="前往 GitHub 查看维护者提供的手动安装方式" onClick={() => window.open(selected.repo, '_blank', 'noopener,noreferrer')}>待验证，手动安装</Button>
                : <><Button className={css.nativePrimary} variant="primary" size="sm" icon={<IconDownloadOutline16 />} disabled={busy !== null} onClick={() => void installAndActivate()}>安装并应用</Button><Button className={css.nativeOutline} variant="outline" size="sm" disabled={busy !== null} onClick={() => void run('install')}>安装</Button></>)}
              {state.installation === 'installed' && state.activation === 'inactive' && <Button className={css.nativePrimary} variant="primary" size="sm" disabled={busy !== null} onClick={() => void run('activate')}>使用</Button>}
              {state.activation === 'restart-required' && <Button className={css.nativePrimary} variant="primary" size="sm" disabled={busy !== null} onClick={() => setConfirmRestart(true)}>重启以应用</Button>}
              {state.activation === 'active' && <Button className={css.nativeOutline} variant="outline" size="sm" disabled={busy !== null} onClick={() => void run('deactivate')}>停用</Button>}
              {state.updateAvailable && <Button className={`${state.activation === 'active' ? css.nativePrimary : css.nativeOutline} ${css.compactActionIcon}`} variant={state.activation === 'active' ? 'primary' : 'outline'} size="sm" icon={<IconRefreshOutline16 />} disabled={busy !== null} onClick={() => void run('update')}>更新</Button>}
              {state.installation !== 'missing' && <Button className={`${css.nativeOutline} ${css.iconOnlyButton} ${css.compactActionIcon}`} variant="outline" size="sm" icon={<IconTrashOutline16 />} aria-label="卸载" title="卸载" disabled={busy !== null} onClick={() => setConfirmUninstall(true)} />}
              <span className={css.actionDivider} aria-hidden="true" />
              <span className={css.repoMeta}>
                <span className={css.stars} title={`GitHub Stars 快照，更新于 ${displayDate(selected.starsUpdatedAt)}`}><StarIcon size={16} aria-hidden="true" /> {selected.githubStars}</span>
                <a className={css.repoLink} href={selected.repo} target="_blank" rel="noreferrer" title={selected.repo}><MarkGithubIcon size={16} aria-hidden="true" /><span>{selected.repo.replace('https://', '')}</span></a>
              </span>
          </div>

          {busy !== null && <div className={css.operation} role="status"><IconLoadingOutline16 size={16} /> {phases[busy.phase]}</div>}
          {error !== null && <div className={css.error} role="alert">{error}</div>}

          <div className={css.hero}>
            <img src={selected.screenshots[shotIndex] ?? selected.screenshots[0]} alt={`${selected.name.zh} 大图预览`} />
          </div>
          {selected.screenshots.length > 1 && <div className={css.thumbnails} aria-label="截图选择">
            {selected.screenshots.map((shot, index) => <Button variant="ghost" key={shot} data-selected={index === shotIndex} onClick={() => setShotIndex(index)}><img src={shot} alt={`${selected.name.zh} 截图 ${index + 1}`} /></Button>)}
          </div>}

          <div className={css.aboutGrid}>
            <article><h3>关于此皮肤</h3><p>{selected.description}</p><div className={css.tags}>{selected.tags.map(tag => <Pill className={css.staticPill} key={tag}>{tag}</Pill>)}</div><dl className={css.metadata}><div><dt>许可证</dt><dd>{selected.license.code}</dd></div><div><dt>代码商业使用</dt><dd>{selected.license.commercialUse ? '许可证允许' : '未获授权'}</dd></div><div><dt>模式</dt><dd>{selected.modes.join(' / ')}</dd></div></dl>{compatibilityUnverified && <p className={css.notice}>维护者尚未声明 DSH 兼容范围，市场暂不提供一键安装；你可以前往 GitHub 查看手动安装方式。</p>}{selected.review?.preview === 'repository-card' && <p className={css.notice}>该仓库没有可识别的皮肤截图，当前展示的是 GitHub 仓库卡片，并非界面预览。</p>}{selected.license.notice && <p className={css.notice}>{selected.license.notice}</p>}</article>
            <aside className={css.changelog}><h3>收录信息</h3><ol><li><strong>{selected.install.version}</strong><span>版本快照更新于 {displayDate(selected.releaseUpdatedAt)}</span></li><li><strong>Stars</strong><span>{selected.githubStars}，更新于 {displayDate(selected.starsUpdatedAt)}</span></li><li><strong>兼容</strong><span>{compatibilityUnverified ? '等待维护者声明 DSH 兼容范围' : `支持 DSH ${selected.compatibility.dsh}`}</span></li></ol><a href={selected.repo} target="_blank" rel="noreferrer">查看仓库详情</a></aside>
          </div>

          <section className={css.recommendations}><h3>更多推荐</h3><div>{recommendations.map(skin => <Button variant="ghost" key={skin.id} onClick={() => select(skin.id)}><img src={skin.screenshots[0]} alt="" /><span><strong>{skin.name.zh}</strong><small><StarIcon size={12} aria-hidden="true" /> {skin.githubStars}</small></span></Button>)}</div></section>
        </> : <div className={css.loading}>暂无可展示的皮肤详情</div>}
      </main>

      <Modal open={confirmUninstall} onClose={() => setConfirmUninstall(false)} title="卸载皮肤" closeLabel="关闭" description={state?.activation === 'active' ? '当前皮肤会先停用并恢复 DSH 默认外观，然后删除安装包。' : '将从当前 DSH profile 删除这个皮肤安装包。'} footer={<><Button className={css.nativeOutline} variant="outline" size="sm" onClick={() => setConfirmUninstall(false)}>取消</Button><Button className={css.nativePrimary} variant="primary" size="sm" onClick={() => { setConfirmUninstall(false); void run('uninstall') }}>确认卸载</Button></>} />
      <Modal open={confirmRestart} onClose={() => { if (!restarting) setConfirmRestart(false) }} title="需要重启 DSH 应用此皮肤" closeLabel="关闭" description={restarting ? '正在重新启动 DSH，请稍候…' : '重新启动会中断当前正在运行的 Agent。'} footer={<><Button className={css.nativeOutline} variant="outline" size="sm" disabled={restarting} onClick={() => setConfirmRestart(false)}>稍后</Button><Button className={css.nativePrimary} variant="primary" size="sm" disabled={restarting} onClick={() => void restartNow()}>{restarting ? '正在重启…' : '立即重启'}</Button></>} />
      <Modal
        open={showSubmission}
        onClose={() => setShowSubmission(false)}
        title="提交你的皮肤"
        closeLabel="关闭"
        description="填写公开 GitHub 仓库地址，复制提示词交给你自己的 Agent。Agent 会检查皮肤并向市场目录准备 PR。"
        footer={<><Button className={css.nativeOutline} variant="outline" size="sm" onClick={() => setShowSubmission(false)}>关闭</Button><Button className={css.nativePrimary} variant="primary" size="sm" disabled={submissionPrompt === ''} onClick={() => void copySubmissionPrompt()}>{submissionCopied ? '已复制' : '复制提示词'}</Button></>}
      >
        <div className={css.submission}>
          <Input aria-label="皮肤 GitHub 仓库" placeholder="https://github.com/作者/皮肤仓库" value={submissionRepository} onChange={event => { setSubmissionRepository(event.currentTarget.value); setSubmissionCopied(false) }} />
          {submissionRepository !== '' && submissionPrompt === '' && <p role="alert">请输入公开 GitHub 仓库首页地址。</p>}
          <textarea aria-label="Agent 投稿提示词" readOnly value={submissionPrompt} placeholder="输入有效仓库地址后生成提示词" rows={14} />
          <small>提示词不会授权 Agent 安装皮肤到你的 DSH，也不会把 Topic 收录等同于安全审核。</small>
        </div>
      </Modal>
    </section>
  )
}
