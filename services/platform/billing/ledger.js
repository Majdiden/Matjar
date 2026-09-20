/**
 * Platform fee ledger — append-only writes.
 *
 *   recognizeDelivered(payload)  ORDER_DELIVERED → one `commission` row per order
 *   reverseForRefund(payload)    ORDER_REFUNDED  → proportional `reversal` row(s)
 *   addAdjustment(...)           operator charge/credit
 *   periodSummary(...)           basis + fee totals used for tiers/caps/statements
 *
 * Rows are never updated except to stamp `statementId` when a statement is
 * issued. Corrections are new rows.
 */
import mongoose from "mongoose";
import logger from "../../../utils/logger.js";
import { APIError } from "../../../middlewares/errorHandler.js";
import { computeCommission, computeReversal } from "./calculator.js";
import { resolveEffectivePricing } from "./resolver.js";
import { getFxTable, fxMultiplier } from "./fx.js";
import { getBillingSettings } from "./settings.js";
import { periodKeyFor, periodBounds, sumMoney, storeCurrencyOf } from "./money.js";

const FeeEvent = () => mongoose.model("PlatformFeeEvent");

function methodAllowed(policy, payload) {
  const allowed = policy?.paymentMethods;
  if (!allowed || allowed === "all") return true;
  if (!Array.isArray(allowed)) return true;
  const codes = allowed.map((c) => String(c).toLowerCase());
  const candidates = [payload.paymentMethodCode, payload.paymentMethod].filter(Boolean).map((c) => String(c).toLowerCase());
  return candidates.some((c) => codes.includes(c));
}

/** Period window filter for tier lookups according to the policy period. */
function periodFilter(policy, occurredAt) {
  const at = new Date(occurredAt);
  if (policy?.period === "lifetime") return {};
  if (policy?.period === "rolling_30d") return { occurredAt: { $gte: new Date(at.getTime() - 30 * 86400000), $lt: at } };
  return { periodKey: periodKeyFor(at) };
}

/**
 * Basis + fee recognised so far (policy currency) for the window the policy
 * tiers are measured over. Reversals reduce both.
 */
export async function periodBasisSoFar(tenantId, policy, occurredAt) {
  const rows = await FeeEvent()
    .find({ tenantId, type: { $in: ["commission", "reversal"] }, ...periodFilter(policy, occurredAt) })
    .select("type basisPolicyAmount feePolicyAmount basisAmount feeAmount fxRateToPolicyCurrency")
    .lean();
  return aggregatePolicyBasis(rows);
}

/**
 * Pure (H1): sum policy-currency basis + fee over ledger rows. Stored
 * policy amounts are ALREADY signed (negative on reversals), so they are
 * summed as-is; the store-currency fallback applies the sign explicitly to
 * the absolute amount.
 */
export function aggregatePolicyBasis(rows) {
  let basis = 0;
  let fee = 0;
  let count = 0;
  for (const r of rows) {
    const sign = r.type === "reversal" ? -1 : 1;
    if (r.type === "commission") count += 1;
    const fx = r.fxRateToPolicyCurrency;
    const b = r.basisPolicyAmount != null ? r.basisPolicyAmount : fx ? sign * Math.abs(r.basisAmount || 0) * fx : 0;
    const f = r.feePolicyAmount != null ? r.feePolicyAmount : fx ? sign * Math.abs(r.feeAmount || 0) * fx : 0;
    basis += b || 0;
    fee += f || 0;
  }
  return { basis: Math.max(0, basis), fee: Math.max(0, fee), count };
}

/**
 * Recognise commission for a delivered order. Idempotent: the unique index
 * on (tenantId, orderId) for `commission` rows turns a replay into
 * `{ skipped: "already-recognised" }`.
 */
