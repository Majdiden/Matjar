import React, { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api-client';
import { useAuth } from './auth-context';
import { DEFAULT_FEATURES, type FeatureFlags, type FeatureKey } from '../lib/features';
import { FeaturesContext } from './features-context';

// Effective flags are cached to localStorage and hydrated synchronously, the
// same offline-resilience pattern AuthContext uses for `permissions`. Sudan's
// connectivity is unreliable, and GET /api/features fails offline — without a
// cached copy every RequireFeature gate would spin forever. Missing keys fall
// back to the restrictive DEFAULT_FEATURES (fail-closed → hidden).
function readCachedFeatures(): FeatureFlags | null {
  try {
    const stored = localStorage.getItem('features');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as FeatureFlags;
    }
    return null;
  } catch {
    return null;
  }
}

interface FeaturesResponse {
  data?: { flags?: FeatureFlags };
}

export const FeaturesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated, token } = useAuth();
  // Init synchronously from the cache so gated nav/routes don't flash. A cached
  // copy counts as "loaded"; only a cold session (no cache) shows the spinner.
  const [features, setFeatures] = useState<FeatureFlags>(() => readCachedFeatures() ?? DEFAULT_FEATURES);
  const [isLoading, setIsLoading] = useState<boolean>(() => readCachedFeatures() === null);

  const refresh = useCallback(async () => {
    // Only meaningful with a token — the endpoint is auth-only.
    if (!localStorage.getItem('token')) {
      setIsLoading(false);
      return;
    }
    try {
      const res = (await api.features.get()) as FeaturesResponse;
      const flags = res?.data?.flags;
      if (flags && typeof flags === 'object') {
        setFeatures(flags);
        try {
          localStorage.setItem('features', JSON.stringify(flags));
        } catch {
          /* storage full / disabled — non-fatal */
        }
      }
    } catch {
      /* offline — cached/default flags stay in effect */
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount and whenever the auth token changes (login / store switch).
  // When the session is gone, drop back to restrictive defaults.
  useEffect(() => {
    if (isAuthenticated) {
      void refresh();
    } else {
      setFeatures(DEFAULT_FEATURES);
      setIsLoading(false);
    }
  }, [isAuthenticated, token, refresh]);

  const hasFeature = useCallback(
    (key: FeatureKey) => features[key] === true,
    [features],
  );

  return (
    <FeaturesContext.Provider value={{ features, hasFeature, isLoading, refresh }}>
      {children}
    </FeaturesContext.Provider>
  );
};
