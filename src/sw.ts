/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

clientsClaim()
self.skipWaiting()
cleanupOutdatedCaches()

// Inject the Vite-generated precache manifest
precacheAndRoute(self.__WB_MANIFEST)

// SPA fallback — serve index.html for all navigation (except /api/)
const handler = createHandlerBoundToURL('/index.html')
const navigationRoute = new NavigationRoute(handler, {
  denylist: [/^\/api\//],
})
registerRoute(navigationRoute)

// ── Push Notifications ─────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'TownsHub PMS', {
      body:  data.body  ?? '',
      icon:  data.icon  ?? '/favicon.png',
      badge: data.badge ?? '/favicon.png',
      data:  data.data  ?? {},
      tag:   data.tag   ?? 'townshub-notification',
    } as NotificationOptions)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data?.url as string) ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
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
