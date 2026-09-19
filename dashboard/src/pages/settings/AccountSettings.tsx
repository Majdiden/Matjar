/**
 * Account tab — the signed-in merchant's own profile (name + contact phone).
 *
 * Email and password have dedicated, verified flows (Security tab), so the
 * email is read-only here with a verified/unverified hint. Loads from
 * GET /auth/me and saves via PUT /auth/me; the phone is validated on the
 * field against the platform's enabled dial codes (Sudan by default).
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api-client';
import { useAuth } from '../../contexts/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { PhoneInput } from '../../components/PhoneInput';
import { usePhoneCountries } from '../../hooks/usePhoneCountries';
import { splitE164, validatePhoneValue, type PhoneValue } from '../../lib/phone';
import { errorMessage } from './shared';

interface MeResponse {
  responseObject?: {
    name?: string | null;
    email?: string | null;
    emailVerified?: boolean;
    phone?: string | null;
    phoneCountry?: string | null;
  };
}

export const AccountSettings: React.FC = () => {
  const { t } = useTranslation(['settings', 'auth', 'common']);
  const { updateUser } = useAuth();
  const { countries, defaultCountry } = usePhoneCountries();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [phone, setPhone] = useState<PhoneValue>({ country: '', national: '' });
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = (await api.auth.me()) as MeResponse;
        const ro = res?.responseObject;
        if (cancelled || !ro) return;
        setName(ro.name || '');
        setEmail(ro.email || '');
        setEmailVerified(!!ro.emailVerified);
        const split = splitE164(ro.phone, countries, ro.phoneCountry);
        setPhone({
          country: split.iso2 || ro.phoneCountry || defaultCountry,
          national: split.national,
        });
      } catch (err) {
        if (!cancelled) toast.error(errorMessage(err, t('settings.toast.profile_load_failed')));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // Countries/default resolve from cache synchronously on first render;
    // a later refresh must not re-run the load and clobber edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once the countries list refreshes, make sure the selected country is a
  // valid option (a stale cache could name a since-disabled country).
  useEffect(() => {
    if (!phone.country && defaultCountry) setPhone(p => ({ ...p, country: defaultCountry }));
  }, [defaultCountry, phone.country]);

  const nameError = nameTouched && name.trim().length < 2
    ? t('auth:auth.field.name.error.too_short')
    : undefined;
  // An empty phone is allowed on the profile (clears the number); anything
  // typed must be valid for the selected country.
  const phoneError = phoneTouched && phone.national.trim()
    ? validatePhoneValue(phone, countries, t) ?? undefined
    : undefined;
  const canSave = !saving && name.trim().length >= 2 &&
    (!phone.national.trim() || !validatePhoneValue(phone, countries, t));

  const onSave = async () => {
    setNameTouched(true);
    setPhoneTouched(true);
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await api.auth.updateMe({
        name: name.trim(),
        phone: phone.national.trim(),
        phoneCountry: phone.country || defaultCountry,
      });
      const ro = res?.responseObject;
      updateUser({
        name: ro?.name ?? name.trim(),
        phone: ro?.phone ?? null,
        phoneCountry: ro?.phoneCountry ?? null,
      });
      if (ro?.phone) {
        const split = splitE164(ro.phone, countries, ro.phoneCountry);
        setPhone({ country: split.iso2 || ro.phoneCountry || phone.country, national: split.national });
      }
      toast.success(t('settings.toast.profile_saved'));
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.profile_save_failed')));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.section.account.title')}</CardTitle>
          <CardDescription>{t('settings.section.account.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="account-name">{t('settings.field.account.name.label')}</Label>
            <Input
              id="account-name"
              autoComplete="name"
              placeholder={t('settings.field.account.name.placeholder')}
              value={name}
              aria-invalid={!!nameError}
              onChange={e => { setNameTouched(true); setName(e.target.value); }}
            />
            {nameError && <p className="text-xs text-destructive">{nameError}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="account-email">{t('settings.field.account.email.label')}</Label>
              {emailVerified === true ? (
                <Badge variant="secondary" className="gap-1 text-[11px]">
                  <CheckCircle2 className="h-3 w-3" /> {t('settings.field.account.email_verified')}
                </Badge>
              ) : emailVerified === false ? (
                <Badge variant="outline" className="text-[11px]">
                  {t('settings.field.account.email_unverified')}
                </Badge>
              ) : null}
            </div>
            <Input id="account-email" type="email" value={email} readOnly dir="ltr" className="bg-muted/50" />
            <p className="text-xs text-muted-foreground">
              <Link to="/dashboard/settings?tab=security" className="underline hover:no-underline">
                {t('settings.field.account.verify_hint')}
              </Link>
            </p>
          </div>

          <PhoneInput
            id="account-phone"
            label={t('settings.field.account.phone.label')}
            value={phone}
            countries={countries}
            onChange={(v) => { setPhoneTouched(true); setPhone(v); }}
            error={phoneError}
            help={t('auth:auth.field.phone.help')}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={!canSave} className="w-full sm:w-auto">
          {saving
            ? <Loader2 className="me-2 h-4 w-4 animate-spin" />
            : <Save className="me-2 h-4 w-4" />}
          {saving ? t('settings.button.saving') : t('settings.button.save_changes')}
        </Button>
      </div>
    </div>
  );
};
