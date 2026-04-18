import { Schema, Types } from "mongoose";

// Per-notification-type delivery preferences. Shape:
//   { [type]: { inApp, sound, browser, email } }
// Stored as Mixed because the type catalog grows organically — locking it
// to a nested schema would require a migration every time we add a new
// notification type.

const tenantUserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  tenantId: {
    type: Types.ObjectId,
    ref: "Tenant",
  },

  // Platform-admin flag. Users with this flag can authenticate against
  // the platform-admin surfaces (cross-tenant support tooling, tenant
  // list / suspension / impersonation) without being scoped to a
  // particular tenant. Defaults false — must be set manually in the
  // admin DB by whoever bootstrapped the platform.
  platformAdmin: { type: Boolean, default: false, index: true },

  // Bcrypt hash of the platform-admin password. Only populated when
  // platformAdmin === true; regular tenant users authenticate against
  // their tenant's User collection, not this one. `select:false` so a
  // bulk find never returns the hash accidentally.
  platformPasswordHash: { type: String, default: null, select: false },

  // Fine-grained platform-admin permission scopes. Each scope gates a
  // category of cross-tenant actions (see middlewares/platformAdmin.js
  // → PLATFORM_SCOPES). Named `platformScopes` (not `roles`) to keep
  // clear separation from per-tenant role arrays. Empty by default —
  // platformAdmin:true alone no longer implies full permission in new
  // code, but a migration fallback keeps legacy admins working.
  platformScopes: { type: [String], default: [] },

  notificationPreferences: { type: Schema.Types.Mixed, default: {} },

  createdAt: { type: Date, default: Date.now },
});

export default tenantUserSchema;
