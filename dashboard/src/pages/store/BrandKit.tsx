/**
 * "Store info" (هوية المتجر) — the brand-kit form (PBI 10-12), behind
 * `design.simpleMode`. Route: /dashboard/store/brand.
 *
 * Phone first: one fact per card, in the order a new merchant should fill
 * them. Every field saves by itself when the merchant leaves it (or taps a
 * colour / picks a photo) and shows "Saved"; failed saves are kept on the
 * phone and retried (hooks/useStoreProfile.ts). Data: GET/PUT
 * /api/store-profile (services/storeProfile.js).
 */
import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check, Eye, Loader2, RotateCw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { PhoneInput, type PhoneValue } from '../../components/PhoneInput';
import { BilingualField } from '../../components/BilingualField';
import { useAuth } from '../../contexts/auth-context';
import { useSetBreadcrumbs } from '../../contexts/breadcrumb-context';
import { api } from '../../lib/api-client';
import { cleanBilingual, sameBilingual, type BilingualValue } from '../../lib/bilingual';
import { normalizeNational, splitE164, validatePhoneValue } from '../../lib/phone';
import {
  BRAND_SOCIAL_PLATFORMS,
  BRAND_TEXT_MAX_LENGTH,
  STORE_NAME_MAX_LENGTH,
  STORE_NAME_MIN_LENGTH,
  profileErrorMessage,
  socialInputToLink,
  unwrapWhatsappLink,
  type BrandSocialPlatform,
  type BrandTextField,
  type StoreProfile,
  type StoreProfilePatch,
} from '../../lib/storeProfile';
import { usePhoneCountries } from '../../hooks/usePhoneCountries';
import { useProfileAutosave, useStoreProfile, type FieldSaveStatus } from '../../hooks/useStoreProfile';
import {
  ColorField,
  FieldCard,
  FieldError,
  ImageField,
  SaveIndicator,
  fieldInputClass,
} from './brandFields';
import { useFieldValue } from '../../hooks/useFieldValue';
import PhonePreview from './PhonePreview';
import { notifySetupChanged } from '../../contexts/setup-guide-context';
import { toast } from 'sonner';
import { focusFirstInvalid } from '../../lib/focusFirstInvalid';

/** Wait for a burst of saves to settle before reloading the preview. */
const PREVIEW_RELOAD_DELAY_MS = 1200;

interface FieldProps {
  profile: StoreProfile;
  status?: FieldSaveStatus;
  draft?: unknown;
  disabled: boolean;
  save: (patch: StoreProfilePatch, draft?: unknown) => void;
  discard: () => void;
  retry: () => void;
}

