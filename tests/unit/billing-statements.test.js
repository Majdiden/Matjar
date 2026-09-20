/**
 * Statement line building + plan family validation — pure.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildStatementLines } from "../../services/platform/billing/statements.js";
import { APIError } from "../../middlewares/errorHandler.js";
import { validatePlanFamily, planBaseFee, planFamilyOf, mergeOverrides } from "../../services/platform/billing/resolver.js";
import { fxMultiplier, sanitizeFxTable } from "../../services/platform/billing/fx.js";
import { aggregatePolicyBasis } from "../../services/platform/billing/ledger.js";

const END = new Date("2026-10-01T00:00:00Z");

describe("buildStatementLines", () => {
  it("subscription plan: base fee only", () => {
    const pricing = { planKey: "starter", planName: "Starter", family: "subscription", chargesBaseFee: true, baseFee: { amount: 4900, currency: "SDG", interval: "month" } };
    const r = buildStatementLines({ pricing, rows: [], periodEnd: END, baseFeeInStoreCurrency: 4900 });
    assert.equal(r.lines.length, 1);
    assert.equal(r.amountDue, 4900);
  });
  it("commission plan: sums commissions and reversals, applies adjustments and credits", () => {
    const pricing = { planKey: "pay-as-you-sell", family: "commission", chargesBaseFee: false, policyKey: "standard", baseFee: { amount: 0 } };
    const rows = [
      { type: "commission", feeAmount: 780 },
      { type: "commission", feeAmount: 120 },
      { type: "reversal", feeAmount: -390 },
      { type: "adjustment", feeAmount: 200, reason: "Late fee" },
      { type: "credit", feeAmount: -100, reason: "Goodwill" },
    ];
    const r = buildStatementLines({ pricing, rows, periodEnd: END, baseFeeInStoreCurrency: null });
    const commission = r.lines.find((l) => l.type === "commission");
    assert.equal(commission.amount, 510);
    assert.equal(r.subtotal, 710);
    assert.equal(r.credits, 100);
    assert.equal(r.amountDue, 610);
  });
  it("yearly base fee is billed as 1/12 and trial suppresses the base fee", () => {
    const pricing = { planKey: "pro", family: "subscription", chargesBaseFee: true, baseFee: { amount: 12000, currency: "SDG", interval: "year" }, trialEndsAt: null };
    assert.equal(buildStatementLines({ pricing, rows: [], periodEnd: END, baseFeeInStoreCurrency: 1000 }).amountDue, 1000);
    const trial = { ...pricing, trialEndsAt: new Date("2026-11-15T00:00:00Z") };
    assert.equal(buildStatementLines({ pricing: trial, rows: [], periodEnd: END, baseFeeInStoreCurrency: 1000 }).amountDue, 0);
  });
  it("amountDue never goes below zero", () => {
    const pricing = { family: "commission", chargesBaseFee: false, baseFee: { amount: 0 } };
    const r = buildStatementLines({ pricing, rows: [{ type: "credit", feeAmount: -500 }], periodEnd: END });
    assert.equal(r.amountDue, 0);
  });
});

describe("plan families", () => {
  it("commission needs a policy and zero fee", () => {
    assert.equal(validatePlanFamily({ family: "commission", baseFeeAmount: 0, commissionPolicyKey: "standard" }), "commission");
    assert.throws(() => validatePlanFamily({ family: "commission", baseFeeAmount: 0, commissionPolicyKey: null }));
    assert.throws(() => validatePlanFamily({ family: "commission", baseFeeAmount: 10, commissionPolicyKey: "standard" }));
  });
  it("subscription cannot carry a policy; hybrid needs both", () => {
    assert.equal(validatePlanFamily({ family: "subscription", baseFeeAmount: 50, commissionPolicyKey: null }), "subscription");
    assert.throws(() => validatePlanFamily({ family: "subscription", baseFeeAmount: 50, commissionPolicyKey: "standard" }));
    assert.equal(validatePlanFamily({ family: "hybrid", baseFeeAmount: 50, commissionPolicyKey: "standard" }), "hybrid");
    assert.throws(() => validatePlanFamily({ family: "hybrid", baseFeeAmount: 0, commissionPolicyKey: "standard" }));
  });
  it("legacy plan rows resolve to a subscription with the flat price", () => {
    const legacy = { key: "starter", price: 4900, currency: "SDG", interval: "month" };
    assert.equal(planFamilyOf(legacy), "subscription");
    assert.deepEqual(planBaseFee(legacy), { amount: 4900, currency: "SDG", interval: "month" });
  });
});

describe("platform FX table (H3)", () => {
  const table = { base: "SDG", rates: { USD: 1 / 600, EUR: 1 / 650 } };
  it("same currency → 1", () => assert.equal(fxMultiplier(table, "SDG", "SDG"), 1));
  it("USD → SDG uses the platform rate (1 USD = 600 SDG)", () => assert.equal(Math.round(fxMultiplier(table, "USD", "SDG")), 600));
  it("SDG → USD is the inverse", () => assert.equal(Math.round(1 / fxMultiplier(table, "SDG", "USD")), 600));
  it("cross rate through base", () => assert.equal(Math.round(fxMultiplier(table, "EUR", "USD") * 1000), Math.round((650 / 600) * 1000)));
  it("unknown → null", () => assert.equal(fxMultiplier(table, "GBP", "SDG"), null));
  it("sanitize rejects non-positive and bad codes", () => {
    assert.throws(() => sanitizeFxTable({ base: "SDG", rates: { USD: 0 } }), APIError);
    assert.throws(() => sanitizeFxTable({ base: "SDG", rates: { usdx: 1 } }), APIError);
    assert.deepEqual(sanitizeFxTable({ base: "sdg", rates: { usd: 0.002, SDG: 1 } }), { base: "SDG", rates: { USD: 0.002 } });
  });
});

describe("statement currency guard (H4)", () => {
  it("throws instead of emitting a foreign-currency base-fee line", () => {
    const pricing = { planKey: "starter", planName: "Starter", family: "subscription", chargesBaseFee: true, baseFee: { amount: 50, currency: "USD", interval: "month" } };
    assert.throws(() => buildStatementLines({ pricing, rows: [], periodEnd: END, baseFeeInStoreCurrency: null }), (e) => e instanceof APIError && e.statusCode === 422);
  });
  it("commission-only plans never need conversion", () => {
    const pricing = { family: "commission", chargesBaseFee: false, baseFee: { amount: 0 } };
    assert.equal(buildStatementLines({ pricing, rows: [{ type: "commission", feeAmount: 5 }], periodEnd: END, baseFeeInStoreCurrency: null }).amountDue, 5);
  });
  it("merchant-facing adjustment lines hide the operator reason (L4)", () => {
    const pricing = { family: "commission", chargesBaseFee: false, baseFee: { amount: 0 } };
    const r = buildStatementLines({ pricing, rows: [{ type: "credit", feeAmount: -5, reason: "ops: goodwill after outage #42" }], periodEnd: END });
    assert.equal(r.lines[0].description, "Credit applied by Matjar");
  });
});

describe("statement currency + period guards (N2/N4)", () => {
  const pricing = { family: "commission", chargesBaseFee: false, baseFee: { amount: 0 } };
  it("throws 422 when a ledger row is in another currency than the statement", () => {
    const rows = [
      { _id: "a", type: "commission", feeAmount: 5, feeCurrency: "SDG" },
      { _id: "b", type: "commission", feeAmount: 1, feeCurrency: "USD" },
    ];
    assert.throws(() => buildStatementLines({ pricing, rows, periodEnd: END, currency: "SDG" }), (e) => e instanceof APIError && e.statusCode === 422);
  });
  it("accepts rows in the statement currency (case-insensitive)", () => {
    const rows = [{ type: "commission", feeAmount: 5, feeCurrency: "sdg" }];
    assert.equal(buildStatementLines({ pricing, rows, periodEnd: END, currency: "SDG" }).amountDue, 5);
  });
  it("never bills a base fee for a period the tenant did not exist in", () => {
    const sub = { planKey: "starter", family: "subscription", chargesBaseFee: true, baseFee: { amount: 4900, currency: "SDG", interval: "month" } };
    const after = buildStatementLines({ pricing: sub, rows: [], periodEnd: END, baseFeeInStoreCurrency: 4900, currency: "SDG", tenantCreatedAt: new Date("2026-10-05T00:00:00Z") });
    assert.equal(after.lines.length, 0);
    const before = buildStatementLines({ pricing: sub, rows: [], periodEnd: END, baseFeeInStoreCurrency: 4900, currency: "SDG", tenantCreatedAt: new Date("2026-09-15T00:00:00Z") });
    assert.equal(before.amountDue, 4900);
  });
});

describe("FX base default (N8)", () => {
  it("keeps the stored base when the update omits it", () => {
    assert.equal(sanitizeFxTable({ rates: { USD: 0.002 } }, "EGP").base, "EGP");
    assert.equal(sanitizeFxTable({ base: "SDG", rates: {} }, "EGP").base, "SDG");
  });
});

describe("override merge (M6)", () => {
  it("newest non-null value per field wins across documents", () => {
    const newest = { _id: "b", commissionPolicyKey: "negotiated", feeHolidayUntil: null, percentDelta: null };
    const older = { _id: "a", commissionPolicyKey: null, feeHolidayUntil: "2026-12-31T00:00:00Z", percentDelta: -1 };
    const m = mergeOverrides([newest, older]);
    assert.equal(m.commissionPolicyKey, "negotiated");
    assert.equal(m.percentDelta, -1);
    assert.equal(m.feeHolidayUntil.toISOString(), "2026-12-31T00:00:00.000Z");
    assert.deepEqual(m.ids, ["b", "a"]);
  });
  it("empty → all null", () => assert.equal(mergeOverrides([]).commissionPolicyKey, null));
});

describe("ledger aggregation (H1)", () => {
  it("a commission and its full reversal net to zero basis and fee", () => {
    const rows = [
      { type: "commission", basisPolicyAmount: 18000, feePolicyAmount: 780, basisAmount: 18000, feeAmount: 780, fxRateToPolicyCurrency: 1 },
      { type: "reversal", basisPolicyAmount: -18000, feePolicyAmount: -780, basisAmount: -18000, feeAmount: -780, fxRateToPolicyCurrency: 1 },
    ];
    assert.deepEqual(aggregatePolicyBasis(rows), { basis: 0, fee: 0, count: 1 });
  });
  it("partial reversal reduces, and the store-currency fallback is signed correctly", () => {
    const rows = [
      { type: "commission", basisPolicyAmount: null, feePolicyAmount: null, basisAmount: 100, feeAmount: 5, fxRateToPolicyCurrency: 600 },
      { type: "reversal", basisPolicyAmount: null, feePolicyAmount: null, basisAmount: -40, feeAmount: -2, fxRateToPolicyCurrency: 600 },
    ];
    const a = aggregatePolicyBasis(rows);
    assert.equal(a.basis, 36000);
    assert.equal(a.fee, 1800);
  });
});
