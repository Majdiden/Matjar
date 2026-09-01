import { useState, useEffect, useMemo } from 'react';
import { storefrontApi } from '../api/client';
import { useLanguage } from '../i18n/LanguageProvider';

/**
 * Resolve a category's display name for the active language. The base `name` is
 * the default/fallback; `translations[lang].name` wins when the merchant filled
 * it in (see the Category schema). Keeps a bilingual storefront without theme
 * changes — every consumer of `cat.name` gets the localized value for free.
 */
function localizeCategory(cat: any, lang: string): any {
  const localized = cat?.translations?.[lang]?.name;
  return localized ? { ...cat, name: localized } : cat;
}

/**
 * Resolve a product's display text (name / description / shortDescription) for
 * the active language. Base fields are the fallback; `translations[lang].*`
 * wins when filled in (see the Product schema). Every consumer of `product.name`
 * gets the localized value with no theme changes.
 */
function localizeProduct(p: any, lang: string): any {
  const tr = p?.translations?.[lang];
  if (!tr) return p;
  const name = tr.name || p.name;
  const description = tr.description || p.description;
  const shortDescription = tr.shortDescription || p.shortDescription;
  if (name === p.name && description === p.description && shortDescription === p.shortDescription) {
    return p;
  }
  return { ...p, name, description, shortDescription };
}

/** Localize a list of products for the active language. */
function localizeProducts(list: any[], lang: string): any[] {
  return Array.isArray(list) ? list.map((p) => localizeProduct(p, lang)) : list;
}

export function useProducts(params?: Record<string, string | number>) {
  const [raw, setRaw] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { lang } = useLanguage();

  useEffect(() => {
    setLoading(true);
    storefrontApi.getProducts(params)
      .then(res => {
        setRaw(res.data?.products || []);
        setPagination(res.data?.pagination || null);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [JSON.stringify(params)]);

  const products = useMemo(() => localizeProducts(raw, lang), [raw, lang]);
  return { products, pagination, loading, error };
}

export function useFeaturedProducts(limit = 8) {
  const [raw, setRaw] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { lang } = useLanguage();

  useEffect(() => {
    storefrontApi.getFeaturedProducts(limit)
      .then(res => setRaw(res.data?.products || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [limit]);

  const products = useMemo(() => localizeProducts(raw, lang), [raw, lang]);
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
  const [rawProduct, setRawProduct] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [rawRelated, setRawRelated] = useState<any[]>([]);
  const [rawFbw, setRawFbw] = useState<any[]>([]);
  const [ratingDistribution, setRatingDistribution] = useState<RatingDistribution>({
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { lang } = useLanguage();

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    storefrontApi.getProduct(slug)
      .then(res => {
        setRawProduct(res.data?.product || null);
        setReviews(res.data?.reviews || []);
        setRawRelated(res.data?.relatedProducts || []);
        setRawFbw(res.data?.frequentlyBoughtWith || []);
        setRatingDistribution(res.data?.ratingDistribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  const product = useMemo(() => (rawProduct ? localizeProduct(rawProduct, lang) : rawProduct), [rawProduct, lang]);
  const relatedProducts = useMemo(() => localizeProducts(rawRelated, lang), [rawRelated, lang]);
  const frequentlyBoughtWith = useMemo(() => localizeProducts(rawFbw, lang), [rawFbw, lang]);

  return { product, reviews, relatedProducts, frequentlyBoughtWith, ratingDistribution, loading, error };
}

export function useCategories() {
  const [raw, setRaw] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { lang } = useLanguage();

  useEffect(() => {
    storefrontApi.getCategories()
      .then(res => setRaw(res.data?.categories || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Re-localize on language change without refetching.
  const categories = useMemo(() => raw.map(c => localizeCategory(c, lang)), [raw, lang]);

  return { categories, loading };
}

export function useCategory(slug: string, params?: Record<string, string | number>) {
  const [rawCategory, setRawCategory] = useState<any>(null);
  const [rawProducts, setRawProducts] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { lang } = useLanguage();

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    storefrontApi.getCategory(slug, params)
      .then(res => {
        setRawCategory(res.data?.category || null);
        setRawProducts(res.data?.products || []);
        setPagination(res.data?.pagination || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug, JSON.stringify(params)]);

  const category = useMemo(() => (rawCategory ? localizeCategory(rawCategory, lang) : rawCategory), [rawCategory, lang]);
  const products = useMemo(() => localizeProducts(rawProducts, lang), [rawProducts, lang]);

  return { category, products, pagination, loading };
}
