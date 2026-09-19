import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { FALLBACK_PHONE_COUNTRY, type PhoneCountry } from '../lib/phone';

const CACHE_KEY = 'matjar.phoneCountries.v1';

interface PhoneCountriesPayload {
  countries: PhoneCountry[];
  defaultCountry: string;
}

const FALLBACK: PhoneCountriesPayload = {
  countries: [FALLBACK_PHONE_COUNTRY],
  defaultCountry: FALLBACK_PHONE_COUNTRY.iso2,
};

function readCache(): PhoneCountriesPayload | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PhoneCountriesPayload;
    if (!Array.isArray(parsed?.countries) || parsed.countries.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(payload: PhoneCountriesPayload) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* storage disabled — non-fatal */
  }
}

// Module-level memo so the Register page and the Account tab share one fetch
// per session instead of hitting the endpoint on every mount.
let inflight: Promise<PhoneCountriesPayload> | null = null;

function fetchCountries(): Promise<PhoneCountriesPayload> {
  if (!inflight) {
    inflight = api.auth
      .phoneCountries()
      .then((res) => {
        const ro = res.responseObject;
        if (!ro || !Array.isArray(ro.countries) || ro.countries.length === 0) {
          throw new Error('empty phone-countries payload');
        }
        const payload: PhoneCountriesPayload = {
          countries: ro.countries,
          defaultCountry: ro.defaultCountry || ro.countries[0].iso2,
        };
        writeCache(payload);
        return payload;
      })
      .catch((err) => {
        inflight = null; // allow a retry on the next mount
        throw err;
      });
  }
  return inflight;
}

/**
 * The enabled phone dial codes (+ default) the platform offers. Renders
 * instantly from the localStorage cache (offline-safe — Sudan connectivity),
 * refreshes from the API in the background, and falls back to Sudan when
 * nothing is available.
 */
export function usePhoneCountries(): PhoneCountriesPayload & { loading: boolean } {
  const [data, setData] = useState<PhoneCountriesPayload>(() => readCache() || FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchCountries()
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => {
        /* keep cache / fallback */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...data, loading };
}
