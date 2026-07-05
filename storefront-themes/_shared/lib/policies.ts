import type { TFunction } from 'i18next';
import type { StoreInfo } from '../contexts/StoreContext';

/**
 * The four merchant-authored store policies. Keys match the backend
 * (settings.policies.<key>) and the `/policies/:key` storefront route.
 */
export const POLICY_KEYS = ['privacy', 'returns', 'delivery', 'cod'] as const;
export type PolicyKey = (typeof POLICY_KEYS)[number];

export interface ResolvedPolicy {
  key: PolicyKey;
  title: string;
  body: string;
  path: string;
}

export const policyPath = (key: PolicyKey | string) => `/policies/${key}`;

/** Fallback label for a policy from the common:storefront.policies namespace. */
export const policyLabel = (key: PolicyKey, t: TFunction): string =>
  t(`common:storefront.policies.${key}`, { defaultValue: key });

/**
 * The policies a store has actually published (body present), in a stable
 * order, each with a display title (merchant title → i18n label fallback).
 */
export function publishedPolicies(store: StoreInfo | null, t: TFunction): ResolvedPolicy[] {
  const src = store?.policies || {};
  const out: ResolvedPolicy[] = [];
  for (const key of POLICY_KEYS) {
    const p = src[key];
    if (p && p.body) {
      out.push({
        key,
        title: (p.title && p.title.trim()) || policyLabel(key, t),
        body: p.body,
        path: policyPath(key),
      });
    }
  }
  return out;
}
