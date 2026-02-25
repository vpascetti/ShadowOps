import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/theme.css'
import App from './App'

const DEMO_PASSWORD_KEY = 'shadowops_demo_password'

function installDemoAuthFetch() {
  if (typeof window === 'undefined' || !window.fetch) return
  const rawFetch = window.fetch.bind(window)
  window.fetch = (input, init = {}) => {
    const password = sessionStorage.getItem(DEMO_PASSWORD_KEY)
    if (!password) return rawFetch(input, init)

    const url = typeof input === 'string' ? input : input.url
    const isSameOrigin = url.startsWith('/') || url.startsWith(window.location.origin)
    if (!isSameOrigin) return rawFetch(input, init)

    const headers = new Headers(init.headers || {})
    headers.set('x-demo-password', password)
    return rawFetch(input, { ...init, headers })
  }
}

installDemoAuthFetch()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
