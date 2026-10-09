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
  categories?: string[];
}

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
    const matched = themes.filter((th) => th.categories?.includes(niche));
    list = matched.length > 0 ? matched : themes;
  } else {
    const matched = themes.filter((th) => th.categories?.includes(niche));
    list = [...matched, ...themes.filter((th) => !th.categories?.includes(niche))];
  }
  return limit == null ? list : list.slice(0, limit);
}

// ---------------------------------------------------------------------------
// "First sale" checklist (10-17)
// ---------------------------------------------------------------------------

export type FirstSaleStepKey = 'product' | 'payments' | 'share';

export const FIRST_SALE_STEPS: readonly FirstSaleStepKey[] = ['product', 'payments', 'share'];

/** Payment method that is always seeded and on: Cash on Delivery. */
export const COD_METHOD_CODE = 'cod';

export interface FirstSaleSignals {
  /** Products in the store (any status). */
  productCount: number;
  /**
   * Codes of the ENABLED payment methods, or null when unknown — the
   * `payments.methods` flag is off (COD is then the only method and always
   * on) or the list failed to load.
   */
  enabledPaymentCodes: string[] | null;
  /** First time the merchant reviewed how customers pay (server stamp). */
  paymentsReviewedAt: string | null;
  /** First time the merchant tapped Share on the checklist (server stamp). */
  sharedAt: string | null;
}

export interface FirstSaleProgress {
  done: Record<FirstSaleStepKey, boolean>;
  doneCount: number;
  total: number;
  complete: boolean;
  /** The first step that is not done yet (the one to highlight), or null. */
  current: FirstSaleStepKey | null;
}

/**
 * Completion rules:
 *  - product:  at least one product exists.
 *  - payments: customers have a way to pay AND the merchant has seen it —
 *              they reviewed the payment step, or switched on a method other
 *              than cash on delivery (which means they set it up). With the
 *              methods unknown, COD is assumed on, so reviewing is enough.
 *              Every method switched off is never done.
 *  - share:    the merchant tapped Share once.
 */
export function firstSaleProgress(s: FirstSaleSignals): FirstSaleProgress {
  const codes = s.enabledPaymentCodes;
  const hasWayToPay = codes == null || codes.length > 0;
  const setUpOtherMethod = codes != null && codes.some((c) => c !== COD_METHOD_CODE);
  const done: Record<FirstSaleStepKey, boolean> = {
    product: s.productCount > 0,
    payments: hasWayToPay && (Boolean(s.paymentsReviewedAt) || setUpOtherMethod),
    share: Boolean(s.sharedAt),
  };
  const doneCount = FIRST_SALE_STEPS.filter((k) => done[k]).length;
  return {
    done,
    doneCount,
    total: FIRST_SALE_STEPS.length,
    complete: doneCount === FIRST_SALE_STEPS.length,
    current: FIRST_SALE_STEPS.find((k) => !done[k]) ?? null,
  };
}
