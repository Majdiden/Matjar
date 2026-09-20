/**
 * Platform billing controllers: commission policies, pricing overrides,
 * billing settings, fee ledger, statements, plan changes, period run.
 *
 * Every write records a platform audit row (services/platform/audit.js).
 * Ledger + statements are append-only from the API: there are no update or
 * delete handlers; corrections are new rows / new status transitions.
 */
import mongoose from "mongoose";
import { asyncHandler, APIError } from "../../middlewares/errorHandler.js";
import logger from "../../utils/logger.js";
import { scheduleBillingPeriodCron } from "../../services/jobs/index.js";
import { recordPlatformAudit } from "../../services/platform/audit.js";
import {
  normalizeTiers,
  computeCommission,
  resolveEffectivePricing,
  getBillingSettings,
  setBillingSettings,
  listLedger,
  addAdjustment,
  periodTotals,
  generateStatement,
  getStatement,
  issueStatement,
  recordPayment,
  waiveStatement,
  voidStatement,
  listStatements,
  markOverdue,
  schedulePlanChange,
  cancelScheduledChange,
  applyDueChanges,
  listPlanChanges,
  periodKeyFor,
  previousPeriodKey,
  getFxTable,
  setFxTable,
} from "../../services/platform/billing/index.js";

const CommissionPolicy = () => mongoose.model("CommissionPolicy");
const PricingOverride = () => mongoose.model("PricingOverride");
const SubscriptionPlan = () => mongoose.model("SubscriptionPlan");
const Tenant = () => mongoose.model("Tenant");

const actorId = (req) => (req.platformUser?.id ? new mongoose.Types.ObjectId(req.platformUser.id) : null);

async function requireTenant(tenantId) {
  const t = await Tenant().findById(tenantId).select("name slug subscriptionPlan subscriptionStartDate settings billing createdAt").lean();
  if (!t) throw new APIError("Tenant not found", 404);
  return t;
}

// --- Settings ----------------------------------------------------------

export const getSettings = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await getBillingSettings() });
});

export const updateSettings = asyncHandler(async (req, res) => {
  const { before, after } = await setBillingSettings(req.body, req.platformUser?.id);
  await recordPlatformAudit(req, { action: "billing.settings.update", resourceType: "BillingSettings", resourceId: "billing", before, after });
  // (N9) The period-close cron follows statementDay. Re-register on change;
  // best-effort (the worker also re-registers at boot from settings).
  if (before.statementDay !== after.statementDay) {
    scheduleBillingPeriodCron({ day: after.statementDay, source: "settings-update" }).catch((err) =>
      logger.warn("billing: could not reschedule period cron", { error: err?.message })
    );
  }
  res.json({ success: true, data: after });
});

// --- Platform FX reference table (H3) -----------------------------------

export const getFx = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await getFxTable() });
});

export const updateFx = asyncHandler(async (req, res) => {
  const { before, after } = await setFxTable(req.body, req.platformUser?.id);
  await recordPlatformAudit(req, { action: "billing.fx.update", resourceType: "PlatformFx", resourceId: "fx", before, after });
  res.json({ success: true, data: after });
});

// --- Commission policies -----------------------------------------------

export const listPolicies = asyncHandler(async (_req, res) => {
  const rows = await CommissionPolicy().find({}).sort({ name: 1 }).lean();
  res.json({ success: true, data: rows });
});

export const createPolicy = asyncHandler(async (req, res) => {
  const body = req.body;
  try {
    normalizeTiers(body.tiers);
  } catch (err) {
    throw new APIError(err.message, 400);
  }
  if (await CommissionPolicy().exists({ key: body.key })) {
    throw new APIError(`A policy with key "${body.key}" already exists`, 409);
  }
  const row = await CommissionPolicy().create(body);
  await recordPlatformAudit(req, { action: "billing.policy.create", resourceType: "CommissionPolicy", resourceId: row._id, after: row.toObject() });
  res.status(201).json({ success: true, data: row });
});

/** Where is this policy referenced? Shared by delete + deactivate (M2). */
async function policyReferences(policyKey) {
  const [plans, overrides, settings] = await Promise.all([
    SubscriptionPlan().countDocuments({ "pricing.commissionPolicyKey": policyKey, isActive: true }),
    PricingOverride().countDocuments({ commissionPolicyKey: policyKey, revokedAt: null }),
    getBillingSettings(),
  ]);
  const isDefault = settings.defaultCommissionPolicyKey === policyKey;
  return { plans, overrides, isDefault, inUse: plans > 0 || overrides > 0 || isDefault };
}