export async function recognizeDelivered(payload) {
  const tenantId = new mongoose.Types.ObjectId(String(payload.tenantId));
  const orderId = new mongoose.Types.ObjectId(String(payload.orderId));
  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findById(tenantId).select("subscriptionPlan subscriptionStartDate settings billing").lean();
  if (!tenant) return { skipped: "no-tenant" };

  const occurredAt = payload.deliveredAt ? new Date(payload.deliveredAt) : new Date();
  const settings = await getBillingSettings();
  const pricing = await resolveEffectivePricing(tenant, { at: occurredAt, settings });
  if (!pricing.chargesCommission) return { skipped: "no-commission" };
  const policy = pricing.policy;
  if (pricing.policyFallback) {
    logger.error("billing: plan references an inactive/missing policy; using platform default", {
      tenantId: String(tenantId), planKey: pricing.planKey, wanted: pricing.policyFallback.wanted, used: policy.key,
    });
  }
  if (!methodAllowed(policy, payload)) return { skipped: "payment-method-excluded" };

  // (N2) Always the store's billing currency — an order presented in another
  // currency is still recorded in base (order.baseCurrency == store base).
  const storeCurrency = storeCurrencyOf(tenant);
  const orderAmount = Math.max(0, (Number(payload.totalAmount) || 0) - (Number(payload.refundedAmount) || 0));
  if (orderAmount <= 0) return { skipped: "zero-basis" };
  // Platform-owned reference FX only (H3) — merchant rates never price the platform.
  const fx = fxMultiplier(await getFxTable(), storeCurrency, policy.currency);

  const base = {
    tenantId,
    orderId,
    orderNumber: payload.orderNumber || null,
    paymentMethod: payload.paymentMethodCode || payload.paymentMethod || null,
    basisAmount: orderAmount,
    basisCurrency: storeCurrency,
    fxRateToPolicyCurrency: fx,
    feeCurrency: storeCurrency,
    policyKey: policy.key,
    planKey: pricing.planKey,
    recognitionEvent: "delivered",
    pricingSource: pricing.source.commission,
    occurredAt,
    periodKey: periodKeyFor(occurredAt),
    source: "system",
  };

  let doc;
  if (pricing.inFeeHoliday) {
    doc = { ...base, type: "commission", feeAmount: 0, basisPolicyAmount: fx ? orderAmount * fx : null, feePolicyAmount: fx ? 0 : null, tierIndex: null, percentApplied: 0, metadata: { feeHoliday: true, feeHolidayUntil: pricing.feeHolidayUntil } };
  } else {
    const sofar = await periodBasisSoFar(tenantId, policy, occurredAt);
    const calc = computeCommission({
      policy,
      periodBasisSoFar: policy.basis === "order_count" ? sofar.count : sofar.basis,
      periodFeeSoFar: sofar.fee,
      orderAmount,
      fxRateToPolicyCurrency: fx,
      percentDelta: pricing.percentDelta,
    });
    doc = {
      ...base,
      type: "commission",
      feeAmount: calc.feeAmount,
      basisPolicyAmount: calc.basisPolicyAmount,
      feePolicyAmount: calc.feePolicyAmount,
      tierIndex: calc.tierIndex,
      percentApplied: calc.percentApplied,
      metadata: {
        ...(calc.fxMissing ? { fxMissing: true } : {}),
        ...(calc.capped ? { capped: true } : {}),
        breakdown: calc.breakdown,
        percentDelta: pricing.percentDelta || 0,
      },
    };
  }

  try {
    const row = await FeeEvent().create(doc);
    logger.info("billing: commission recognised", { tenantId: String(tenantId), orderId: String(orderId), fee: row.feeAmount, currency: row.feeCurrency });
    return { recognised: true, eventId: String(row._id), feeAmount: row.feeAmount };
  } catch (err) {
    if (err?.code === 11000) return { skipped: "already-recognised" };
    throw err;
  }
}

