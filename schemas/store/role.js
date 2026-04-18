import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

// Custom-role definitions per tenant. Built-in roles (admin, manager,
// staff, customer) live in code — they're the fallback the platform
// ships with and can't be edited. Custom roles let a merchant build
// e.g. "Bookkeeper" (orders.read + analytics.read, no writes) or
// "Catalog editor" (products.* only).
//
// A user's effective permissions are the union of built-in role perms
// (resolved via ROLE_PERMISSIONS) and every custom role assigned via
// `user.customRoleIds`. The merge happens in middlewares/authorize.js.
const roleSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, trim: true, maxlength: 500, default: "" },
  // Flat list of permission strings matching the backend's canonical
  // keys (e.g. "products.write", "payments.refund"). No wildcard on
  // custom roles — admins keep "*" via the built-in admin role.
  permissions: [{ type: String, trim: true }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

roleSchema.index({ tenantId: 1, name: 1 }, { unique: true });

roleSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

applyTenantScope(roleSchema);

export default roleSchema;
