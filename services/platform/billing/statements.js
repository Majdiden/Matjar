/**
 * Monthly billing statements.
 *
 *   buildStatementLines(...)   pure — unit-tested
 *   generateStatement(...)     idempotent per (tenant, period); see rules below
 *   issueStatement / recordPayment / waiveStatement / voidStatement
 *   markOverdue(...)           flips issued/partially_paid past due+grace to overdue
 *
 * generateStatement rules (M4):
 *   - no statement yet         → create draft
 *   - draft                    → rebuild lines
 *   - void                     → reset to draft (payments cleared) and rebuild
 *   - issued / overdue + force → recompute lines, keep status, recompute balance
 *   - paid / partially_paid    → 409 even with force (money already moved)
 *   - any non-draft without force → returned unchanged
 *
 * Currency (H4): every line is in the statement (store) currency. If the
 * base fee cannot be converted with the platform FX table, generation
 * throws — the tenant lands in the period run's errors[] and NO statement
 * is written. A statement never mixes currencies.
 */
import mongoose from "mongoose";
import { APIError } from "../../../middlewares/errorHandler.js";
import { resolveEffectivePricing } from "./resolver.js";
import { getBillingSettings } from "./settings.js";
import { getFxTable, fxMultiplier } from "./fx.js";
import { planKeyAt } from "./planChanges.js";
import { periodBounds, roundMoney, sumMoney, storeCurrencyOf } from "./money.js";

const Statement = () => mongoose.model("BillingStatement");
const FeeEvent = () => mongoose.model("PlatformFeeEvent");

/** Merchant-facing description for operator adjustments (L4). */
export function merchantLineDescription(row) {
  if (row.type === "credit") return "Credit applied by Matjar";
  if (row.type === "adjustment") return "Adjustment applied by Matjar";
  return row.reason || "";
}

/**
 * Pure: turn the resolved pricing + ledger rows for a period into statement
 * lines and totals. `baseFeeInStoreCurrency` must already be converted; pass
 * `null` when the plan charges a base fee that could not be converted — the
 * function throws (H4) rather than emitting a foreign-currency line.
 */
export function buildStatementLines({ pricing, rows, periodEnd, baseFeeInStoreCurrency, currency, tenantCreatedAt }) {
  const lines = [];
  // (N2) Every ledger row must already be in the statement currency.
  if (currency) {
    const foreign = rows.find((r) => r.feeCurrency && String(r.feeCurrency).toUpperCase() !== String(currency).toUpperCase());
    if (foreign) {
      throw new APIError(`Ledger row ${foreign._id || ""} is in ${foreign.feeCurrency} but the statement currency is ${currency}`, 422);
    }
  }
  // (N4) Never bill a base fee for a period the tenant did not exist in.
  const existedInPeriod = !tenantCreatedAt || new Date(tenantCreatedAt) < periodEnd;
  const chargesBase = existedInPeriod && pricing.chargesBaseFee && !(pricing.trialEndsAt && new Date(pricing.trialEndsAt) > periodEnd);
  if (chargesBase) {
    if (baseFeeInStoreCurrency == null) {
      throw new APIError(`Cannot convert the ${pricing.baseFee.currency} base fee into the statement currency: add a platform FX rate`, 422);
    }
    lines.push({
      type: "subscription",
      description: `${pricing.planName || pricing.planKey || "Plan"} base fee (${pricing.baseFee.interval === "year" ? "yearly, 1/12" : "monthly"})`,
      amount: roundMoney(baseFeeInStoreCurrency, 2),
      ref: `plan:${pricing.planKey}`,
    });
  }
  const commissionRows = rows.filter((r) => r.type === "commission" || r.type === "reversal");
  if (commissionRows.length) {
    const total = sumMoney(commissionRows.map((r) => r.feeAmount));
    const orders = commissionRows.filter((r) => r.type === "commission").length;
    lines.push({
      type: "commission",
      description: `Commission on ${orders} delivered order${orders === 1 ? "" : "s"}`,
      amount: roundMoney(total, 2),
      ref: pricing.policyKey ? `policy:${pricing.policyKey}` : null,
    });
  }
  for (const r of rows.filter((x) => x.type === "adjustment")) {
    lines.push({ type: "adjustment", description: merchantLineDescription(r), amount: roundMoney(r.feeAmount, 2), ref: String(r._id || "") });
  }
  for (const r of rows.filter((x) => x.type === "credit")) {
    lines.push({ type: "credit", description: merchantLineDescription(r), amount: roundMoney(r.feeAmount, 2), ref: String(r._id || "") });
  }
  const subtotal = roundMoney(sumMoney(lines.filter((l) => l.type !== "credit").map((l) => l.amount)), 2);
  const credits = roundMoney(Math.abs(sumMoney(lines.filter((l) => l.type === "credit").map((l) => l.amount))), 2);
  const amountDue = roundMoney(Math.max(0, subtotal - credits), 2);
  return { lines, subtotal, credits, amountDue };
}

