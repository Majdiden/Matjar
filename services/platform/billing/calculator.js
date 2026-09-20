/**
 * Pure commission calculator — no DB, no side effects. Unit-tested in
 * tests/unit/billing-calculator.test.js.
 *
 * Amounts:
 *   - `orderAmount` is in the STORE currency.
 *   - Tier thresholds, fixedPerOrder, perOrder.min/max and periodCap are in
 *     the POLICY currency.
 *   - `fxRateToPolicyCurrency` converts store → policy (multiply). `1` when
 *     the currencies match; `null` when unknown — then tier 0 is used and the
 *     result is flagged `fxMissing` (per plan decision 2, the fee itself is
 *     still recorded in the store currency).
 *
 * Returns fee in the STORE currency plus the policy-currency figures needed
 * to track period basis and caps.
 */
import { roundMoney } from "./money.js";

function pctOf(amount, percent) {
  return (amount * percent) / 100;
}

/** Normalise + validate a tier table; throws on malformed input. */
export function normalizeTiers(tiers) {
  const list = Array.isArray(tiers) && tiers.length ? tiers : [{ upTo: null, percent: 0 }];
  let prev = 0;
  return list.map((t, i) => {
    const upTo = t.upTo == null ? null : Number(t.upTo);
    const percent = Number(t.percent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      throw new Error(`tier ${i}: percent must be between 0 and 100`);
    }
    if (upTo !== null) {
      if (!Number.isFinite(upTo) || upTo <= prev) throw new Error(`tier ${i}: upTo must be ascending`);
      if (i === list.length - 1) throw new Error("last tier must be open-ended (upTo: null)");
      prev = upTo;
    } else if (i !== list.length - 1) {
      throw new Error(`tier ${i}: only the last tier may be open-ended`);
    }
    return { upTo, percent, fixedPerOrder: Math.max(0, Number(t.fixedPerOrder) || 0) };
  });
}

/** Index of the tier that contains `basis` (policy currency / order count). */
export function tierIndexFor(tiers, basis) {
  for (let i = 0; i < tiers.length; i++) {
    if (tiers[i].upTo === null || basis <= tiers[i].upTo) return i;
  }
  return tiers.length - 1;
}

/**
 * @param {object} args
 * @param {object} args.policy               CommissionPolicy-shaped object
 * @param {number} args.periodBasisSoFar     recognised basis in this period (policy ccy, or order count)
 * @param {number} args.periodFeeSoFar       fees already recognised this period (policy ccy) — for periodCap
 * @param {number} args.orderAmount          order basis in store currency
 * @param {number|null} args.fxRateToPolicyCurrency
 * @param {number} [args.percentDelta]       additive percentage points (override), clamped ≥ 0
 */