function referencesMessage(key, refs, verb) {
  return `Policy "${key}" is in use (${refs.plans} active plan(s), ${refs.overrides} override(s)${refs.isDefault ? ", platform default" : ""}). Move those references before you ${verb} it.`;
}

export const updatePolicy = asyncHandler(async (req, res) => {
  const row = await CommissionPolicy().findById(req.params.id);
  if (!row) throw new APIError("Policy not found", 404);
  const before = row.toObject();
  const { key: _ignored, ...patch } = req.body; // key is immutable
  if (patch.isActive === false && row.isActive) {
    const refs = await policyReferences(row.key);
    if (refs.inUse) throw new APIError(referencesMessage(row.key, refs, "deactivate"), 409);
  }
  if (patch.tiers) {
    try {
      normalizeTiers(patch.tiers);
    } catch (err) {
      throw new APIError(err.message, 400);
    }
  }
  row.set(patch);
  await row.save();
  await recordPlatformAudit(req, { action: "billing.policy.update", resourceType: "CommissionPolicy", resourceId: row._id, before, after: row.toObject() });
  res.json({ success: true, data: row });
});

export const deletePolicy = asyncHandler(async (req, res) => {
  const row = await CommissionPolicy().findById(req.params.id);
  if (!row) throw new APIError("Policy not found", 404);
  const anyPlans = await SubscriptionPlan().countDocuments({ "pricing.commissionPolicyKey": row.key });
  const refs = await policyReferences(row.key);
  if (refs.inUse || anyPlans > 0) {
    throw new APIError(referencesMessage(row.key, { ...refs, plans: anyPlans }, "delete"), 409);
  }
  await row.deleteOne();
  await recordPlatformAudit(req, { action: "billing.policy.delete", resourceType: "CommissionPolicy", resourceId: row._id, before: row.toObject() });
  res.json({ success: true, data: { id: String(row._id) } });
});

/** Preview: what would a policy charge at a given period basis + order amount. */
export const previewPolicy = asyncHandler(async (req, res) => {
  const { policy, periodBasisSoFar = 0, periodFeeSoFar = 0, orderAmount = 0, fxRateToPolicyCurrency = 1, percentDelta = 0 } = req.body || {};
  let def = policy;
  if (typeof policy === "string") {
    def = await CommissionPolicy().findOne({ key: policy.toLowerCase() }).lean();
    if (!def) throw new APIError("Policy not found", 404);
  }
  try {
    normalizeTiers(def?.tiers);
  } catch (err) {
    throw new APIError(err.message, 400);
  }
  const result = computeCommission({
    policy: def,
    periodBasisSoFar: Number(periodBasisSoFar) || 0,
    periodFeeSoFar: Number(periodFeeSoFar) || 0,
    orderAmount: Number(orderAmount) || 0,
    fxRateToPolicyCurrency: fxRateToPolicyCurrency == null ? null : Number(fxRateToPolicyCurrency),
    percentDelta: Number(percentDelta) || 0,
  });
  res.json({ success: true, data: result });
});

// --- Effective pricing + overrides ------------------------------------

export const getEffective = asyncHandler(async (req, res) => {
  const tenant = await requireTenant(req.params.tenantId);
  const settings = await getBillingSettings();
  const pricing = await resolveEffectivePricing(tenant, { settings });
  const period = periodKeyFor();
  const totals = await periodTotals(tenant._id, period);
  const overrides = await PricingOverride().find({ scope: "tenant", scopeId: tenant._id }).sort({ createdAt: -1 }).limit(20).lean();
  const changes = await listPlanChanges(tenant._id, 10);
  res.json({ success: true, data: { pricing, currentPeriod: { periodKey: period, ...totals }, overrides, planChanges: changes } });
});

export const createOverride = asyncHandler(async (req, res) => {
  const tenant = await requireTenant(req.params.tenantId);
  const b = req.body;
  if (b.commissionPolicyKey) {
    const ok = await CommissionPolicy().exists({ key: b.commissionPolicyKey, isActive: true });
    if (!ok) throw new APIError("commissionPolicyKey must reference an active policy", 400);
  }
  const row = await PricingOverride().create({
    scope: "tenant",
    scopeId: tenant._id,
    baseFee: b.baseFee
      ? { amount: b.baseFee.amount, currency: b.baseFee.currency || null, interval: b.baseFee.interval || null }
      : { amount: null, currency: null, interval: null },
    commissionPolicyKey: b.commissionPolicyKey || null,
    percentDelta: b.percentDelta ?? null,
    feeHolidayUntil: b.feeHolidayUntil ? new Date(b.feeHolidayUntil) : null,
    startsAt: b.startsAt ? new Date(b.startsAt) : new Date(),
    endsAt: b.endsAt ? new Date(b.endsAt) : null,
    reason: b.reason,
    createdBy: actorId(req),
  });
  await recordPlatformAudit(req, { action: "billing.override.create", resourceType: "PricingOverride", resourceId: row._id, tenantId: tenant._id, reason: b.reason, after: row.toObject() });
  res.status(201).json({ success: true, data: row });
});

