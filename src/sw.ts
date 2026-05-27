/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from 'workbox-precaching'
import {
  registerRoute,
  NavigationRoute,
} from 'workbox-routing'
import {
  NetworkFirst,
  CacheFirst,
  StaleWhileRevalidate,
} from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

declare let self: ServiceWorkerGlobalScope

clientsClaim()
self.skipWaiting()
cleanupOutdatedCaches()

// Inject the Vite-generated precache manifest
precacheAndRoute(self.__WB_MANIFEST)

// ── SPA fallback ────────────────────────────────────────────────────────────
// Serve index.html for all navigation requests except /api/ routes
const handler = createHandlerBoundToURL('/index.html')
const navigationRoute = new NavigationRoute(handler, {
  denylist: [/^\/api\//],
})
registerRoute(navigationRoute)

// ── Runtime caching ─────────────────────────────────────────────────────────

// Supabase API & auth calls — Network first, fall back to cache (60s)
// This allows the app to read cached data when offline
registerRoute(
  ({ url }) => url.hostname.includes('supabase.co'),
  new NetworkFirst({
    cacheName: 'supabase-api',
    networkTimeoutSeconds: 10,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 }),
    ],
  })
)

// Vercel API routes — Network only (no caching — mutations shouldn't be cached)
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-routes',
    networkTimeoutSeconds: 15,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 }),
    ],
  })
)

// Fonts from Google Fonts — Cache first (immutable)
registerRoute(
  ({ url }) =>
    url.origin === 'https://fonts.googleapis.com' ||
    url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 365 * 24 * 3600 }),
    ],
  })
)

// Images — Stale while revalidate (serve fast, update in background)
registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: 'images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * 24 * 3600 }),
    ],
  })
)

// ── Push Notifications ──────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'TownsHub PMS', {
      body:    data.body    ?? '',
      icon:    data.icon    ?? '/favicon.png',
      badge:   data.badge   ?? '/favicon.png',
      data:    data.data    ?? {},
      tag:     data.tag     ?? 'townshub-notification',
      actions: data.actions ?? [],
    } as NotificationOptions)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data?.url as string) ?? '/'
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url.startsWith(self.location.origin))
        if (existing && 'focus' in existing) {
          existing.focus()
          ;(existing as WindowClient).navigate(url)
        } else {
          self.clients.openWindow(url)
        }
      })
  )
})

// ── Background sync hint ─────────────────────────────────────────────────────
// When the browser comes back online after being offline, post a message
// to all clients so they can invalidate React Query caches.
self.addEventListener('sync', (event: any) => {
  if (event.tag === 'sync-pending') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'SYNC_ONLINE' }))
      })
    )
  }
})
