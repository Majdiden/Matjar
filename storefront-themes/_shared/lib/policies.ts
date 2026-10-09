import type { TFunction } from 'i18next';
import type { StoreInfo } from '../contexts/StoreContext';
import i18n from '../i18n';

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

const currentLang = () => ((i18n.resolvedLanguage || i18n.language || 'ar').startsWith('en') ? 'en' : 'ar');

/**
 * The policies a store has actually published (body present), in a stable
 * order, each with a display title. Generated policies come in the
 * shopper's language (`translations`); a policy the merchant wrote or
 * edited shows their text, with the title in the shopper's language when the
 * merchant left it at the generated default.
 */
export function publishedPolicies(store: StoreInfo | null, t: TFunction, lang: string = currentLang()): ResolvedPolicy[] {
  const src = store?.policies || {};
  const out: ResolvedPolicy[] = [];
  for (const key of POLICY_KEYS) {
    const p = src[key];
    if (!p || !p.body) continue;
    const localized = p.translations?.[lang];
    const body = (localized?.body && localized.body.trim()) || p.body;
    const title = (localized?.title && localized.title.trim()) || (p.title && p.title.trim()) || policyLabel(key, t);
    out.push({ key, title, body, path: policyPath(key) });
  }
  return out;
}

/** One published policy in the shopper's language, or null. */
export function publishedPolicy(store: StoreInfo | null, key: PolicyKey, t: TFunction): ResolvedPolicy | null {
  return publishedPolicies(store, t).find((p) => p.key === key) ?? null;
}
