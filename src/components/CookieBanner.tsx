import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { X, Cookie } from 'lucide-react'

const STORAGE_KEY = 'townshub_cookie_consent'

export type CookieConsent = 'all' | 'essential' | null

export function getCookieConsent(): CookieConsent {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'all' || v === 'essential') return v
  } catch { /* private browsing */ }
  return null
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (getCookieConsent() === null) setVisible(true)
  }, [])

  function accept(level: 'all' | 'essential') {
    try { localStorage.setItem(STORAGE_KEY, level) } catch { /* ignore */ }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl rounded-xl border border-white/10 bg-navy shadow-2xl">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
          <Cookie size={22} className="hidden shrink-0 text-gold sm:block" />

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">We use cookies</p>
            <p className="mt-0.5 text-xs text-white/60 leading-relaxed">
              We collect anonymous usage data (page views, device type) to improve the platform.
              No advertising cookies. No third-party trackers.{' '}
              <Link to="/privacy" className="underline text-gold hover:text-gold/80">
                Privacy Policy
              </Link>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => accept('essential')}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 transition-colors"
            >
              Essential only
            </button>
            <button
              onClick={() => accept('all')}
              className="rounded-lg bg-gold px-4 py-1.5 text-xs font-semibold text-white hover:bg-gold/90 transition-colors"
            >
              Accept all
            </button>
            <button
              onClick={() => accept('essential')}
              className="rounded-md p-1 text-white/40 hover:text-white transition-colors"
              aria-label="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
