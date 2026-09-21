import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import { requireFeature } from "../middlewares/featureGate.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { syncStorePaymentMethods, listCatalog } from "../services/platform/paymentCatalog.js";

const router = Router();

const PROTECTED_CODES = new Set(["cod", "manual-transfer"]);
// System-defined manual-transfer providers — merchants can edit the
// account info on these but cannot remove them. Custom providers they
// add themselves are freely removable.
const SYSTEM_PROVIDER_CODES = new Set(["bankak", "fawry", "ocash", "bravo", "cashi"]);

// Keys inside `config` that hold secrets (gateway credentials). Even on
// admin endpoints we mask these on read so operator browsers, logs, or
// dashboard network tabs don't carry raw credentials around. Write path
// still accepts the plaintext value; only the read side is redacted.
const SECRET_CONFIG_KEYS = new Set([
  "secretKey",
  "apiKey",
  "apiSecret",
  "privateKey",
  "webhookSecret",
  "clientSecret",
  "accessToken",
  "refreshToken",
]);

const redactConfig = (method) => {
  if (!method || !method.config || typeof method.config !== "object") return method;
  const redacted = {};
  for (const [k, v] of Object.entries(method.config)) {
    if (SECRET_CONFIG_KEYS.has(k) && v) {
      redacted[k] = "__set__";
    } else {
      redacted[k] = v;
    }
  }
  return { ...method, config: redacted };
};
// Gateway integrations the platform can offer to merchants via the
// "Add payment method" UI. Each entry is a system-defined template —
// merchants pick one and fill its config, they don't invent methods.
// Stripe is parked; no gateway integrations available yet.

router.use(authenticate, requirePermission("settings.write"), requireFeature("payments.methods"));

/**
 * GET / — list all payment methods (enabled + disabled) for tenant.
 * Includes `config` because this is an authenticated admin endpoint.
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const PaymentMethod = req.models?.PaymentMethod;
    if (!PaymentMethod) {
      return res.status(500).json({ success: false, message: "Tenant models not resolved" });
    }
    // Self-heal legacy tenants: if the canonical manual-transfer record
    // is missing (or still under the old "manual_transfer" code, or has
    // no providers seeded), run the idempotent seed once. Cheap precheck
    // first so steady-state requests stay a single find().
    // Methods are platform-owned: bring this store in line with the catalog
    // (new methods appear disabled, withdrawn ones are flagged) on every read.
    await syncStorePaymentMethods(req.models, req.tenant?.settings?.language);
    const methods = await PaymentMethod.find({})
      .select("+config")
      .sort({ order: 1, createdAt: 1 })
      .lean();
    // What the merchant must fill in per method (API keys etc.) comes from
    // the integration behind the catalog entry.
    const catalog = await listCatalog();
    const merchantFields = Object.fromEntries(catalog.map((e) => [e.code, e.integration?.merchantFields || []]));
    res.json({ success: true, data: { methods: methods.map((m) => ({ ...redactConfig(m), merchantFields: merchantFields[m.code] || [] })) } });
  })
);

/**
 * Methods are defined by the platform (platform admin → Payments). Merchants
 * enable what the platform offers and fill in their own details; they never
 * author methods. Kept as explicit 410s so an old dashboard build gets a
 * clear message instead of a 404.
 */
const platformOwned = (_req, res) =>
  res.status(410).json({ success: false, code: "PLATFORM_OWNED", message: "Payment methods are managed by the platform. Enable one from the list and add your details." });
router.get("/catalog", platformOwned);
router.post("/", platformOwned);

/**
 * PATCH /reorder — body: { order: [id1, id2, ...] }.
 * Assigns each doc's `order` field to its index in the array.
 * Best-effort atomic via bulkWrite. Declared BEFORE `/:id` so Express
 * doesn't route "reorder" into the generic id handler.
 */
