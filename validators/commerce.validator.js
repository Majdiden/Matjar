import { z } from "zod";

/**
 * Zod schemas for the platform-admin cross-store commerce search and the
 * storefront (domains / themes / health) endpoints. Every list query is
 * bounded (limit ≤ 100) and every free-text field is length-capped; the
 * services escape strings before they reach a RegExp.
 */

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");
const page = z.coerce.number().int().min(1).max(10000).default(1);
const limit = z.coerce.number().int().min(1).max(100).default(25);
const text = z.string().trim().max(120);
const isoDate = z.coerce.date();
const money = z.coerce.number().min(0).max(1e12);
const currency = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/);
// Query flags: only "1" / "true" switch a filter on (z.coerce.boolean would
// treat "0" and "false" as true because they are non-empty strings).
const flag = z.preprocess((v) => v === "1" || v === "true" || v === true, z.boolean()).optional();

export const ORDER_STATUSES = ["Draft", "Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled", "Refunded", "Archived"];
export const PAYMENT_STATUSES = ["Not Paid", "Authorized", "Paid", "Partially Refunded", "Refunded", "Voided", "Failed"];
export const PRODUCT_STATUSES = ["active", "draft", "archived"];

export const listOrdersSchema = z.object({
  query: z
    .object({
      q: text.optional(),
      tenantId: objectId.optional(),
      status: z.enum(ORDER_STATUSES).optional(),
      paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
      from: isoDate.optional(),
      to: isoDate.optional(),
      currency: currency.optional(),
      min: money.optional(),
      max: money.optional(),
      page,
      limit,
    })
    .refine((q) => !(q.from && q.to) || q.from <= q.to, { message: "from must be before to" })
    .refine((q) => q.min == null || q.max == null || q.min <= q.max, { message: "min must be ≤ max" }),
});

export const listProductsSchema = z.object({
  query: z.object({
    q: text.optional(),
    tenantId: objectId.optional(),
    status: z.enum(PRODUCT_STATUSES).optional(),
    sku: text.optional(),
    page,
    limit,
  }),
});

export const listCustomersSchema = z.object({
  query: z.object({
    tenantId: objectId,
    q: text.optional(),
    page,
    limit,
  }),
});

export const listInventorySchema = z.object({
  query: z.object({
    tenantId: objectId.optional(),
    lowStock: flag,
    negative: flag,
    q: text.optional(),
    page,
    limit,
  }),
});

// --- Storefront ------------------------------------------------------

export const DOMAIN_STATUS_VALUES = [
  "pending_dns",
  "ownership_verified",
  "dns_verified",
  "provisioning_ssl",
  "active",
  "ssl_failed",
  "dns_misconfigured",
  "disabled",
];

export const listDomainsSchema = z.object({
  query: z.object({
    status: z.enum(DOMAIN_STATUS_VALUES).optional(),
    tenantId: objectId.optional(),
    q: text.optional(),
    kind: z.enum(["platform_subdomain", "custom_apex", "custom_subdomain"]).optional(),
    page,
    limit,
  }),
});

const reason = z.string().trim().min(4, "Reason must be at least 4 characters").max(500);
export const domainActionSchema = z.object({ body: z.object({ reason: reason.optional() }).default({}) });
export const domainRemoveSchema = z.object({ body: z.object({ reason }) });

export const themeStatusSchema = z.object({
  body: z.object({
    status: z.enum(["active", "inactive", "development"]),
    reason: reason.optional(),
  }),
});

export const themeStoresSchema = z.object({
  params: z.object({ slug: z.string().trim().toLowerCase().min(1).max(64).regex(/^[a-z0-9-]+$/, "Invalid theme slug") }),
  query: z.object({ page, limit }),
});

export const listHealthSchema = z.object({
  query: z.object({
    overall: z.enum(["ok", "degraded", "error", "unknown"]).optional(),
    tenantId: objectId.optional(),
    page,
    limit,
  }),
});
