import { createContext, useContext } from 'react';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface NotificationItem {
  _id: string;
  type: string;
  severity: NotificationSeverity;
  title: string;
  body?: string;
  resourceType?: string;
  resourceId?: string;
  // Backend stores arbitrary per-type context here (orderId, productId,
  // webhook url, …). Typed as `unknown` so callers validate each field
  // at the use site rather than trusting an implicit any.
  data?: Record<string, unknown>;
  permission?: string;
  recipientUserIds?: string[];
  readBy?: Array<{ userId: string; readAt: string }>;
  dismissedBy?: string[];
  createdAt: string;
}

export type ConnectionState = 'connecting' | 'open' | 'polling' | 'closed';

export interface NotificationsCtx {
  items: NotificationItem[];
  unreadCount: number;
  cursor: string | null;
  hasMore: boolean;
  connectionState: ConnectionState;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  addLocal: (n: NotificationItem) => void;
  setConnectionState: (s: ConnectionState) => void;
  setUnreadCount: (n: number) => void;
}

export const NotificationsContextObj = createContext<NotificationsCtx | null>(null);

export function useNotificationsContext(): NotificationsCtx {
  const ctx = useContext(NotificationsContextObj);
  if (!ctx) throw new Error('useNotificationsContext must be used inside <NotificationsProvider>');
  return ctx;
}
