import { useEffect, useState } from 'react';
import { storefrontApi } from '../api/client';

/**
 * Whether the store has any product a shopper can see: true / false, or null
 * while unknown (and on a failed request, so a network error never hides a
 * store's products). One small request per page load, shared by every caller.
 */
let probe: Promise<boolean | null> | null = null;

const hasProducts = (): Promise<boolean | null> => {
  probe ??= storefrontApi
    .getProducts({ limit: 1 })
    .then((res: any) => {
      const total = res?.data?.pagination?.total;
      return typeof total === 'number' ? total > 0 : (res?.data?.products?.length ?? 0) > 0;
    })
    .catch(() => {
      probe = null; // try again next time
      return null;
    });
  return probe;
};

export function useStoreHasProducts(): boolean | null {
  const [value, setValue] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    hasProducts().then((v) => { if (live) setValue(v); });
    return () => { live = false; };
  }, []);
  return value;
}
