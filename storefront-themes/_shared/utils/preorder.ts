/**
 * Theme SDK — Pre-order helper
 *
 * Centralises the "is this a pre-order and how should the CTA behave"
 * decision across every theme and every CTA render site (ProductCard,
 * ProductDetail, QuickView). A single call site keeps behaviour
 * consistent so a merchant's pre-order rules (unit cap, ship-by date,
 * deposit, discount) are surfaced everywhere — not just where a theme
 * author happened to remember.
 *
 * Inputs are typed loosely because different call sites pass slightly
 * different product shapes (Card vs full Product vs API response). The
 * helper only touches optional fields and tolerates absent ones.
 *
 * Resolution order:
 *   1. If an active variant has preorder.enabled === true, variant wins.
 *   2. Otherwise, if product.preorder.enabled === true, product wins.
 *   3. Otherwise the mode is 'buy'.
 *
 * When a preorder block is active:
 *   - remaining = maxUnits - unitsReserved (null maxUnits ⇒ unlimited)
 *   - mode is 'soldOut' when remaining <= 0 (and maxUnits was finite)
 *   - mode is 'preorder' otherwise.
 *
 * Labels are pre-formatted strings so every theme renders the same
 * copy without reimplementing date/percent formatting.
 */

export type PreorderMode = 'buy' | 'preorder' | 'soldOut';

export interface PreorderState {
  /** Whether to show buy / pre-order / sold-out UI. */
  mode: PreorderMode;
  /** Units still available for pre-order, or null when uncapped. */
  remaining: number | null;
  /** True when remaining is a finite number in (0, 5]. */
  lowRemaining: boolean;
  /** Preformatted "Ships by <date>" label, or null. */
  shipByLabel: string | null;
  /** Preformatted "Reserve with N% deposit" label, or null. */
  depositLabel: string | null;
  /** Preformatted "N% pre-order discount" label, or null. */
  discountLabel: string | null;
  /** Optional merchant policy note, trimmed or null. */
  policyNote: string | null;
  /** Price after applying discountPct, or the input price when no discount. */
  effectivePrice: number;
  /** Original (pre-discount) price to render as strike-through when > effectivePrice. */
  originalPrice: number;
  /** Discount percentage applied (0 when none). */
  savingsPct: number;
  /** Recommended CTA label. */
  ctaLabel: string;
  /** True when the CTA button should be disabled. */
  ctaDisabled: boolean;
  /** The resolved preorder block (variant-level or product-level). */
  config: PreorderConfigLike | null;
}

interface PreorderConfigLike {
  enabled?: boolean;
  expectedShipDate?: string | Date | null;
  shipByDate?: string | Date | null;
  maxUnits?: number | null;
  unitsReserved?: number | null;
  maxPerCustomer?: number | null;
  chargePolicy?: 'now' | 'on_ship';
  depositPct?: number | null;
  discountPct?: number | null;
  policyNote?: string | null;
}

interface ProductLike {
  price?: number;
  compareAtPrice?: number;
  preorder?: PreorderConfigLike | null;
}

interface VariantLike {
  price?: number;
  compareAtPrice?: number;
  preorder?: PreorderConfigLike | null;
}

interface Options {
  /** Override the base price (e.g. when a variant is active). */
  price?: number;
  /**
   * When true, the CTA label is "Select Options" (caller is
   * responsible for not allowing cart submission). This takes
   * priority over preorder copy so the user is guided to pick
   * a variant first.
   */
  requiresSelection?: boolean;
  /** When true, the add button is mid-request — label suffix changes. */
  adding?: boolean;
  /** Override the default "Add to Cart" copy (e.g. "Add"). */
  buyLabel?: string;
}

