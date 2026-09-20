import { Schema } from "mongoose";

/**
 * Latest storefront health probe per tenant (admin DB). One row per tenant,
 * upserted by the probe job (every 6h) or an on-demand check. The probe only
 * ever targets hostnames from the platform's own Domain registry and never
 * follows redirects off that host.
 */
const checkSchema = new Schema(
  {
    status: { type: String, enum: ["ok", "error", "skipped"], required: true },
    httpStatus: { type: Number, default: null },
    ms: { type: Number, default: null },
    error: { type: String, default: null },
    url: { type: String, default: null },
  },
  { _id: false }
);

const storefrontHealthSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, unique: true },
    host: { type: String, required: true },
    baseUrl: { type: String, required: true },
    checkedAt: { type: Date, required: true, index: true },
    checks: {
      home: { type: checkSchema, required: true },
      product: { type: checkSchema, required: true },
      cart: { type: checkSchema, required: true },
    },
    ssl: {
      ok: { type: Boolean, default: null },
      expiresAt: { type: Date, default: null },
      error: { type: String, default: null },
    },
    // ok = all checks ok; degraded = home ok but another check failed;
    // error = home failed; unknown = nothing could be probed.
    overall: { type: String, enum: ["ok", "degraded", "error", "unknown"], required: true, index: true },
    source: { type: String, enum: ["cron", "manual"], default: "cron" },
    theme: { slug: { type: String, default: null }, version: { type: String, default: null } },
  },
  { versionKey: false }
);

export default storefrontHealthSchema;
