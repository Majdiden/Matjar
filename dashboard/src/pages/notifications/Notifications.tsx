import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  Box,
  CheckCheck,
  CreditCard,
  Globe,
  Package,
  RotateCcw,
  Trash2,
  Users,
  Webhook,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { useNotificationsContext, type NotificationItem } from '../../contexts/notifications-context';
import { resolveNotificationLink } from '../../hooks/useNotifications';
import { cn } from '../../lib/utils';

function iconForType(type: string): React.ElementType {
  if (type.startsWith('order.')) return Package;
  if (type.startsWith('payment.')) return CreditCard;
  if (type.startsWith('refund.')) return RotateCcw;
  if (type.startsWith('return.')) return RotateCcw;
  if (type.startsWith('stock.')) return Box;
  if (type.startsWith('webhook.')) return Webhook;
  if (type.startsWith('domain.')) return Globe;
  if (type.startsWith('staff.')) return Users;
  return AlertTriangle;
}

function severityClass(sev: string): string {
  switch (sev) {
    case 'success':
      return 'bg-green-500';
    case 'warning':
      return 'bg-amber-500';
    case 'error':
      return 'bg-destructive';
    default:
      return 'bg-blue-500';
  }
}

function severityBadgeVariant(sev: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (sev === 'error') return 'destructive';
  if (sev === 'warning') return 'outline';
  if (sev === 'success') return 'secondary';
  return 'default';
}

function isUnread(n: NotificationItem): boolean {
  const me = localStorage.getItem('userId') || '';
  if (!me) return !(n.readBy && n.readBy.length > 0);
  return !(n.readBy || []).some((r) => r.userId === me);
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return '';
  }
}

export default function Notifications() {
  const navigate = useNavigate();
  const {
    items,
    unreadCount,
    hasMore,
    connectionState,
    markRead,
    markAllRead,
    dismiss,
    loadMore,
    refresh,
  } = useNotificationsContext();
  const [refreshing, setRefreshing] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      await loadMore();
    } finally {
      setLoadingMore(false);
    }
  };

  const handleOpen = (n: NotificationItem) => {
    void markRead(n._id);
    const link = resolveNotificationLink(n);
    if (link) navigate(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            Review store activity, alerts, and follow-up items.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{unreadCount} unread</Badge>
          <Badge variant="outline" className="capitalize">{connectionState}</Badge>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button onClick={() => void markAllRead()} disabled={unreadCount === 0}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark all read
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            All notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          {refreshing && items.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Bell className="mb-3 h-10 w-10 text-muted-foreground" />
              <h3 className="font-semibold">No notifications yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                New order, payment, return, stock, domain, and staff updates will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y rounded-md border">
              {items.map((n) => {
                const Icon = iconForType(n.type);
                const unread = isUnread(n);
                const link = resolveNotificationLink(n);
                return (
                  <div
                    key={n._id}
                    className={cn(
                      'flex gap-3 p-4 transition-colors',
                      unread ? 'bg-accent/40' : 'bg-background',
                    )}
                  >
                    <span
                      className={cn('mt-2 h-2.5 w-2.5 shrink-0 rounded-full', severityClass(n.severity))}
                      aria-hidden
                    />
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => handleOpen(n)}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{n.title}</span>
                        {unread && <Badge className="text-[10px]">Unread</Badge>}
                        <Badge variant={severityBadgeVariant(n.severity)} className="text-[10px] capitalize">
                          {n.severity}
                        </Badge>
                      </div>
                      {n.body && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {n.body}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{relativeTime(n.createdAt)}</span>
                        <span>{n.type}</span>
                        {link && <span>Click to open</span>}
                      </div>
                    </button>
                    <div className="flex shrink-0 items-start gap-1">
                      {unread && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void markRead(n._id)}
                        >
                          Mark read
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => void dismiss(n._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Dismiss notification</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {hasMore && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading...' : 'Load older notifications'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