const fmtDate = (raw: string | Date | null | undefined): string | null => {
  if (!raw) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const pickConfig = (
  product: ProductLike | null | undefined,
  variant: VariantLike | null | undefined,
): PreorderConfigLike | null => {
  if (variant?.preorder?.enabled) return variant.preorder;
  if (product?.preorder?.enabled) return product.preorder;
  return null;
};

export function getPreorderState(
  product: ProductLike | null | undefined,
  variant?: VariantLike | null,
  options: Options = {},
): PreorderState {
  const basePrice =
    typeof options.price === 'number'
      ? options.price
      : typeof variant?.price === 'number'
        ? variant.price
        : (product?.price ?? 0);

  const buyLabel = options.buyLabel || 'Add to Cart';
  const config = pickConfig(product, variant);

  if (!config) {
    // Not a preorder product — straightforward buy flow. We still return
    // a fully populated state so call sites can use the same labels.
    return {
      mode: 'buy',
      remaining: null,
      lowRemaining: false,
      shipByLabel: null,
      depositLabel: null,
      discountLabel: null,
      policyNote: null,
      effectivePrice: basePrice,
      originalPrice: basePrice,
      savingsPct: 0,
      ctaLabel: options.requiresSelection
        ? 'Select Options'
        : options.adding
          ? 'Adding…'
          : buyLabel,
      ctaDisabled: !!options.requiresSelection,
      config: null,
    };
  }

  const maxUnits =
    typeof config.maxUnits === 'number' && config.maxUnits >= 0 ? config.maxUnits : null;
  const unitsReserved =
    typeof config.unitsReserved === 'number' && config.unitsReserved >= 0
      ? config.unitsReserved
      : 0;
  const remaining = maxUnits === null ? null : Math.max(0, maxUnits - unitsReserved);
  const soldOut = remaining !== null && remaining <= 0;

  const discountPctRaw =
    typeof config.discountPct === 'number' ? config.discountPct : 0;
  const discountPct = Math.max(0, Math.min(100, discountPctRaw));
  const effectivePrice =
    discountPct > 0 ? Math.max(0, basePrice * (1 - discountPct / 100)) : basePrice;

  const depositPctRaw =
    typeof config.depositPct === 'number' ? config.depositPct : null;
  const depositPct =
    depositPctRaw === null ? null : Math.max(0, Math.min(100, depositPctRaw));

  const shipByLabel = fmtDate(config.expectedShipDate ?? config.shipByDate ?? null);

  const mode: PreorderMode = options.requiresSelection
    ? 'buy' // user must pick first; hide preorder-specific CTA copy until resolved
    : soldOut
      ? 'soldOut'
      : 'preorder';

  let ctaLabel: string;
  let ctaDisabled = false;

  if (options.requiresSelection) {
    ctaLabel = 'Select Options';
    ctaDisabled = true;
  } else if (mode === 'soldOut') {
    ctaLabel = 'Sold out';
    ctaDisabled = true;
  } else if (options.adding) {
    ctaLabel = 'Reserving…';
  } else {
    ctaLabel = 'Pre-order';
  }

  return {
    mode,
    remaining,
    lowRemaining:
      remaining !== null && remaining > 0 && remaining <= 5,
    shipByLabel: shipByLabel ? `Ships by ${shipByLabel}` : null,
    depositLabel:
      depositPct !== null && depositPct > 0
        ? `Reserve with ${depositPct}% deposit`
        : null,
    discountLabel:
      discountPct > 0 ? `${discountPct}% pre-order discount` : null,
    policyNote:
      typeof config.policyNote === 'string' && config.policyNote.trim().length > 0
        ? config.policyNote.trim()
        : null,
    effectivePrice,
    originalPrice: basePrice,
    savingsPct: discountPct,
    ctaLabel,
    ctaDisabled,
    config,
  };
}

/**
 * Convenience: just the CTA label for callers that don't care about
 * the rest (e.g. minimalist product cards). Defaults match
 * `getPreorderState`.
 */
export function getCtaLabel(
  product: ProductLike | null | undefined,
  variant?: VariantLike | null,
  options: Options = {},
): string {
  return getPreorderState(product, variant, options).ctaLabel;
}
