import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  Package,
  CreditCard,
  AlertTriangle,
  RotateCcw,
  Users,
  Globe,
  Webhook,
  Box,
  Settings as SettingsIcon,
  CheckCheck,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useNotificationsContext, type NotificationItem } from '../contexts/notifications-context';
import { resolveNotificationLink } from '../hooks/useNotifications';
import { renderNotificationCopy } from '../lib/notification-copy';
import {
  fireNativeNotification,
  playNotificationChime,
} from '../lib/notification-effects';
import { cn } from '../lib/utils';

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

function severityDotClass(sev: string): string {
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

function isItemUnread(n: NotificationItem): boolean {
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

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation(['nav', 'notifications']);
  const { items, unreadCount, markRead, markAllRead } =
    useNotificationsContext();

  const [open, setOpen] = React.useState(false);
  const latestItems = items.slice(0, 5);

  const handleRowClick = (n: NotificationItem) => {
    void markRead(n._id);
    const link = resolveNotificationLink(n);
    if (link) {
      navigate(link);
      setOpen(false);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <span className="sr-only">{t('nav:notifications.title')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">{t('nav:notifications.title')}</span>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-normal text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void markAllRead();
                }}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {t('nav:notifications.mark_all_read')}
              </button>
            )}
            <button
              type="button"
              className="inline-flex items-center rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              title={t('nav:notifications.settings_title')}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate('/dashboard/settings?tab=notifications');
                setOpen(false);
              }}
            >
              <SettingsIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            {t('nav:notifications.empty')}
          </div>
        ) : (
          <div>
            <div className="max-h-[22rem] overflow-y-auto">
            {latestItems.map((n) => {
              const Icon = iconForType(n.type);
              const unread = isItemUnread(n);
              const { title, body } = renderNotificationCopy(t, n);
              return (
                <button
                  key={n._id}
                  type="button"
                  onClick={() => handleRowClick(n)}
                  className={cn(
                    'block w-full border-b px-3 py-2 text-start text-sm hover:bg-accent last:border-b-0',
                    unread && 'bg-accent/40',
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                        severityDotClass(n.severity),
                      )}
                      aria-hidden
                    />
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {relativeTime(n.createdAt)}
                        </span>
                      </div>
                      {body && (
                        <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {body}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
            </div>
            <DropdownMenuSeparator />
            <div className="px-3 py-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate('/dashboard/notifications');
                  setOpen(false);
                }}
              >
                {t('nav:notifications.view_all')}
              </Button>
            </div>
          </div>
        )}
        {import.meta.env.DEV && (
          <>
            <DropdownMenuSeparator />
            <div className="px-3 py-2">
              <button
                type="button"
                className="w-full rounded border px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  playNotificationChime();
                  toast.success('Test notification', {
                    description: 'In-app, sound, and OS channels firing.',
                    id: 'test-notification',
                  });
                  fireNativeNotification(
                    'Test notification',
                    'In-app, sound, and OS channels firing.',
                  );
                }}
              >
                Test notification (dev)
              </button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
