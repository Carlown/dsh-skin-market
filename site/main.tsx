import { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowLeft, Check, Copy, GithubLogo, MagnifyingGlass, X } from '@phosphor-icons/react'
import { StarIcon } from '@primer/octicons-react'
import { fetchLiveCatalog } from './catalog.ts'
import { MARKET_CLI_COMMAND, MARKET_PROMPT, MARKET_PUBLIC_URL, MARKET_REPOSITORY, skinCommand, skinPrompt } from './prompts.ts'
import './site.css'

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

function App({ skins }: { skins: Skin[] }) {
  const [selectedId, setSelectedId] = useState(skins[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'stars' | 'latest'>('stars')
  const [shot, setShot] = useState(0)
  const [detailOpen, setDetailOpen] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [installDialog, setInstallDialog] = useState<'market' | 'skin' | null>(null)

  const selected = skins.find(item => item.id === selectedId) ?? skins[0]
  const filtered = useMemo(() => skins.filter(skin => {
    const text = `${skin.name.zh} ${skin.name.en} ${skin.author} ${skin.tags.join(' ')}`.toLowerCase()
    return text.includes(query.trim().toLowerCase())
  }).sort((a, b) => sort === 'stars' ? b.starsSnapshot - a.starsSnapshot : Date.parse(b.updatedAt) - Date.parse(a.updatedAt)), [query, sort])

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
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const copyPrompt = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value)
    setCopied(key)
    window.setTimeout(() => setCopied(current => current === key ? null : current), 1800)
  }

  if (selected === undefined) return <main className="empty-page">目录暂时为空</main>

  const verified = selected.review?.compatibility !== 'unverified'

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

    <main className="market">
      <aside className="catalog" aria-label="皮肤目录">
        <div className="catalog-head">
          <div><h1>浏览皮肤</h1><span>{skins.length} 款社区皮肤</span></div>
          <label className="search"><MagnifyingGlass size={18} /><input value={query} onChange={event => setQuery(event.currentTarget.value)} placeholder="搜索皮肤、作者或标签" /></label>
          <div className="catalog-tools"><span>{filtered.length} 个结果</span><button onClick={() => setSort(value => value === 'stars' ? 'latest' : 'stars')}>{sort === 'stars' ? 'Stars 优先' : '最近更新'}</button></div>
        </div>
        <div className="skin-list">
          {filtered.map(skin => <button className="skin-row" data-selected={skin.id === selected.id} aria-current={skin.id === selected.id ? 'true' : undefined} key={skin.id} onClick={() => select(skin.id)}>
            <PreviewMedia key={`${skin.id}:list`} skin={skin} src={skin.listScreenshot ?? skin.screenshots[0]} alt="" kind="list" loading="lazy" />
            <span className="row-copy"><strong>{skin.name.zh}</strong><small>{skin.author}<span><StarIcon size={12} /> {skin.starsSnapshot}</span></small></span>
            <span className={skin.review?.installation === 'manual-only' ? 'status pending' : 'status'}>{skin.review?.installation === 'manual-only' ? '需手动安装' : '市场可安装'}</span>
          </button>)}
          {filtered.length === 0 && <p className="no-results">没有匹配的皮肤</p>}
        </div>
      </aside>

      <section className="detail">
        <button className="mobile-back" onClick={() => setDetailOpen(false)}><ArrowLeft size={16} /> 返回列表</button>
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
        {selected.review?.preview === 'repository-card' && <p className="notice">该仓库暂无可识别的皮肤截图，页面使用本地占位卡，不会加载 GitHub 仓库图片。</p>}
        {selected.marketScreenshots?.length && <p className="notice">前 {selected.marketScreenshots.length} 张截图由市场在隔离 DSH 中实机补录，仓库自己的截图会按原顺序接在后面。维护者可向目录仓库提交 PR 删除或替换这些补录图。</p>}

        <div className="gallery">
          <PreviewMedia key={`${selected.id}:${selected.screenshots[shot] ?? selected.screenshots[0] ?? 'missing'}:gallery`} skin={selected} src={selected.screenshots[shot] ?? selected.screenshots[0]} alt={`${selected.name.zh} 界面预览`} kind="gallery" />
        </div>
        {selected.screenshots.length > 1 && <div className="thumbs" aria-label="截图选择">{selected.screenshots.map((image, index) => <button key={image} data-selected={index === shot} onClick={() => setShot(index)}><PreviewMedia skin={selected} src={image} alt={`${selected.name.zh} 截图 ${index + 1}`} kind="thumbnail" loading="lazy" /></button>)}</div>}

        <div className="information">
          <article><h3>关于此皮肤</h3><p>{selected.description}</p><div className="tags">{selected.tags.map(tag => <span key={tag}>{tag}</span>)}</div>{selected.health && <div className="health"><h3>仓库健康</h3><p>{selected.health.status === 'healthy' ? 'README 展示、兼容声明和一键安装准备均符合要求。' : selected.health.suggestions.join(' ')}</p></div>}</article>
          <dl><div><dt>许可证</dt><dd>{selected.license.code}</dd></div><div><dt>模式</dt><dd>{selected.modes.join(' / ')}</dd></div><div><dt>平台</dt><dd>{selected.compatibility.platform.join(' / ')}</dd></div></dl>
        </div>

        {recommendations.length > 0 && <section className="recommendations"><h3>更多推荐</h3><div>{recommendations.map(skin => <button key={skin.id} onClick={() => select(skin.id)}><PreviewMedia skin={skin} src={skin.listScreenshot ?? skin.screenshots[0]} alt="" kind="recommendation" loading="lazy" /><span><strong>{skin.name.zh}</strong><small><StarIcon size={12} /> {skin.starsSnapshot}</small></span></button>)}</div></section>}
      </section>
    </main>

    {installDialog !== null && <div className="install-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setInstallDialog(null) }}>
      <section className="install-dialog" role="dialog" aria-modal="true" aria-labelledby="install-dialog-title">
        <header><div><h2 id="install-dialog-title">{installDialog === 'market' ? '安装皮肤市场' : `安装 ${selected.name.zh}`}</h2><p>任选一种，不用都执行。</p></div><button aria-label="关闭" onClick={() => setInstallDialog(null)}><X size={18} /></button></header>
        <div className="install-method-grid" data-single={installDialog === 'market' ? 'true' : 'false'}>
          {installDialog === 'skin' && <InstallGroup title="安装这个皮肤" prompt={skinPrompt(selected.repo, verified, selected.install.target)} command={skinCommand(selected.install.target)} copyKey="skin" copied={copied} onCopy={copyPrompt} />}
          <InstallGroup title={installDialog === 'skin' ? '安装皮肤市场（推荐）' : undefined} prompt={MARKET_PROMPT} command={MARKET_CLI_COMMAND} copyKey="market" copied={copied} onCopy={copyPrompt} />
        </div>
      </section>
    </div>}

    <div className="toast" data-visible={copied !== null}>{copied !== null && <><Check size={16} /> 已复制</>}</div>
  </div>
}

