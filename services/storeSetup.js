import mongoose from "mongoose";
import crypto from "crypto";
import { registerDomain } from "./domainRegistration.js";
import { installDefaultTheme } from "./theme.js";
import { seedSampleData } from "./dataSeed.js";
import logger from "../utils/logger.js";

const SETUP_STEPS = {
  DOMAIN_REGISTRATION: "domain_registration",
  THEME_INSTALLATION: "theme_installation",
  DATA_SEEDING: "data_seeding",
  FINALIZATION: "finalization",
};

/**
 * Initialize store setup
 * @param {Object} tenant - Tenant document
 * @param {Object} models - Scoped models for this tenant
 */
export async function initializeStoreSetup(tenant, models, options = {}) {
  const tenantId = tenant._id.toString();
  const Tenant = mongoose.model("Tenant");

  // Idempotency guard: if this tenant already completed setup, short-circuit
  // unless the caller explicitly asks for a retry (recovery path from a
  // stuck `in_progress`/`failed` state). Without this, the worker retry
  // machinery would duplicate sample data and bump theme install counters
  // every time it replayed the job.
  const existing = await Tenant.findById(tenantId).select("setupStatus name").lean();
  if (!existing) {
    throw new Error(`Tenant ${tenantId} not found — cannot run setup`);
  }
  const currentStatus = existing.setupStatus?.status;
  if (currentStatus === "completed" && !options.force) {
    logger.info("Setup already completed, skipping", { tenantId });
    return { success: true, tenantId, status: existing.setupStatus, skipped: true };
  }

  await Tenant.findByIdAndUpdate(tenantId, {
    $set: {
      "setupStatus.status": "in_progress",
      "setupStatus.currentStep": null,
      "setupStatus.steps": {},
      "setupStatus.startedAt": new Date(),
      "setupStatus.completedAt": null,
      "setupStatus.error": null,
    },
  });

  try {
    logger.info(`Starting setup for tenant: ${tenant.name}`, { tenantId });

    // Step 1: Domain Registration
    await updateSetupStep(tenantId, SETUP_STEPS.DOMAIN_REGISTRATION, "in_progress");
    const domainResult = await registerDomain(tenant.domains.subdomain.name);
    if (!domainResult.success) {
      throw new Error(`Domain registration failed: ${domainResult.error || "Unknown error"}`);
    }
    await updateSetupStep(tenantId, SETUP_STEPS.DOMAIN_REGISTRATION, "completed", {
      domain: domainResult.domain,
      instructions: domainResult.instructions,
    });

    // Step 2: Theme Installation
    await updateSetupStep(tenantId, SETUP_STEPS.THEME_INSTALLATION, "in_progress");
    const themeResult = await installDefaultTheme(tenant);

    if (!themeResult.success) {
      logger.warn(`Theme installation failed: ${themeResult.error}`, { tenantId });
      await updateSetupStep(tenantId, SETUP_STEPS.THEME_INSTALLATION, "skipped", { reason: themeResult.error });
    } else {
      await Tenant.findByIdAndUpdate(tenantId, { "settings.activeTheme": themeResult.theme.slug });
      await updateSetupStep(tenantId, SETUP_STEPS.THEME_INSTALLATION, "completed", { theme: themeResult.theme });
    }

    // Step 3: Sample Data Seeding
    await updateSetupStep(tenantId, SETUP_STEPS.DATA_SEEDING, "in_progress");
    const seedResult = await seedSampleData(models, tenant);
    if (!seedResult.success) {
      await updateSetupStep(tenantId, SETUP_STEPS.DATA_SEEDING, "skipped", { reason: seedResult.error });
    } else {
      await updateSetupStep(tenantId, SETUP_STEPS.DATA_SEEDING, "completed", {
        categories: seedResult.categoriesCreated,
        products: seedResult.productsCreated,
      });
    }

    // Seed default payment methods. Idempotent — skipped if any method
    // already exists for this tenant. COD is enabled by default; gateway
    // methods (Stripe, etc.) are disabled until the merchant configures
    // their credentials.
    try {
      await seedDefaultPaymentMethods(models, tenant?.settings?.language);
    } catch (err) {
      logger.warn(`Payment method seeding failed: ${err.message}`, { tenantId });
    }

    // Step 4: Finalization
    await updateSetupStep(tenantId, SETUP_STEPS.FINALIZATION, "completed");

    await Tenant.findByIdAndUpdate(tenantId, {
      $set: {
        "setupStatus.status": "completed",
        "setupStatus.completedAt": new Date(),
      },
    });

    logger.info(`Setup completed for tenant: ${tenant.name}`, { tenantId });
    const updated = await Tenant.findById(tenantId);
    return { success: true, tenantId, status: updated?.setupStatus || null };
  } catch (error) {
    logger.error(`Setup failed for tenant: ${tenant.name}: ${error.message}`, { tenantId });
    await Tenant.findByIdAndUpdate(tenantId, {
      $set: {
        "setupStatus.status": "failed",
        "setupStatus.error": error.message,
        "setupStatus.completedAt": new Date(),
      },
    });
    const updated = await Tenant.findById(tenantId);
    return { success: false, tenantId, error: error.message, status: updated?.setupStatus || null };
  }
}

