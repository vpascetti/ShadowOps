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
      },
      '/jobs': {
        target: 'http://localhost:5050',
        changeOrigin: true,
        secure: false,
        timeout: 0,
        proxyTimeout: 0,
      },
      '/metrics': {
        target: 'http://localhost:5050',
        changeOrigin: true,
        secure: false,
        timeout: 0,
        proxyTimeout: 0,
      },
      '/upload-csv': {
        target: 'http://localhost:5050',
        changeOrigin: true,
        secure: false,
        timeout: 0,
        proxyTimeout: 0,
      },
    },
  },
})
