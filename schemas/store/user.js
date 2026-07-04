import { Schema } from "mongoose";
import bcrypt from "bcrypt";
import { applyTenantScope } from "../../utils/tenantScope.js";

const userSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  firstName: { type: String, trim: true },
  lastName: { type: String, trim: true },
  phone: { type: String, trim: true },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    match: [/^[\w.-]+@([\w-]+\.)+[\w-]{2,4}$/, "Invalid email format"],
  },
  password: { type: String, required: true, minlength: 8 },
  // Bumped on every password change (and any other "invalidate all
  // sessions" event). The number is baked into JWTs at issue time and
  // re-checked in the auth middleware — a mismatch means the token was
  // issued before the most recent invalidation event and is rejected.
  // This is what makes "log out everywhere" actually log out everywhere
  // for already-issued access tokens, not just refresh tokens.
  tokenVersion: { type: Number, default: 0 },
  avatar: { type: String, default: null },
  roles: [
    {
      type: String,
      enum: ["admin", "manager", "staff", "customer"],
      default: "customer",
    },
  ],
  // Custom tenant-defined roles layered on top of the built-in role
  // enum above. A user's effective permissions are the UNION of their
  // built-in roles and every custom role here — removing a custom role
  // doesn't strip baseline built-in access.
  customRoleIds: [{ type: Schema.Types.ObjectId, ref: "Role" }],
  // Customer-specific fields
  customerType: { type: String, enum: ["individual", "business"], default: "individual" },
  companyName: { type: String, trim: true },
  taxId: { type: String, trim: true },
  acceptsMarketing: { type: Boolean, default: false },
  marketingConsentAt: { type: Date },
  totalOrders: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0, min: 0 },
  tags: [{ type: String, trim: true }],
  notes: { type: String },
  // Per-type in-app/sound/browser/email delivery prefs. Shape:
  //   { [type]: { inApp, sound, browser, email } }
  notificationPreferences: { type: Schema.Types.Mixed, default: {} },

  addresses: [
    {
      label: { type: String, default: "default" },
      firstName: { type: String },
      lastName: { type: String },
      phone: { type: String },
      addressLine1: { type: String, required: true },
      addressLine2: String,
      city: { type: String, required: true },
      state: String,
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
      isDefault: { type: Boolean, default: false },
    },
  ],
  isActive: { type: Boolean, default: true },
  lastLoginAt: { type: Date },

  // Email-verification state. Set true once the user completes the 4-digit
  // email-OTP flow — either at signup (the registration gate) or later from
  // the dashboard Security page (existing accounts opting in). `null`/false
  // means "never verified"; the dashboard surfaces this as a badge/CTA.
  emailVerified: { type: Boolean, default: false },
  emailVerifiedAt: { type: Date, default: null },

  // Preferred language for this customer's transactional emails. Defaults
  // to the store's language at signup; used to localize order/account mail.
  language: { type: String, default: "en" },

  // ─── Password reset (forgot-password flow) ──────────────────────────
  // We store the SHA-256 hash of the raw token, never the raw token
  // itself. The raw token lives only in the email we send; a DB leak
  // therefore can't be used to mint a reset on someone else's behalf.
  // Tokens are single-use (passwordResetUsedAt is stamped on successful
  // reset) and expire in 1 hour (enforced in the service layer against
  // passwordResetTokenExpiresAt).
  passwordResetTokenHash: { type: String, default: null, index: true },
  passwordResetTokenExpiresAt: { type: Date, default: null },
  passwordResetUsedAt: { type: Date, default: null },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Compound indexes for tenant isolation
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });
userSchema.index({ tenantId: 1, roles: 1 });
userSchema.index({ tenantId: 1, isActive: 1 });
userSchema.index({ tenantId: 1, customerType: 1 });
userSchema.index({ tenantId: 1, tags: 1 });

// Pre-save: hash password if modified + update timestamps
userSchema.pre("save", async function (next) {
  this.updatedAt = Date.now();
  if (this.isModified("password") && !this.password.startsWith("$2b$")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Instance method: compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Ensure password is never returned in JSON
userSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.password;
    return ret;
  },
});

// Apply tenant safety net
applyTenantScope(userSchema);

export default userSchema;
