import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowLeft, Check, Copy, GithubLogo, MagnifyingGlass, X } from '@phosphor-icons/react'
import { StarIcon } from '@primer/octicons-react'
import { fetchLiveCatalogWithFallback, REMOTE_CATALOG_URL } from './catalog.ts'
import { comparePublicCatalogOrder, shouldRenderPublicPreview } from './catalog-order.ts'
import { MARKET_CLI_COMMAND, MARKET_PROMPT, MARKET_PUBLIC_URL, MARKET_REPOSITORY, skinCommand, skinPrompt } from './prompts.ts'
import './site.css'
import '../src/client/media-hover.module.css'

interface Skin {
  id: string
  name: { zh: string; en: string }
  author: string
  description: string
  repo: string
  subpath?: string
  tags: string[]
  modes: string[]
  install: { target: string; version: string; commit: string }
  compatibility: { dsh: string; platform: string[] }
  marketScreenshots?: string[]
  listScreenshot?: string
  screenshots: string[]
  review?: { compatibility: 'verified' | 'unverified'; preview: 'verified' | 'repository-card'; installation: 'verified' | 'manual-only' }
  health?: { status: 'healthy' | 'improvements'; checks: { readmeScreenshots: 'pass' | 'improve'; compatibility: 'pass' | 'improve'; installation: 'pass' | 'improve'; installCommand?: 'pass' | 'improve'; topic?: 'pass' | 'improve' }; suggestions: string[] }
  license: { code: string; commercialUse: boolean; notice?: string }
  featuredRank: number
  starsSnapshot: number
  updatedAt: string
}

const GALLERY_INTERVAL_MS = 5600