/**
 * Resolve pricing as the tenant was configured at the END of the period
 * (H2): a plan change applied after the period boundary must not re-price
 * the closed period.
 */
async function pricingAsOf(tenant, periodEnd, settings) {
  const at = new Date(periodEnd.getTime() - 1);
  const planKey = await planKeyAt(tenant._id, at, tenant.subscriptionPlan);
  return resolveEffectivePricing({ ...tenant, subscriptionPlan: planKey }, { at, settings });
}

export async function generateStatement(tenantId, periodKey, { force = false, preloaded = {} } = {}) {
  const { start, end } = periodBounds(periodKey);
  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findById(tenantId).select("subscriptionPlan subscriptionStartDate settings name billing createdAt").lean();
  if (!tenant) throw new APIError("Tenant not found", 404);

  const existing = await Statement().findOne({ tenantId, periodKey });
  if (existing) {
    if (["paid", "partially_paid", "waived"].includes(existing.status)) {
      if (force) throw new APIError(`Statement is ${existing.status}; it cannot be regenerated`, 409);
      return { statement: existing.toObject(), created: false, regenerated: false };
    }
    if (existing.status !== "draft" && existing.status !== "void" && !force) {
      return { statement: existing.toObject(), created: false, regenerated: false };
    }
  }

  const settings = preloaded.settings || (await getBillingSettings());
  const fxTable = preloaded.fxTable || (await getFxTable());
  const pricing = await pricingAsOf(tenant, end, settings);
  const rows = await FeeEvent().find({ tenantId, periodKey }).lean();
  const storeCurrency = storeCurrencyOf(tenant); // (N2) never inferred from a row

  let baseFeeInStoreCurrency = null;
  if (pricing.chargesBaseFee) {
    const monthly = pricing.baseFee.interval === "year" ? pricing.baseFee.amount / 12 : pricing.baseFee.amount;
    const fx = fxMultiplier(fxTable, pricing.baseFee.currency, storeCurrency);
    baseFeeInStoreCurrency = fx == null ? null : monthly * fx;
  }

  const totals = buildStatementLines({ pricing, rows, periodEnd: end, baseFeeInStoreCurrency, currency: storeCurrency, tenantCreatedAt: tenant.createdAt });
  // (N12) Nothing to bill and nothing on file → do not persist an empty draft.
  if (!existing && totals.lines.length === 0) {
    return { statement: null, created: false, regenerated: false, empty: true };
  }
  const doc = {
    tenantId,
    periodKey,
    periodStart: start,
    periodEnd: end,
    currency: storeCurrency,
    planKey: pricing.planKey,
    planFamily: pricing.family,
    lines: totals.lines,
    subtotal: totals.subtotal,
    credits: totals.credits,
    amountDue: totals.amountDue,
  };

  if (existing) {
    if (existing.status === "void") {
      existing.set({ ...doc, status: "draft", payments: [], amountPaid: 0, issuedAt: null, dueAt: null, paidAt: null, note: null });
    } else {
      existing.set(doc); // draft, or issued/overdue with force (status kept)
    }
    existing.balance = roundMoney(existing.amountDue - (existing.amountPaid || 0), 2);
    await existing.save();
    return { statement: existing.toObject(), created: false, regenerated: true };
  }
  const created = await Statement().create({ ...doc, amountPaid: 0, balance: totals.amountDue, status: "draft" });
  return { statement: created.toObject(), created: true, regenerated: false };
}