router.patch(
  "/reorder",
  asyncHandler(async (req, res) => {
    const PaymentMethod = req.models?.PaymentMethod;
    const { order } = req.body || {};
    if (!Array.isArray(order) || order.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "`order` must be a non-empty array of IDs" });
    }
    const ops = order.map((id, idx) => ({
      updateOne: { filter: { _id: id }, update: { $set: { order: idx } } },
    }));
    await PaymentMethod.bulkWrite(ops, { ordered: false });
    const methods = await PaymentMethod.find({})
      .select("+config")
      .sort({ order: 1, createdAt: 1 })
      .lean();
    res.json({ success: true, data: { methods: methods.map(redactConfig) } });
  })
);

/**
 * PATCH /:id — update a payment method.
 * `code` is immutable once set. `config` is shallow-merged unless
 * `replaceConfig: true` is passed in the body.
 */
router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const PaymentMethod = req.models?.PaymentMethod;
    const { id } = req.params;
    const payload = { ...(req.body || {}) };

    // code is immutable
    delete payload.code;
    delete payload.tenantId;
    delete payload._id;

    const replaceConfig = payload.replaceConfig === true;
    delete payload.replaceConfig;

    const doc = await PaymentMethod.findById(id).select("+config");
    if (!doc) {
      return res.status(404).json({ success: false, message: "Payment method not found" });
    }


    // Merge config carefully. Strip sentinel values from redacted reads —
    // if the client echoes back `{ secretKey: "__set__" }` we preserve the
    // stored secret rather than overwriting it.
    if (payload.config !== undefined) {
      const incoming = payload.config && typeof payload.config === "object" ? payload.config : {};
      const sanitized = {};
      for (const [k, v] of Object.entries(incoming)) {
        if (SECRET_CONFIG_KEYS.has(k) && v === "__set__") continue;
        sanitized[k] = v;
      }
      if (replaceConfig || !doc.config || typeof doc.config !== "object") {
        doc.config = sanitized;
      } else {
        doc.config = { ...(doc.config || {}), ...sanitized };
      }
      doc.markModified("config");
      delete payload.config;
    }

    if (payload.enabled === true && doc.platformEnabled === false) {
      return res.status(400).json({ success: false, code: "PLATFORM_DISABLED", message: "This payment method is currently not offered by the platform." });
    }

    // Merchant-owned state only. Presentation (label, description,
    // instructions, logo, customer fields, provider list) comes from the
    // platform catalog and is re-synced on every read.
    for (const k of ["enabled", "order"]) {
      if (payload[k] !== undefined) doc[k] = payload[k];
    }
    if (payload.providers !== undefined) {
      // Merchants edit account details + enabled per provider; the set of
      // providers itself is the catalog's. Unknown codes are ignored.
      const incoming = Array.isArray(payload.providers) ? payload.providers : [];
      const byCode = new Map(incoming.map((p) => [String(p?.code || "").toLowerCase(), p]));
      doc.providers = (doc.providers || []).map((p) => {
        const cur = p.toObject?.() || p;
        const mine = byCode.get(cur.code);
        if (!mine) return cur;
        return {
          ...cur,
          enabled: mine.enabled !== undefined ? !!mine.enabled : cur.enabled,
          accountNumber: mine.accountNumber !== undefined ? String(mine.accountNumber).slice(0, 120) : cur.accountNumber,
          beneficiaryName: mine.beneficiaryName !== undefined ? String(mine.beneficiaryName).slice(0, 120) : cur.beneficiaryName,
          phone: mine.phone !== undefined ? String(mine.phone).slice(0, 40) : cur.phone,
          instructions: mine.instructions !== undefined ? String(mine.instructions).slice(0, 2000) : cur.instructions,
        };
      });
      doc.markModified("providers");
    }

    await doc.save();
    const updated = await PaymentMethod.findById(doc._id).select("+config").lean();
    res.json({ success: true, data: { method: redactConfig(updated) } });
  })
);

/**
 * DELETE /:id — delete a payment method, unless it is a protected default.
 */
router.delete("/:id", platformOwned);

export default router;
