/**
 * Email templates tab — per-order-status email templates + sender identity
 * against /store-settings/notifications.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Skeleton } from '../../components/ui/skeleton';
import { Textarea } from '../../components/ui/textarea';
import { Save, Loader2 } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { errorMessage, FlagRow } from './shared';

interface NotificationTemplate {
  enabled?: boolean;
  subject?: string | null;
  body?: string | null;
}

interface NotificationConfig {
  fromName?: string | null;
  fromEmail?: string | null;
  templates: Record<string, NotificationTemplate>;
}

const NOTIFICATION_STATUSES = [
  'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded',
] as const;

export const EmailTemplates: React.FC = () => {
  const { t } = useTranslation(['settings', 'common']);
  const [config, setConfig] = useState<NotificationConfig>({ fromName: '', fromEmail: '', templates: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeStatus, setActiveStatus] = useState<typeof NOTIFICATION_STATUSES[number]>('Pending');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.settings.getNotifications() as { data?: Partial<NotificationConfig> };
      const data = res.data || { fromName: '', fromEmail: '', templates: {} };
      setConfig({ fromName: data.fromName || '', fromEmail: data.fromEmail || '', templates: data.templates || {} });
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.notifications_load_failed')));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: {
        fromName: string | null;
        fromEmail: string | null;
        templates: Record<string, NotificationTemplate>;
      } = {
        fromName: config.fromName || null,
        fromEmail: config.fromEmail || null,
        templates: config.templates,
      };
      await api.settings.updateNotifications(payload);
      toast.success(t('settings.toast.email_templates_saved'));
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.notifications_save_failed')));
    } finally {
      setSaving(false);
    }
  };

  const updateTemplate = (status: string, patch: Partial<NotificationTemplate>) => {
    setConfig(c => ({
      ...c,
      templates: {
        ...c.templates,
        [status]: { ...(c.templates[status] || { enabled: true }), ...patch },
      },
    }));
  };

  if (loading) return <Skeleton className="h-96" />;

  const tpl = config.templates[activeStatus] || { enabled: true, subject: '', body: '' };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.section.sender.title')}</CardTitle>
          <CardDescription>{t('settings.section.sender.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('settings.field.notifications.from_name.label')}</Label>
              <Input value={config.fromName || ''} onChange={e => setConfig(c => ({ ...c, fromName: e.target.value }))} placeholder={t('settings.field.notifications.from_name.placeholder')} />
            </div>
            <div className="space-y-2">
              <Label>{t('settings.field.notifications.from_email.label')}</Label>
              <Input type="email" value={config.fromEmail || ''} onChange={e => setConfig(c => ({ ...c, fromEmail: e.target.value }))} placeholder={t('settings.field.notifications.from_email.placeholder')} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.section.status_templates.title')}</CardTitle>
          <CardDescription>
            {t('settings.section.status_templates.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {NOTIFICATION_STATUSES.map(s => {
              const isActive = activeStatus === s;
              const isEnabled = config.templates[s]?.enabled !== false;
              return (
                <button
                  key={s}
                  onClick={() => setActiveStatus(s)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium border transition ${
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  {t(`common:status.${s}`, { defaultValue: s })}
                  {!isEnabled && <span className="ms-1 text-[10px] opacity-70">{t('settings.email_template.off_badge')}</span>}
                </button>
              );
            })}
          </div>

          <div className="space-y-4 border rounded-md p-4">
            <FlagRow
              label={t('settings.email_template.send_this_email.label')}
              description={t('settings.email_template.send_this_email.description', { status: activeStatus })}
              checked={tpl.enabled !== false}
              onCheckedChange={v => updateTemplate(activeStatus, { enabled: v })}
            />
            <div className="space-y-2">
              <Label>{t('settings.field.notifications.subject.label')}</Label>
              <Input
                value={tpl.subject || ''}
                onChange={e => updateTemplate(activeStatus, { subject: e.target.value })}
                placeholder={t('settings.email_template.subject_placeholder', { orderNumber: '{{orderNumber}}', status: activeStatus.toLowerCase() })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('settings.field.notifications.body.label')}</Label>
              <Textarea
                rows={10}
                value={tpl.body || ''}
                onChange={e => updateTemplate(activeStatus, { body: e.target.value })}
                placeholder={t('settings.email_template.body_placeholder', { customerName: '{{customerName}}', orderNumber: '{{orderNumber}}', status: activeStatus.toLowerCase() })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Save className="h-4 w-4 me-2" />}
          {t('settings.button.save_notifications')}
        </Button>
      </div>
    </>
  );
};
