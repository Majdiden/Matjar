/**
 * Store configuration inspector (Phase B) — the "why is this store behaving
 * like this" screen. Every row carries the value at each layer and the layer
 * that won, so a support operator can explain a flag, a limit or a price
 * without reading the database.
 *
 * Read-only. Secrets (provider keys, tokens) are never selected.
 */
import mongoose from "mongoose";
import { APIError } from "../../middlewares/errorHandler.js";
import { createScopedModels } from "../../utils/scopedModel.js";
import { FEATURE_REGISTRY } from "../../config/featureFlags.js";
import { resolveTenantFeatures } from "../featureFlags.js";
import { resolveEffectiveLimits, LIMIT_KEYS } from "./usage.js";
import { resolveEffectivePricing } from "./billing/resolver.js";
import { getBillingSettings } from "./billing/settings.js";
import logger from "../../utils/logger.js";

const TENANT_DEFAULTS = Object.freeze({
  currency: "SDG",
  timezone: "Africa/Khartoum",
  language: "en",
  activeTheme: null,
  shippingType: "flat",
  taxEnabled: false,
});

function row(key, { def = null, plan = null, program = null, tenant = null, effective, source, label, group, extra }) {
  return { key, label: label || key, group, default: def, plan, program, tenant, effective, source, ...(extra || {}) };
}

export async function inspectTenantConfig(tenantId) {
  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findById(tenantId)
    .select("name slug subscriptionPlan subscriptionStartDate accessPrograms limitOverrides limitOverridesReason settings.currency settings.timezone settings.language settings.activeTheme settings.shipping.type settings.tax.enabled billing lifecycle.state deletedAt createdAt")
    .lean();
  if (!tenant || tenant.deletedAt) throw new APIError("Tenant not found", 404);

  const models = createScopedModels(mongoose.connection, tenantId);
  const safe = async (fn, fallback) => {
    try {
      return await fn();
    } catch (err) {
      logger.warn("configInspector: section failed", { tenantId: String(tenantId), error: err?.message });
      return fallback;
    }
  };

  const [features, limits, pricing, paymentMethods, settings] = await Promise.all([
    safe(() => resolveTenantFeatures(tenant, { fresh: true }), { flags: {}, layers: {} }),
    safe(() => resolveEffectiveLimits(tenant), {}),
    safe(async () => resolveEffectivePricing(tenant, { settings: await getBillingSettings() }), null),
    safe(() => models.PaymentMethod.find({}).select("code label enabled").lean(), []),
    safe(() => getBillingSettings(), null),
  ]);

  // ---- settings (store-level values; the only layers are default + tenant)
  const s = tenant.settings || {};
  const settingsRows = [
    ["currency", "Currency", s.currency],
    ["timezone", "Timezone", s.timezone],
    ["language", "Language", s.language],
    ["activeTheme", "Active theme", s.activeTheme],
    ["shippingType", "Shipping mode", s.shipping?.type],
    ["taxEnabled", "Tax enabled", s.tax?.enabled],
  ].map(([key, label, val]) => {
    const def = TENANT_DEFAULTS[key];
    const v = val === undefined || val === null ? def : val;
    return row(key, { label, group: "settings", def, tenant: val ?? null, effective: v, source: val === undefined || val === null || val === def ? "default" : "tenant" });
  });
  settingsRows.push(
    row("paymentMethods", {
      label: "Payment methods enabled",
      group: "settings",
      def: [],
      tenant: paymentMethods.filter((m) => m.enabled).map((m) => m.code),
      effective: paymentMethods.filter((m) => m.enabled).map((m) => m.code),
      source: "tenant",
      extra: { all: paymentMethods.map((m) => ({ code: m.code, label: m.label, enabled: !!m.enabled })) },
    })
  );

  // ---- feature flags (full ladder)
  const flagRows = FEATURE_REGISTRY.filter((d) => d.type === "boolean").map((d) => {
    const l = features.layers?.[d.key] || {};
    return row(d.key, {
      label: d.label,
      group: `flags:${d.group}`,
      def: l.default ?? d.default,
      plan: l.plan ?? null,
      program: l.program ?? null,
      tenant: l.tenant ?? null,
      effective: l.effective ?? d.default,
      source: l.source || "default",
      extra: { global: l.global ?? null, programKey: l.programKey || null, description: d.description },
    });
  });

  // ---- limits
  const limitRows = LIMIT_KEYS.map((k) => {
    const l = limits[k] || {};
    return row(k, { label: k, group: "limits", def: null, plan: l.plan ?? null, program: l.program ?? null, tenant: l.tenant ?? null, effective: l.effective ?? null, source: l.source || "default", extra: { programKey: l.programKey || null } });
  });

  // ---- pricing summary (read-only; no policy internals beyond key/name)
  const pricingRows = pricing
    ? [
        row("plan", { label: "Plan", group: "pricing", plan: pricing.planKey, effective: pricing.planKey, source: "plan" }),
        row("family", { label: "Family", group: "pricing", plan: pricing.family, effective: pricing.family, source: "plan" }),
        row("baseFee", {
          label: "Base fee",
          group: "pricing",
          plan: pricing.source?.baseFee === "plan" ? pricing.baseFee : null,
          tenant: pricing.source?.baseFee === "override" ? pricing.baseFee : null,
          effective: pricing.baseFee,
          source: pricing.source?.baseFee === "override" ? "tenant" : "plan",
        }),
        row("commissionPolicy", {
          label: "Commission policy",
          group: "pricing",
          def: settings?.defaultCommissionPolicyKey || null,
          plan: pricing.source?.commission === "plan" ? pricing.policyKey : null,
          tenant: pricing.source?.commission === "override" ? pricing.policyKey : null,
          effective: pricing.policyKey,
          source: pricing.source?.commission === "override" ? "tenant" : pricing.source?.commission === "plan" ? "plan" : pricing.source?.commission === "default" ? "default" : "none",
          extra: { policyName: pricing.policy?.name || null, policyFallback: pricing.policyFallback || null },
        }),
        row("trial", { label: "Trial", group: "pricing", effective: pricing.trialEndsAt ? { endsAt: pricing.trialEndsAt, inTrial: pricing.inTrial } : null, source: pricing.trialEndsAt ? "tenant" : "default" }),
        row("feeHoliday", { label: "Fee holiday", group: "pricing", tenant: pricing.feeHolidayUntil || null, effective: pricing.feeHolidayUntil || null, source: pricing.feeHolidayUntil ? "tenant" : "default" }),
      ]
    : [];

  return {
    tenant: { id: String(tenant._id), name: tenant.name, slug: tenant.slug, plan: tenant.subscriptionPlan, programs: tenant.accessPrograms || [], lifecycle: tenant.lifecycle?.state || null },
    generatedAt: new Date(),
    settings: settingsRows,
    flags: flagRows,
    limits: limitRows,
    limitOverridesReason: tenant.limitOverridesReason || null,
    pricing: pricingRows,
  };
}
