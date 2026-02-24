import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/health': {
        target: 'http://localhost:5050',
        changeOrigin: true,
        secure: false,
        timeout: 0,
        proxyTimeout: 0,
        rewrite: (path) => path.replace(/^\/health/, '/api/health'),
      },
      '/jobs': {
        target: 'http://localhost:5050',
        changeOrigin: true,
        secure: false,
        timeout: 0,
        proxyTimeout: 0,
        rewrite: (path) => path.replace(/^\/jobs/, '/api/jobs'),
      },
      '/demo': {
        target: 'http://localhost:5050',
        changeOrigin: true,
        secure: false,
        timeout: 0,
        proxyTimeout: 0,
        rewrite: (path) => path.replace(/^\/demo/, '/api/demo'),
      },
      '/metrics': {
        target: 'http://localhost:5050',
        changeOrigin: true,
        secure: false,
        timeout: 0,
        proxyTimeout: 0,
        rewrite: (path) => path.replace(/^\/metrics/, '/api/metrics'),
      },
      '/upload-csv': {
        target: 'http://localhost:5050',
        changeOrigin: true,
        secure: false,
        timeout: 0,
        proxyTimeout: 0,
        rewrite: (path) => path.replace(/^\/upload-csv/, '/api/upload-csv'),
      },
      '/realtime': {
        target: 'http://localhost:5050',
        changeOrigin: true,
        secure: false,
        timeout: 0,
        proxyTimeout: 0,
        rewrite: (path) => path.replace(/^\/realtime/, '/api/realtime'),
      },
      '/financial-summary': {
        target: 'http://localhost:5050',
        changeOrigin: true,
        secure: false,
        timeout: 0,
        proxyTimeout: 0,
        rewrite: (path) => path.replace(/^\/financial-summary/, '/api/financial-summary'),
      },      // Catch-all for any other /api/ paths
      '/api': {
        target: 'http://localhost:5050',
        changeOrigin: true,
        secure: false,
        timeout: 0,
        proxyTimeout: 0,
      },    },
  },
})
