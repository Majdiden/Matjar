import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api-client';
import {
  playNotificationChime,
  fireNativeNotification,
} from '../lib/notification-effects';
import { useNotificationsContext, type NotificationItem } from '../contexts/notifications-context';
import { useNotificationLeader } from './useNotificationLeader';
import { useNotificationPreferences } from './useNotificationPreferences';
import { ensurePushSubscription, isPushSupported } from '../lib/web-push';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const BACKOFFS_MS = [1000, 2000, 4000, 8000, 16000, 30000];
const MAX_BACKOFFS_BEFORE_POLLING = 5;
const POLL_INTERVAL_MS = 30000;
const ES_RETRY_WHILE_POLLING_MS = 60000;

/*
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ !!  KEEP IN SYNC  !!                                                │
 * │ Counterpart: utils/notificationLinks.js (resolveNotificationPath)   │
 * │                                                                     │
 * │ The two functions MUST return identical paths for identical inputs. │
 * │ When a link diverges, the "View in dashboard" link in outbound      │
 * │ email (backend) stops matching the in-app toast deep-link (frontend)│
 * │ and users land on a different page than they expected.              │
 * │                                                                     │
 * │ Notification types currently handled (add to BOTH switches):        │
 * │   - order.created                                                   │
 * │   - payment.manual_submitted                                        │
 * │   - payment.failed                                                  │
 * │   - refund.created                                                  │
 * │   - return.requested                                                │
 * │   - stock.low                                                       │
 * │   - webhook.failed                                                  │
 * │   - domain.verification_failed                                      │
 * │   - staff.invite_accepted                                           │
 * │                                                                     │
 * │ Contract is pinned by tests/unit/notification-links.test.js against │
 * │ tests/fixtures/notification-link-cases.json on the backend side.    │
 * │ Frontend is not tested against the fixture (no bundler in node      │
 * │ --test); keep changes in lock-step manually.                        │
 * └─────────────────────────────────────────────────────────────────────┘
 */
export function resolveNotificationLink(n: NotificationItem): string | null {
  switch (n.type) {
    case 'order.created':
      return n.resourceId ? `/dashboard/orders/${n.resourceId}` : '/dashboard/orders';
    case 'payment.manual_submitted':
    case 'payment.failed': {
      const oid = n.data?.orderId || n.resourceId;
      return oid ? `/dashboard/orders/${oid}` : '/dashboard/payments';
    }
    case 'refund.created': {
      const oid = n.data?.orderId || n.resourceId;
      return oid ? `/dashboard/orders/${oid}` : '/dashboard/orders';
    }
    case 'return.requested':
      return n.resourceId ? `/dashboard/returns/${n.resourceId}` : '/dashboard/orders';
    case 'stock.low':
      return n.resourceId ? `/dashboard/products/${n.resourceId}` : '/dashboard/inventory';
    case 'webhook.failed':
      return '/dashboard/settings?tab=webhooks';
    case 'domain.verification_failed':
      return '/dashboard/settings?tab=domains';
    case 'staff.invite_accepted':
      return '/dashboard/staff';
    default:
      return null;
  }
}

function toastForSeverity(severity: string, title: string, body: string | undefined, id: string) {
  const opts = { id, description: body };
  switch (severity) {
    case 'success':
      toast.success(title, opts);
      break;
    case 'warning':
      toast.warning(title, opts);
      break;
    case 'error':
      toast.error(title, opts);
      break;
    default:
      toast(title, opts);
  }
}

/**
 * Core runtime hook. Mount once inside <NotificationsProvider>.
 * Handles SSE (leader) or BroadcastChannel subscription (follower),
 * reconnect/backoff, and fallback to polling.
 */
