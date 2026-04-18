import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api-client';
import {
  NotificationsContextObj,
  type NotificationItem,
  type NotificationsCtx,
  type ConnectionState,
} from './notifications-context';

// Shape of the paginated list envelope we read from `/notifications`.
// Only the fields the provider actually consumes are typed; the backend
// returns more but we don't care about the rest here.
interface NotificationsListEnvelope {
  items?: NotificationItem[];
  nextCursor?: string | null;
  hasMore?: boolean;
}

interface NotificationsUnreadEnvelope {
  count?: number;
}

// The api client wraps most endpoints in a `{ responseObject: … }`
// envelope but some return the payload directly. This helper unwraps
// whichever shape came back without using `any`.
function unwrap<T>(res: unknown): T | undefined {
  if (res && typeof res === 'object' && 'responseObject' in res) {
    const ro = (res as { responseObject?: T }).responseObject;
    if (ro) return ro;
  }
  return res as T | undefined;
}

function isUnread(n: NotificationItem): boolean {
  const me = localStorage.getItem('userId') || '';
  if (!me) return !(n.readBy && n.readBy.length > 0);
  return !(n.readBy || []).some((r) => r.userId === me);
}

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');

  const refresh = useCallback(async () => {
    try {
      // List response doesn't include unreadCount — fetch both in parallel.
      const [listRes, countRes] = await Promise.all([
        api.notifications.list({ limit: 20 }),
        api.notifications.unreadCount().catch(() => null),
      ]);
      const obj = unwrap<NotificationsListEnvelope>(listRes);
      const newItems: NotificationItem[] = obj?.items ?? [];
      setItems(newItems);
      setCursor(obj?.nextCursor ?? null);
      setHasMore(Boolean(obj?.hasMore));
      const countObj = unwrap<NotificationsUnreadEnvelope>(countRes);
      if (countObj && typeof countObj.count === 'number') {
        setUnreadCount(countObj.count);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore || !cursor) return;
    try {
      const res = await api.notifications.list({ cursor, limit: 20 });
      const obj = unwrap<NotificationsListEnvelope>(res);
      const more: NotificationItem[] = obj?.items ?? [];
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p._id));
        return [...prev, ...more.filter((m) => !seen.has(m._id))];
      });
      setCursor(obj?.nextCursor ?? null);
      setHasMore(Boolean(obj?.hasMore));
    } catch {
      /* ignore */
    }
  }, [cursor, hasMore]);

  const addLocal = useCallback((n: NotificationItem) => {
    setItems((prev) => {
      if (prev.some((p) => p._id === n._id)) return prev;
      return [n, ...prev];
    });
    if (isUnread(n)) setUnreadCount((c) => c + 1);
  }, []);

  const markRead = useCallback(async (id: string) => {
    setItems((prev) =>
      prev.map((p) => {
        if (p._id !== id) return p;
        const me = localStorage.getItem('userId') || '';
        if ((p.readBy || []).some((r) => r.userId === me)) return p;
        return {
          ...p,
          readBy: [...(p.readBy || []), { userId: me, readAt: new Date().toISOString() }],
        };
      }),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await api.notifications.markRead(id);
    } catch {
      /* ignore */
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const before = new Date().toISOString();
    const me = localStorage.getItem('userId') || '';
    setItems((prev) =>
      prev.map((p) => {
        if ((p.readBy || []).some((r) => r.userId === me)) return p;
        return {
          ...p,
          readBy: [...(p.readBy || []), { userId: me, readAt: before }],
        };
      }),
    );
    setUnreadCount(0);
    try {
      await api.notifications.markAllRead(before);
    } catch {
      /* ignore */
    }
  }, []);

  const dismiss = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((p) => p._id !== id));
    try {
      await api.notifications.dismiss(id);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<NotificationsCtx>(
    () => ({
      items,
      unreadCount,
      cursor,
      hasMore,
      connectionState,
      markRead,
      markAllRead,
      dismiss,
      loadMore,
      refresh,
      addLocal,
      setConnectionState,
      setUnreadCount,
    }),
    [items, unreadCount, cursor, hasMore, connectionState, markRead, markAllRead, dismiss, loadMore, refresh, addLocal],
  );

  return <NotificationsContextObj.Provider value={value}>{children}</NotificationsContextObj.Provider>;
};
