import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api-client';

export type NotificationChannel = 'inbox' | 'toast' | 'sound' | 'browser' | 'email';

export const NOTIFICATION_TYPES = [
  'order.created',
  'payment.manual_submitted',
  'payment.failed',
  'stock.low',
  'refund.created',
  'return.requested',
  'webhook.failed',
  'domain.verification_failed',
  'staff.invite_accepted',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationTypePrefs = Record<NotificationChannel, boolean>;
export type NotificationPreferences = Record<string, NotificationTypePrefs>;

const DEFAULT_PREFS_FOR_TYPE: NotificationTypePrefs = {
  inbox: true,
  toast: true,
  sound: true,
  browser: true,
  // Email defaults to OFF — opt-in per type. Backend matches this default
  // (see services/notification.js#shouldEmailUser) so existing users
  // don't start receiving mail without explicitly turning the channel on.
  email: false,
};

export { DEFAULT_PREFS_FOR_TYPE };

function buildDefaults(): NotificationPreferences {
  const out: NotificationPreferences = {};
  for (const t of NOTIFICATION_TYPES) {
    out[t] = { ...DEFAULT_PREFS_FOR_TYPE };
  }
  return out;
}

function merge(incoming: unknown): NotificationPreferences {
  const base = buildDefaults();
  if (!incoming || typeof incoming !== 'object') return base;
  const incomingObj = incoming as Record<string, unknown>;
  for (const t of Object.keys(incomingObj)) {
    const rowRaw = incomingObj[t];
    if (!rowRaw || typeof rowRaw !== 'object') continue;
    const row = rowRaw as Record<string, unknown>;
    // Legacy migration: old shape had `inApp`. Map it to `toast` since the
    // old wording was a toast-style ephemeral popup. Inbox defaults to true.
    const hasLegacyInApp = Object.prototype.hasOwnProperty.call(row, 'inApp');
    const legacyToast = hasLegacyInApp ? row.inApp !== false : undefined;
    base[t] = {
      inbox: row.inbox !== undefined ? row.inbox !== false : true,
      toast:
        row.toast !== undefined
          ? row.toast !== false
          : legacyToast !== undefined
            ? legacyToast
            : true,
      sound: row.sound !== false,
      browser: row.browser !== false,
      // Email is opt-in: only `true` counts as on. Anything else
      // (undefined, null, false) stays off so migrating prefs don't
      // surprise users with new mail.
      email: row.email === true,
    };
  }
  return base;
}

export interface UseNotificationPreferences {
  prefs: NotificationPreferences;
  loading: boolean;
  updatePref: (type: string, channel: NotificationChannel, value: boolean) => void;
  save: () => Promise<void>;
}

export function useNotificationPreferences(): UseNotificationPreferences {
  const [prefs, setPrefs] = useState<NotificationPreferences>(() => buildDefaults());
  const [loading, setLoading] = useState(true);
  const saveTimerRef = useRef<number | null>(null);
  const latestRef = useRef<NotificationPreferences>(prefs);

  useEffect(() => {
    latestRef.current = prefs;
  }, [prefs]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.me.getNotificationPreferences();
        if (cancelled) return;
        const envelope = res as
          | { responseObject?: { preferences?: unknown }; preferences?: unknown }
          | null
          | undefined;
        const raw = envelope?.responseObject?.preferences ?? envelope?.preferences;
        setPrefs(merge(raw));
      } catch {
        /* fallback to defaults */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async () => {
    try {
      await api.me.updateNotificationPreferences(latestRef.current);
    } catch {
      /* swallow — next change will retry */
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void save();
    }, 500);
  }, [save]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  const updatePref = useCallback(
    (type: string, channel: NotificationChannel, value: boolean) => {
      setPrefs((prev) => {
        const row = prev[type] ?? { ...DEFAULT_PREFS_FOR_TYPE };
        const next = { ...prev, [type]: { ...row, [channel]: value } };
        return next;
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  return { prefs, loading, updatePref, save };
}
