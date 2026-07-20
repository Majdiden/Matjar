import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import { requireFeature } from "../middlewares/featureGate.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { seedDefaultPaymentMethods } from "../services/storeSetup.js";

const router = Router();

const ALLOWED_TYPES = ["gateway", "manual", "cod"];
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
const GATEWAY_CATALOG = [];

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
    const canonical = await PaymentMethod.findOne({ code: "manual-transfer" })
      .select("providers label")
      .lean();
    const needsHeal =
      !canonical ||
      !(canonical.providers && canonical.providers.length > 0) ||
      canonical.label !== "Manual Transfer";
    if (needsHeal) {
      await seedDefaultPaymentMethods(req.models);
    }
    const methods = await PaymentMethod.find({})
      .select("+config")
      .sort({ order: 1, createdAt: 1 })
      .lean();
    res.json({ success: true, data: { methods: methods.map(redactConfig) } });
  })
);

/**
 * GET /catalog — list gateway integration templates available for install.
 * Currently empty (Stripe parked). The dashboard "Add method" UI
 * uses this to show what can be added.
 */
router.get(
  "/catalog",
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: { gateways: GATEWAY_CATALOG } });
  })
);

/**
 * POST / — install a gateway integration from the catalog. Merchants
 * never author arbitrary methods; they pick a catalog entry by code.
 */
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const PaymentMethod = req.models?.PaymentMethod;
    const { code, enabled, config } = req.body || {};

    if (!code) {
      return res.status(400).json({ success: false, message: "`code` is required" });
    }
    const codeSlug = String(code).trim().toLowerCase();
    const template = GATEWAY_CATALOG.find((g) => g.code === codeSlug);
    if (!template) {
      return res.status(400).json({
        success: false,
        message:
          "Only gateway integrations from the catalog can be installed. No catalog entries are currently available.",
      });
    }

    const existing = await PaymentMethod.findOne({ code: codeSlug });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `"${template.label}" is already installed.`,
      });
    }

    const last = await PaymentMethod.findOne({}).sort({ order: -1 }).select("order").lean();
    const doc = await PaymentMethod.create({
      tenantId: req.tenantId,
      code: codeSlug,
      type: "gateway",
      label: template.label,
      description: template.description || "",
      providerLogos: template.providerLogos || [],
      icon: template.icon || "",
      enabled: !!enabled,
      order: last ? (last.order || 0) + 1 : 0,
      customerFields: [],
      providers: [],
      config: config && typeof config === "object" ? config : undefined,
    });
    const created = await PaymentMethod.findById(doc._id).select("+config").lean();
    res.status(201).json({ success: true, data: { method: redactConfig(created) } });
  })
);

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

    if (payload.type && !ALLOWED_TYPES.includes(payload.type)) {
      return res.status(400).json({
        success: false,
        message: `\`type\` must be one of: ${ALLOWED_TYPES.join(", ")}`,
      });
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

    const isProtected = PROTECTED_CODES.has(doc.code);
    // For system-defined methods (cod, manual-transfer) merchants can
    // only flip `enabled`, reorder, update instructions/description, and
    // — for manual-transfer — edit the provider account details. Code,
    // type, customerFields, and the provider list itself are locked.
    const assignable = isProtected
      ? ["enabled", "order", "description", "instructions", "providers"]
      : [
          "type",
          "label",
          "description",
          "providerLogos",
          "icon",
          "enabled",
          "order",
          "instructions",
          "customerFields",
          "providers",
        ];

    for (const k of assignable) {
      if (payload[k] !== undefined) doc[k] = payload[k];
    }

    // On protected methods, merchants can edit/add/remove providers
    // freely — but system-defined providers (Bankak, Fawry, …) must
    // remain in the list. If the incoming payload drops a system code,
    // we reinsert the existing record (preserving account info).
    if (isProtected && payload.providers !== undefined) {
      const existingProviders = (doc.providers || []).map((p) => p.toObject?.() || p);
      const incoming = Array.isArray(payload.providers) ? payload.providers : [];
      const incomingCodes = new Set(incoming.map((x) => x.code));
      const preservedSystem = existingProviders.filter(
        (p) => SYSTEM_PROVIDER_CODES.has(p.code) && !incomingCodes.has(p.code)
      );
      doc.providers = [...incoming, ...preservedSystem];
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
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const PaymentMethod = req.models?.PaymentMethod;
    const { id } = req.params;
    const doc = await PaymentMethod.findById(id).lean();
    if (!doc) {
      return res.status(404).json({ success: false, message: "Payment method not found" });
    }
    if (PROTECTED_CODES.has(doc.code)) {
      return res.status(400).json({
        success: false,
        message: "Default methods cannot be deleted — disable instead.",
      });
    }
    await PaymentMethod.deleteOne({ _id: id });
    res.json({ success: true, data: { deleted: true } });
  })
);

export default router;
