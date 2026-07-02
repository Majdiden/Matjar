import { useEffect, useState } from 'react';
import { storefrontApi } from '../api/client';

export interface CmsPage {
  _id?: string;
  slug: string;
  title: string;
  content: string;
  metaTitle?: string;
  metaDescription?: string;
}

/**
 * Fetch a published CMS page by slug (About, Contact, or any custom page).
 * Returns `{ page, loading }`. `page` is null when the page doesn't exist or
 * isn't published yet — callers can fall back to static content.
 */
export function usePage(slug: string | undefined): { page: CmsPage | null; loading: boolean } {
  const [page, setPage] = useState<CmsPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!slug) { setPage(null); setLoading(false); return; }
    setLoading(true);
    storefrontApi
      .getPage(slug)
      .then((res: any) => { if (active) setPage(res?.data || null); })
      .catch(() => { if (active) setPage(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  return { page, loading };
}
