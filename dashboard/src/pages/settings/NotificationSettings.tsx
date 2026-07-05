/**
 * Notifications tab — per-event in-app/toast/sound/browser/email channel
 * preferences (useNotificationPreferences hook).
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import {
  useNotificationPreferences,
  NOTIFICATION_TYPES,
  type NotificationChannel,
  type NotificationType,
} from '../../hooks/useNotificationPreferences';
import {
  Bell as BellIcon, Package as PackageIcon, CreditCard as CreditCardIcon,
  RotateCcw as RotateCcwIcon, Users as UsersIcon, Globe as GlobeIcon,
  Webhook as WebhookIcon, Box as BoxIcon, AlertTriangle as AlertTriangleIcon,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { Switch } from '../../components/ui/switch';
import { AlertCircle } from 'lucide-react';

const NOTIFICATION_TYPE_ICONS: Record<NotificationType, React.ElementType> = {
  'order.created': PackageIcon,
  'payment.manual_submitted': CreditCardIcon,
  'payment.failed': AlertTriangleIcon,
  'stock.low': BoxIcon,
  'refund.created': RotateCcwIcon,
  'return.requested': RotateCcwIcon,
  'webhook.failed': WebhookIcon,
  'domain.verification_failed': GlobeIcon,
  'staff.invite_accepted': UsersIcon,
};

const NOTIFICATION_TYPE_KEYS: Record<NotificationType, string> = {
  'order.created': 'order_created',
  'payment.manual_submitted': 'payment_manual_submitted',
  'payment.failed': 'payment_failed',
  'stock.low': 'stock_low',
  'refund.created': 'refund_created',
  'return.requested': 'return_requested',
  'webhook.failed': 'webhook_failed',
  'domain.verification_failed': 'domain_verification_failed',
  'staff.invite_accepted': 'staff_invite_accepted',
};

export const NotificationSettings: React.FC = () => {
  const { t } = useTranslation(['settings', 'common']);
  const { prefs, loading, updatePref } = useNotificationPreferences();
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );

  const handleRequestPermission = () => {
    if (typeof Notification === 'undefined') return;
    Notification.requestPermission()
      .then((result) => {
        setPermission(result);
      })
      .catch(() => {
        /* ignore */
      });
  };

  if (loading) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.section.notifications.title')}</CardTitle>
          <CardDescription>
            {t('settings.section.notifications.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {permission === 'default' && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
              <div className="flex items-start gap-2">
                <BellIcon className="mt-0.5 h-4 w-4 text-amber-700 dark:text-amber-300" />
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-100">
                    {t('settings.browser_permission.not_enabled_title')}
                  </p>
                  <p className="text-xs text-amber-800/80 dark:text-amber-200/80">
                    {t('settings.browser_permission.not_enabled_body')}
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={handleRequestPermission}>
                {t('settings.browser_permission.request_button')}
              </Button>
            </div>
          )}
          {permission === 'denied' && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
              <div>
                <p className="font-medium">{t('settings.browser_permission.blocked_title')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('settings.browser_permission.blocked_body')}
                </p>
              </div>
            </div>
          )}

          {/* The channel matrix is intrinsically wide (event + 5 toggles). On
              phones it scrolls horizontally inside its own container instead of
              clipping the right-hand channels off-screen. */}
          <div className="overflow-x-auto rounded-md border">
           <div className="min-w-[560px]">
            <div className="grid grid-cols-[minmax(0,1fr)_72px_72px_72px_72px_72px] items-center gap-2 border-b bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <div>{t('settings.notification_channel.event')}</div>
              <div className="text-center">{t('settings.notification_channel.inbox')}</div>
              <div className="text-center">{t('settings.notification_channel.toast')}</div>
              <div className="text-center">{t('settings.notification_channel.sound')}</div>
              <div className="text-center">{t('settings.notification_channel.browser')}</div>
              <div className="text-center">{t('settings.notification_channel.email')}</div>
            </div>
            {NOTIFICATION_TYPES.map((type) => {
              const Icon = NOTIFICATION_TYPE_ICONS[type];
              const typeKey = NOTIFICATION_TYPE_KEYS[type];
              const row =
                prefs[type] ?? {
                  inbox: true,
                  toast: true,
                  sound: true,
                  browser: true,
                  email: false,
                };
              const browserDisabled = permission !== 'granted';
              const renderChannel = (channel: NotificationChannel, disabled: boolean) => (
                <div className="flex items-center justify-center">
                  <Switch
                    checked={!!row[channel]}
                    disabled={disabled}
                    onCheckedChange={(v) => updatePref(type, channel, v)}
                  />
                </div>
              );
              return (
                <div
                  key={type}
                  className="grid grid-cols-[minmax(0,1fr)_72px_72px_72px_72px_72px] items-center gap-2 border-b px-4 py-3 last:border-b-0"
                >
                  <div className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{t(`settings.notification_type.${typeKey}.label`)}</p>
                      <p className="text-xs text-muted-foreground">{t(`settings.notification_type.${typeKey}.description`)}</p>
                    </div>
                  </div>
                  {renderChannel('inbox', false)}
                  {renderChannel('toast', false)}
                  {renderChannel('sound', false)}
                  {browserDisabled ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>{renderChannel('browser', true)}</div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {permission === 'denied'
                          ? t('settings.browser_permission.tooltip_blocked')
                          : t('settings.browser_permission.tooltip_grant')}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    renderChannel('browser', false)
                  )}
                  {renderChannel('email', false)}
                </div>
              );
            })}
           </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('settings.notification_channel_hint')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