function CatalogCard({ skin, onOpen, onInstall }: { skin: Skin; onOpen: () => void; onInstall: () => void }) {
  const repoLabel = skin.repo.replace(/^https?:\/\/github\.com\//, '')
  return <article className="feed-card">
    <button className="feed-card-open dsh-skin-media-hover" aria-label={`${skin.name.zh} 界面预览`} onClick={onOpen}>
      <span className="feed-card-media"><PreviewMedia skin={skin} src={skin.listScreenshot ?? skin.screenshots[0]} alt={`${skin.name.zh} 界面预览`} kind="card" loading="lazy" /></span>
      <span className="feed-card-copy">
        <span className="feed-card-title"><strong title={skin.description}>{skin.description}</strong><span className="feed-card-stats"><StarIcon size={12} /> {skin.starsSnapshot}</span></span>
        <small><span title={repoLabel}>{repoLabel}</span>{skin.review?.installation === 'manual-only' && <span className="status pending">手动安装</span>}</small>
      </span>
    </button>
    <button className="card-install" onClick={onInstall}>安装</button>
  </article>
}

function App({ skins }: { skins: Skin[] }) {
  const [selectedId, setSelectedId] = useState(skins[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'stars' | 'latest'>('stars')
  const [shot, setShot] = useState(0)
  const [galleryPaused, setGalleryPaused] = useState(false)
  const [carouselEpoch, setCarouselEpoch] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(24)
  const [copied, setCopied] = useState<string | null>(null)
  const [installDialog, setInstallDialog] = useState<'market' | 'skin' | null>(null)
  const detailRef = useRef<HTMLElement | null>(null)

  const selected = skins.find(item => item.id === selectedId) ?? skins[0]
  const shotCount = selected?.screenshots.length ?? 0
  const filtered = useMemo(() => skins.filter(skin => {
    const text = `${skin.name.zh} ${skin.name.en} ${skin.author} ${skin.tags.join(' ')}`.toLowerCase()
    return text.includes(query.trim().toLowerCase())
  }).sort((a, b) => comparePublicCatalogOrder(a, b, sort)), [query, sort])
  const visibleSkins = filtered.slice(0, visibleCount)

  const recommendations = selected === undefined
    ? []
    : skins.filter(item => item.id !== selected.id && item.review?.compatibility === 'verified')
      .sort((a, b) => {
        const aMatch = a.tags.filter(tag => selected.tags.includes(tag)).length
        const bMatch = b.tags.filter(tag => selected.tags.includes(tag)).length
        return bMatch - aMatch || b.starsSnapshot - a.starsSnapshot
      }).slice(0, 4)

  const select = (id: string) => {
    setSelectedId(id)
    setShot(0)
    setDetailOpen(true)
  }

  useEffect(() => { setVisibleCount(24) }, [query, sort])

  useLayoutEffect(() => {
    if (detailRef.current !== null) detailRef.current.scrollTop = 0
  }, [selectedId])

  useEffect(() => {
    const loadMore = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 720) {
        setVisibleCount(current => Math.min(filtered.length, current + 24))
      }
    }
    window.addEventListener('scroll', loadMore, { passive: true })
    return () => window.removeEventListener('scroll', loadMore)
  }, [filtered.length])

  useEffect(() => {
    if (!detailOpen) return
    const handleGalleryKeys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (lightboxOpen) {
          event.preventDefault()
          event.stopPropagation()
          event.stopImmediatePropagation()
          setLightboxOpen(false)
        } else setDetailOpen(false)
        return
      }
      if (!lightboxOpen || shotCount < 2) return
      if (event.key === 'ArrowLeft') setShot(current => (current - 1 + shotCount) % shotCount)
      if (event.key === 'ArrowRight') setShot(current => (current + 1) % shotCount)
    }
    window.addEventListener('keydown', handleGalleryKeys, true)
    return () => window.removeEventListener('keydown', handleGalleryKeys, true)
  }, [detailOpen, lightboxOpen, shotCount])

  useEffect(() => {
    const reduceMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!detailOpen || galleryPaused || lightboxOpen || shotCount < 2 || reduceMotion) return
    const timer = window.setTimeout(() => setShot(current => (current + 1) % shotCount), GALLERY_INTERVAL_MS)
    return () => window.clearTimeout(timer)
  }, [carouselEpoch, detailOpen, galleryPaused, lightboxOpen, selected?.id, shot, shotCount])

  useEffect(() => {
    setGalleryPaused(false)
    setLightboxOpen(false)
    setCarouselEpoch(current => current + 1)
  }, [selected?.id])

  const setCarouselPaused = (paused: boolean) => {
    setGalleryPaused(paused)
    setCarouselEpoch(current => current + 1)
  }

  const moveShot = (direction: -1 | 1) => {
    if (shotCount > 1) setShot(current => (current + direction + shotCount) % shotCount)
  }

  const copyPrompt = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value)
    setCopied(key)
    window.setTimeout(() => setCopied(current => current === key ? null : current), 1800)
  }

  if (selected === undefined) return <main className="empty-page">目录暂时为空</main>

  const verified = selected.review?.compatibility !== 'unverified'
  const manualOnly = selected.review?.installation === 'manual-only'

  return <div className="page-shell" data-detail={detailOpen ? 'open' : 'closed'}>
    <header className="topbar">
      <a className="brand" href={import.meta.env.BASE_URL}>
        <span className="brand-mark">DSH</span>
        <span><strong>皮肤市场</strong><small>社区外观目录</small></span>
      </a>
      <nav className="top-actions" aria-label="平台操作">
        <a className="qr-share" href={MARKET_PUBLIC_URL} target="_blank" rel="noreferrer" aria-label="扫描二维码打开 DSH 皮肤市场">
          <img src={`${import.meta.env.BASE_URL}market-qr.svg`} alt="DSH 皮肤市场二维码" />
          <span><strong>扫码打开</strong><small>分享后也能访问</small></span>
        </a>
        <a className="button outline" href={MARKET_REPOSITORY} target="_blank" rel="noreferrer"><GithubLogo size={17} /> GitHub</a>
        <button className="button outline" onClick={() => { setCopied(null); setInstallDialog('market') }}>安装皮肤市场</button>
      </nav>
    </header>

    <main className="feed-page">
      <header className="feed-header">
        <div><h1>发现皮肤</h1><p>{skins.length} 款社区皮肤，找到适合你的 DSH 外观</p></div>
        <label className="search feed-search"><MagnifyingGlass size={18} /><input value={query} onChange={event => setQuery(event.currentTarget.value)} placeholder="搜索皮肤、作者或标签" /></label>
      </header>
      <section className="feed-content" aria-labelledby="discover-title">
        <div className="feed-section-title"><div><h2 id="discover-title">{query.trim() === '' ? '发现更多' : '搜索结果'}</h2><span>{filtered.length} 个结果</span></div><button onClick={() => setSort(value => value === 'stars' ? 'latest' : 'stars')}>{sort === 'stars' ? 'Stars 优先' : '最近更新'}</button></div>
        {visibleSkins.length > 0 ? <div className="skin-grid">
          {visibleSkins.map(skin => <CatalogCard key={skin.id} skin={skin} onOpen={() => select(skin.id)} onInstall={() => { setSelectedId(skin.id); setShot(0); setCopied(null); setInstallDialog('skin') }} />)}
        </div> : <p className="no-results feed-empty">没有匹配的皮肤</p>}
        {visibleCount < filtered.length && <div className="feed-loading" aria-hidden="true"><span /><span /></div>}
      </section>
    </main>

    {detailOpen && <div className="browser-overlay" role="presentation">
      <button className="browser-mask" aria-hidden="true" tabIndex={-1} onClick={() => setDetailOpen(false)} />
      <section className="browser-panel" role="dialog" aria-modal="true" aria-label="皮肤详情">
        <header className="browser-titlebar"><span><strong>皮肤详情</strong><small>{selected.name.zh}</small></span><button className="button outline" onClick={() => setDetailOpen(false)}><X size={15} /> 关闭详情</button></header>
        <aside className="catalog" aria-label="皮肤目录">
        <div className="catalog-head">
          <button className="mobile-back modal-home-back" onClick={() => setDetailOpen(false)}><ArrowLeft size={16} /> 返回发现</button>
          <div><h2>浏览皮肤</h2><span>{skins.length} 款社区皮肤</span></div>
          <label className="search"><MagnifyingGlass size={18} /><input value={query} onChange={event => setQuery(event.currentTarget.value)} placeholder="搜索皮肤、作者或标签" /></label>
          <div className="catalog-tools"><span>{filtered.length} 个结果</span><button onClick={() => setSort(value => value === 'stars' ? 'latest' : 'stars')}>{sort === 'stars' ? 'Stars 优先' : '最近更新'}</button></div>
        </div>
        <div className="skin-list">
          {filtered.map(skin => <button className="skin-row" data-selected={skin.id === selected.id} aria-current={skin.id === selected.id ? 'true' : undefined} key={skin.id} onClick={() => { setSelectedId(skin.id); setShot(0) }}>
            <span className="skin-row-preview dsh-skin-media-hover"><PreviewMedia key={`${skin.id}:list`} skin={skin} src={skin.listScreenshot ?? skin.screenshots[0]} alt="" kind="list" loading="lazy" /></span>
            <span className="row-copy"><strong title={skin.description}>{skin.description}</strong><small><span title={skin.repo.replace(/^https?:\/\/github\.com\//, '')}>{skin.repo.replace(/^https?:\/\/github\.com\//, '')}</span><span><StarIcon size={12} /> {skin.starsSnapshot}</span></small></span>
            <span className={skin.review?.installation === 'manual-only' ? 'status pending' : 'status'}>{skin.review?.installation === 'manual-only' ? '需手动安装' : '市场可安装'}</span>
          </button>)}
          {filtered.length === 0 && <p className="no-results">没有匹配的皮肤</p>}
        </div>
      </aside>

        <section className="detail" ref={detailRef} aria-label="皮肤详情内容">
        <button className="mobile-back" onClick={() => setDetailOpen(false)}><ArrowLeft size={16} /> 返回发现</button>
        <header className="skin-head">
          <div className="avatar"><PreviewMedia key={`${selected.id}:avatar`} skin={selected} src={selected.listScreenshot ?? selected.screenshots[0]} alt="" kind="avatar" /></div>
          <div className="skin-title"><div><h2>{selected.name.zh}</h2><p>{selected.author}</p></div><p className="description">{selected.description}</p><div className="meta"><span>版本 {selected.install.version}</span><span>DSH {selected.compatibility.dsh}</span><span className={verified ? 'verified' : 'unverified'}>{verified ? '兼容已验证' : '兼容待验证'}</span></div></div>
        </header>

        <div className="detail-actions">
          <button className="button primary" onClick={() => { setCopied(null); setInstallDialog('skin') }}>安装这个皮肤</button>
          <a className="button outline repo-button" href={selected.repo} target="_blank" rel="noreferrer"><GithubLogo size={17} /><span>{selected.repo.replace('https://', '')}</span></a>
          <span className="detail-stars"><StarIcon size={16} /> {selected.starsSnapshot}</span>
        </div>

        {!verified && <p className="notice">兼容性待验证，安装前请先确认。</p>}
        {selected.review?.preview === 'repository-card' && !(selected.marketScreenshots?.length) && <p className="notice">该仓库暂无可识别的皮肤截图，页面使用本地占位卡，不会加载 GitHub 仓库图片。</p>}
        {selected.marketScreenshots?.length && <p className="notice">前 {selected.marketScreenshots.length} 张截图由市场在隔离 DSH 中实机补录，仓库自己的截图会按原顺序接在后面。维护者可向目录仓库提交 PR 删除或替换这些补录图。</p>}

        <div className="gallery-group" data-paused={galleryPaused ? 'true' : 'false'} onMouseEnter={() => setCarouselPaused(true)} onMouseLeave={() => setCarouselPaused(false)} onFocusCapture={() => setCarouselPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setCarouselPaused(false) }}>
          <div className="gallery">
            <button className="gallery-open dsh-skin-media-hover" aria-label={`全屏查看 ${selected.name.zh} 截图 ${shot + 1}`} onClick={() => setLightboxOpen(true)}>
              <PreviewMedia key={`${selected.id}:${selected.screenshots[shot] ?? selected.screenshots[0] ?? 'missing'}:gallery`} skin={selected} src={selected.screenshots[shot] ?? selected.screenshots[0]} alt={`${selected.name.zh} 界面预览`} kind="gallery" />
            </button>
            {shotCount > 1 && <><button className="gallery-nav gallery-prev" aria-label="上一张截图" onClick={() => moveShot(-1)}><ArrowLeft size={18} /></button><button className="gallery-nav gallery-next" aria-label="下一张截图" onClick={() => moveShot(1)}><ArrowLeft size={18} /></button></>}
          </div>
          {selected.screenshots.length > 1 && <div className="thumbs" aria-label="截图选择">{selected.screenshots.map((image, index) => <button className="dsh-skin-media-hover" key={image} data-selected={index === shot} onClick={() => { setShot(index); setCarouselEpoch(current => current + 1) }}><PreviewMedia skin={selected} src={image} alt={`${selected.name.zh} 截图 ${index + 1}`} kind="thumbnail" loading="lazy" />{index === shot && <span className="thumb-progress" key={`${selected.id}:${shot}:${carouselEpoch}`} aria-hidden="true" />}</button>)}</div>}
        </div>

        <div className="information">
          <article><h3>关于此皮肤</h3><p>{selected.description}</p><div className="tags">{selected.tags.map(tag => <span key={tag}>{tag}</span>)}</div>{selected.health && <div className="health"><h3>仓库健康</h3><p>{selected.health.status === 'healthy' ? 'README 展示、兼容声明和一键安装准备均符合要求。' : selected.health.suggestions.join(' ')}</p></div>}</article>
          <dl><div><dt>许可证</dt><dd>{selected.license.code}</dd></div><div><dt>模式</dt><dd>{selected.modes.join(' / ')}</dd></div><div><dt>平台</dt><dd>{selected.compatibility.platform.join(' / ')}</dd></div></dl>
        </div>

        {recommendations.length > 0 && <section className="recommendations"><h3>更多推荐</h3><div>{recommendations.map(skin => <CatalogCard key={skin.id} skin={skin} onOpen={() => { setSelectedId(skin.id); setShot(0) }} onInstall={() => { setSelectedId(skin.id); setShot(0); setCopied(null); setInstallDialog('skin') }} />)}</div></section>}
        </section>
      </section>
    </div>}

    {lightboxOpen && <section className="lightbox" role="dialog" aria-modal="true" aria-label={`${selected.name.zh} 全屏截图查看`}>
      <button className="lightbox-close" aria-label="关闭全屏查看" onClick={() => setLightboxOpen(false)}><X size={20} /></button>
      {selected.screenshots.length > 1 && <button className="lightbox-nav lightbox-prev" aria-label="上一张截图" onClick={() => moveShot(-1)}><ArrowLeft size={26} /></button>}
      <button className="lightbox-stage" aria-label="退出全屏查看" onClick={() => setLightboxOpen(false)}><PreviewMedia key={`${selected.id}:${selected.screenshots[shot] ?? selected.screenshots[0] ?? 'missing'}:lightbox`} skin={selected} src={selected.screenshots[shot] ?? selected.screenshots[0]} alt={`${selected.name.zh} 全屏截图 ${shot + 1}`} kind="gallery" /></button>
      {selected.screenshots.length > 1 && <button className="lightbox-nav lightbox-next" aria-label="下一张截图" onClick={() => moveShot(1)}><ArrowLeft size={26} /></button>}
      {selected.screenshots.length > 1 && <div className="lightbox-thumbs" aria-label="全屏截图选择">{selected.screenshots.map((image, index) => <button className="dsh-skin-media-hover" key={image} data-selected={index === shot} aria-label={`查看截图 ${index + 1}`} onClick={() => setShot(index)}><PreviewMedia skin={selected} src={image} alt="" kind="thumbnail" loading="lazy" /></button>)}</div>}
    </section>}

    {installDialog !== null && <div className="install-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setInstallDialog(null) }}>
      <section className="install-dialog" role="dialog" aria-modal="true" aria-labelledby="install-dialog-title">
        <header><div><h2 id="install-dialog-title">{installDialog === 'market' ? '安装皮肤市场' : `安装 ${selected.name.zh}`}</h2><p>{installDialog === 'skin' && manualOnly ? '该皮肤需要 Agent 协助安装，请复制提示词。' : '任选一种，不用都执行。'}</p></div><button aria-label="关闭" onClick={() => setInstallDialog(null)}><X size={18} /></button></header>
        <div className="install-method-grid" data-single={installDialog === 'market' ? 'true' : 'false'}>
          {installDialog === 'skin' && <InstallGroup title="安装这个皮肤" prompt={skinPrompt(selected.repo, verified, selected.install.target)} command={manualOnly ? undefined : skinCommand(selected.install.target)} copyKey="skin" copied={copied} onCopy={copyPrompt} />}
          <InstallGroup title={installDialog === 'skin' ? '皮肤市场安装' : undefined} prompt={MARKET_PROMPT} command={MARKET_CLI_COMMAND} copyKey="market" copied={copied} onCopy={copyPrompt} />
        </div>
      </section>
    </div>}

    <div className="toast" data-visible={copied !== null}>{copied !== null && <><Check size={16} /> 已复制</>}</div>
  </div>
}

