import { useState, useEffect } from 'react';
import { storefrontApi } from '../api/client';

/**
 * The API returns a collection's `image` as an object ({ url, alt }), but
 * every render site expects a plain URL string (`<img src={collection.image}>`).
 * Flatten it here — once — so all consumers get a string and never render a
 * broken `[object Object]` src. Accepts a string too (forward-compatible).
 */
function normalizeCollection(c: any): any {
  if (!c || typeof c !== 'object') return c;
  const img = c.image;
  const url = img && typeof img === 'object' ? (img.url || img.src || '') : img;
  return { ...c, image: url || '', imageUrl: c.imageUrl || url || '' };
}

export function useCollections() {
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    storefrontApi.getCollections()
      .then(res => setCollections((res.data?.collections || []).map(normalizeCollection)))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { collections, loading, error };
}

export function useCollection(handle: string, params?: Record<string, string | number>) {
  const [collection, setCollection] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!handle) return;
    setLoading(true);
    storefrontApi.getCollection(handle, params)
      .then(res => {
        setCollection(res.data?.collection ? normalizeCollection(res.data.collection) : null);
        setProducts(res.data?.products || []);
        setPagination(res.data?.pagination || null);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [handle, JSON.stringify(params)]);

  return { collection, products, pagination, loading, error };
}
