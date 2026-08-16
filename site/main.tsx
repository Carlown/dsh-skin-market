import { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowLeft, Check, Copy, GithubLogo, MagnifyingGlass } from '@phosphor-icons/react'
import { StarIcon } from '@primer/octicons-react'
import rawCatalog from '../data/catalog.json'
import { MARKET_PROMPT, MARKET_REPOSITORY, skinPrompt } from './prompts.ts'
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
  install: { version: string; commit: string }
  compatibility: { dsh: string; platform: string[] }
  screenshots: string[]
  review?: { compatibility: 'verified' | 'unverified'; preview: 'verified' | 'repository-card' }
  license: { code: string; commercialUse: boolean; notice?: string }
  featuredRank: number
  starsSnapshot: number
  updatedAt: string
}

const skins = rawCatalog.skins as Skin[]
function App() {
  const [selectedId, setSelectedId] = useState(skins[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'stars' | 'latest'>('stars')
  const [shot, setShot] = useState(0)
  const [detailOpen, setDetailOpen] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

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
        <a className="button outline" href={MARKET_REPOSITORY} target="_blank" rel="noreferrer"><GithubLogo size={17} /> GitHub</a>
        <button className="button primary" onClick={() => void copyPrompt('market', MARKET_PROMPT)}>{copied === 'market' ? <Check size={17} /> : <Copy size={17} />}{copied === 'market' ? '已复制' : '安装皮肤市场'}</button>
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
            <img src={skin.screenshots[0]} alt="" loading="lazy" />
            <span className="row-copy"><strong>{skin.name.zh}</strong><small>{skin.author}<span><StarIcon size={12} /> {skin.starsSnapshot}</span></small></span>
            <span className={skin.review?.compatibility === 'unverified' ? 'status pending' : 'status'}>{skin.review?.compatibility === 'unverified' ? '待验证' : '可安装'}</span>
          </button>)}
          {filtered.length === 0 && <p className="no-results">没有匹配的皮肤</p>}
        </div>
      </aside>

      <section className="detail">
        <button className="mobile-back" onClick={() => setDetailOpen(false)}><ArrowLeft size={16} /> 返回列表</button>
        <header className="skin-head">
          <img className="avatar" src={selected.screenshots[0]} alt="" />
          <div className="skin-title"><div><h2>{selected.name.zh}</h2><p>{selected.author}</p></div><p className="description">{selected.description}</p><div className="meta"><span>版本 {selected.install.version}</span><span>DSH {selected.compatibility.dsh}</span><span className={verified ? 'verified' : 'unverified'}>{verified ? '兼容已验证' : '兼容待验证'}</span></div></div>
        </header>

        <div className="detail-actions">
          <button className="button primary" onClick={() => void copyPrompt(selected.id, skinPrompt(selected.repo, verified))}>{copied === selected.id ? <Check size={17} /> : <Copy size={17} />}{copied === selected.id ? '已复制' : '复制安装提示词'}</button>
          <a className="button outline repo-button" href={selected.repo} target="_blank" rel="noreferrer"><GithubLogo size={17} /><span>{selected.repo.replace('https://', '')}</span></a>
          <span className="detail-stars"><StarIcon size={16} /> {selected.starsSnapshot}</span>
        </div>

        {!verified && <p className="notice">维护者尚未声明可验证的 DSH 兼容范围。复制提示词后，请让 Agent 先检查仓库，不要直接安装。</p>}

        <div className="gallery">
          <img src={selected.screenshots[shot] ?? selected.screenshots[0]} alt={`${selected.name.zh} 界面预览`} />
        </div>
        {selected.screenshots.length > 1 && <div className="thumbs" aria-label="截图选择">{selected.screenshots.map((image, index) => <button key={image} data-selected={index === shot} onClick={() => setShot(index)}><img src={image} alt={`${selected.name.zh} 截图 ${index + 1}`} /></button>)}</div>}

        <div className="information">
          <article><h3>关于此皮肤</h3><p>{selected.description}</p><div className="tags">{selected.tags.map(tag => <span key={tag}>{tag}</span>)}</div></article>
          <dl><div><dt>许可证</dt><dd>{selected.license.code}</dd></div><div><dt>模式</dt><dd>{selected.modes.join(' / ')}</dd></div><div><dt>平台</dt><dd>{selected.compatibility.platform.join(' / ')}</dd></div></dl>
        </div>

        {recommendations.length > 0 && <section className="recommendations"><h3>更多推荐</h3><div>{recommendations.map(skin => <button key={skin.id} onClick={() => select(skin.id)}><img src={skin.screenshots[0]} alt="" /><span><strong>{skin.name.zh}</strong><small><StarIcon size={12} /> {skin.starsSnapshot}</small></span></button>)}</div></section>}
      </section>
    </main>

    <div className="toast" data-visible={copied !== null}>{copied !== null && <><Check size={16} /> 提示词已复制，可以发给你的 Agent</>}</div>
  </div>
}

createRoot(document.getElementById('root')!).render(<App />)