export async function getStatement(id) {
  const s = await Statement().findById(id);
  if (!s) throw new APIError("Statement not found", 404);
  return s;
}

export async function issueStatement(id, { settings } = {}) {
  const s = await getStatement(id);
  if (s.status !== "draft") throw new APIError(`Statement is ${s.status}; only drafts can be issued`, 409);
  const cfg = settings || (await getBillingSettings());
  const now = new Date();
  s.status = "issued";
  s.issuedAt = now;
  s.dueAt = new Date(now.getTime() + cfg.dueDays * 86400000);
  s.balance = roundMoney(s.amountDue - (s.amountPaid || 0), 2);
  if (s.amountDue === 0) {
    s.status = "paid";
    s.paidAt = now;
  }
  await s.save();
  await FeeEvent().updateMany({ tenantId: s.tenantId, periodKey: s.periodKey, statementId: null }, { $set: { statementId: s._id } });
  return s;
}

export async function recordPayment(id, { amount, method, reference, note, recordedBy }) {
  const s = await getStatement(id);
  if (!["issued", "partially_paid", "overdue"].includes(s.status)) {
    throw new APIError(`Cannot record a payment on a ${s.status} statement`, 409);
  }
  const n = roundMoney(amount, 2);
  if (!(n > 0)) throw new APIError("amount must be greater than 0", 400);
  if (n > roundMoney(s.balance + 0.005, 2)) throw new APIError(`amount exceeds the outstanding balance (${s.balance})`, 400);
  s.payments.push({ amount: n, method, reference: reference || null, note: note || null, recordedBy, recordedAt: new Date() });
  s.amountPaid = roundMoney((s.amountPaid || 0) + n, 2);
  s.balance = roundMoney(s.amountDue - s.amountPaid, 2);
  if (s.balance <= 0) {
    s.status = "paid";
    s.paidAt = new Date();
    s.balance = 0;
  } else {
    s.status = "partially_paid";
  }
  await s.save();
  return s;
}

export async function waiveStatement(id, { reason }) {
  const s = await getStatement(id);
  if (!["issued", "partially_paid", "overdue"].includes(s.status)) {
    throw new APIError(`Cannot waive a ${s.status} statement`, 409);
  }
  s.status = "waived";
  s.balance = 0;
  s.note = reason;
  await s.save();
  return s;
}

export async function voidStatement(id, { reason }) {
  const s = await getStatement(id);
  if (["paid", "void"].includes(s.status)) throw new APIError(`Cannot void a ${s.status} statement`, 409);
  if ((s.amountPaid || 0) > 0) throw new APIError("Cannot void a statement with recorded payments; waive it instead", 409);
  s.status = "void";
  s.balance = 0;
  s.note = reason;
  await s.save();
  await FeeEvent().updateMany({ statementId: s._id }, { $set: { statementId: null } });
  return s;
}

/** Flip past-due statements to overdue. Returns the count changed. */
export async function markOverdue(now = new Date()) {
  const settings = await getBillingSettings();
  const cutoff = new Date(now.getTime() - settings.graceDays * 86400000);
  const res = await Statement().updateMany(
    { status: { $in: ["issued", "partially_paid"] }, dueAt: { $lt: cutoff }, balance: { $gt: 0 } },
    { $set: { status: "overdue", updatedAt: now } }
  );
  return res.modifiedCount || 0;
}

export async function listStatements({ tenantId, status, periodKey, page = 1, limit = 25 } = {}) {
  const filter = {};
  if (tenantId) filter.tenantId = tenantId;
  if (status) filter.status = status;
  if (periodKey) filter.periodKey = periodKey;
  const skip = (Math.max(1, page) - 1) * limit;
  const [rows, total] = await Promise.all([
    Statement().find(filter).sort({ periodKey: -1, createdAt: -1 }).skip(skip).limit(limit).populate("tenantId", "name slug email").lean(),
    Statement().countDocuments(filter),
  ]);
  return { rows, total, page: Math.max(1, page), pages: Math.max(1, Math.ceil(total / limit)) };
}