export const revokeOverride = asyncHandler(async (req, res) => {
  const row = await PricingOverride().findOne({ _id: req.params.id, scope: "tenant", scopeId: req.params.tenantId });
  if (!row) throw new APIError("Override not found", 404);
  if (row.revokedAt) throw new APIError("Override already revoked", 409);
  const before = row.toObject();
  row.revokedAt = new Date();
  row.revokedBy = actorId(req);
  await row.save();
  await recordPlatformAudit(req, { action: "billing.override.revoke", resourceType: "PricingOverride", resourceId: row._id, tenantId: row.scopeId, reason: req.body.reason, before, after: row.toObject() });
  res.json({ success: true, data: row });
});

// --- Ledger --------------------------------------------------------------

export const getLedger = asyncHandler(async (req, res) => {
  await requireTenant(req.params.tenantId);
  const { periodKey, page = 1, limit = 50 } = req.query;
  const data = await listLedger(new mongoose.Types.ObjectId(req.params.tenantId), { periodKey, page: Number(page), limit: Number(limit) });
  res.json({ success: true, data });
});

export const createAdjustment = asyncHandler(async (req, res) => {
  const tenant = await requireTenant(req.params.tenantId);
  const row = await addAdjustment({
    tenantId: tenant._id,
    amount: req.body.amount,
    reason: req.body.reason,
    periodKey: req.body.periodKey,
    createdBy: actorId(req),
  });
  await recordPlatformAudit(req, { action: "billing.adjustment.create", resourceType: "PlatformFeeEvent", resourceId: row._id, tenantId: tenant._id, reason: req.body.reason, after: row });
  res.status(201).json({ success: true, data: row });
});

// --- Statements ----------------------------------------------------------

export const listAllStatements = asyncHandler(async (req, res) => {
  const { status, tenantId, periodKey, page = 1, limit = 25 } = req.query;
  const data = await listStatements({ status, tenantId, periodKey, page: Number(page), limit: Number(limit) });
  res.json({ success: true, data });
});

export const listTenantStatements = asyncHandler(async (req, res) => {
  await requireTenant(req.params.tenantId);
  const data = await listStatements({ tenantId: req.params.tenantId, page: 1, limit: 60 });
  res.json({ success: true, data });
});

export const generateTenantStatement = asyncHandler(async (req, res) => {
  const tenant = await requireTenant(req.params.tenantId);
  const result = await generateStatement(tenant._id, req.body.periodKey, { force: !!req.body.force });
  if (result.empty) {
    return res.json({ success: true, data: result, message: "Nothing to bill for this period; no statement created" });
  }
  await recordPlatformAudit(req, {
    action: "billing.statement.generate",
    resourceType: "BillingStatement",
    resourceId: result.statement._id,
    tenantId: tenant._id,
    metadata: { periodKey: req.body.periodKey, created: result.created, regenerated: result.regenerated },
  });
  res.status(result.created ? 201 : 200).json({ success: true, data: result });
});

export const getOneStatement = asyncHandler(async (req, res) => {
  const s = await getStatement(req.params.id);
  res.json({ success: true, data: s });
});

const statementAction = (action, fn) =>
  asyncHandler(async (req, res) => {
    const before = (await getStatement(req.params.id)).toObject();
    const s = await fn(req);
    await recordPlatformAudit(req, {
      action,
      resourceType: "BillingStatement",
      resourceId: s._id,
      tenantId: s.tenantId,
      reason: req.body?.reason || null,
      before: { status: before.status, balance: before.balance, amountPaid: before.amountPaid },
      after: { status: s.status, balance: s.balance, amountPaid: s.amountPaid },
      metadata: req.body?.amount ? { amount: req.body.amount, method: req.body.method, reference: req.body.reference } : null,
    });
    res.json({ success: true, data: s });
  });

