import { z } from "zod";

/**
 * Zod schemas for the platform billing API (routes/platform/billing.js) and
 * the merchant billing API (routes/billing.js). Tier tables are validated
 * structurally here and semantically (ascending, open-ended last tier) in
 * services/platform/billing/calculator.js → normalizeTiers.
 */

const key = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-_]{0,63}$/, "lowercase slug");
const currency = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "ISO-4217 code");
const money = z.number().finite().min(0);
const periodKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "YYYY-MM");
const reason = z.string().trim().min(3).max(500);

export const tierSchema = z.object({
  upTo: z.number().finite().positive().nullable(),
  percent: z.number().finite().min(0).max(100),
  fixedPerOrder: money.optional(),
});

const policyBody = z.object({
  key: key.optional(),
  name: z.string().trim().min(2).max(80),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
  basis: z.enum(["gmv", "order_count"]).optional(),
  gmvScope: z.enum(["delivered", "paid", "placed"]).optional(),
  recognitionEvent: z.enum(["delivered", "paid"]).optional(),
  period: z.enum(["calendar_month", "rolling_30d", "lifetime"]).optional(),
  tierMode: z.enum(["marginal", "bracket"]).optional(),
  tiers: z.array(tierSchema).min(1).max(20),
  perOrder: z
    .object({ minFee: money.nullable().optional(), maxFee: money.nullable().optional() })
    .optional(),
  periodCap: money.nullable().optional(),
  paymentMethods: z.union([z.literal("all"), z.array(z.string().trim().min(1).max(40)).max(50)]).optional(),
  currency: currency.optional(),
  rounding: z.enum(["nearest", "up", "down"]).optional(),
  precision: z.number().int().min(0).max(4).optional(),
});

export const createPolicySchema = z.object({ body: policyBody.extend({ key }) });
export const updatePolicySchema = z.object({
  body: policyBody.partial().refine((b) => Object.keys(b).length > 0, { message: "Nothing to update" }),
  params: z.object({ id: z.string().min(1) }),
});

export const billingSettingsSchema = z.object({
  body: z.object({
    defaultCommissionPolicyKey: key.nullable().optional(),
    defaultPlanKey: key.optional(),
    billingStartPeriod: periodKey.nullable().optional(),
    statementDay: z.number().int().min(1).max(28).optional(),
    dueDays: z.number().int().min(0).max(90).optional(),
    graceDays: z.number().int().min(0).max(180).optional(),
    enforcement: z.object({ onOverdue: z.enum(["none", "warn", "read_only", "suspend"]) }).optional(),
  }),
});

export const createOverrideSchema = z.object({
  body: z
    .object({
      baseFee: z
        .object({ amount: money, currency: currency.optional(), interval: z.enum(["month", "year"]).optional() })
        .optional(),
      commissionPolicyKey: key.nullable().optional(),
      percentDelta: z.number().finite().min(-100).max(100).nullable().optional(),
      feeHolidayUntil: z.string().datetime().nullable().optional(),
      startsAt: z.string().datetime().optional(),
      endsAt: z.string().datetime().nullable().optional(),
      reason,
    })
    .refine(
      (b) => b.baseFee || b.commissionPolicyKey || b.percentDelta != null || b.feeHolidayUntil,
      { message: "An override must change at least one of baseFee, commissionPolicyKey, percentDelta or feeHolidayUntil" }
    )
    // (M6) A fee holiday must be time-boxed: either the holiday date itself
    // or endsAt bounds it (both are dates; the holiday date is the bound).
    .refine((b) => !b.feeHolidayUntil || b.endsAt || b.feeHolidayUntil, { message: "feeHolidayUntil must be bounded" })
    .refine((b) => !(b.endsAt && b.startsAt) || new Date(b.endsAt) > new Date(b.startsAt), { message: "endsAt must be after startsAt" }),
});

export const previewPolicySchema = z.object({
  body: z.object({
    policy: z.union([key, policyBody.pick({ tiers: true, tierMode: true, basis: true, perOrder: true, periodCap: true, currency: true, rounding: true, precision: true }).partial({ tierMode: true, basis: true, perOrder: true, periodCap: true, currency: true, rounding: true, precision: true })]),
    periodBasisSoFar: money.optional(),
    periodFeeSoFar: money.optional(),
    orderAmount: money,
    fxRateToPolicyCurrency: z.number().finite().positive().nullable().optional(),
    percentDelta: z.number().finite().min(-100).max(100).optional(),
  }),
});

export const fxTableSchema = z.object({
  body: z.object({
    base: currency.optional(),
    rates: z.record(z.string().regex(/^[A-Za-z]{3}$/), z.number().finite().positive()).refine((r) => Object.keys(r).length <= 200, "too many rates"),
  }),
});

export const revokeOverrideSchema = z.object({ body: z.object({ reason }) });

export const adjustmentSchema = z.object({
  body: z.object({
    amount: z.number().finite().refine((n) => n !== 0, "amount must be non-zero"),
    reason,
    periodKey: periodKey.optional(),
  }),
});

export const generateStatementSchema = z.object({
  body: z.object({ periodKey, force: z.boolean().optional() }),
});

export const paymentSchema = z.object({
  body: z.object({
    amount: z.number().finite().positive(),
    method: z.enum(["bankak", "bank_transfer", "cash", "gateway", "other"]),
    reference: z.string().trim().max(120).optional(),
    note: z.string().trim().max(500).optional(),
  }),
});

export const reasonOnlySchema = z.object({ body: z.object({ reason }) });

export const runPeriodSchema = z.object({ body: z.object({ periodKey: periodKey.optional() }) });

export const operatorPlanChangeSchema = z.object({
  body: z.object({
    toPlan: key,
    effectiveAt: z.enum(["immediately", "next_period"]).optional(),
    reason: reason.optional(),
  }),
});

export const merchantPlanChangeSchema = z.object({
  body: z.object({ toPlan: key }),
});

export const listStatementsQuerySchema = z.object({
  query: z.object({
    status: z.enum(["draft", "issued", "paid", "partially_paid", "overdue", "waived", "void"]).optional(),
    tenantId: z.string().regex(/^[a-f0-9]{24}$/).optional(),
    periodKey: periodKey.optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

export const ledgerQuerySchema = z.object({
  query: z.object({
    periodKey: periodKey.optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
});