export function computeCommission({
  policy,
  periodBasisSoFar = 0,
  periodFeeSoFar = 0,
  orderAmount,
  fxRateToPolicyCurrency = 1,
  percentDelta = 0,
}) {
  const tiers = normalizeTiers(policy?.tiers);
  const precision = Number(policy?.precision ?? 0);
  const rounding = policy?.rounding || "nearest";
  const tierMode = policy?.tierMode === "bracket" ? "bracket" : "marginal";
  const basisKind = policy?.basis === "order_count" ? "order_count" : "gmv";
  const amount = Math.max(0, Number(orderAmount) || 0);
  const fx = fxRateToPolicyCurrency == null ? null : Number(fxRateToPolicyCurrency);
  const fxMissing = fx == null || !Number.isFinite(fx) || fx <= 0;
  const toPolicy = (v) => (fxMissing ? null : v * fx);
  const toStore = (v) => (fxMissing ? 0 : v / fx);
  const delta = Number(percentDelta) || 0;
  const effPct = (p) => Math.min(100, Math.max(0, p + delta)); // (N10)

  const breakdown = [];
  let feeStore = 0; // store currency, unrounded
  let lastTier = 0;

  if (basisKind === "order_count") {
    // Tier by the ordinal of this order within the period.
    const idx = fxMissing ? 0 : tierIndexFor(tiers, (Number(periodBasisSoFar) || 0) + 1);
    lastTier = idx;
    feeStore = pctOf(amount, effPct(tiers[idx].percent));
    breakdown.push({ tier: idx, amount, percent: effPct(tiers[idx].percent) });
  } else if (fxMissing) {
    // Unknown FX: apply tier 0 to the whole order (flagged for review).
    feeStore = pctOf(amount, effPct(tiers[0].percent));
    breakdown.push({ tier: 0, amount, percent: effPct(tiers[0].percent) });
  } else if (tierMode === "bracket") {
    const reached = (Number(periodBasisSoFar) || 0) + amount * fx;
    const idx = tierIndexFor(tiers, reached);
    lastTier = idx;
    feeStore = pctOf(amount, effPct(tiers[idx].percent));
    breakdown.push({ tier: idx, amount, percent: effPct(tiers[idx].percent) });
  } else {
    // Marginal: walk the brackets from the basis already recognised.
    let cursor = Number(periodBasisSoFar) || 0; // policy ccy
    let remainingPolicy = amount * fx;
    for (let i = 0; i < tiers.length && remainingPolicy > 1e-9; i++) {
      const t = tiers[i];
      const upper = t.upTo === null ? Infinity : t.upTo;
      if (cursor >= upper) continue;
      const slicePolicy = Math.min(remainingPolicy, upper - cursor);
      const sliceStore = slicePolicy / fx;
      const pct = effPct(t.percent);
      feeStore += pctOf(sliceStore, pct);
      breakdown.push({ tier: i, amount: sliceStore, percent: pct });
      cursor += slicePolicy;
      remainingPolicy -= slicePolicy;
      lastTier = i;
    }
  }

  // Fixed per-order component (policy currency) at the reached tier.
  // (M1) Fixed component and floor only apply to a real (positive) basis —
  // a zero-value order must never produce a fee.
  const fixed = tiers[lastTier]?.fixedPerOrder || 0;
  if (amount > 0 && fixed > 0 && !fxMissing) feeStore += toStore(fixed);

  // Per-order floor / ceiling (policy currency).
  const minFee = policy?.perOrder?.minFee;
  const maxFee = policy?.perOrder?.maxFee;
  if (!fxMissing) {
    if (amount > 0 && minFee != null && feeStore < toStore(minFee)) feeStore = toStore(minFee);
    if (maxFee != null && feeStore > toStore(maxFee)) feeStore = toStore(maxFee);
  }

  // Period cap (policy currency): never exceed cap - already charged.
  let capped = false;
  const cap = policy?.periodCap;
  if (cap != null && !fxMissing) {
    const room = Math.max(0, cap - (Number(periodFeeSoFar) || 0));
    if (feeStore * fx > room) {
      feeStore = room / fx;
      capped = true;
    }
  }

  const feeAmount = roundMoney(feeStore, precision, rounding);
  const percentApplied = amount > 0 ? roundMoney((feeAmount / amount) * 100, 4) : 0;

  return {
    feeAmount,
    tierIndex: lastTier,
    percentApplied,
    basisPolicyAmount: fxMissing ? null : roundMoney(amount * fx, 4),
    feePolicyAmount: fxMissing ? null : roundMoney(feeAmount * fx, 4),
    fxMissing,
    capped,
    breakdown,
  };
}

/**
 * Proportional reversal of a recognised commission for a refund. Never
 * reverses more than what remains un-reversed on that order.
 */
export function computeReversal({ commissionFee, orderBasis, refundAmount, alreadyReversed = 0, precision = 0, rounding = "nearest" }) {
  const fee = Number(commissionFee) || 0;
  const basis = Number(orderBasis) || 0;
  const refund = Math.max(0, Number(refundAmount) || 0);
  if (fee <= 0 || basis <= 0 || refund <= 0) return 0;
  const share = Math.min(1, refund / basis);
  const remaining = Math.max(0, fee - (Number(alreadyReversed) || 0));
  return roundMoney(Math.min(remaining, fee * share), precision, rounding);
}