export const issueOneStatement = statementAction("billing.statement.issue", (req) => issueStatement(req.params.id));
export const payStatement = statementAction("billing.statement.record_payment", (req) =>
  recordPayment(req.params.id, { ...req.body, recordedBy: actorId(req) })
);
export const waiveOneStatement = statementAction("billing.statement.waive", (req) => waiveStatement(req.params.id, req.body));
export const voidOneStatement = statementAction("billing.statement.void", (req) => voidStatement(req.params.id, req.body));

// --- Plan changes ----------------------------------------------------------

export const operatorPlanChange = asyncHandler(async (req, res) => {
  const tenant = await requireTenant(req.params.tenantId);
  const result = await schedulePlanChange({
    tenantId: tenant._id,
    toPlan: req.body.toPlan,
    effectiveAt: req.body.effectiveAt || "next_period",
    requestedBy: "operator",
    requestedById: actorId(req),
    reason: req.body.reason || null,
  });
  await recordPlatformAudit(req, {
    action: "plan.change",
    resourceType: "Tenant",
    resourceId: tenant._id,
    tenantId: tenant._id,
    reason: req.body.reason || null,
    before: { plan: tenant.subscriptionPlan },
    after: { plan: req.body.toPlan, effectiveAt: result.change.effectiveAt, applied: result.applied },
  });
  res.json({ success: true, data: result });
});

export const cancelPlanChange = asyncHandler(async (req, res) => {
  const tenant = await requireTenant(req.params.tenantId);
  const n = await cancelScheduledChange(tenant._id);
  await recordPlatformAudit(req, { action: "plan.change.cancel", resourceType: "Tenant", resourceId: tenant._id, tenantId: tenant._id, metadata: { cancelled: n } });
  res.json({ success: true, data: { cancelled: n } });
});

// --- Period run ------------------------------------------------------------

/**
 * Close a period: apply due plan changes, generate + issue statements for
 * every active tenant for `periodKey` (default: previous month), flip
 * overdue statements. Same routine the monthly cron runs.
 */
export async function runBillingPeriod(periodKey) {
  const lastClosed = previousPeriodKey(periodKeyFor());
  const key = periodKey || lastClosed;
  // (N4) Only closed periods can be run, and never before the platform
  // started billing. The start period is recorded on the first run.
  if (key > lastClosed) throw new APIError(`Period ${key} is not closed yet (latest closed period: ${lastClosed})`, 400);
  let settings = await getBillingSettings();
  if (!settings.billingStartPeriod) {
    await setBillingSettings({ billingStartPeriod: key }, null);
    settings = await getBillingSettings();
  }
  if (key < settings.billingStartPeriod) {
    throw new APIError(`Period ${key} is before the platform billing start (${settings.billingStartPeriod})`, 400);
  }
  // (H2) Close the period under the plan it ran on BEFORE any scheduled
  // plan change takes effect. (L7) Settings/FX are loaded once.
  const fxTable = await getFxTable();
  const tenants = await Tenant().find({ deletedAt: null, isActive: true }).select("_id").lean();
  let generated = 0;
  let issued = 0;
  let skippedEmpty = 0;
  const errors = [];
  for (const t of tenants) {
    try {
      const result = await generateStatement(t._id, key, { preloaded: { settings, fxTable } });
      if (result.empty) {
        skippedEmpty += 1; // (N12) nothing persisted
        continue;
      }
      const { statement, created } = result;
      if (created) generated += 1;
      if (statement.status === "draft") {
        if (!statement.lines?.length) {
          skippedEmpty += 1;
          continue;
        }
        await issueStatement(statement._id, { settings });
        issued += 1;
      }
    } catch (err) {
      errors.push({ tenantId: String(t._id), error: err.message });
    }
  }
  // (N7) Plan changes, overdue flags and the audit row always run, even when
  // individual tenants failed above.
  const changes = await applyDueChanges();
  errors.push(...changes.errors.map((e) => ({ ...e, stage: "plan-change" })));
  const overdue = await markOverdue();
  return { periodKey: key, planChangesApplied: changes.applied, tenants: tenants.length, generated, issued, skippedEmpty, overdue, errors };
}

export const runPeriod = asyncHandler(async (req, res) => {
  const result = await runBillingPeriod(req.body?.periodKey);
  await recordPlatformAudit(req, { action: "billing.period.run", resourceType: "BillingPeriod", resourceId: result.periodKey, metadata: { ...result, errors: result.errors.slice(0, 20) } });
  res.json({ success: true, data: result });
});
