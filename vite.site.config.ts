import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'

export default defineConfig({
  root: 'site',
  base: '/dsh-skin-market/',
  plugins: [react(), {
    name: 'publish-live-catalog',
    closeBundle() { copyFileSync(resolve('data/catalog.json'), resolve('dist-site/catalog.json')) },
  }],
  server: { host: '0.0.0.0', allowedHosts: ['terminal.local'] },
  build: { outDir: '../dist-site', emptyOutDir: true },
})