export default function BrandKit() {
  const { t } = useTranslation(['storeDesign', 'nav']);
  const { can } = useAuth();
  const canEdit = can('settings.write');
  const { profile, setProfile, loading, loadFailed, reload } = useStoreProfile();

  const [previewKey, setPreviewKey] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const refreshPreview = useCallback(() => {
    clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => setPreviewKey((k) => k + 1), PREVIEW_RELOAD_DELAY_MS);
  }, []);
  React.useEffect(() => () => clearTimeout(previewTimer.current), []);

  const onSaved = useCallback(
    (next: StoreProfile) => {
      setProfile(next);
      refreshPreview();
      notifySetupChanged();
    },
    [setProfile, refreshPreview],
  );
  const { save, retry, discard, flush, statuses, drafts } = useProfileAutosave(onSaved);
  const [savingAll, setSavingAll] = useState(false);

  // Fields save by themselves when the merchant leaves them; the button is
  // for peace of mind: it commits the field being typed in, sends anything
  // still waiting and says so.
  const saveAll = async () => {
    setSavingAll(true);
    (document.activeElement as HTMLElement | null)?.blur?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const ok = await flush();
    setSavingAll(false);
    if (ok) {
      toast.success(t('storeDesign:brand.save_all.done'));
    } else {
      toast.error(t('storeDesign:brand.save_all.failed'));
      focusFirstInvalid();
    }
  };

  useSetBreadcrumbs([
    { label: t('nav:sidebar.storefront.my_store'), href: '/dashboard/store' },
    { label: t('storeDesign:brand.title') },
  ]);

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-12 text-center text-muted-foreground">
        {loading ? (
          <Loader2 className="h-7 w-7 animate-spin" />
        ) : (
          <>
            <p>{t('storeDesign:load_failed')}</p>
            <Button variant="outline" className="h-11" onClick={() => void reload()}>
              <RotateCw className="h-4 w-4 me-2" />
              {t('storeDesign:try_again')}
            </Button>
          </>
        )}
      </div>
    );
  }

  const field = (key: string): FieldProps => ({
    profile,
    status: statuses[key],
    draft: drafts[key],
    disabled: !canEdit,
    save: (patch, draft) => save(key, patch, draft),
    discard: () => discard(key),
    retry: () => retry(key),
  });
  const errorOf = (key: string) =>
    statuses[key]?.state === 'error' ? profileErrorMessage(statuses[key]?.error, t) : null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 pb-24 lg:pb-8">
      <Link
        to="/dashboard/store"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4 ltr:rotate-180" />
        {t('nav:sidebar.storefront.my_store')}
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{t('storeDesign:brand.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('storeDesign:brand.subtitle')}</p>
        </div>
        <Button variant="outline" className="h-11 shrink-0 lg:hidden" onClick={() => setPreviewOpen(true)}>
          <Eye className="h-4 w-4 me-2" />
          {t('storeDesign:preview.button')}
        </Button>
      </div>

      {loadFailed && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          {t('storeDesign:offline_copy')}
        </p>
      )}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8">
        <div className="min-w-0 space-y-4">
          <FieldCard title={t('storeDesign:brand.logo.title')} help={t('storeDesign:brand.logo.help')} status={statuses.logo} onRetry={() => retry('logo')}>
            <ImageField
              kind="logo"
              url={profile.logo}
              disabled={!canEdit}
              upload={async (file) => {
                // POST /upload/logo also stores it as the store logo.
                const res = (await api.upload.logo(file)) as { data?: { url?: string } };
                if (!res?.data?.url) throw new Error(t('storeDesign:errors.generic'));
                return res.data.url;
              }}
              onUploaded={(url) => {
                setProfile((p) => ({ ...p, logo: url }));
                refreshPreview();
              }}
              onRemove={() => save('logo', { logo: null })}
            />
            <FieldError message={errorOf('logo')} />
          </FieldCard>

          <StoreNameField {...field('storeName')} error={errorOf('storeName')} />

          <BrandTextCard fieldKey="tagline" multiline {...field('tagline')} error={errorOf('tagline')} />

          <FieldCard title={t('storeDesign:brand.cover.title')} help={t('storeDesign:brand.cover.help')} status={statuses.cover} onRetry={() => retry('cover')}>
            <ImageField
              kind="cover"
              url={profile.brand.coverImage}
              disabled={!canEdit}
              upload={async (file) => {
                const res = (await api.upload.contentImage(file)) as { data?: { url?: string } };
                if (!res?.data?.url) throw new Error(t('storeDesign:errors.generic'));
                return res.data.url;
              }}
              onUploaded={(url) => save('cover', { brand: { coverImage: url } })}
              onRemove={() => save('cover', { brand: { coverImage: null } })}
            />
            <FieldError message={errorOf('cover')} />
          </FieldCard>

          <FieldCard title={t('storeDesign:brand.color.title')} help={t('storeDesign:brand.color.help')} status={statuses.color} onRetry={() => retry('color')}>
            <ColorField
              value={(drafts.color as string | null | undefined) ?? profile.brand.color}
              disabled={!canEdit}
              onSave={(color) => save('color', { brand: { color } }, color)}
            />
            <FieldError message={errorOf('color')} />
          </FieldCard>

          <WhatsappField {...field('whatsapp')} error={errorOf('whatsapp')} />

          <BrandTextCard fieldKey="city" {...field('city')} error={errorOf('city')} />

          <BrandTextCard fieldKey="hours" multiline {...field('hours')} error={errorOf('hours')} />

          <ContactCard field={field} errorOf={errorOf} />

          <FieldCard title={t('storeDesign:brand.social.title')} help={t('storeDesign:brand.social.help')}>
            <div className="space-y-4">
              {BRAND_SOCIAL_PLATFORMS.map((platform) => (
                <SocialInput
                  key={platform}
                  platform={platform}
                  {...field(`social.${platform}`)}
                  error={errorOf(`social.${platform}`)}
                />
              ))}
            </div>
          </FieldCard>

          {canEdit && (
            <Button className="h-12 w-full text-base" onClick={() => void saveAll()} disabled={savingAll}>
              {savingAll ? <Loader2 className="h-5 w-5 me-2 animate-spin" /> : <Check className="h-5 w-5 me-2" />}
              {t('storeDesign:brand.save_all.button')}
            </Button>
          )}
        </div>

        {/* Desktop: the phone preview stays in view beside the form. */}
        <aside className="hidden lg:sticky lg:top-4 lg:block">
          <p className="mb-3 text-center text-sm font-medium text-muted-foreground">{t('storeDesign:preview.heading')}</p>
          <PhonePreview reloadKey={previewKey} />
        </aside>
      </div>

      {/* Phones: the preview opens on demand (it is a whole web page to load). */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('storeDesign:preview.heading')}</DialogTitle>
          </DialogHeader>
          {previewOpen && <PhonePreview reloadKey={previewKey} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------

function StoreNameField({ profile, status, draft, disabled, save, discard, retry, error }: FieldProps & { error: string | null }) {
  const { t } = useTranslation('storeDesign');
  const [value, setValue] = useFieldValue<string>(profile.storeName || '', draft as string | undefined);
  const [localError, setLocalError] = useState<string | null>(null);

  const commit = () => {
    const name = value.trim();
    if (name === (profile.storeName || '')) return discard();
    if (name.length < STORE_NAME_MIN_LENGTH) {
      setLocalError(t('errors.store_name'));
      return;
    }
    setLocalError(null);
    save({ storeName: name }, value);
  };

  return (
    <FieldCard title={t('brand.name.title')} htmlFor="brand-name" help={t('brand.name.help')} status={status} onRetry={retry}>
      <input
        id="brand-name"
        type="text"
        value={value}
        maxLength={STORE_NAME_MAX_LENGTH}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        aria-invalid={!!(localError || error) || undefined}
        className={fieldInputClass}
      />
      <FieldError message={localError || error} />
    </FieldCard>
  );
}

function BrandTextCard({
  fieldKey,
  multiline,
  profile,
  status,
  draft,
  disabled,
  save,
  discard,
  retry,
  error,
}: FieldProps & { fieldKey: BrandTextField; multiline?: boolean; error: string | null }) {
  const { t, i18n } = useTranslation('storeDesign');
  // Each input shows an example in its own language, whatever the UI language.
  const example = (lang: 'ar' | 'en') => i18n.getFixedT(lang, 'storeDesign')(`brand.${fieldKey}.placeholder`);
  const server = profile.brand[fieldKey] || {};
  const [value, setValue] = useFieldValue<BilingualValue>(server, draft as BilingualValue | undefined);

  const commit = (next: BilingualValue) => {
    const cleaned = cleanBilingual(next);
    if (sameBilingual(cleaned, server)) return discard();
    save({ brand: { [fieldKey]: cleaned } }, next);
  };

  return (
    <Card className="p-4 shadow-sm">
      <BilingualField
        id={`brand-${fieldKey}`}
        label={t(`brand.${fieldKey}.title`)}
        help={t(`brand.${fieldKey}.help`)}
        value={value}
        onChange={setValue}
        onCommit={commit}
        multiline={multiline}
        maxLength={BRAND_TEXT_MAX_LENGTH[fieldKey]}
        placeholder={{ ar: example('ar'), en: example('en') }}
        error={error}
        disabled={disabled}
        labelAction={<SaveIndicator status={status} onRetry={retry} />}
      />
    </Card>
  );
}

function WhatsappField({ profile, status, draft, disabled, save, discard, retry, error }: FieldProps & { error: string | null }) {
  const { t } = useTranslation(['storeDesign', 'auth']);
  const { user } = useAuth();
  const { countries, defaultCountry } = usePhoneCountries();

  const toValue = (e164: string | null | undefined): PhoneValue => {
    const split = splitE164(e164, countries);
    return { country: split.iso2 || defaultCountry, national: e164 ? split.national : '' };
  };
  const saved = profile.brand.whatsapp || null;
  // No WhatsApp yet: suggest the number on the merchant's account (not saved
  // until they confirm it — it may not be their WhatsApp).
  const suggestion = !saved && draft === undefined && user?.phone ? user.phone : null;
  const [value, setValue] = useFieldValue<PhoneValue>(toValue(saved || suggestion), draft as PhoneValue | undefined);
  const [suggested, setSuggested] = useState(!!suggestion);
  const [localError, setLocalError] = useState<string | null>(null);

  const commit = (current: PhoneValue) => {
    if (!current.national.trim()) {
      setLocalError(null);
      if (saved) save({ brand: { whatsapp: null } }, current);
      else discard();
      return;
    }
    const country = countries.find((c) => c.iso2 === current.country) || countries[0];
    const result = normalizeNational(current.national, country);
    if (!result.ok) {
      setLocalError(validatePhoneValue(current, countries, t));
      return;
    }
    setLocalError(null);
    setSuggested(false);
    if (result.e164 === saved) return discard();
    save({ brand: { whatsapp: result.e164, whatsappCountry: current.country } }, current);
  };

  return (
    <FieldCard title={t('brand.whatsapp.title')} help={t('brand.whatsapp.help')} status={status} onRetry={retry}>
      <div
        onBlur={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          if (!suggested) commit(value);
        }}
      >
        <PhoneInput
          id="brand-whatsapp"
          value={value}
          countries={countries}
          disabled={disabled}
          error={localError || error || undefined}
          onChange={(next) => {
            setSuggested(false);
            // A pasted wa.me link becomes the number inside it.
            const unwrapped = unwrapWhatsappLink(next.national);
            if (unwrapped !== next.national) {
              const split = splitE164(unwrapped, countries);
              setValue({ country: split.iso2 || next.country, national: split.national });
            } else {
              setValue(next);
            }
          }}
        />
      </div>
      {suggested && !disabled && (
        <div className="space-y-2 rounded-lg bg-muted/60 p-3">
          <p className="text-sm">{t('brand.whatsapp.suggested')}</p>
          <Button type="button" className="h-11 w-full sm:w-auto" onClick={() => commit(value)}>
            {t('brand.whatsapp.use_this')}
          </Button>
        </div>
      )}
    </FieldCard>
  );
}

function SocialInput({
  platform,
  profile,
  status,
  draft,
  disabled,
  save,
  discard,
  retry,
  error,
}: FieldProps & { platform: BrandSocialPlatform; error: string | null }) {
  const { t } = useTranslation('storeDesign');
  const saved = profile.socialLinks[platform] || '';
  const [value, setValue] = useFieldValue<string>(saved, draft as string | undefined);
  const id = `brand-social-${platform}`;

  const commit = () => {
    const link = socialInputToLink(platform, value);
    if (link === saved || (!link && !saved)) return discard();
    save({ socialLinks: { [platform]: link || null } }, value);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {t(`brand.social.${platform}`)}
        </label>
        <SaveIndicator status={status} onRetry={retry} />
      </div>
      <input
        id={id}
        type="url"
        inputMode="url"
        dir="ltr"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        disabled={disabled}
        placeholder={t(`brand.social.${platform}_placeholder`)}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        aria-invalid={!!error || undefined}
        className={`${fieldInputClass} text-start`}
      />
      <FieldError message={error} />
    </div>
  );
}

// ---------------------------------------------------------------------------

const CONTACT_FIELDS = ['phone', 'email', 'address'] as const;
type ContactField = (typeof CONTACT_FIELDS)[number];

/**
 * The store's public phone, email and address (`settings.contact`), shown on
 * the contact page, in the footer and on the policy pages. A new store has
 * none, so the merchant's own account phone and email are offered with one
 * tap.
 */
function ContactCard({ field, errorOf }: { field: (key: string) => FieldProps; errorOf: (key: string) => string | null }) {
  const { t } = useTranslation('storeDesign');
  return (
    <FieldCard title={t('brand.contact.title')} help={t('brand.contact.help')}>
      <div className="space-y-4">
        {CONTACT_FIELDS.map((key) => (
          <ContactInput key={key} contactKey={key} {...field(`contact.${key}`)} error={errorOf(`contact.${key}`)} />
        ))}
      </div>
    </FieldCard>
  );
}

function ContactInput({
  contactKey,
  profile,
  status,
  draft,
  disabled,
  save,
  discard,
  retry,
  error,
}: FieldProps & { contactKey: ContactField; error: string | null }) {
  const { t } = useTranslation('storeDesign');
  const { user } = useAuth();
  const saved = profile.contact[contactKey] || '';
  const [value, setValue] = useFieldValue<string>(saved, draft as string | undefined);
  const id = `brand-contact-${contactKey}`;
  const suggestion = contactKey === 'phone' ? user?.phone || '' : contactKey === 'email' ? user?.email || '' : '';
  const ltr = contactKey !== 'address';

  const commit = (next = value) => {
    const clean = next.trim();
    if (clean === saved.trim()) return discard();
    save({ contact: { [contactKey]: clean || null } }, next);
  };

  const input = {
    id,
    value,
    disabled,
    dir: ltr ? 'ltr' : undefined,
    placeholder: t(`brand.contact.${contactKey}_placeholder`),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValue(e.target.value),
    onBlur: () => commit(),
    'aria-invalid': error ? true : undefined,
    className: `${fieldInputClass} ${ltr ? 'text-start' : ''}`,
  } as const;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {t(`brand.contact.${contactKey}`)}
        </label>
        <SaveIndicator status={status} onRetry={retry} />
      </div>
      {contactKey === 'address' ? (
        <textarea rows={2} {...input} />
      ) : (
        <input
          type={contactKey === 'email' ? 'email' : 'tel'}
          inputMode={contactKey === 'email' ? 'email' : 'tel'}
          autoCapitalize="none"
          {...input}
        />
      )}
      {!value.trim() && suggestion && !disabled && (
        <button
          type="button"
          className="inline-flex min-h-[40px] items-center text-sm font-medium text-primary hover:underline"
          onClick={() => {
            setValue(suggestion);
            commit(suggestion);
          }}
        >
          {t('brand.contact.use_account', { value: suggestion })}
        </button>
      )}
      <FieldError message={error} />
    </div>
  );
}
