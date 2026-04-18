/**
 * Tenant data export — full dump of every collection scoped to a
 * tenant. Used for:
 *   - GDPR tenant-level access requests;
 *   - Migration off the platform;
 *   - Support debugging (read-only snapshots).
 *
 * Returned as a plain JS object. Large tenants should stream this
 * through a BullMQ worker and upload to object storage with a signed
 * URL; callers here can wrap in JSON.stringify for the synchronous
 * path used by admin tooling.
 */

import mongoose from "mongoose";
import { createScopedModels } from "../utils/scopedModel.js";

const EXPORTABLE = [
  "Product", "Category", "Order", "Cart", "User", "Review", "Wishlist",
  "Discount", "Payment", "Fulfillment", "Return", "Inventory",
  "Analytics", "SupportTicket", "CustomerSegment", "CustomField",
  "Company",
];

export async function exportTenantData(tenantId, { include = EXPORTABLE } = {}) {
  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findById(tenantId).lean();
  if (!tenant) throw new Error("Tenant not found");
  // Strip secrets before exporting.
  if (tenant.paymentProviders) {
    if (tenant.paymentProviders.stripe) delete tenant.paymentProviders.stripe.secretKey;
    if (tenant.paymentProviders.paypal) delete tenant.paymentProviders.paypal.clientSecret;
  }
  if (tenant.setupStatus) delete tenant.setupStatus.setupToken;

  const models = createScopedModels(mongoose.connection, tenant._id);
  const collections = {};
  // .lean() bypasses Mongoose toJSON transforms, so fields stripped via
  // schema transforms still leak. Project them out explicitly here.
  const SENSITIVE_PROJECTIONS = {
    User: "-password -passwordResetToken -passwordResetExpires -twoFactorSecret",
  };
  for (const name of include) {
    const Model = models[name];
    if (!Model) continue;
    try {
      const projection = SENSITIVE_PROJECTIONS[name];
      const query = Model.find({});
      if (projection) query.select(projection);
      collections[name] = await query.lean();
    } catch (err) {
      collections[name] = { error: err.message };
    }
  }
  return {
    exportedAt: new Date(),
    tenant,
    collections,
  };
}
