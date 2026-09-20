/**
 * Commission calculator + money helpers — pure, no DB.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeCommission, computeReversal, normalizeTiers, tierIndexFor } from "../../services/platform/billing/calculator.js";
import { roundMoney, sumMoney, periodKeyFor, periodBounds, previousPeriodKey } from "../../services/platform/billing/money.js";

const STANDARD = {
  currency: "SDG",
  tierMode: "marginal",
  precision: 0,
  rounding: "nearest",
  tiers: [
    { upTo: 500000, percent: 5 },
    { upTo: 2000000, percent: 3.5 },
    { upTo: null, percent: 2 },
  ],
  perOrder: { minFee: 50, maxFee: null },
};

describe("money helpers", () => {
  it("rounds half away from zero, up and down", () => {
    assert.equal(roundMoney(2.5, 0), 3);
    assert.equal(roundMoney(-2.5, 0), -3);
    assert.equal(roundMoney(2.01, 0, "up"), 3);
    assert.equal(roundMoney(2.99, 0, "down"), 2);
    assert.equal(roundMoney(1.005, 2), 1.01);
  });
  it("sums without float drift", () => {
    assert.equal(sumMoney([0.1, 0.2, 0.3]), 0.6);
  });
  it("period keys and bounds are UTC months", () => {
    assert.equal(periodKeyFor(new Date("2026-09-19T10:00:00Z")), "2026-09");
    const { start, end } = periodBounds("2026-09");
    assert.equal(start.toISOString(), "2026-09-01T00:00:00.000Z");
    assert.equal(end.toISOString(), "2026-10-01T00:00:00.000Z");
    assert.equal(previousPeriodKey("2026-01"), "2025-12");
    assert.throws(() => periodBounds("2026-13"));
  });
});

describe("normalizeTiers", () => {
  it("accepts an ascending table ending open", () => {
    assert.equal(normalizeTiers(STANDARD.tiers).length, 3);
  });
  it("rejects non-ascending, closed last tier, or bad percent", () => {
    assert.throws(() => normalizeTiers([{ upTo: 10, percent: 5 }, { upTo: 5, percent: 4 }, { upTo: null, percent: 3 }]));
    assert.throws(() => normalizeTiers([{ upTo: 10, percent: 5 }]));
    assert.throws(() => normalizeTiers([{ upTo: null, percent: 101 }]));
    assert.throws(() => normalizeTiers([{ upTo: null, percent: 2 }, { upTo: 5, percent: 1 }]));
  });
  it("tierIndexFor picks the containing tier", () => {
    const t = normalizeTiers(STANDARD.tiers);
    assert.equal(tierIndexFor(t, 0), 0);
    assert.equal(tierIndexFor(t, 500000), 0);
    assert.equal(tierIndexFor(t, 500001), 1);
    assert.equal(tierIndexFor(t, 9e9), 2);
  });
});

describe("computeCommission — marginal", () => {
  it("worked example from the plan: 18,000 order at 490,000 basis → 780", () => {
    const r = computeCommission({ policy: STANDARD, periodBasisSoFar: 490000, orderAmount: 18000 });
    assert.equal(r.feeAmount, 780);
    assert.equal(r.tierIndex, 1);
    assert.equal(r.breakdown.length, 2);
    assert.equal(r.basisPolicyAmount, 18000);
  });
  it("applies the per-order minimum", () => {
    const r = computeCommission({ policy: STANDARD, periodBasisSoFar: 0, orderAmount: 100 });
    assert.equal(r.feeAmount, 50);
  });
  it("applies the per-order maximum", () => {
    const r = computeCommission({ policy: { ...STANDARD, perOrder: { minFee: null, maxFee: 1000 } }, periodBasisSoFar: 0, orderAmount: 100000 });
    assert.equal(r.feeAmount, 1000);
  });
  it("honours the period cap with what was already charged", () => {
    const r = computeCommission({ policy: { ...STANDARD, periodCap: 1000 }, periodBasisSoFar: 0, periodFeeSoFar: 900, orderAmount: 100000 });
    assert.equal(r.feeAmount, 100);
    assert.equal(r.capped, true);
  });
  it("adds fixedPerOrder at the reached tier", () => {
    const pol = { ...STANDARD, perOrder: {}, tiers: [{ upTo: null, percent: 0, fixedPerOrder: 25 }] };
    assert.equal(computeCommission({ policy: pol, orderAmount: 1000 }).feeAmount, 25);
  });
  it("percentDelta shifts the rate and is clamped to [0, 100]", () => {
    const pol = { ...STANDARD, perOrder: {} };
    assert.equal(computeCommission({ policy: pol, orderAmount: 1000, percentDelta: -1 }).feeAmount, 40);
    assert.equal(computeCommission({ policy: pol, orderAmount: 1000, percentDelta: -10 }).feeAmount, 0);
    assert.equal(computeCommission({ policy: pol, orderAmount: 1000, percentDelta: 100 }).feeAmount, 1000); // 5+100 → 100%
  });
});

describe("computeCommission — bracket, fx, order_count", () => {
  it("bracket mode charges the whole order at the reached tier", () => {
    const r = computeCommission({ policy: { ...STANDARD, tierMode: "bracket", perOrder: {} }, periodBasisSoFar: 490000, orderAmount: 18000 });
    assert.equal(r.feeAmount, 630); // 18,000 × 3.5%
    assert.equal(r.tierIndex, 1);
  });
  it("converts a USD store into SDG thresholds and records the fee in USD", () => {
    // 1 USD = 600 SDG. 1,000 USD = 600,000 SDG → 500,000 at 5% + 100,000 at 3.5%
    const r = computeCommission({ policy: { ...STANDARD, precision: 2, perOrder: {} }, periodBasisSoFar: 0, orderAmount: 1000, fxRateToPolicyCurrency: 600 });
    assert.equal(r.feeAmount, 47.5); // (25,000 + 3,500) SDG / 600
    assert.equal(r.basisPolicyAmount, 600000);
    assert.equal(r.feePolicyAmount, 28500);
  });
  it("unknown FX uses tier 0 and flags fxMissing", () => {
    const r = computeCommission({ policy: { ...STANDARD, perOrder: {} }, periodBasisSoFar: 0, orderAmount: 1000, fxRateToPolicyCurrency: null });
    assert.equal(r.feeAmount, 50);
    assert.equal(r.fxMissing, true);
    assert.equal(r.basisPolicyAmount, null);
  });
  it("order_count basis tiers by ordinal", () => {
    const pol = { currency: "SDG", basis: "order_count", precision: 0, tiers: [{ upTo: 10, percent: 5 }, { upTo: null, percent: 2 }] };
    assert.equal(computeCommission({ policy: pol, periodBasisSoFar: 9, orderAmount: 1000 }).feeAmount, 50);
    assert.equal(computeCommission({ policy: pol, periodBasisSoFar: 10, orderAmount: 1000 }).feeAmount, 20);
  });
  it("rounding mode respected", () => {
    const pol = { currency: "SDG", precision: 0, rounding: "up", tiers: [{ upTo: null, percent: 3.33 }] };
    assert.equal(computeCommission({ policy: pol, orderAmount: 100 }).feeAmount, 4);
  });
});

describe("zero-basis orders (M1)", () => {
  it("never charge a minimum fee or fixed component on a zero order", () => {
    const pol = { ...STANDARD, tiers: [{ upTo: null, percent: 5, fixedPerOrder: 25 }] };
    assert.equal(computeCommission({ policy: pol, orderAmount: 0 }).feeAmount, 0);
    assert.equal(computeCommission({ policy: STANDARD, orderAmount: 0 }).feeAmount, 0);
  });
});

describe("computeReversal", () => {
  it("reverses proportionally and never beyond the remaining fee", () => {
    assert.equal(computeReversal({ commissionFee: 780, orderBasis: 18000, refundAmount: 9000 }), 390);
    assert.equal(computeReversal({ commissionFee: 780, orderBasis: 18000, refundAmount: 9000, alreadyReversed: 390 }), 390);
    assert.equal(computeReversal({ commissionFee: 780, orderBasis: 18000, refundAmount: 18000, alreadyReversed: 780 }), 0);
    assert.equal(computeReversal({ commissionFee: 780, orderBasis: 18000, refundAmount: 99999 }), 780);
  });
});
