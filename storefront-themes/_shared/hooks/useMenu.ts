import { useState, useEffect, useMemo } from 'react';
import { storefrontApi } from '../api/client';
import { useLanguage } from '../i18n/LanguageProvider';

export interface MenuItem {
  _id?: string;
  label: string;
  /** Optional per-language label overrides (see the Menu schema). */
  translations?: { en?: { label?: string }; ar?: { label?: string } };
  /** Author-supplied URL (set for `link`/`external` items). */
  url?: string;
  /** Backend-resolved URL — present after resolveMenu (falls back to `url`). */
  resolvedUrl?: string;
  type?: 'link' | 'collection' | 'product' | 'category' | 'page' | 'external';
  target?: '_self' | '_blank';
  icon?: string;
  order?: number;
  children?: MenuItem[];
}

/**
 * Fetch a public storefront navigation menu by location/handle.
 *
 * The backend serves menus by handle at `GET /storefront/menus/:handle`, and
 * the default nav seeded on store creation uses the "header" handle — so the
 * `location` argument doubles as the handle (they're kept equal server-side).
 * The `previewTheme` query param is forwarded automatically by the API client.
 *
 * Returns an empty `items` list (never throws) when the store has no such menu
 * — e.g. older stores created before menu seeding existed — so callers can
 * fall back to another navigation source (a category list, static links, …).
 */
// Resolve each item's label for the active language (recursively for children).
// `label` is the fallback; `translations[lang].label` wins when present.
function localizeItems(items: MenuItem[], lang: 'en' | 'ar'): MenuItem[] {
  return items.map((it) => {
    const localized = it.translations?.[lang]?.label;
    const children = it.children ? localizeItems(it.children, lang) : it.children;
    if (!localized && children === it.children) return it;
    return { ...it, label: localized || it.label, children };
  });
}

export function useMenu(location: string = 'header') {
  const [raw, setRaw] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { lang } = useLanguage();

  useEffect(() => {
    if (!location) {
      setRaw([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    storefrontApi
      .getMenu(location)
      .then((res) => setRaw(res.data?.items || []))
      .catch(() => setRaw([]))
      .finally(() => setLoading(false));
  }, [location]);

  // Re-localize on language change without refetching.
  const items = useMemo(() => localizeItems(raw, lang), [raw, lang]);

  return { items, loading };
}
