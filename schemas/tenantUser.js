import { Schema, Types } from "mongoose";

// Per-notification-type delivery preferences. Shape:
//   { [type]: { inApp, sound, browser, email } }
// Stored as Mixed because the type catalog grows organically — locking it
// to a nested schema would require a migration every time we add a new
// notification type.

const tenantUserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  // Merchant contact phone (E.164) + the ISO-3166 alpha-2 country it was
  // entered for. Mirrors the tenant-scoped User row so support tooling can
  // reach the owner without opening the tenant's collection.
  phone: { type: String, default: null, trim: true },
  phoneCountry: { type: String, default: null, uppercase: true, trim: true },
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

  // Named platform role (config/platformRoles.js). Effective scopes are
  // the role's scopes ∪ `platformScopes`. `null` for legacy admins that
  // were bootstrapped with explicit scopes only.
  platformRole: { type: String, default: null, lowercase: true, trim: true },
  // Email alerts this operator receives (config/platformNotificationEvents.js
  // keys). Set by a platform OWNER only.
  platformNotifications: { type: [String], default: [] },
  platformStatus: { type: String, enum: ["active", "suspended"], default: "active" },
  // Bumped to revoke every issued platform token (logout everywhere,
  // suspension, forced password reset). Baked into the JWT at login and
  // re-checked on every request.
  platformTokenVersion: { type: Number, default: 0 },
  platformLastLoginAt: { type: Date, default: null },
  // Set by "force password reset"; the console blocks everything until the
  // operator sets a new password.
  platformMustResetPassword: { type: Boolean, default: false },
  platformSuspendedAt: { type: Date, default: null },
  platformSuspensionReason: { type: String, default: null },
  // Password-reset token (SHA-256 of the raw token, which lives only in the
  // email). `select: false` so it never rides along on a bulk find.
  platformResetTokenHash: { type: String, default: null, select: false },
  platformResetTokenExpiresAt: { type: Date, default: null, select: false },

  // ── Platform-staff MFA (TOTP) ──────────────────────────────────────────
  // The TOTP seed is AES-256-GCM sealed (utils/secretBox.js) and never
  // returned by any endpoint. Enrollment is two-phase: a pending seed is
  // stored until the operator proves possession with a valid code.
  platformMfa: {
    enabled: { type: Boolean, default: false },
    secretSealed: { type: String, default: null, select: false },
    pendingSecretSealed: { type: String, default: null, select: false },
    pendingCreatedAt: { type: Date, default: null, select: false },
    enrolledAt: { type: Date, default: null },
    // Last accepted TOTP step — a code is single-use within its step.
    lastUsedStep: { type: Number, default: null, select: false },
    // SHA-256 hashes of single-use recovery codes; consumed entries are removed.
    recoveryCodeHashes: { type: [String], default: [], select: false },
    recoveryCodesRemaining: { type: Number, default: 0 },
  },

  notificationPreferences: { type: Schema.Types.Mixed, default: {} },

  createdAt: { type: Date, default: Date.now },
});

// One platform account per email (merchant directory rows for the same email
// may still exist per tenant, hence the partial filter).
tenantUserSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { platformAdmin: true }, name: "uniq_platform_user_email" }
);

export default tenantUserSchema;