/** Reverse commission proportionally to a refund. Multiple partial refunds stack. */
export async function reverseForRefund(payload) {
  const tenantId = new mongoose.Types.ObjectId(String(payload.tenantId));
  const orderId = new mongoose.Types.ObjectId(String(payload.orderId));
  const commission = await FeeEvent().findOne({ tenantId, orderId, type: "commission" }).lean();
  if (!commission || !(commission.feeAmount > 0)) return { skipped: "no-commission" };

  const prior = await FeeEvent().find({ tenantId, orderId, type: "reversal" }).select("feeAmount basisAmount").lean();
  const alreadyReversed = sumMoney(prior.map((r) => Math.abs(r.feeAmount)));
  const basisAlreadyReversed = sumMoney(prior.map((r) => Math.abs(r.basisAmount || 0)));
  // L2: never reverse more basis than remains on the order.
  const remainingBasis = Math.max(0, (commission.basisAmount || 0) - basisAlreadyReversed);
  const reversedBasis = Math.min(Math.max(0, Number(payload.refundAmount) || 0), remainingBasis);
  const policy = commission.policyKey ? await mongoose.model("CommissionPolicy").findOne({ key: commission.policyKey }).select("precision rounding").lean() : null;
  const amount = computeReversal({
    commissionFee: commission.feeAmount,
    orderBasis: commission.basisAmount,
    refundAmount: payload.refundAmount,
    alreadyReversed,
    precision: policy?.precision ?? 0,
    rounding: policy?.rounding || "nearest",
  });
  if (amount <= 0) return { skipped: "nothing-to-reverse" };

  const occurredAt = payload.refundedAt ? new Date(payload.refundedAt) : new Date();
  const fx = commission.fxRateToPolicyCurrency || null;
  const row = await FeeEvent().create({
    tenantId,
    orderId,
    orderNumber: commission.orderNumber,
    paymentMethod: commission.paymentMethod,
    type: "reversal",
    basisAmount: -reversedBasis,
    basisCurrency: commission.basisCurrency,
    fxRateToPolicyCurrency: fx,
    basisPolicyAmount: fx ? -reversedBasis * fx : null,
    feePolicyAmount: fx ? -amount * fx : null,
    feeAmount: -amount,
    feeCurrency: commission.feeCurrency,
    policyKey: commission.policyKey,
    planKey: commission.planKey,
    recognitionEvent: "refund",
    pricingSource: commission.pricingSource,
    occurredAt,
    periodKey: periodKeyFor(occurredAt),
    source: "system",
    reversesEventId: commission._id,
    metadata: { refundAmount: payload.refundAmount },
  });
  logger.info("billing: commission reversed", { tenantId: String(tenantId), orderId: String(orderId), amount });
  return { reversed: true, eventId: String(row._id), feeAmount: row.feeAmount };
}

/** Operator adjustment: positive = charge, negative = credit. */
export async function addAdjustment({ tenantId, amount, reason, createdBy, periodKey, currency }) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n === 0) throw new Error("amount must be a non-zero number");
  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findById(tenantId).select("settings").lean();
  if (!tenant) throw new APIError("Tenant not found", 404);
  const now = new Date();
  const key = periodKey || periodKeyFor(now);
  periodBounds(key); // validates
  // M5: a period whose statement is already issued is closed to new rows.
  const issued = await mongoose
    .model("BillingStatement")
    .exists({ tenantId, periodKey: key, status: { $nin: ["draft", "void"] } });
  if (issued) {
    throw new APIError(`Period ${key} already has an issued statement; post the adjustment to the current period`, 409);
  }
  const row = await FeeEvent().create({
    tenantId,
    type: n > 0 ? "adjustment" : "credit",
    feeAmount: n,
    // (N2) Adjustments are always in the store's billing currency; a
    // different `currency` argument is rejected rather than mixed in.
    feeCurrency: (() => {
      const store = storeCurrencyOf(tenant);
      if (currency && String(currency).toUpperCase() !== store) {
        throw new APIError(`Adjustments must be in the store currency (${store})`, 400);
      }
      return store;
    })(),
    occurredAt: now,
    periodKey: key,
    source: "operator",
    createdBy,
    reason,
  });
  return row.toObject();
}

/** Ledger rows for one tenant, optionally one period. */
export async function listLedger(tenantId, { periodKey, page = 1, limit = 50 } = {}) {
  const filter = { tenantId };
  if (periodKey) {
    periodBounds(periodKey);
    filter.periodKey = periodKey;
  }
  const skip = (Math.max(1, page) - 1) * limit;
  const [rows, total] = await Promise.all([
    FeeEvent().find(filter).sort({ occurredAt: -1 }).skip(skip).limit(limit).lean(),
    FeeEvent().countDocuments(filter),
  ]);
  return { rows, total, page: Math.max(1, page), pages: Math.max(1, Math.ceil(total / limit)) };
}

/** Totals for a tenant + period (store currency). */
export async function periodTotals(tenantId, periodKey) {
  periodBounds(periodKey);
  const rows = await FeeEvent().find({ tenantId, periodKey }).select("type feeAmount basisAmount feeCurrency").lean();
  const out = { gmv: 0, commission: 0, adjustments: 0, credits: 0, currency: rows[0]?.feeCurrency || null, count: rows.length };
  out.gmv = sumMoney(rows.filter((r) => r.type === "commission" || r.type === "reversal").map((r) => r.basisAmount || 0));
  out.commission = sumMoney(rows.filter((r) => r.type === "commission" || r.type === "reversal").map((r) => r.feeAmount));
  out.adjustments = sumMoney(rows.filter((r) => r.type === "adjustment").map((r) => r.feeAmount));
  out.credits = Math.abs(sumMoney(rows.filter((r) => r.type === "credit").map((r) => r.feeAmount)));
  return out;
}
