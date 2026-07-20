import { createContext, useContext } from 'react';
import type { FeatureFlags, FeatureKey } from '../lib/features';

export interface FeaturesContextType {
  // Effective platform feature flags for the current session. Hydrated
  // synchronously from localStorage so the shell is usable offline.
  features: FeatureFlags;
  // True when a flag is enabled. Falls back to the restrictive default
  // (hidden) for any key the backend hasn't sent.
  hasFeature: (key: FeatureKey) => boolean;
  // True until the first successful /features fetch of this session (a cached
  // copy still counts as loaded — we init from it synchronously).
  isLoading: boolean;
  // Force a re-fetch (e.g. after an operator flips a flag).
  refresh: () => Promise<void>;
}

export const FeaturesContext = createContext<FeaturesContextType | undefined>(undefined);

export function useFeatures(): FeaturesContextType {
  const context = useContext(FeaturesContext);
  if (!context) throw new Error('useFeatures must be used within a FeaturesProvider');
  return context;
}

// Convenience hook for a single flag.
export function useFeature(key: FeatureKey): boolean {
  return useFeatures().hasFeature(key);
}
