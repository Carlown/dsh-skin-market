import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'site',
  base: '/dsh-skin-market/',
  plugins: [react()],
  server: { host: '0.0.0.0', allowedHosts: ['terminal.local'] },
  build: { outDir: '../dist-site', emptyOutDir: true },
})
