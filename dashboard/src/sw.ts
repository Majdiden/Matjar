/// <reference lib="webworker" />
/**
 * Custom dashboard service worker (vite-plugin-pwa `injectManifest`).
 *
 * Replicates everything the previous `generateSW` config produced so
 * nothing regresses:
 *   - precache the built app shell + hashed assets (`self.__WB_MANIFEST`)
 *   - SPA navigation fallback → /dashboard/index.html (API + printable-doc
 *     routes denied so the shell never hijacks them)
 *   - NetworkFirst runtime cache for GET /api (offline-tolerant data)
 *   - StaleWhileRevalidate runtime cache for /uploads (media)
 *   - clientsClaim; prompt-style update handled via SKIP_WAITING message
 *
 * ...AND adds the reason this file exists: real Web Push background
 * delivery (`push` + `notificationclick`), which `generateSW` cannot host.
 */
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';

// The SW runs in the ServiceWorkerGlobalScope, not a Window. `__WB_MANIFEST`
// is the precache list vite-plugin-pwa injects at build time.
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

const DASHBOARD_SCOPE = '/dashboard';
const FALLBACK_ICON = '/dashboard/pwa-192x192.png';

// ── Precache the app shell + hashed assets ─────────────────────────────
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ── SPA navigation fallback ────────────────────────────────────────────
// Serve the cached index.html for in-app navigations, but never for the
// API or printable-doc/editor routes (they must hit the network / their own
// handlers). Mirrors the old navigateFallback + navigateFallbackDenylist.
const navigationRoute = new NavigationRoute(
  createHandlerBoundToURL('/dashboard/index.html'),
  {
    denylist: [/^\/api/, /\/(invoice|packing-slip|refund-receipt)/],
  },
);
registerRoute(navigationRoute);

// Endpoints the SW must NEVER intercept/cache — they pass straight to the
// network natively (no route registered → no respondWith → default fetch):
//   - /api/notifications/stream(-token): the real-time SSE EventSource. A
//     NetworkFirst wrapper with a 5s timeout kills this long-lived stream,
//     which is exactly why the installed PWA only showed new notifications
//     after a page switch (a fresh poll) instead of in real time.
//   - *.csv exports: streamed downloads that must not be buffered/cached.
const isBypassApi = (pathname: string): boolean =>
  pathname.startsWith('/api/notifications/stream') || pathname.endsWith('/export.csv');

// ── Runtime caching: GET /api → NetworkFirst (excluding streamed endpoints) ─
registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith('/api/') &&
    request.method === 'GET' &&
    !isBypassApi(url.pathname),
  new NetworkFirst({
    cacheName: 'matjar-api',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// ── Runtime caching: /uploads → StaleWhileRevalidate ───────────────────
registerRoute(
  ({ url }) => url.pathname.startsWith('/uploads/'),
  new StaleWhileRevalidate({
    cacheName: 'matjar-uploads',
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// Take control of open clients on activation (matched the old clientsClaim).
clientsClaim();

// ── Prompt-style update flow ───────────────────────────────────────────
// registerType is 'prompt': a new SW must WAIT (so PwaManager can show the
// "new version available — refresh" banner) instead of auto-activating. We
// only skip waiting when the banner's refresh button posts SKIP_WAITING via
// virtual:pwa-register (workbox-window). Do NOT call skipWaiting() on install.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Web Push: show a system notification ───────────────────────────────
interface PushPayload {
  title?: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: { url?: string; type?: string; notificationId?: string };
}

self.addEventListener('push', (event: PushEvent) => {
  let payload: PushPayload = {};
  try {
    payload = event.data ? (event.data.json() as PushPayload) : {};
  } catch {
    // Non-JSON payload — fall back to the raw text as the body.
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Matjar';
  const url = payload.data?.url || DASHBOARD_SCOPE;
  const options: NotificationOptions = {
    body: payload.body || '',
    icon: payload.icon || FALLBACK_ICON,
    badge: payload.badge || FALLBACK_ICON,
    tag: payload.tag,
    data: { ...payload.data, url },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Web Push: focus/open the dashboard on click ────────────────────────
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const data = (event.notification.data || {}) as { url?: string };
  const targetUrl = data.url || DASHBOARD_SCOPE;

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Prefer focusing an already-open dashboard tab and navigating it.
      for (const client of allClients) {
        if (client.url.includes(DASHBOARD_SCOPE)) {
          await client.focus();
          if ('navigate' in client && typeof client.navigate === 'function') {
            try {
              await client.navigate(targetUrl);
            } catch {
              /* navigation can reject on cross-origin; focus is enough */
            }
          }
          return;
        }
      }

      // Otherwise open a fresh window at the deep link.
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
