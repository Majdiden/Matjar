/**
 * "Contact page" screen (PBI 10-10) at /dashboard/store/contact.
 *
 * Nothing to write here: the storefront builds the contact page from the
 * store info (brand kit, contact details, social pages) whenever the switch
 * is on. The screen shows exactly what customers will see and links to the
 * store-info form to change it.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ExternalLink, MessageCircle, Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { useStorefrontHost } from '../../hooks/useStorefrontHost';
import { api, type AnswerText, type StoreContactState } from '../../lib/api-client';
import { StoreScreen } from './StoreScreen';
import { STORE_BRAND_PATH } from './answers';

/** Social platforms in display order; brand names read the same in every language. */
const SOCIAL_NAMES: Record<string, string> = {
  facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', telegram: 'Telegram', x: 'X',
};

/** WhatsApp's own green, as on the storefront button. */
const WHATSAPP_GREEN = '#25D366';

export const StoreContact: React.FC = () => {
  const { t, i18n } = useTranslation(['storePages']);
  const host = useStorefrontHost();
  const [state, setState] = useState<StoreContactState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    api.storePages.getContact()
      .then((res) => { if (alive) setState(res.data); })
      .catch(() => toast.error(t('storePages:common.error_load')))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  const toggle = async (enabled: boolean) => {
    setSaving(true);
    try {
      const res = await api.storePages.setContact(enabled);
      setState(res.data);
      toast.success(enabled ? t('storePages:contact.turned_on') : t('storePages:contact.turned_off'));
    } catch {
      toast.error(t('storePages:common.error_save'));
    } finally {
      setSaving(false);
    }
  };

  const pick = (text: AnswerText | null) =>
    (i18n.language.startsWith('en') ? text?.en || text?.ar : text?.ar || text?.en) || null;

  const p = state?.preview;
  const rows: Array<{ key: string; label: string; value: string | null; ltr?: boolean }> = p
    ? [
        { key: 'phone', label: t('storePages:contact.phone'), value: p.phone, ltr: true },
        { key: 'email', label: t('storePages:contact.email'), value: p.email, ltr: true },
        { key: 'address', label: t('storePages:contact.address'), value: p.address },
        { key: 'city', label: t('storePages:contact.city'), value: pick(p.city) },
        { key: 'hours', label: t('storePages:contact.hours'), value: pick(p.hours) },
      ]
    : [];
  const socials = Object.keys(SOCIAL_NAMES).filter((k) => p?.socialLinks?.[k]);

  return (
    <StoreScreen title={t('storePages:contact.title')} intro={t('storePages:contact.intro')} loading={loading}>
      <Card>
        <CardContent className="flex items-start justify-between gap-4 pt-6">
          <div className="space-y-1">
            <Label htmlFor="auto-contact" className="text-base font-medium">{t('storePages:contact.toggle_label')}</Label>
            <p className="text-sm text-muted-foreground">{t('storePages:contact.toggle_hint')}</p>
          </div>
          <Switch
            id="auto-contact"
            checked={Boolean(state?.enabled)}
            disabled={saving || !state}
            onCheckedChange={toggle}
          />
        </CardContent>
      </Card>

      {p && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('storePages:contact.preview_title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {p.whatsapp ? (
              <div
                className="flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-white font-semibold"
                style={{ backgroundColor: WHATSAPP_GREEN }}
              >
                <MessageCircle className="h-5 w-5" />
                <span>{t('storePages:contact.whatsapp_button')}</span>
                <span dir="ltr" className="font-normal opacity-90">{p.whatsapp}</span>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                {t('storePages:contact.no_whatsapp')}
              </p>
            )}

            <dl className="divide-y rounded-lg border">
              {rows.map((row) => (
                <div key={row.key} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:gap-4">
                  <dt className="text-sm text-muted-foreground sm:w-32 shrink-0">{row.label}</dt>
                  <dd className={row.value ? 'font-medium break-words min-w-0' : 'text-sm text-muted-foreground italic'}>
                    {row.value ? <span dir={row.ltr ? 'ltr' : undefined} className="whitespace-pre-line">{row.value}</span> : t('storePages:contact.not_added')}
                  </dd>
                </div>
              ))}
              <div className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:gap-4">
                <dt className="text-sm text-muted-foreground sm:w-32 shrink-0">{t('storePages:contact.social')}</dt>
                <dd className={socials.length ? 'font-medium' : 'text-sm text-muted-foreground italic'}>
                  {socials.length ? socials.map((k) => SOCIAL_NAMES[k]).join(' · ') : t('storePages:contact.not_added')}
                </dd>
              </div>
            </dl>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button asChild variant="outline" className="flex-1">
                <Link to={STORE_BRAND_PATH}>
                  <Pencil className="h-4 w-4 me-1" />
                  {t('storePages:contact.edit_info')}
                </Link>
              </Button>
              {host && state?.enabled && (
                <Button asChild variant="ghost" className="flex-1">
                  <a href={`https://${host}/contact`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 me-1" />
                    {t('storePages:common.view_on_store')}
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </StoreScreen>
  );
};

export default StoreContact;