function InstallOption({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return <div className="install-option"><strong>{label}</strong><div className="copy-capsule"><code title={value}>{value}</code><button aria-label={`复制${label}`} title={`复制${label}`} onClick={onCopy}>{copied ? <Check size={16} /> : <Copy size={16} />}</button></div></div>
}

function InstallGroup({ title, prompt, command, copyKey, copied, onCopy }: { title?: string; prompt: string; command?: string; copyKey: string; copied: string | null; onCopy: (key: string, value: string) => Promise<void> }) {
  return <section className="install-group">{title && <h3>{title}</h3>}<InstallOption label="提示词" value={prompt} copied={copied === `${copyKey}:prompt`} onCopy={() => void onCopy(`${copyKey}:prompt`, prompt)} />{command !== undefined && <InstallOption label="命令" value={command} copied={copied === `${copyKey}:command`} onCopy={() => void onCopy(`${copyKey}:command`, command)} />}</section>
}

function Site() {
  const [catalog, setCatalog] = useState<{ skins?: Skin[]; error?: string }>({})

  useEffect(() => {
    const controller = new AbortController()
    const fallbackUrl = `${import.meta.env.BASE_URL}catalog.json`
    void fetchLiveCatalogWithFallback<Skin>(REMOTE_CATALOG_URL, fallbackUrl, (input, init) => fetch(input, { ...init, signal: controller.signal }))
      .then(skins => setCatalog({ skins }))
      .catch(error => {
        if (!controller.signal.aborted) setCatalog({ error: error instanceof Error ? error.message : String(error) })
      })
    return () => controller.abort()
  }, [])

  if (catalog.error !== undefined) {
    return <main className="empty-page">目录加载失败：{catalog.error}。请刷新页面重试。</main>
  }
  if (catalog.skins === undefined) return <main className="empty-page">正在加载最新皮肤目录…</main>
  return <App skins={catalog.skins} />
}

function PreviewMedia({ skin, src, alt, kind, loading }: { skin: Skin; src?: string; alt: string; kind: 'list' | 'avatar' | 'gallery' | 'thumbnail' | 'recommendation' | 'card'; loading?: 'eager' | 'lazy' }) {
  const [failed, setFailed] = useState(false)
  if (!shouldRenderPublicPreview(skin, src, failed)) {
    return <div className="preview-placeholder" data-preview-kind={kind} role="img" aria-label={`${skin.name.zh} 暂无界面截图`}><GithubLogo size={kind === 'list' ? 16 : 24} aria-hidden="true" /><strong>{skin.author}</strong><small>暂无界面截图</small></div>
  }
  return <img src={src} alt={alt} loading={loading} decoding="async" onError={() => setFailed(true)} />
}

createRoot(document.getElementById('root')!).render(<Site />)
