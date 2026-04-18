import { useState, useEffect } from 'react';
import { storefrontApi } from '../api/client';

export function useProducts(params?: Record<string, string | number>) {
  const [products, setProducts] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    storefrontApi.getProducts(params)
      .then(res => {
        setProducts(res.data?.products || []);
        setPagination(res.data?.pagination || null);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [JSON.stringify(params)]);

  return { products, pagination, loading, error };
}

export function useFeaturedProducts(limit = 8) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    storefrontApi.getFeaturedProducts(limit)
      .then(res => setProducts(res.data?.products || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [limit]);

  return { products, loading };
}

export interface RatingDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export function useProduct(slug: string) {
  const [product, setProduct] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [frequentlyBoughtWith, setFrequentlyBoughtWith] = useState<any[]>([]);
  const [ratingDistribution, setRatingDistribution] = useState<RatingDistribution>({
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    storefrontApi.getProduct(slug)
      .then(res => {
        setProduct(res.data?.product || null);
        setReviews(res.data?.reviews || []);
        setRelatedProducts(res.data?.relatedProducts || []);
        setFrequentlyBoughtWith(res.data?.frequentlyBoughtWith || []);
        setRatingDistribution(res.data?.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  return { product, reviews, relatedProducts, frequentlyBoughtWith, ratingDistribution, loading, error };
}

export function useCategories() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    storefrontApi.getCategories()
      .then(res => setCategories(res.data?.categories || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { categories, loading };
}

export function useCategory(slug: string, params?: Record<string, string | number>) {
  const [category, setCategory] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    storefrontApi.getCategory(slug, params)
      .then(res => {
        setCategory(res.data?.category || null);
        setProducts(res.data?.products || []);
        setPagination(res.data?.pagination || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug, JSON.stringify(params)]);

  return { category, products, pagination, loading };
}
