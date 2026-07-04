/**
 * Web Push subscription helpers (frontend).
 *
 * Bridges the browser PushManager and the backend subscription store:
 *   - fetch the VAPID public key
 *   - create (or reuse) a PushSubscription on the dashboard's service worker
 *   - upsert it to /api/notifications/push/subscribe
 *   - best-effort teardown on logout
 *
 * All functions are safe to call in unsupported browsers (they no-op) and
 * never throw — background push is an enhancement layered on top of the
 * existing foreground in-app notifications.
 */
import { api } from './api-client';

/** True when this browser can register push subscriptions at all. */
export function isPushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  );
}

/** Convert a base64url VAPID key to the Uint8Array the PushManager wants. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  // Allocate over a concrete ArrayBuffer (not the generic ArrayBufferLike) so
  // the result satisfies BufferSource for applicationServerKey.
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function unwrap<T>(res: unknown): T | null {
  if (res && typeof res === 'object' && 'responseObject' in res) {
    return (res as { responseObject?: T }).responseObject ?? null;
  }
  return (res as T) ?? null;
}

async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const res = await api.notifications.vapidPublicKey();
    const obj = unwrap<{ publicKey?: string | null; enabled?: boolean }>(res);
    return obj?.publicKey ?? null;
  } catch {
    return null;
  }
}

/** The dashboard SW registration (scope /dashboard/), or null if none. */
async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    // `ready` resolves once the active SW controls the page.
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

/**
 * Ensure the current browser is subscribed to Web Push and the backend
 * knows about it. Idempotent:
 *   - reuses an existing PushSubscription when present,
 *   - always (re-)POSTs it to the backend so a subscription the server
 *     doesn't yet know about gets re-registered.
 *
 * Returns true when a subscription was successfully registered server-side.
 * Requires Notification.permission === 'granted' (caller checks/requests it).
 */
export async function ensurePushSubscription(): Promise<boolean> {
  if (!isPushSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  const registration = await getRegistration();
  if (!registration || !registration.pushManager) return false;

  try {
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const publicKey = await fetchVapidPublicKey();
      if (!publicKey) return false; // backend has no VAPID keys → push disabled
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    // Upsert (idempotent) — covers both a brand-new subscription and the
    // "subscription exists locally but backend forgot it" case.
    await api.notifications.pushSubscribe(
      subscription.toJSON() as PushSubscriptionJSON,
      typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Best-effort teardown on logout: tell the backend to drop the endpoint and
 * unsubscribe the browser so a shared device doesn't keep receiving another
 * user's pushes. Never throws.
 */
export async function teardownPushSubscription(): Promise<void> {
  if (!isPushSupported()) return;
  try {
    const registration = await getRegistration();
    const subscription = await registration?.pushManager?.getSubscription();
    if (!subscription) return;
    const { endpoint } = subscription;
    try {
      await api.notifications.pushUnsubscribe(endpoint);
    } catch {
      /* ignore — still unsubscribe locally below */
    }
    await subscription.unsubscribe().catch(() => undefined);
  } catch {
    /* no-op */
  }
}
