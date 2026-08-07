import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@/lib/i18n' // initialise i18next before rendering
import App from './App.tsx'

// skipWaiting()/clientsClaim() in the service worker let a new deploy take
// over in the background, but an already-open tab keeps running whatever JS
// it already loaded until something reloads it. Force that reload the
// instant a new service worker takes control, so a stale tab can never keep
// submitting against old, already-fixed bugs.
if ('serviceWorker' in navigator) {
  let refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return
    refreshing = true
    window.location.reload()
  })
}

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
