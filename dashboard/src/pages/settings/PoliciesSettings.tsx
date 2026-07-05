/**
 * Policies tab — store contact/company info + the four merchant-authored
 * store policies (Privacy, Return & Refund, Delivery, Cash on Delivery).
 *
 * Contact info and each policy's title are plain text; policy bodies are
 * rich-text (HTML) via the shared RichTextEditor. Everything saves through the
 * bulk store-settings PUT; the server sanitises the HTML bodies on write.
 * Surfaced storefront-side in the footer, on dedicated policy pages, and in
 * checkout.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Skeleton } from '../../components/ui/skeleton';
import { RichTextEditor } from '../../components/RichTextEditor';
import { Save, Loader2, ShieldCheck, RotateCcw, Truck, Banknote } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { errorMessage } from './shared';

interface PolicyState {
  title: string;
  body: string;
}
interface PoliciesState {
  privacy: PolicyState;
  returns: PolicyState;
  delivery: PolicyState;
  cod: PolicyState;
}
interface ContactState {
  email: string;
  phone: string;
  address: string;
}

type PolicyKey = keyof PoliciesState;

const EMPTY_POLICY: PolicyState = { title: '', body: '' };
const POLICY_DEFS: { key: PolicyKey; icon: React.ElementType }[] = [
  { key: 'privacy', icon: ShieldCheck },
  { key: 'returns', icon: RotateCcw },
  { key: 'delivery', icon: Truck },
  { key: 'cod', icon: Banknote },
];

export const PoliciesSettings: React.FC = () => {
  const { t } = useTranslation(['settings', 'common']);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contact, setContact] = useState<ContactState>({ email: '', phone: '', address: '' });
  const [policies, setPolicies] = useState<PoliciesState>({
    privacy: { ...EMPTY_POLICY },
    returns: { ...EMPTY_POLICY },
    delivery: { ...EMPTY_POLICY },
    cod: { ...EMPTY_POLICY },
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.domains.getInfo() as {
        data?: { settings?: Record<string, unknown> };
        responseObject?: { data?: { settings?: Record<string, unknown> } };
      };
      const s = (res?.data || res?.responseObject?.data)?.settings || {};
      const c = (s.contact as Partial<ContactState>) || {};
      setContact({ email: c.email || '', phone: c.phone || '', address: c.address || '' });
      const p = (s.policies as Partial<Record<PolicyKey, Partial<PolicyState>>>) || {};
      setPolicies({
        privacy: { title: p.privacy?.title || '', body: p.privacy?.body || '' },
        returns: { title: p.returns?.title || '', body: p.returns?.body || '' },
        delivery: { title: p.delivery?.title || '', body: p.delivery?.body || '' },
        cod: { title: p.cod?.title || '', body: p.cod?.body || '' },
      });
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.settings_load_failed')));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.settings.update({ contact, policies });
      toast.success(t('settings.toast.settings_saved'));
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.settings_save_failed')));
    } finally {
      setSaving(false);
    }
  };

  const setPolicy = (key: PolicyKey, patch: Partial<PolicyState>) =>
    setPolicies((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Contact / company info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.section.contact.title', { defaultValue: 'Contact information' })}</CardTitle>
          <CardDescription>
            {t('settings.section.contact.description', { defaultValue: 'Shown in your storefront footer and on your policy pages.' })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('settings.field.contact.email.label', { defaultValue: 'Store email' })}</Label>
              <Input
                type="email"
                placeholder={t('settings.field.contact.email.placeholder', { defaultValue: 'store@example.com' })}
                value={contact.email}
                onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('settings.field.contact.phone.label', { defaultValue: 'Phone number' })}</Label>
              <Input
                type="tel"
                dir="ltr"
                placeholder={t('settings.field.contact.phone.placeholder', { defaultValue: '+249 …' })}
                value={contact.phone}
                onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('settings.field.contact.address.label', { defaultValue: 'Company address' })}</Label>
            <Textarea
              rows={3}
              placeholder={t('settings.field.contact.address.placeholder', { defaultValue: 'Street, city, country' })}
              value={contact.address}
              onChange={(e) => setContact((c) => ({ ...c, address: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Policies */}
      {POLICY_DEFS.map(({ key, icon: Icon }) => (
        <Card key={key}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              {t(`settings.policy.${key}.label`, { defaultValue: key })}
            </CardTitle>
            <CardDescription>
              {t(`settings.policy.${key}.description`, { defaultValue: '' })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('settings.policy.field.title.label', { defaultValue: 'Title' })}</Label>
              <Input
                placeholder={t(`settings.policy.${key}.title_placeholder`, { defaultValue: t(`settings.policy.${key}.label`, { defaultValue: '' }) })}
                value={policies[key].title}
                onChange={(e) => setPolicy(key, { title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('settings.policy.field.body.label', { defaultValue: 'Content' })}</Label>
              <RichTextEditor
                value={policies[key].body}
                onChange={(html) => setPolicy(key, { body: html })}
                placeholder={t('settings.policy.field.body.placeholder', { defaultValue: 'Write your policy…' })}
              />
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg" className="w-full sm:w-auto">
          {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
          {saving ? t('settings.button.saving') : t('settings.button.save_changes')}
        </Button>
      </div>
    </div>
  );
};

export default PoliciesSettings;
