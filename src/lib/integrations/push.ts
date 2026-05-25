/**
 * Push Notifications — Web Push (VAPID)
 * Keys are live — set via Vercel env vars.
 */

export const PUSH_CONFIG = {
  vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '',
  serviceWorkerPath: '/sw.js',
} as const

export type PushNotificationTopic =
  | 'housekeeping'
  | 'maintenance'
  | 'new_booking'
  | 'check_in'
  | 'check_out'
  | 'fb_order'
  | 'message'

export interface PushPayload {
  title: string
  body: string
  icon?: string
  data?: Record<string, unknown>
  topic?: PushNotificationTopic
}

// ── Subscription management ───────────────────────────────────────────────

let _currentSub: PushSubscription | null = null

/**
 * Returns the current push subscription for this browser, or null if not subscribed.
 * Uses the already-registered PWA service worker (no registration needed).
 */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  try {
    // Use the PWA service worker that's already registered — don't register a new one
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('SW timeout')), 3000)),
    ])
    return reg.pushManager.getSubscription()
  } catch {
    return null
  }
}

/**
 * Subscribe this browser to push notifications.
 * Registers the service worker, requests permission, stores the subscription server-side.
 * Returns true on success.
 */
export async function subscribeToPush(authToken: string): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[Push] Not supported in this browser')
    return false
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  if (!PUSH_CONFIG.vapidPublicKey) {
    console.error('[Push] VITE_VAPID_PUBLIC_KEY not set')
    return false
  }

  try {
    // Use the PWA service worker that's already registered
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('SW timeout')), 5000)),
    ])

    const existing = await reg.pushManager.getSubscription()
    if (existing) await existing.unsubscribe()

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUSH_CONFIG.vapidPublicKey).buffer as ArrayBuffer,
    })

    _currentSub = sub
    const json = sub.toJSON()

    const res = await fetch('/api/push?action=subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      }),
    })

    return res.ok
  } catch (err) {
    console.error('[Push] Subscribe failed:', err)
    return false
  }
}

/**
 * Unsubscribe this browser from push notifications.
 */
export async function unsubscribeFromPush(authToken: string): Promise<boolean> {
  try {
    const sub = _currentSub ?? (await getCurrentSubscription())
    if (!sub) return true

    await fetch('/api/push?action=subscribe', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    })

    await sub.unsubscribe()
    _currentSub = null
    return true
  } catch (err) {
    console.error('[Push] Unsubscribe failed:', err)
    return false
  }
}

/**
 * Send a push notification via the server API.
 * Called from within the app (e.g. housekeeping alert, new booking).
 */
export async function sendPushNotification(
  recipientUserIds: string[],
  payload: PushPayload,
  authToken: string
): Promise<boolean> {
  try {
    const res = await fetch('/api/push?action=send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ userIds: recipientUserIds, payload }),
    })
    return res.ok
  } catch (err) {
    console.error('[Push] sendPushNotification failed:', err)
    return false
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return new Uint8Array([...raw].map((c) => c.charCodeAt(0)))
}
