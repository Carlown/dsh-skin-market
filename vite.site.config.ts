import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, createReadStream } from 'node:fs'
import { resolve } from 'node:path'

const catalogFile = resolve('data/catalog.json')

export default defineConfig({
  root: 'site',
  base: '/dsh-skin-market/',
  plugins: [react(), {
    name: 'publish-live-catalog',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
        if (pathname !== '/catalog.json' && pathname !== '/dsh-skin-market/catalog.json') return next()
        response.setHeader('content-type', 'application/json; charset=utf-8')
        response.setHeader('cache-control', 'no-store')
        createReadStream(catalogFile).pipe(response)
      })
    },
    closeBundle() { copyFileSync(catalogFile, resolve('dist-site/catalog.json')) },
  }],
  server: { host: '0.0.0.0', allowedHosts: ['terminal.local'] },
  build: { outDir: '../dist-site', emptyOutDir: true },
})