function InstallOption({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return <div className="install-option"><strong>{label}</strong><div className="copy-capsule"><code title={value}>{value}</code><button aria-label={`复制${label}`} title={`复制${label}`} onClick={onCopy}>{copied ? <Check size={16} /> : <Copy size={16} />}</button></div></div>
}

function InstallGroup({ title, prompt, command, copyKey, copied, onCopy }: { title?: string; prompt: string; command: string; copyKey: string; copied: string | null; onCopy: (key: string, value: string) => Promise<void> }) {
  return <section className="install-group">{title && <h3>{title}</h3>}<InstallOption label="提示词" value={prompt} copied={copied === `${copyKey}:prompt`} onCopy={() => void onCopy(`${copyKey}:prompt`, prompt)} /><InstallOption label="命令" value={command} copied={copied === `${copyKey}:command`} onCopy={() => void onCopy(`${copyKey}:command`, command)} /></section>
}

function Site() {
  const [catalog, setCatalog] = useState<{ skins?: Skin[]; error?: string }>({})

  useEffect(() => {
    const controller = new AbortController()
    const url = `${import.meta.env.BASE_URL}catalog.json`
    void fetchLiveCatalog<Skin>(url, (input, init) => fetch(input, { ...init, signal: controller.signal }))
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

function PreviewMedia({ skin, src, alt, kind, loading }: { skin: Skin; src?: string; alt: string; kind: 'list' | 'avatar' | 'gallery' | 'thumbnail' | 'recommendation'; loading?: 'eager' | 'lazy' }) {
  const [failed, setFailed] = useState(false)
  if (skin.review?.preview === 'repository-card' || src === undefined || failed) {
    return <div className="preview-placeholder" data-preview-kind={kind} role="img" aria-label={`${skin.name.zh} 暂无界面截图`}><GithubLogo size={kind === 'list' ? 16 : 24} aria-hidden="true" /><strong>{skin.author}</strong><small>暂无界面截图</small></div>
  }
  return <img src={src} alt={alt} loading={loading} decoding="async" onError={() => setFailed(true)} />
}

createRoot(document.getElementById('root')!).render(<Site />)
