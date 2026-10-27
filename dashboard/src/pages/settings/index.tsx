/**
 * Store settings — everything that lives on the tenant `settings` document
 * and that the merchant edits at the store level (rather than per-product or
 * per-order).
 *
 * /dashboard/settings shows a grid of large boxes, one per section; each opens
 * that section's page (/dashboard/settings?tab=<section>, so older deep links
 * keep working) with a back link to the grid. Sections:
 *   General          — store name + description, branding (logo, favicon)
 *   Regional         — currency, timezone, language
 *   Shipping         — provider type + zone CRUD against /store-settings/shipping/zones
 *   Tax              — flags + per-rate CRUD against /store-settings/tax/rates
 *   Markets          — pricing currency + markets (countries, currency, rate or
 *                      own prices, payment methods) against /store-settings/markets
 *   Notifications    — in-app/sound/browser/email channel preferences
 *   Email templates  — per-status email templates against /store-settings/notifications
 *
 * Granular tab CRUD targets the per-row endpoints so two admins editing
 * different tabs at the same time don't clobber each other. The "General"
 * and "Regional" tabs still go through the bulk PUT because they're a
 * single round-trip — which is also why their state lives here and is
 * passed down to both tab components.
 *
 * Split from the former monolithic pages/Settings.tsx (audit 3.2) —
 * extraction only, no behaviour change.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { Bell as BellIcon } from 'lucide-react';
import { setTenantCurrency, setTenantLocale } from '../../lib/format';
import { useLanguage } from '../../i18n/LanguageProvider';
import { useFeatures } from '../../contexts/features-context';
import type { FeatureKey } from '../../lib/features';
import { Skeleton } from '../../components/ui/skeleton';
import { Store, Globe2, Truck, Receipt, Coins, Mail, ShieldCheck, ScrollText, UserRound, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { errorMessage, type GeneralSettingsState, type ShippingType } from './shared';
import { AccountSettings } from './AccountSettings';
import { GeneralSettings } from './GeneralSettings';
import { RegionalSettings } from './RegionalSettings';
import { ShippingZones } from './ShippingZones';
import { TaxSettings } from './TaxSettings';
import { MarketsSettings } from './MarketsSettings';
import { NotificationSettings } from './NotificationSettings';
import { EmailTemplates } from './EmailTemplates';
import { PoliciesSettings } from './PoliciesSettings';
import { SecurityPanel } from '../security/Security';

type SettingsTab = 'account' | 'general' | 'regional' | 'shipping' | 'tax' | 'markets' | 'notifications' | 'email-templates' | 'policies' | 'security';

const VALID_TABS: SettingsTab[] = ['account', 'general', 'regional', 'shipping', 'tax', 'markets', 'notifications', 'email-templates', 'policies', 'security'];

// Tabs gated behind a platform feature flag. Ungated tabs are always shown.
const TAB_FEATURES: Partial<Record<SettingsTab, FeatureKey>> = {
  regional: 'settings.regional',
  tax: 'settings.tax',
};

export const Settings: React.FC = () => {
  const { t, i18n } = useTranslation(['settings', 'common']);
  const { setLang } = useLanguage();
  // "Back" points to where the reading starts: left in English, right in Arabic.
  const BackIcon = i18n.dir() === 'rtl' ? ChevronRight : ChevronLeft;
  const { hasFeature } = useFeatures();
  const [loading, setLoading] = useState(true);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [searchParams] = useSearchParams();
  // The old Currencies tab is part of Markets now.
  const rawTab = searchParams.get('tab');
  const urlTab = (rawTab === 'currencies' ? 'markets' : rawTab) as SettingsTab | null;
  const tabAllowed = (id: SettingsTab): boolean => {
    // Markets (with currencies) opens with either platform switch.
    if (id === 'markets') return hasFeature('settings.markets') || hasFeature('settings.currencies');
    const f = TAB_FEATURES[id];
    return !f || hasFeature(f);
  };
  // Deep-link validation is feature-aware: an off-flag `?tab=tax` falls back
  // to `general` instead of rendering a hidden tab's panel.
  const validTabs = VALID_TABS.filter(tabAllowed);
  // No (or an unknown / switched-off) section: the grid of sections.
  const tab: SettingsTab | null = urlTab && validTabs.includes(urlTab) ? urlTab : null;
  const [general, setGeneral] = useState<GeneralSettingsState>({
    storeName: '', storeDescription: '', logo: '', favicon: '',
    currency: 'SDG', timezone: 'Africa/Khartoum', language: 'en',
  });
  const [shippingType, setShippingType] = useState<ShippingType>('zone');
  const [flatRate, setFlatRate] = useState(0);

  // loadGeneral is stable (reads from setters only, no captured props/state)
  // — running once on mount is intentional.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadGeneral(); }, []);

  const loadGeneral = async () => {
    try {
      setLoading(true);
      const res = await api.domains.getInfo() as {
        data?: { settings?: Record<string, unknown> & { shipping?: { type?: ShippingType; rate?: number } } };
        responseObject?: { data?: { settings?: Record<string, unknown> & { shipping?: { type?: ShippingType; rate?: number } } } };
      };
      const data = res?.data || res?.responseObject?.data;
      const s = data?.settings;
      if (s) {
        setGeneral({
          storeName: (s.storeName as string) || '',
          storeDescription: (s.storeDescription as string) || '',
          logo: (s.logo as string) || '',
          favicon: (s.favicon as string) || '',
          currency: (s.currency as string) || 'SDG',
          timezone: (s.timezone as string) || 'Africa/Khartoum',
          language: (s.language as string) || 'en',
        });
        setShippingType(s.shipping?.type || 'zone');
        setFlatRate(s.shipping?.rate || 0);
        if (s.currency) setTenantCurrency(s.currency as string);
        if (s.language) setTenantLocale(s.language === 'ar' ? 'ar-SD' : 'en-US');
      }
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.settings_load_failed')));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGeneral = async () => {
    setSavingGeneral(true);
    try {
      await api.settings.update(general);
      setTenantCurrency(general.currency);
      setTenantLocale(general.language === 'ar' ? 'ar-SD' : 'en-US');
      setLang(general.language === 'ar' ? 'ar' : 'en');
      toast.success(t('settings.toast.settings_saved'));
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.settings_save_failed')));
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleSaveShippingMode = async () => {
    try {
      await api.settings.update({
        shipping: { type: shippingType, rate: flatRate },
      });
      toast.success(t('settings.toast.shipping_mode_saved'));
    } catch (err) {
      toast.error(errorMessage(err, t('settings.toast.shipping_mode_save_failed')));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const sections = ([
    { id: 'account', icon: UserRound },
    { id: 'general', icon: Store },
    { id: 'regional', icon: Globe2 },
    { id: 'shipping', icon: Truck },
    { id: 'tax', icon: Receipt },
    { id: 'markets', icon: Coins },
    { id: 'notifications', icon: BellIcon },
    { id: 'email-templates', icon: Mail },
    { id: 'policies', icon: ScrollText },
    { id: 'security', icon: ShieldCheck },
  ] as { id: SettingsTab; icon: React.ElementType }[]).filter(({ id }) => tabAllowed(id));
  const labelOf = (id: SettingsTab) => t(`settings.tab.${id.replace('-', '_')}.label`);
  const descriptionOf = (id: SettingsTab) => t(`settings.hub.${id.replace('-', '_')}`);

  // The grid of sections.
  if (!tab) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('settings.title')}</h1>
          <p className="text-muted-foreground">{t('settings.subtitle')}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {sections.map(({ id, icon: Icon }) => (
            <Link
              key={id}
              to={`/dashboard/settings?tab=${id}`}
              onClick={() => window.scrollTo({ top: 0 })}
              className="group flex min-h-[132px] flex-col gap-3 rounded-xl border bg-card p-4 text-start shadow-sm transition hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="space-y-1">
                <span className="block font-semibold leading-tight">{labelOf(id)}</span>
                <span className="block text-xs leading-relaxed text-muted-foreground sm:text-sm">{descriptionOf(id)}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* A section's page: back to the grid, then its settings. */}
      <div className="space-y-2">
        <Link
          to="/dashboard/settings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <BackIcon className="h-4 w-4" />
          {t('settings.title')}
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{labelOf(tab)}</h1>
        <p className="text-muted-foreground">{descriptionOf(tab)}</p>
      </div>

      <div id="settings-panel">
        {/* Account — the merchant's own profile (name + phone) */}
        {tab === 'account' && (
        <div className="space-y-6">
          <AccountSettings />
        </div>
        )}

        {/* General */}
        {tab === 'general' && (
          <GeneralSettings
            general={general}
            setGeneral={setGeneral}
            saving={savingGeneral}
            onSave={handleSaveGeneral}
          />
        )}

        {/* Regional */}
        {tab === 'regional' && (
          <RegionalSettings
            general={general}
            setGeneral={setGeneral}
            saving={savingGeneral}
            onSave={handleSaveGeneral}
          />
        )}

        {/* Shipping */}
        {tab === 'shipping' && (
          <ShippingZones
            shippingType={shippingType}
            setShippingType={setShippingType}
            flatRate={flatRate}
            setFlatRate={setFlatRate}
            onSaveMode={handleSaveShippingMode}
          />
        )}

        {/* Tax */}
        {tab === 'tax' && (
        <div className="space-y-6">
          <TaxSettings />
        </div>
        )}

        {/* Markets: currencies, exchange rates and prices per country */}
        {tab === 'markets' && (
        <div className="space-y-6">
          <MarketsSettings />
        </div>
        )}

        {/* Notifications (in-app/sound/browser/email prefs) */}
        {tab === 'notifications' && (
        <div className="space-y-6">
          <NotificationSettings />
        </div>
        )}

        {/* Order status email templates */}
        {tab === 'email-templates' && (
        <div className="space-y-6">
          <EmailTemplates />
        </div>
        )}

        {/* Store policies — contact info + privacy/returns/delivery/COD */}
        {tab === 'policies' && (
        <div className="space-y-6">
          <PoliciesSettings />
        </div>
        )}

        {/* Account security — passkeys + email verification */}
        {tab === 'security' && (
        <div className="space-y-6">
          <SecurityPanel />
        </div>
        )}
      </div>
    </div>
  );
};
