/** Helpers for the product form's own prices per currency (OwnPricesEditor). */
import React from 'react';
import { api } from '../../lib/api-client';
import type { CurrencyConfig } from '../settings/shared';

/** A currency the store sells in besides the pricing one, with its rate from it. */
export interface OtherCurrency {
  code: string;
  rate: number;
}

/**
 * The store's other currencies (those with an exchange rate), or [] when the
 * store has none or the Currencies settings are off for it.
 */
export function useOtherCurrencies(): OtherCurrency[] {
  const [list, setList] = React.useState<OtherCurrency[]>([]);
  React.useEffect(() => {
    let cancelled = false;
    (api.settings.getCurrencies() as Promise<{ data?: { currencies?: CurrencyConfig } }>)
      .then((res) => {
        if (cancelled) return;
        const cfg = res?.data?.currencies;
        setList(
          Object.entries(cfg?.rates || {})
            .filter(([code, rate]) => code !== cfg?.base && Number(rate) > 0)
            .map(([code, rate]) => ({ code, rate: Number(rate) })),
        );
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
