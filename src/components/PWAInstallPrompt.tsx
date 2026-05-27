/**
 * PWAInstallPrompt
 * Shows an "Install App" bottom sheet when the browser fires the
 * `beforeinstallprompt` event (Chrome/Edge on Android + desktop).
 * Also shows a persistent "Add to Home Screen" banner on iOS Safari
 * with instructions (iOS never fires beforeinstallprompt).
 */
import { useState, useEffect } from 'react'
import { Download, X, Smartphone, Share } from 'lucide-react'

// Extend the Window interface for the deferred prompt
declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }
}
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'townshub_pwa_dismissed'
const DISMISSED_EXPIRY_DAYS = 7

function isDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    if (!raw) return false
    const ts = parseInt(raw, 10)
    return Date.now() - ts < DISMISSED_EXPIRY_DAYS * 86_400_000
  } catch {
    return false
  }
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as any).standalone === true)
  )
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosBanner, setShowIosBanner] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    // Don't show if already installed or recently dismissed
    if (isInStandaloneMode() || isDismissedRecently()) return

    // iOS Safari — show manual instructions banner
    if (isIos()) {
      setShowIosBanner(true)
      return
    }

    // Chrome/Edge — listen for the native prompt
    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // If app gets installed, hide the prompt
    const onInstalled = () => setDeferredPrompt(null)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function dismiss() {
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())) } catch {}
    setDeferredPrompt(null)
    setShowIosBanner(false)
  }

  async function handleInstall() {
    if (!deferredPrompt) return
    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
      } else {
        dismiss()
      }
    } finally {
      setInstalling(false)
    }
  }

  // ── iOS banner ──────────────────────────────────────────────────────────────
  if (showIosBanner) {
    return (
      <div
        className="fixed bottom-0 left-0 right-0 z-[9998] px-4 pb-safe-area"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
      >
        <div
          className="rounded-2xl shadow-2xl p-4 flex items-start gap-3 max-w-sm mx-auto"
          style={{ background: '#0F2138', color: 'white' }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: '#D4A843' }}
          >
            <Smartphone size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-white mb-0.5">Install TownsHub</p>
            <p className="text-xs text-white/60 leading-relaxed">
              Tap <Share size={11} className="inline mx-0.5" /> then{' '}
              <strong className="text-white/80">"Add to Home Screen"</strong> for the best experience.
            </p>
          </div>
          <button
            onClick={dismiss}
            className="shrink-0 p-1 text-white/40 hover:text-white/70"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    )
  }

  // ── Chrome/Edge native install prompt ───────────────────────────────────────
  if (!deferredPrompt) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9998] px-4"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
    >
      <div
        className="rounded-2xl shadow-2xl p-4 flex items-center gap-3 max-w-sm mx-auto"
        style={{ background: '#0F2138', color: 'white' }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: '#D4A843' }}
        >
          <Download size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-white">Install TownsHub</p>
          <p className="text-xs text-white/60">Works offline · Faster · No browser bar</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={dismiss}
            className="text-xs text-white/40 hover:text-white/70 px-2 py-1"
          >
            Not now
          </button>
          <button
            onClick={handleInstall}
            disabled={installing}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-opacity disabled:opacity-60"
            style={{ background: '#D4A843' }}
          >
            {installing ? 'Installing…' : 'Install'}
          </button>
        </div>
      </div>
    </div>
  )
}
