/**
 * Global configuration registry — the single place that DECLARES the
 * platform-wide constants an operator can see (and, for the safe subset,
 * change) from Platform → Global configuration.
 *
 * Two kinds of entries:
 *   editable: true   value lives in `platformconfigs._id:"settings"` with the
 *                    code default as fallback; validated against `bounds`
 *                    on write AND on read (an invalid stored value falls back
 *                    to the default — consumers never see garbage).
 *   editable: false  display-only. These are enums/limits baked into schemas,
 *                    migrations or middleware; changing them needs a code
 *                    change + migration, so the page shows them with a note.
 *
 * Keep this list small and boring. Anything that needs its own validation
 * story (feature flags, phone countries, billing, security) already has its
 * own registry + service and does NOT belong here.
 */
import config from "./index.js";
import { PHONE_COUNTRY_CATALOG } from "./phoneCountries.js";

const MB = 1024 * 1024;

/** ISO-4217 codes an operator may offer as a store's BASE currency. */
export const CURRENCY_ALLOWLIST = Object.freeze([
  "SDG", "USD", "EUR", "GBP", "AED", "SAR", "EGP", "QAR", "KWD", "BHD", "OMR",
  "JOD", "TRY", "CAD", "AUD", "JPY", "INR", "NGN", "KES", "ETB", "ZAR", "MYR",
]);

/** ISO-3166 alpha-2 codes an operator may offer as shipping/market countries. */
export const COUNTRY_ALLOWLIST = Object.freeze(
  Array.from(new Set([...PHONE_COUNTRY_CATALOG.map((c) => c.iso2), "CN", "BR", "MX", "ID", "PH", "IT", "ES", "CH", "BE", "AT"]))
);

/** MIME types the upload filter may be configured to accept. SVG is never allowed (XSS). */
// Exactly the types the magic-byte validator and Cloudinary presets support.
export const MIME_ALLOWLIST = Object.freeze(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export const PLATFORM_SETTINGS_REGISTRY = Object.freeze([
  // ── Uploads ────────────────────────────────────────────────────────────
  {
    key: "uploads.maxFileSizeMB",
    group: "Uploads",
    label: "Max upload size (MB)",
    description: "Largest single image a merchant may upload. Hard ceiling is the process limit (MAX_FILE_SIZE env).",
    type: "integer",
    editable: true,
    default: Math.max(1, Math.min(50, Math.round(config.maxFileSize / MB))),
    bounds: { min: 1, max: 50 },
  },
  {
    key: "uploads.maxFilesPerUpload",
    group: "Uploads",
    label: "Max files per upload",
    description: "How many images one multi-file upload request may carry.",
    type: "integer",
    editable: true,
    default: Math.max(1, Math.min(30, config.maxFilesPerUpload)),
    bounds: { min: 1, max: 30 },
  },
  {
    key: "uploads.allowedMimeTypes",
    group: "Uploads",
    label: "Allowed image types",
    description: "MIME types accepted by the image upload filter. SVG is always rejected.",
    type: "stringList",
    editable: true,
    default: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
    bounds: { allowlist: MIME_ALLOWLIST, min: 1 },
  },

  // ── Commerce catalogs ──────────────────────────────────────────────────
  {
    key: "commerce.baseCurrencies",
    group: "Commerce",
    label: "Store base currencies",
    description: "Currencies a merchant may pick as their store's base currency (Settings → Regional). Markets/FX accept any ISO-4217 code.",
    type: "stringList",
    editable: true,
    default: ["SDG", "USD", "EUR", "GBP", "AED", "SAR", "EGP", "CAD", "AUD", "JPY", "INR"],
    bounds: { allowlist: CURRENCY_ALLOWLIST, min: 1 },
  },
  {
    key: "commerce.countries",
    group: "Commerce",
    label: "Shipping / market countries",
    description: "Countries offered in shipping-zone and market pickers. Enforced: newly added shipping-zone countries must be in this list.",
    type: "stringList",
    editable: true,
    default: ["SD", "SS", "EG", "SA", "AE", "QA", "KW", "BH", "OM", "JO", "TR", "GB", "US"],
    bounds: { allowlist: COUNTRY_ALLOWLIST, min: 1 },
  },

  // ── Platform console ───────────────────────────────────────────────────
  {
    key: "console.listPageSize",
    group: "Platform console",
    label: "Default list page size",
    description: "Rows per page on platform-admin lists (capped at 100 server-side). Not yet consumed by the console — display-only until it is.",
    type: "integer",
    editable: false,
    default: 25,
  },

  // ── Display-only (code / schema constants) ─────────────────────────────
  {
    key: "orders.statuses",
    group: "Order states",
    label: "Order statuses",
    description: "Schema enum. Changing requires a migration.",
    type: "stringList",
    editable: false,
    default: ["Draft", "Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled", "Refunded", "Archived"],
  },
  {
    key: "orders.paymentStatuses",
    group: "Order states",
    label: "Payment statuses",
    description: "Schema enum. Changing requires a migration.",
    type: "stringList",
    editable: false,
    default: ["Not Paid", "Authorized", "Paid", "Partially Refunded", "Refunded", "Voided", "Failed"],
  },
  {
    key: "orders.fulfillmentStatuses",
    group: "Order states",
    label: "Fulfillment statuses",
    description: "Schema enum. Changing requires a migration.",
    type: "stringList",
    editable: false,
    default: ["Unfulfilled", "Partially Fulfilled", "Fulfilled", "Returned", "Cancelled"],
  },
  {
    key: "limits.apiPaginationMax",
    group: "System limits",
    label: "API pagination cap",
    description: "Maximum `limit` any list endpoint honours.",
    type: "integer",
    editable: false,
    default: 100,
  },
  {
    key: "limits.rateLimitWindowMinutes",
    group: "System limits",
    label: "General API rate-limit window (minutes)",
    description: "From RATE_LIMIT_WINDOW_MS. Per-endpoint auth limiters are stricter and fixed in code.",
    type: "integer",
    editable: false,
    default: Math.round(config.rateLimitWindowMs / 60000),
  },
  {
    key: "limits.rateLimitMaxRequests",
    group: "System limits",
    label: "General API rate-limit max requests",
    description: "From RATE_LIMIT_MAX_REQUESTS.",
    type: "integer",
    editable: false,
    default: config.rateLimitMaxRequests,
  },
  {
    key: "uploads.processMaxFileSizeMB",
    group: "System limits",
    label: "Process upload ceiling (MB)",
    description: "MAX_FILE_SIZE env — multer's hard limit; the editable max above cannot exceed it.",
    type: "integer",
    editable: false,
    default: Math.round(config.maxFileSize / MB),
  },
]);

export const SETTING_KEYS = Object.freeze(PLATFORM_SETTINGS_REGISTRY.map((s) => s.key));

export function getSettingDef(key) {
  return PLATFORM_SETTINGS_REGISTRY.find((s) => s.key === key) || null;
}

export const DEFAULT_SETTINGS = Object.freeze(
  Object.fromEntries(PLATFORM_SETTINGS_REGISTRY.map((s) => [s.key, s.default]))
);
