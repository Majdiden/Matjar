/** Helpers for the product form's own prices per currency (OwnPricesEditor). */
import React from 'react';
import { api } from '../../lib/api-client';
import type { CurrencyConfig } from '../settings/shared';

/** A market currency besides the pricing one, with its rate and the markets using it. */
export interface OtherCurrency {
  code: string;
  rate: number;
  /** Names of the markets paying in it ("Saudi Arabia"). */
  markets: string[];
}

/**
 * The currencies the store's markets pay in other than the pricing currency
 * (Settings → Markets), or [] when there are none or Markets is off.
 */
export function useOtherCurrencies(): OtherCurrency[] {
  const [list, setList] = React.useState<OtherCurrency[]>([]);
  React.useEffect(() => {
    let cancelled = false;
    (api.settings.listMarketsSettings() as Promise<{
      data?: { currencies?: CurrencyConfig; markets?: { name: string; currency: string; enabled?: boolean }[] };
    }>)
      .then((res) => {
        if (cancelled) return;
        const cfg = res?.data?.currencies;
        const byCode = new Map<string, OtherCurrency>();
        for (const m of res?.data?.markets || []) {
          const rate = Number(cfg?.rates?.[m.currency]);
          if (m.enabled === false || m.currency === cfg?.base || !(rate > 0)) continue;
          const entry = byCode.get(m.currency) || { code: m.currency, rate, markets: [] };
          entry.markets.push(m.name);
          byCode.set(m.currency, entry);
        }
        setList([...byCode.values()]);
      })
      .catch(() => { if (!cancelled) setList([]); });
    return () => { cancelled = true; };
  }, []);
  return list;
}

/** The prices map without empty entries, or null when nothing is left. */
export function cleanOwnPrices(prices: Record<string, number> | null | undefined): Record<string, number> | null {
  const out = Object.fromEntries(Object.entries(prices || {}).filter(([, v]) => typeof v === 'number' && v >= 0 && !isNaN(v)));
  return Object.keys(out).length ? out : null;
}
