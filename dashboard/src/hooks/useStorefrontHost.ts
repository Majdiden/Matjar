import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';

/**
 * The store's public hostname (custom domain when live, else the platform
 * subdomain) from GET /api/domains/info, for showing full shareable links
 * like "https://nile.matjar.to/products/atr-alord".
 *
 * One shared fetch per page load. Returns '' until known — and stays '' when
 * the staff member lacks `domains.read` — so callers fall back to showing the
 * path alone.
 */
interface DomainInfo {
  activeDomain?: string;
  subdomain?: { fullDomain?: string };
}

let inflight: Promise<string> | null = null;

function fetchHost(): Promise<string> {
  inflight ??= (async () => {
    try {
      const res = (await api.domains.getInfo()) as {
        data?: DomainInfo;
        responseObject?: DomainInfo & { data?: DomainInfo };
      };
      const info = res.data || res.responseObject?.data || res.responseObject;
      return info?.activeDomain || info?.subdomain?.fullDomain || '';
    } catch {
      inflight = null; // allow a retry on the next mount
      return '';
    }
  })();
  return inflight;
}

export function useStorefrontHost(): string {
  const [host, setHost] = useState('');
  useEffect(() => {
    let alive = true;
    fetchHost().then((h) => { if (alive) setHost(h); });
    return () => { alive = false; };
  }, []);
  return host;
}
