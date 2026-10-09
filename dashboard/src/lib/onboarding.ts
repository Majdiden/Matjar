// =============================================================================
// Guided onboarding rules (PBI 10-16 signup v2, 10-17 "first sale"
// checklist). Pure and dependency-free so they are unit-tested directly
// (tests/unit/onboarding.test.js, via Node's type stripping).
// =============================================================================

export type SignupFlow = 'v1' | 'v2';

export type SignupStep = 'welcome' | 'account' | 'otp' | 'store' | 'niche' | 'location' | 'theme';

/** v1: the original order. v2 adds "where are you" before the look. */
const SIGNUP_STEPS: Record<SignupFlow, readonly SignupStep[]> = {
  v1: ['welcome', 'account', 'otp', 'store', 'niche', 'theme'],
  v2: ['welcome', 'account', 'otp', 'store', 'niche', 'location', 'theme'],
};

/** URL parameter the operator uses to force a flow (`?flow=v2` / `?flow=v1`). */
export const SIGNUP_FLOW_PARAM = 'flow';

/** Theme cards shown in signup v2 — few enough to compare on a phone. */
export const SIGNUP_V2_THEME_LIMIT = 3;

/**
 * Which signup flow to run. A `?flow=` override wins, so the operator can try
 * v2 on prod while the global flag is off (and force v1 while it is on);
 * otherwise the global `onboarding.v2` flag. Unknown/unloaded → v1.
 */
export function resolveSignupFlow(search: string, globalV2: boolean | null | undefined): SignupFlow {
  const forced = new URLSearchParams(search).get(SIGNUP_FLOW_PARAM)?.trim().toLowerCase();
  if (forced === 'v1' || forced === 'v2') return forced;
  return globalV2 === true ? 'v2' : 'v1';
}

export function signupSteps(flow: SignupFlow): readonly SignupStep[] {
  return SIGNUP_STEPS[flow];
}

interface NicheTheme {
  /** Platform-managed category keys (GET /api/themes/active). */
  categoryKeys?: string[];
  /** Raw manifest categories — used only when categoryKeys is absent. */
  categories?: string[];
}

const inNiche = (th: NicheTheme, niche: string) => (th.categoryKeys ?? th.categories ?? []).includes(niche);

/**
 * Themes for the "pick a look" step: the ones made for the merchant's niche
 * first, then the rest, capped at `limit`. "general" (or nothing) keeps the
 * catalog order. v1 passes no limit and keeps its old filter-or-everything.
 */
export function themesForNiche<T extends NicheTheme>(themes: T[], niche: string, limit?: number): T[] {
  let list: T[];
  if (!niche || niche === 'general') {
    list = themes;
  } else if (limit == null) {
    const matched = themes.filter((th) => inNiche(th, niche));
    list = matched.length > 0 ? matched : themes;
  } else {
    const matched = themes.filter((th) => inNiche(th, niche));
    list = [...matched, ...themes.filter((th) => !inNiche(th, niche))];
  }
  return limit == null ? list : list.slice(0, limit);
}

// ---------------------------------------------------------------------------
// "First sale" essentials (10-17, guided setup 10-28)
// ---------------------------------------------------------------------------

/**
 * The essentials a new store goes through before it can sell, in order.
 * "How customers pay" is not a step: cash on delivery is the only method
 * today and it is on by default.
 */
export type FirstSaleStepKey = 'product' | 'brand' | 'policies' | 'share';

export const FIRST_SALE_STEPS: readonly FirstSaleStepKey[] = ['product', 'brand', 'policies', 'share'];

/** Steps done on the My Store screens (`design.simpleMode`). */
const MY_STORE_STEPS: ReadonlySet<FirstSaleStepKey> = new Set(['brand', 'policies']);

/** Where each step is done; `null` = done in place (the guide's own button). */
export const FIRST_SALE_STEP_ROUTES: Readonly<Record<FirstSaleStepKey, string | null>> = Object.freeze({
  product: '/dashboard/products/quick',
  brand: '/dashboard/store/brand',
  policies: '/dashboard/store/policies',
  share: null,
});

/** The steps for this store: "logo and cover" and "delivery and returns" need the My Store screens. */
export function firstSaleSteps({ myStore }: { myStore: boolean }): FirstSaleStepKey[] {
  return FIRST_SALE_STEPS.filter((k) => myStore || !MY_STORE_STEPS.has(k));
}

export interface FirstSaleSignals {
  /** Products in the store (any status). */
  productCount: number;
  /** The store has a logo, a cover photo and the line shown with it (brand kit). */
  brandReady: boolean;
  /** The delivery and returns policies were written from the questions. */
  policiesReady: boolean;
  /** First time the merchant shared the store link (server stamp). */
  sharedAt: string | null;
}

interface BrandProfile {
  logo?: string | null;
  brand?: { coverImage?: string | null; tagline?: { ar?: string | null } | null } | null;
}

/**
 * "Logo and cover" is done once the store has a logo, a cover photo and the
 * short line shown with it (the tagline, which fills the homepage's big
 * photo section). Arabic is the required language of the tagline.
 */
export function isBrandReady(profile: BrandProfile | null | undefined): boolean {
  return Boolean(profile?.logo && profile?.brand?.coverImage && profile?.brand?.tagline?.ar?.trim());
}

export interface FirstSaleProgress {
  steps: FirstSaleStepKey[];
  done: Record<FirstSaleStepKey, boolean>;
  doneCount: number;
  total: number;
  complete: boolean;
  /** The first step that is not done yet (the one to open), or null. */
  current: FirstSaleStepKey | null;
}

/**
 * Completion rules:
 *  - product: at least one product exists.
 *  - brand:    a logo, a cover photo and the tagline are set.
 *  - policies: the delivery and returns policies were written.
 *  - share:   the merchant shared the store link once.
 */
export function firstSaleProgress(s: FirstSaleSignals, steps: readonly FirstSaleStepKey[] = FIRST_SALE_STEPS): FirstSaleProgress {
  const done: Record<FirstSaleStepKey, boolean> = {
    product: s.productCount > 0,
    brand: s.brandReady,
    policies: s.policiesReady,
    share: Boolean(s.sharedAt),
  };
  const doneCount = steps.filter((k) => done[k]).length;
  return {
    steps: [...steps],
    done,
    doneCount,
    total: steps.length,
    complete: doneCount === steps.length,
    current: steps.find((k) => !done[k]) ?? null,
  };
}
