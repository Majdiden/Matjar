import { z } from "zod";
import { FLAG_KEYS, getFlagDef } from "../config/featureFlags.js";

/** Only registry-known BOOLEAN flags may be overridden per plan/program/tenant. */
const booleanFlagKey = z
  .string()
  .trim()
  .refine((k) => getFlagDef(k)?.type === "boolean", { message: "Unknown or non-boolean feature flag" });

const featureOverridePair = z.object({ key: booleanFlagKey, value: z.boolean() });

const limitNumber = z.number().int().min(0).max(1_000_000_000).nullable();

export const limitOverridesSchema = z
  .object({
    maxProducts: limitNumber.optional(),
    maxStaff: limitNumber.optional(),
    maxOrdersPerMonth: limitNumber.optional(),
    maxStorageMB: limitNumber.optional(),
  })
  .strict();

const isoDate = z.coerce.date();
const reason = z.string().trim().min(4, "Reason must be at least 4 characters").max(500);
const programKey = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-_]{1,63}$/, "Key must be a lowercase slug");

const programBody = z.object({
  key: programKey.optional(),
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(["draft", "active", "closed"]).optional(),
  eligibility: z
    .object({
      countries: z.array(z.string().trim().toUpperCase().length(2)).max(200).optional(),
      planKeys: z.array(z.string().trim().toLowerCase().max(64)).max(50).optional(),
    })
    .optional(),
  featureOverrides: z.array(featureOverridePair).max(FLAG_KEYS.length).optional(),
  limitOverrides: limitOverridesSchema.optional(),
  startsAt: isoDate.nullable().optional(),
  endsAt: isoDate.nullable().optional(),
});

export const createProgramSchema = z.object({
  body: programBody.extend({ key: programKey, name: z.string().trim().min(2).max(120), reason }),
});

export const updateProgramSchema = z.object({
  // Status changes via PATCH are limited to draft|active; closing goes through
  // POST /:id/close (typed confirm + reason), and closed cannot be reopened.
  body: programBody.omit({ key: true }).extend({ status: z.enum(["draft", "active"]).optional(), reason }),
});

export const closeProgramSchema = z.object({ body: z.object({ reason }) });

export const addMemberSchema = z.object({
  body: z.object({ tenantId: z.string().regex(/^[a-f0-9]{24}$/i), reason }),
});

export const paginationQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    status: z.enum(["draft", "active", "closed"]).optional(),
    q: z.string().trim().max(100).optional(),
  }),
});

export const createTenantFeatureOverrideSchema = z.object({
  body: z.object({
    key: booleanFlagKey,
    value: z.boolean(),
    reason,
    endsAt: isoDate.nullable().optional(),
  }),
});

export const revokeSchema = z.object({ body: z.object({ reason }) });

export const setLimitOverridesSchema = z.object({
  body: z.object({ limitOverrides: limitOverridesSchema, reason }),
});
