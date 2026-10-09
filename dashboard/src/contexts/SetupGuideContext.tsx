import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { api, type OnboardingState } from '../lib/api-client';
import { useAuth } from './auth-context';
import { useFeatures } from './features-context';
import { readJson, useStoreKey, writeJson } from '../hooks/useStoreProfile';
import { firstSaleProgress, firstSaleSteps, isBrandReady, type FirstSaleSignals } from '../lib/onboarding';
import { storefrontUrl } from '../components/LiveStoreBanner';
import { SETUP_CHANGED_EVENT, SetupGuideContext } from './setup-guide-context';

const CACHE_PREFIX = 'matjar.setupGuide.v1:';
/** Navigating re-reads the signals at most this often. */
const REFRESH_MIN_INTERVAL_MS = 4000;

interface Signals extends FirstSaleSignals {
  storeUrl: string;
}

interface DomainInfo {
  activeDomain?: string;
}

/**
 * Loads the guided-setup signals for the dashboard layout. Cheap on purpose:
 * one product count, the brand kit, the policies state, the onboarding
 * stamps and the store
 * link, re-read when the merchant moves between pages (throttled), returns
 * to the tab, or a screen reports a change (notifySetupChanged). The last
 * result is cached per store so the guide shows at once, also offline.
 */
export const SetupGuideProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { can } = useAuth();
  const { hasFeature } = useFeatures();
  const location = useLocation();
  const storeKey = useStoreKey();
  const cacheKey = CACHE_PREFIX + storeKey;

  const enabled = hasFeature('onboarding.v2') && can('products.write');
  // "Logo and cover" and "delivery and returns" are done on the My Store screens.
  const myStore = hasFeature('design.simpleMode') && can('settings.write');

  const [signals, setSignals] = useState<Signals | null>(() => readJson<Signals>(cacheKey));
  const lastLoadRef = useRef(0);
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (!enabled || loadingRef.current) return;
    loadingRef.current = true;
    lastLoadRef.current = Date.now();
    try {
      const [products, profile, policies, onboarding, domain] = await Promise.allSettled([
        api.products.getAll({ page: 1, limit: 1 }),
        myStore ? api.storeProfile.get() : Promise.resolve(null),
        myStore ? api.storePages.getPolicies() : Promise.resolve(null),
        api.onboarding.get(),
        api.domains.getInfo(),
      ]);
      setSignals((prev) => {
        const productCount =
          products.status === 'fulfilled'
            ? Number((products.value as { responseObject?: { pagination?: { total?: number } } })?.responseObject?.pagination?.total || 0)
            : prev?.productCount ?? 0;
        const brandReady =
          profile.status === 'fulfilled'
            ? isBrandReady((profile.value as { data?: Parameters<typeof isBrandReady>[0] } | null)?.data)
            : prev?.brandReady ?? false;
        const policiesReady =
          policies.status === 'fulfilled'
            ? Boolean((policies.value as { data?: { generatedAt?: string | null } } | null)?.data?.generatedAt)
            : prev?.policiesReady ?? false;
        const sharedAt =
          onboarding.status === 'fulfilled'
            ? ((onboarding.value as { data?: OnboardingState })?.data?.sharedAt ?? null)
            : prev?.sharedAt ?? null;
        const info =
          domain.status === 'fulfilled'
            ? ((domain.value as { data?: DomainInfo; responseObject?: DomainInfo & { data?: DomainInfo } })?.data ||
              (domain.value as { responseObject?: { data?: DomainInfo } })?.responseObject?.data ||
              (domain.value as { responseObject?: DomainInfo })?.responseObject)
            : null;
        const storeUrl = info?.activeDomain ? storefrontUrl(info.activeDomain) : prev?.storeUrl ?? '';
        const next = { productCount, brandReady, policiesReady, sharedAt, storeUrl };
        writeJson(cacheKey, next);
        return next;
      });
    } finally {
      loadingRef.current = false;
    }
  }, [enabled, myStore, cacheKey]);

  // First load, then on navigation (throttled).
  useEffect(() => {
    if (Date.now() - lastLoadRef.current >= REFRESH_MIN_INTERVAL_MS) void load();
  }, [location.pathname, load]);

  // A screen finished something, or the merchant came back to the tab.
  useEffect(() => {
    const now = () => void load();
    const onVisible = () => {
      if (document.visibilityState === 'visible') now();
    };
    window.addEventListener(SETUP_CHANGED_EVENT, now);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(SETUP_CHANGED_EVENT, now);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const recordShared = useCallback(() => {
    setSignals((prev) => (prev ? { ...prev, sharedAt: prev.sharedAt || new Date().toISOString() } : prev));
    api.onboarding
      .record('shared')
      .then(() => load())
      .catch(() => {
        /* stays ticked for this visit; the next share records it */
      });
  }, [load]);

  const value = useMemo(() => {
    const progress = enabled && signals ? firstSaleProgress(signals, firstSaleSteps({ myStore })) : null;
    return {
      active: Boolean(progress && !progress.complete),
      progress,
      storeUrl: signals?.storeUrl ?? '',
      refresh: () => void load(),
      recordShared,
    };
  }, [enabled, myStore, signals, load, recordShared]);

  return <SetupGuideContext.Provider value={value}>{children}</SetupGuideContext.Provider>;
};
