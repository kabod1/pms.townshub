import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

const PUBLIC_PATH_PREFIXES = [
  '/auth/', '/survey/', '/menu/', '/guest-chat/', '/pre-checkin/',
]

function detectBrowser(): string {
  const ua = navigator.userAgent
  if (ua.includes('Edg/'))     return 'Edge'
  if (ua.includes('Chrome/'))  return 'Chrome'
  if (ua.includes('Firefox/')) return 'Firefox'
  if (ua.includes('Safari/'))  return 'Safari'
  if (ua.includes('OPR/'))     return 'Opera'
  return 'Other'
}

function detectDevice(): 'desktop' | 'mobile' | 'tablet' {
  const ua = navigator.userAgent
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet'
  if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile'
  return 'desktop'
}

let _sid: string | null = null
function getSessionId(): string {
  if (!_sid) {
    _sid = sessionStorage.getItem('_pv_sid') ?? crypto.randomUUID()
    sessionStorage.setItem('_pv_sid', _sid)
  }
  return _sid
}

export function usePageTracking() {
  const location = useLocation()

  useEffect(() => {
    const isPublic = PUBLIC_PATH_PREFIXES.some((p) => location.pathname.startsWith(p))
    if (isPublic) return

    // Fire-and-forget — POST to /api/track which reads Vercel geolocation headers server-side
    async function track() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token

        await fetch('/api/track', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            path:        location.pathname,
            referrer:    document.referrer || null,
            browser:     detectBrowser(),
            device_type: detectDevice(),
            session_id:  getSessionId(),
          }),
        })
      } catch {
        // Tracking is non-critical — swallow errors silently
      }
    }

    track()
  }, [location.pathname])
}
