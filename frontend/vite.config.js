import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5176,
    host: '127.0.0.1'
  },
  publicDir: 'public',
  build: {
    outDir: 'dist'
  }
})
