import { z } from "zod";
import { objectId, reason } from "./platform.validator.js";
import { PAYMENT_INTEGRATION_KEYS } from "../config/paymentIntegrations.js";

const text = (max) => z.string().trim().max(max);
const url = z.string().trim().max(2048).refine((v) => v === "" || /^https?:\/\//.test(v), "Must be an http(s) URL").optional();

const customerField = z.object({
  name: z.string().trim().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/),
  label: text(80).min(1),
  labelAr: text(80).optional(),
  type: z.enum(["text", "textarea", "number", "file", "select", "email", "tel"]).default("text"),
  required: z.boolean().default(false),
  placeholder: text(120).optional(),
  options: z.array(z.object({ label: text(80), value: text(80) })).max(50).optional(),
  accept: text(200).optional(),
  maxSize: z.number().int().min(1).max(25 * 1024 * 1024).optional(),
});

const provider = z.object({
  code: z.string().trim().regex(/^[a-z0-9][a-z0-9-_]{0,39}$/),
  label: text(80).min(1),
  logo: text(2048).optional(),
});

const entryBody = z.object({
  code: z.string().trim().regex(/^[a-z0-9][a-z0-9-_]{0,39}$/),
  integrationKey: z.enum(PAYMENT_INTEGRATION_KEYS),
  label: text(80).min(1),
  labelAr: text(80).optional(),
  description: text(1000).optional(),
  descriptionAr: text(1000).optional(),
  instructions: text(2000).optional(),
  instructionsAr: text(2000).optional(),
  logo: url,
  icon: text(40).optional(),
  enabled: z.boolean().optional(),
  enabledByDefault: z.boolean().optional(),
  order: z.number().int().min(0).max(1000).optional(),
  customerFields: z.array(customerField).max(20).optional(),
  providers: z.array(provider).max(50).optional(),
});

export const createCatalogEntrySchema = z.object({ body: entryBody.extend({ reason: reason.optional() }) });
export const updateCatalogEntrySchema = z.object({
  params: z.object({ id: objectId }),
  body: entryBody.omit({ code: true, integrationKey: true }).partial().extend({ reason: reason.optional() }),
});
export const catalogIdSchema = z.object({ params: z.object({ id: objectId }), body: z.object({ reason: reason.optional() }).optional() });