export function useNotifications() {
  const ctx = useNotificationsContext();
  const { isLeader, broadcast, subscribe } = useNotificationLeader();
  const { prefs } = useNotificationPreferences();

  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  const ctxRef = useRef(ctx);
  useEffect(() => {
    ctxRef.current = ctx;
  }, [ctx]);

  // ── Web Push background delivery ──────────────────────────────────────
  // Once the browser has notification permission, register (or re-register)
  // a push subscription with the backend so the installed PWA receives order
  // alerts even when it is backgrounded/closed — the ADDITION on top of the
  // foreground in-app toasts/SSE below. Uses the Permissions API so a grant
  // that happens AFTER mount (via the permission prompt or Settings page) is
  // also caught. Fully best-effort; unsupported browsers no-op.
  useEffect(() => {
    if (!isPushSupported()) return;
    let cancelled = false;
    let permStatus: PermissionStatus | null = null;

    const trySubscribe = () => {
      if (cancelled) return;
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      void ensurePushSubscription();
    };

    // Attempt immediately in case permission was already granted.
    trySubscribe();

    // Re-attempt when the permission flips to granted later.
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'notifications' as PermissionName })
        .then((status) => {
          if (cancelled) return;
          permStatus = status;
          status.onchange = () => trySubscribe();
        })
        .catch(() => {
          /* Permissions API unavailable — the initial attempt is enough. */
        });
    }

    return () => {
      cancelled = true;
      if (permStatus) permStatus.onchange = null;
    };
  }, []);

  // Follower subscription — fires in-app toast only.
  useEffect(() => {
    if (isLeader) return;
    const unsub = subscribe((msg: unknown) => {
      if (
        !msg ||
        typeof msg !== 'object' ||
        (msg as { type?: unknown }).type !== 'notification' ||
        !(msg as { payload?: unknown }).payload
      ) {
        return;
      }
      const n = (msg as { payload: NotificationItem }).payload;
      const p = prefsRef.current[n.type];
      const inbox = !p || p.inbox !== false;
      const toast_ = !p || p.toast !== false;
      if (inbox) ctxRef.current.addLocal(n);
      if (toast_) {
        toastForSeverity(n.severity, n.title, n.body, `notif-${n._id}`);
      }
    });
    return () => {
      unsub();
    };
  }, [isLeader, subscribe]);

  // Leader SSE + polling fallback
  useEffect(() => {
    if (!isLeader) return;

    let es: EventSource | null = null;
    let reconnectTimer: number | null = null;
    let pollTimer: number | null = null;
    let reopenTimer: number | null = null;
    let failureCount = 0;
    let cancelled = false;

    const clearTimers = () => {
      if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
      if (pollTimer != null) window.clearInterval(pollTimer);
      if (reopenTimer != null) window.clearInterval(reopenTimer);
      reconnectTimer = null;
      pollTimer = null;
      reopenTimer = null;
    };

    const handleIncoming = (n: NotificationItem) => {
      const p = prefsRef.current[n.type];
      const inbox = !p || p.inbox !== false;
      const toast_ = !p || p.toast !== false;
      const sound = !p || p.sound !== false;
      const browser = !p || p.browser !== false;
      if (inbox) ctxRef.current.addLocal(n);
      // Always cross-tab broadcast so followers apply their own pref filters.
      broadcast({ type: 'notification', payload: n });
      if (toast_) toastForSeverity(n.severity, n.title, n.body, `notif-${n._id}`);
      if (sound) playNotificationChime();
      if (browser) {
        fireNativeNotification(n.title, n.body || '', resolveNotificationLink(n) || undefined);
      }
    };

    const openES = async () => {
      if (cancelled) return;
      ctxRef.current.setConnectionState('connecting');
      // Mint a short-lived stream token via authed axios — EventSource
      // can't attach an Authorization header, so we pass it as ?token=.
      let streamToken: string | null = null;
      try {
        const res = await api.notifications.streamToken();
        const obj =
          (res && typeof res === 'object' && 'responseObject' in res
            ? (res as { responseObject?: { token?: string } }).responseObject
            : (res as { token?: string } | null | undefined)) ?? null;
        streamToken = obj?.token ?? null;
      } catch {
        /* fall through — scheduleReconnect handles it */
      }
      if (cancelled) return;
      if (!streamToken) {
        scheduleReconnect();
        return;
      }
      try {
        es = new EventSource(
          `${API_BASE_URL}/notifications/stream?token=${encodeURIComponent(streamToken)}`,
          { withCredentials: true },
        );
      } catch {
        scheduleReconnect();
        return;
      }
      es.onopen = () => {
        failureCount = 0;
        ctxRef.current.setConnectionState('open');
        // If we had started polling, stop it — SSE is back.
        if (pollTimer != null) {
          window.clearInterval(pollTimer);
          pollTimer = null;
        }
        if (reopenTimer != null) {
          window.clearInterval(reopenTimer);
          reopenTimer = null;
        }
      };
      es.onmessage = (e) => {
        try {
          const n: NotificationItem = JSON.parse(e.data);
          handleIncoming(n);
        } catch {
          /* ignore */
        }
      };
      es.onerror = () => {
        if (es) {
          es.close();
          es = null;
        }
        failureCount++;
        if (failureCount >= MAX_BACKOFFS_BEFORE_POLLING) {
          startPolling();
          return;
        }
        scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      const delay = BACKOFFS_MS[Math.min(failureCount, BACKOFFS_MS.length - 1)];
      ctxRef.current.setConnectionState('connecting');
      reconnectTimer = window.setTimeout(() => { void openES(); }, delay);
    };

    const pollOnce = async () => {
      try {
        const [listRes, countRes] = await Promise.all([
          api.notifications.list({ unreadOnly: true, limit: 20 }),
          api.notifications.unreadCount(),
        ]);
        const listObj =
          (listRes && typeof listRes === 'object' && 'responseObject' in listRes
            ? (listRes as { responseObject?: { items?: NotificationItem[] } }).responseObject
            : (listRes as { items?: NotificationItem[] } | null | undefined)) ?? null;
        const newItems: NotificationItem[] = listObj?.items ?? [];
        const existing = new Set(ctxRef.current.items.map((i) => i._id));
        for (const n of newItems) {
          if (!existing.has(n._id)) {
            handleIncoming(n);
          }
        }
        const countObj =
          (countRes && typeof countRes === 'object' && 'responseObject' in countRes
            ? (countRes as { responseObject?: { count?: number } }).responseObject
            : (countRes as { count?: number } | null | undefined)) ?? null;
        if (typeof countObj?.count === 'number') ctxRef.current.setUnreadCount(countObj.count);
      } catch {
        /* ignore */
      }
    };

    const startPolling = () => {
      ctxRef.current.setConnectionState('polling');
      if (pollTimer == null) {
        pollTimer = window.setInterval(pollOnce, POLL_INTERVAL_MS);
      }
      if (reopenTimer == null) {
        reopenTimer = window.setInterval(() => {
          // Try ES again periodically
          failureCount = 0;
          void openES();
        }, ES_RETRY_WHILE_POLLING_MS);
      }
    };

    void openES();

    return () => {
      cancelled = true;
      clearTimers();
      if (es) {
        es.close();
        es = null;
      }
      ctxRef.current.setConnectionState('closed');
    };
  }, [isLeader, broadcast]);
}