/**
 * Recovery: surface tenants whose setup has been sitting in `in_progress`
 * longer than the given threshold. Worker loop picks these up and re-runs
 * `initializeStoreSetup(..., { force: true })` so a crash mid-setup can't
 * orphan a tenant forever.
 */
export async function findStuckSetups({ olderThanMs = 15 * 60 * 1000 } = {}) {
  const Tenant = mongoose.model("Tenant");
  const cutoff = new Date(Date.now() - olderThanMs);
  return await Tenant.find(
    {
      "setupStatus.status": "in_progress",
      "setupStatus.startedAt": { $lt: cutoff },
    },
    "_id name setupStatus"
  ).lean();
}

/**
 * Admin/support hook: manually retry setup for a tenant stuck in
 * `in_progress` or `failed`. Distinct from the auto-recovery above
 * because it's triggered explicitly by an operator and always forces.
 */
export async function retrySetup(tenantId) {
  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new Error(`Tenant ${tenantId} not found`);
  const { createScopedModels } = await import("../utils/scopedModel.js");
  const models = createScopedModels(mongoose.connection, tenant._id);
  return initializeStoreSetup(tenant, models, { force: true });
}

async function updateSetupStep(tenantId, step, status, data = {}) {
  const Tenant = mongoose.model("Tenant");
  await Tenant.findByIdAndUpdate(tenantId, {
    $set: {
      "setupStatus.currentStep": step,
      [`setupStatus.steps.${step}`]: { status, ...data, timestamp: new Date() },
    },
  });
}

/**
 * Read setup status, gated by a one-time token issued at registration.
 * The endpoint is public (the dashboard polls before login completes), so
 * the token is the only thing standing between an attacker who guesses an
 * ObjectId and another tenant's setup state. Mismatch → null (the route
 * layer turns that into a 404 to avoid leaking which tenantIds exist).
 */
export async function getSetupStatus(tenantId, providedToken) {
  const Tenant = mongoose.model("Tenant");
  // setupToken is `select: false` on the schema — opt back in here.
  const tenant = await Tenant.findById(tenantId)
    .select("+setupStatus.setupToken")
    .lean();
  if (!tenant || !tenant.setupStatus) return { found: false, message: "Setup status not found" };

  const expected = tenant.setupStatus.setupToken;
  if (!expected || !providedToken) return { found: false, message: "Setup status not found" };
  // Constant-time compare to avoid leaking the token via timing.
  const a = Buffer.from(String(providedToken));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { found: false, message: "Setup status not found" };
  }

  // Strip the token from the response — the client already has it.
  const { setupToken: _drop, ...status } = tenant.setupStatus;
  return { found: true, ...status };
}

export async function clearSetupStatus(tenantId, providedToken) {
  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findById(tenantId)
    .select("+setupStatus.setupToken")
    .lean();
  if (!tenant || !tenant.setupStatus) return { cleared: false };

  const expected = tenant.setupStatus.setupToken;
  if (!expected || !providedToken) return { cleared: false };
  const a = Buffer.from(String(providedToken));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { cleared: false };
  }

  await Tenant.findByIdAndUpdate(tenantId, { $unset: { setupStatus: 1 } });
  return { cleared: true };
}

/**
 * Seed the two default payment methods (COD enabled, Stripe disabled) when
 * the tenant has no methods configured. Safe to call repeatedly.
 */
/**
 * System-default payment methods. Merchants can only enable/disable and
 * fill provider account info — codes, types, customer-fields, and the
 * provider template list are system-owned and must not be altered.
 */
export const DEFAULT_MANUAL_PROVIDERS = [
  { code: "bankak", label: "Bankak", logo: "bankak" },
  { code: "fawry", label: "Fawry", logo: "fawry" },
  { code: "ocash", label: "OCash", logo: "ocash" },
  { code: "bravo", label: "Bravo", logo: "bravo" },
  { code: "cashi", label: "Cashi", logo: "cashi" },
];

export const MANUAL_CUSTOMER_FIELDS = [
  {
    name: "transactionNumber",
    label: "Transaction number",
    type: "text",
    required: true,
    placeholder: "e.g. TXN-8827463",
  },
  {
    name: "receipt",
    label: "Payment receipt",
    type: "file",
    required: true,
    accept: "image/*,application/pdf",
    maxSize: 5 * 1024 * 1024,
  },
];

