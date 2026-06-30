import { useState, useEffect } from 'react';
import { storefrontApi } from '../api/client';

export interface MenuItem {
  _id?: string;
  label: string;
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
export function useMenu(location: string = 'header') {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!location) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    storefrontApi
      .getMenu(location)
      .then((res) => setItems(res.data?.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [location]);

  return { items, loading };
}
