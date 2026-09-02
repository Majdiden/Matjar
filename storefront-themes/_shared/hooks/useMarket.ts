import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { marketsApi } from '../api/client';

/**
 * Resolves the visitor's active market — currency, country group, and
 * any catalog/price overrides. The backend `/markets/resolve` endpoint
 * inspects geo headers and falls back to the default market if no
 * explicit selection is in the session.
 *
 * Themes use this to pick a currency formatter and to render a market
 * switcher in the header. The hook also exposes `markets` (the full
 * list) so the switcher can populate its options.
 */
export function useMarket() {
  const { t } = useTranslation();
  const [activeMarket, setActiveMarket] = useState<any>(null);
  const [markets, setMarkets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [activeRes, listRes] = await Promise.all([
        marketsApi.resolve().catch(() => null),
        marketsApi.list().catch(() => null),
      ]);
      const active: any =
        activeRes?.data?.market ||
        activeRes?.responseObject?.market ||
        activeRes?.data ||
        activeRes?.responseObject ||
        null;
      const list: any =
        listRes?.data?.markets ||
        listRes?.responseObject?.markets ||
        listRes?.data ||
        listRes?.responseObject ||
        [];
      setActiveMarket(active);
      setMarkets(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setError(err?.message || t('errors:feedback.markets_load_failed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { refresh(); }, [refresh]);

  return { activeMarket, markets, loading, error, refresh };
}
