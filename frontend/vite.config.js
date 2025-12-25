import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5176,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true
      }
    }
  },
  publicDir: 'public',
  build: {
    outDir: 'dist'
  }
})
