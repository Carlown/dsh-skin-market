export interface CatalogSkin {
  id: string
  name: { zh: string; en: string }
  author: string
  description: string
  repo: string
  package: string
  tags: string[]
  modes: string[]
  install: { version: string; commit: string }
  compatibility: { dsh: string; platform: string[] }
  screenshots: string[]
  review?: { compatibility: 'verified' | 'unverified'; preview: 'verified' | 'repository-card' }
  license: { code: string; commercialUse: boolean; notice?: string }
  githubStars: number
  starsStale: boolean
  starsUpdatedAt: string
  recommendations: string[]
  releaseUpdatedAt: string
  metadataUpdatedAt: string
  updatedAt: string
}

export interface RuntimeSkin {
  skinId: string
  installation: 'missing' | 'installed' | 'updating' | 'broken'
  activation: 'inactive' | 'active' | 'switching' | 'restart-required'
  installedVersion: string | null
  updateAvailable: boolean
  error?: string
}

export interface Operation {
  id: string
  phase: 'queued' | 'resolving' | 'downloading' | 'validating' | 'activating' | 'done' | 'failed'
  message?: string
}
