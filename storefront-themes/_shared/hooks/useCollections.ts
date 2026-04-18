import { useState, useEffect } from 'react';
import { storefrontApi } from '../api/client';

export function useCollections() {
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    storefrontApi.getCollections()
      .then(res => setCollections(res.data?.collections || []))
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
        setCollection(res.data?.collection || null);
        setProducts(res.data?.products || []);
        setPagination(res.data?.pagination || null);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [handle, JSON.stringify(params)]);

  return { collection, products, pagination, loading, error };
}
