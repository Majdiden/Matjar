import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';

/**
 * Operator-enabled store currencies + shipping/market countries from
 * GET /api/config/public (Platform → Global configuration).
 *
 * Mirrors usePhoneCountries: one shared fetch, cached in localStorage so the
 * pickers render instantly and keep working offline (Sudan connectivity).
 * Returns `null` lists until anything is known, so callers fall back to their
 * full static option lists rather than rendering empty pickers.
 */
const CACHE_KEY = 'matjar.publicConfig.v1';

export interface PublicConfig {
  currencies: string[] | null;
  countries: string[] | null;
}

let inflight: Promise<PublicConfig> | null = null;

function readCache(): PublicConfig {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<PublicConfig>;
      return {
        currencies: Array.isArray(p.currencies) ? p.currencies : null,
        countries: Array.isArray(p.countries) ? p.countries : null,
      };
    }
  } catch { /* storage unavailable */ }
  return { currencies: null, countries: null };
}

function fetchOnce(): Promise<PublicConfig> {
  if (!inflight) {
    inflight = api
      .get<{ responseObject?: { currencies?: string[]; countries?: string[] } }>('/config/public')
      .then((res) => {
        const ro = res?.responseObject || {};
        const next: PublicConfig = {
          currencies: Array.isArray(ro.currencies) && ro.currencies.length ? ro.currencies : null,
          countries: Array.isArray(ro.countries) && ro.countries.length ? ro.countries : null,
        };
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      })
      .catch(() => {
        // Allow a later mount to retry instead of pinning a failed result.
        inflight = null;
        return readCache();
      });
  }
  return inflight;
}

export function usePublicConfig(): PublicConfig {
  const [cfg, setCfg] = useState<PublicConfig>(readCache);
  useEffect(() => {
    let cancelled = false;
    fetchOnce().then((next) => { if (!cancelled) setCfg(next); });
    return () => { cancelled = true; };
  }, []);
  return cfg;
}
