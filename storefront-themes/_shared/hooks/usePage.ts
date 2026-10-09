import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { storefrontApi } from '../api/client';
import type { BrandText } from '../types/commerce';

/**
 * Facts behind an About page written from the merchant's answers (PBI 10-9).
 * Present only while the page is still the generated text — gone once the
 * merchant edits it by hand.
 */
export interface GeneratedAboutFacts {
  kind: 'about';
  since?: number;
  city?: BrandText;
  photo?: string;
}

export interface CmsPage {
  _id?: string;
  slug: string;
  title: string;
  content: string;
  metaTitle?: string;
  metaDescription?: string;
  generated?: GeneratedAboutFacts;
}

/**
 * Fetch a published CMS page by slug (About, Contact, or any custom page).
 * Returns `{ page, loading }`. `page` is null when the page doesn't exist or
 * isn't published yet — callers can fall back to static content.
 *
 * Asks for the visitor's language first: a slug can exist once per language
 * (e.g. the Arabic and English About pages written from the merchant's
 * answers, PBI 10-9). A store with one page per slug gets that page as before.
 */
export function usePage(slug: string | undefined): { page: CmsPage | null; loading: boolean } {
  const [page, setPage] = useState<CmsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const { i18n } = useTranslation();
  const lang = (i18n.language || '').split('-')[0];

  useEffect(() => {
    let active = true;
    if (!slug) { setPage(null); setLoading(false); return; }
    setLoading(true);
    storefrontApi
      .getPage(slug, lang || undefined)
      .then((res: any) => { if (active) setPage(res?.data || null); })
      .catch(() => { if (active) setPage(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug, lang]);

  return { page, loading };
}
