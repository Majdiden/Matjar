/**
 * Platform payment-method catalog + per-store sync.
 *
 * The owner manages catalog entries here (admin DB). Each store keeps a
 * synced copy in its PaymentMethod collection: presentation (label,
 * description, instructions, logo, icon, customer fields, provider list)
 * is copied FROM the catalog on every sync; merchant-owned state (enabled,
 * order, provider account details, integration config) is preserved.
 */
import mongoose from "mongoose";
import { APIError } from "../../middlewares/errorHandler.js";
import { DEFAULT_CATALOG_ENTRIES, paymentIntegration } from "../../config/paymentIntegrations.js";

const Catalog = () => mongoose.model("PlatformPaymentMethod");

export function publicEntry(e) {
  if (!e) return null;
  const o = typeof e.toObject === "function" ? e.toObject() : e;
  const integration = paymentIntegration(o.integrationKey);
  return { ...o, _id: String(o._id), type: integration?.type || null, integration: integration ? { key: integration.key, label: integration.label, supportsProviders: integration.supportsProviders, merchantFields: integration.merchantFields } : null };
}

/** Seed the built-in COD + manual-transfer entries on an empty platform. */
export async function bootstrapCatalog() {
  if ((await Catalog().estimatedDocumentCount()) > 0) return { created: 0 };
  const docs = DEFAULT_CATALOG_ENTRIES.map((e) => ({
    ...e,
    customerFields: paymentIntegration(e.integrationKey)?.defaultCustomerFields || [],
  }));
  await Catalog().insertMany(docs, { ordered: false }).catch((err) => {
    if (err?.code !== 11000) throw err; // concurrent bootstrap
  });
  return { created: docs.length };
}

export async function listCatalog() {
  await bootstrapCatalog();
  const rows = await Catalog().find({}).sort({ order: 1, code: 1 }).lean();
  return rows.map(publicEntry);
}

function normaliseProviders(list, integration) {
  if (!integration?.supportsProviders) return [];
  const seen = new Set();
  return (list || []).map((p) => {
    const code = String(p.code || "").toLowerCase().trim();
    if (!code || seen.has(code)) throw new APIError(`Provider code "${code || "?"}" is missing or duplicated`, 400);
    seen.add(code);
    return { code, label: String(p.label || "").trim() || code, logo: String(p.logo || "") };
  });
}

export async function createEntry(body, actor) {
  const integration = paymentIntegration(body.integrationKey);
  if (!integration) throw new APIError("Unknown integration", 400);
  if (await Catalog().exists({ code: body.code })) throw new APIError("A method with this code already exists", 409);
  const doc = await Catalog().create({
    ...body,
    customerFields: body.customerFields ?? integration.defaultCustomerFields ?? [],
    providers: normaliseProviders(body.providers, integration),
    createdBy: actor?.id || null,
  });
  return publicEntry(doc);
}

export async function updateEntry(id, patch) {
  const doc = await Catalog().findById(id);
  if (!doc) throw new APIError("Payment method not found", 404);
  const before = publicEntry(doc);
  const integration = paymentIntegration(doc.integrationKey);
  const { code: _code, integrationKey: _ik, ...fields } = patch; // both immutable
  if (fields.providers !== undefined) fields.providers = normaliseProviders(fields.providers, integration);
  Object.assign(doc, fields);
  await doc.save();
  return { before, after: publicEntry(doc) };
}

export async function deleteEntry(id) {
  const doc = await Catalog().findById(id);
  if (!doc) throw new APIError("Payment method not found", 404);
  if (DEFAULT_CATALOG_ENTRIES.some((e) => e.code === doc.code)) {
    throw new APIError("Built-in methods cannot be deleted; disable them instead", 400);
  }
  await doc.deleteOne();
  return publicEntry(doc);
}

export async function setLogo(id, url) {
  const doc = await Catalog().findByIdAndUpdate(id, { $set: { logo: url, updatedAt: new Date() } }, { new: true }).lean();
  if (!doc) throw new APIError("Payment method not found", 404);
  return publicEntry(doc);
}

/** How many stores have each catalog code switched on (for the admin list). */
export async function usageByCode() {
  if (!mongoose.modelNames().includes("PaymentMethod")) return {};
  const rows = await mongoose.model("PaymentMethod").aggregate([
    { $match: { enabled: true } },
    { $group: { _id: "$code", stores: { $sum: 1 } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, r.stores]));
}

const pick = (entry, field, isAr) => (isAr && entry[`${field}Ar`]) || entry[field] || "";

/**
 * Bring one store's PaymentMethod docs in line with the platform catalog.
 * Idempotent; safe to call on every merchant read of the methods list.
 */
export async function syncStorePaymentMethods(models, language) {
  if (!models?.PaymentMethod) return { created: 0, updated: 0 };
  const catalog = await listCatalog();
  const isAr = String(language || "").toLowerCase().startsWith("ar");
  const existing = await models.PaymentMethod.find({}).select("+config");
  const byCode = new Map(existing.map((d) => [d.code, d]));
  // Legacy code variant from very old seeds.
  const legacyManual = byCode.get("manual_transfer");
  if (legacyManual && !byCode.get("manual-transfer")) {
    legacyManual.code = "manual-transfer";
    byCode.set("manual-transfer", legacyManual);
    byCode.delete("manual_transfer");
  }

  let created = 0;
  let updated = 0;
  const catalogCodes = new Set();
  for (const entry of catalog) {
    catalogCodes.add(entry.code);
    const presentation = {
      type: entry.type,
      label: pick(entry, "label", isAr),
      description: pick(entry, "description", isAr),
      instructions: pick(entry, "instructions", isAr),
      logo: entry.logo || "",
      icon: entry.icon || "",
      providerLogos: entry.providers?.length ? entry.providers.map((p) => p.logo).filter(Boolean) : entry.icon ? [entry.icon] : [],
      customerFields: (entry.customerFields || []).map((f) => ({ ...f, label: (isAr && f.labelAr) || f.label })),
      platformEnabled: !!entry.enabled,
    };
    const doc = byCode.get(entry.code);
    if (!doc) {
      await models.PaymentMethod.create({
        code: entry.code,
        ...presentation,
        enabled: !!entry.enabled && !!entry.enabledByDefault,
        order: entry.order ?? 0,
        providers: (entry.providers || []).map((p) => ({ ...p, enabled: false, accountNumber: "", beneficiaryName: "", phone: "", instructions: "" })),
      });
      created += 1;
      continue;
    }
    Object.assign(doc, presentation);
    // Provider template: keep the merchant's account details, add new
    // providers, drop ones the platform removed, refresh label/logo.
    const mine = new Map((doc.providers || []).map((p) => [p.code, p.toObject?.() || p]));
    doc.providers = (entry.providers || []).map((p) => {
      const have = mine.get(p.code) || {};
      return { ...have, code: p.code, label: p.label, logo: p.logo || "" };
    });
    doc.markModified("providers");
    doc.markModified("customerFields");
    if (doc.isModified()) {
      await doc.save();
      updated += 1;
    }
  }
  // Store methods no longer in the catalog are withdrawn, not deleted
  // (orders reference their code).
  for (const doc of existing) {
    if (!catalogCodes.has(doc.code) && doc.platformEnabled !== false) {
      doc.platformEnabled = false;
      await doc.save();
      updated += 1;
    }
  }
  return { created, updated };
}
