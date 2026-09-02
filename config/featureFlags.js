/**
 * Canonical platform feature-flag registry — the single source of truth.
 *
 * Every flag is declared once here with its default. The platform-admin UI
 * renders itself from this registry (served by the API), so only the merchant
 * dashboard carries a small mirrored key list (same "keep in sync" convention
 * the repo already uses for PLATFORM_SCOPES).
 *
 * Defaults are the SOFT-LAUNCH posture: most features OFF/hidden so the
 * operator opens them gradually from the platform-admin Features panel.
 *
 *   type: "boolean" | "stringList"  (stringList exists only for themes.allowedSlugs)
 *   group/label/description power the admin UI.
 */
export const FEATURE_REGISTRY = Object.freeze([
  { key: "payments.methods",      type: "boolean", default: false, group: "Payments",   label: "Payment methods management", description: "Merchant payment-method config UI + non-COD methods at checkout. OFF = Cash on Delivery is the only method." },
  { key: "payments.transactions", type: "boolean", default: false, group: "Payments",   label: "Payments & transactions",    description: "Transactions list/detail pages and the order-detail payments ledger (refunds, manual verification)." },
  { key: "orders.fulfillment",    type: "boolean", default: false, group: "Orders",     label: "Fulfillments",               description: "Fulfillments page, fulfillment creation, fulfillment card on order detail, packing slips." },
  { key: "orders.returns",        type: "boolean", default: false, group: "Orders",     label: "Returns & replacements",     description: "Returns card + return/replacement dialogs on order detail." },
  { key: "orders.timeline",       type: "boolean", default: false, group: "Orders",     label: "Order timeline card",        description: "Timeline card on the order detail page." },
  { key: "orders.notes",          type: "boolean", default: false, group: "Orders",     label: "Order notes & tags",         description: "Notes/tags cards on the order detail page." },
  { key: "orders.lifecycle",      type: "boolean", default: false, group: "Orders",     label: "Order lifecycle view",       description: "The order lifecycle deep-dive page and links to it." },
  { key: "themes.catalogAll",     type: "boolean", default: false, group: "Themes",     label: "Full theme catalog",         description: "OFF = only the allow-listed themes below are offered/installable." },
  { key: "themes.allowedSlugs",   type: "stringList", default: ["modern", "starter"], group: "Themes", label: "Allowed theme slugs", description: "Themes offered when the full catalog is off." },
  { key: "webhooks",              type: "boolean", default: false, group: "Developer",  label: "Webhooks",                   description: "Merchant webhook endpoints (CRUD + delivery)." },
  { key: "customFields",          type: "boolean", default: false, group: "Developer",  label: "Custom fields (metafields)", description: "Custom-field definitions UI + API." },
  { key: "team.advancedRoles",    type: "boolean", default: false, group: "Team",       label: "Advanced roles",             description: "Custom role editor (Permissions page, role CRUD). Assigning built-in roles to staff stays available." },
  { key: "auditLogs",             type: "boolean", default: false, group: "Team",       label: "Audit logs",                 description: "Audit-log page + API." },
  { key: "settings.regional",     type: "boolean", default: false, group: "Settings",   label: "Regional settings tab",      description: "Currency/timezone/language regional settings tab." },
  { key: "settings.tax",          type: "boolean", default: false, group: "Settings",   label: "Tax settings tab",           description: "Tax settings tab + tax-rate API." },
  { key: "settings.currencies",   type: "boolean", default: false, group: "Settings",   label: "Currencies tab",             description: "Multi-currency settings tab + API." },
  { key: "settings.markets",      type: "boolean", default: false, group: "Settings",   label: "Markets tab",                description: "Markets settings tab + markets APIs." },
  { key: "domains.custom",        type: "boolean", default: false, group: "Storefront", label: "Custom domains",             description: "Domains page + custom-domain add/verify/SSL APIs. Platform subdomain always works." },
  { key: "redirects",             type: "boolean", default: false, group: "Storefront", label: "URL redirects",              description: "Redirects page + API." },
  { key: "billing.subscription",  type: "boolean", default: false, group: "Billing",    label: "Subscription page",          description: "Merchant-facing subscription/upgrade page." },
  { key: "billing.geoPricing",    type: "boolean", default: false, group: "Billing",    label: "Geo-localized plan pricing", description: "Public plan catalog shows an approximate price in the visitor's local currency (geo-detected), converted from the base SDG price. OFF = base currency only." },
]);

export const DEFAULT_FLAGS = Object.freeze(
  Object.fromEntries(FEATURE_REGISTRY.map((f) => [f.key, f.default]))
);

export const FLAG_KEYS = Object.freeze(FEATURE_REGISTRY.map((f) => f.key));

export function getFlagDef(key) {
  return FEATURE_REGISTRY.find((f) => f.key === key) || null;
}
