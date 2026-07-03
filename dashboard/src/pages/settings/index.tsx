/**
 * Store settings — tabbed configuration page covering everything that lives
 * on the tenant `settings` document and that the merchant edits at the
 * store level (rather than per-product or per-order).
 *
 * Tabs:
 *   General          — store name + description, branding (logo, favicon)
 *   Regional         — currency, timezone, language
 *   Shipping         — provider type + zone CRUD against /store-settings/shipping/zones
 *   Tax              — flags + per-rate CRUD against /store-settings/tax/rates
 *   Currencies       — base + FX rates table against /store-settings/currencies
 *   Markets          — geographic price targeting (checkout presentment)
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
import { useSearchParams } from 'react-router-dom';
import { Bell as BellIcon } from 'lucide-react';
import { setTenantCurrency, setTenantLocale } from '../../lib/format';
import { useLanguage } from '../../i18n/LanguageProvider';
import { Skeleton } from '../../components/ui/skeleton';
import { FilterPills } from '../../components/ui/filter-pills';
import { Store, Globe2, Truck, Receipt, Coins, Mail } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { errorMessage, type GeneralSettingsState, type ShippingType } from './shared';
import { GeneralSettings } from './GeneralSettings';
import { RegionalSettings } from './RegionalSettings';
import { ShippingZones } from './ShippingZones';
import { TaxSettings } from './TaxSettings';
import { CurrencySettings } from './CurrencySettings';
import { MarketsSettings } from './MarketsSettings';
import { NotificationSettings } from './NotificationSettings';
import { EmailTemplates } from './EmailTemplates';

type SettingsTab = 'general' | 'regional' | 'shipping' | 'tax' | 'currencies' | 'markets' | 'notifications' | 'email-templates';

const VALID_TABS: SettingsTab[] = ['general', 'regional', 'shipping', 'tax', 'currencies', 'markets', 'notifications', 'email-templates'];

export const Settings: React.FC = () => {
  const { t } = useTranslation(['settings', 'common']);
  const { setLang } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') as SettingsTab | null;
  const initialTab: SettingsTab = urlTab && VALID_TABS.includes(urlTab) ? urlTab : 'general';
  const [tab, setTabState] = useState<SettingsTab>(initialTab);
  const setTab = (next: SettingsTab) => {
    setTabState(next);
    const sp = new URLSearchParams(searchParams);
    sp.set('tab', next);
    setSearchParams(sp, { replace: true });
  };
  useEffect(() => {
    if (urlTab && VALID_TABS.includes(urlTab) && urlTab !== tab) {
      setTabState(urlTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTab]);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('settings.title')}</h1>
        <p className="text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <FilterPills<SettingsTab>
        value={tab}
        onChange={setTab}
        items={[
          { id: 'general', label: t('settings.tab.general.label'), icon: Store },
          { id: 'regional', label: t('settings.tab.regional.label'), icon: Globe2 },
          { id: 'shipping', label: t('settings.tab.shipping.label'), icon: Truck },
          { id: 'tax', label: t('settings.tab.tax.label'), icon: Receipt },
          { id: 'currencies', label: t('settings.tab.currencies.label'), icon: Coins },
          { id: 'markets', label: t('settings.tab.markets.label'), icon: Globe2 },
          { id: 'notifications', label: t('settings.tab.notifications.label'), icon: BellIcon },
          { id: 'email-templates', label: t('settings.tab.email_templates.label'), icon: Mail },
        ]}
      />

      <div className="mt-6">
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

        {/* Currencies */}
        {tab === 'currencies' && (
        <div className="space-y-6">
          <CurrencySettings />
        </div>
        )}

        {/* Markets (geographic price targeting — source of truth for checkout presentment) */}
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
      </div>
    </div>
  );
};