export const SYSTEM_METHOD_CODES = new Set(["cod", "manual-transfer"]);

export async function seedDefaultPaymentMethods(models, language) {
  if (!models?.PaymentMethod) return { created: 0 };

  // Seed the default method copy in the store's chosen language so a new
  // Arabic store doesn't start with English payment labels. The merchant can
  // still rename them. Falls back to English for any other language.
  const isAr = String(language || "").toLowerCase().startsWith("ar");
  const copy = isAr
    ? {
        codLabel: "الدفع عند الاستلام",
        codDesc: "ادفع عند وصول طلبك.",
        manualLabel: "تحويل يدوي",
        manualDesc: "ادفع عبر تحويل بنكي أو محفظة إلكترونية. ستظهر لك تفاصيل حساب التاجر عند إتمام الطلب.",
        manualInstr: "حوّل إجمالي الطلب بالضبط إلى الحساب الظاهر، ثم ارفع الإيصال وأدخل رقم العملية.",
        fTxnLabel: "رقم العملية",
        fTxnPlaceholder: "مثال: TXN-8827463",
        fReceiptLabel: "إيصال الدفع",
      }
    : {
        codLabel: "Cash on Delivery",
        codDesc: "Pay when your order arrives.",
        manualLabel: "Manual Transfer",
        manualDesc: "Pay by bank or mobile-money transfer. You'll get the merchant's account details at checkout.",
        manualInstr: "Transfer the exact order total to the account shown, then upload the receipt and enter your transaction number.",
        fTxnLabel: "Transaction number",
        fTxnPlaceholder: "e.g. TXN-8827463",
        fReceiptLabel: "Payment receipt",
      };
  const manualFields = MANUAL_CUSTOMER_FIELDS.map((f) =>
    f.name === "transactionNumber"
      ? { ...f, label: copy.fTxnLabel, placeholder: copy.fTxnPlaceholder }
      : f.name === "receipt"
      ? { ...f, label: copy.fReceiptLabel }
      : f
  );

  const wanted = [
    {
      code: "cod",
      type: "cod",
      label: copy.codLabel,
      description: copy.codDesc,
      providerLogos: ["cod"],
      icon: "cod",
      enabled: true,
      order: 1,
      customerFields: [],
      providers: [],
    },
    {
      code: "manual-transfer",
      type: "manual",
      label: copy.manualLabel,
      description: copy.manualDesc,
      providerLogos: DEFAULT_MANUAL_PROVIDERS.map((p) => p.logo),
      icon: "bank",
      enabled: false,
      order: 2,
      instructions: copy.manualInstr,
      customerFields: manualFields,
      providers: DEFAULT_MANUAL_PROVIDERS.map((p) => ({
        ...p,
        enabled: false,
        accountNumber: "",
        beneficiaryName: "",
        phone: "",
      })),
    },
  ];

  // Idempotent: insert any missing system method, and top-up missing
  // provider templates for existing manual-transfer docs (so upgrading
  // tenants get the new Bankak/Fawry/… list without clobbering their
  // already-filled account info).
  let created = 0;
  for (const method of wanted) {
    // Legacy tenants may have the method under an older code variant
    // (e.g. "manual_transfer" with an underscore). Match any of them
    // so the top-up migrates in place instead of creating a duplicate.
    const codeVariants = method.code === "manual-transfer"
      ? ["manual-transfer", "manual_transfer"]
      : [method.code];
    const existing = await models.PaymentMethod.findOne({ code: { $in: codeVariants } });
    if (!existing) {
      await models.PaymentMethod.create(method);
      created++;
      continue;
    }
    // Normalize the canonical code + label so legacy tenants converge
    // on the system-owned name.
    if (existing.code !== method.code) {
      existing.code = method.code;
    }
    if (existing.label !== method.label) {
      existing.label = method.label;
    }
    if (method.code === "manual-transfer") {
      const have = new Set((existing.providers || []).map((p) => p.code));
      const missing = method.providers.filter((p) => !have.has(p.code));
      if (missing.length > 0) {
        existing.providers = [...(existing.providers || []), ...missing];
        existing.markModified("providers");
      }
      if (!existing.customerFields || existing.customerFields.length === 0) {
        existing.customerFields = MANUAL_CUSTOMER_FIELDS;
      }
    }
    if (existing.isModified()) await existing.save();
  }
  return { created };
}

export async function getAllActiveSetups() {
  const Tenant = mongoose.model("Tenant");
  const tenants = await Tenant.find({ "setupStatus.status": "in_progress" }, "setupStatus name");
  return tenants.map((t) => ({ tenantId: t._id, name: t.name, ...t.setupStatus.toObject() }));
}
