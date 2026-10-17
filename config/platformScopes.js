/**
 * Platform-admin permission scopes — a LEAF module (no imports) so that
 * config/platformRoles.js, middlewares/platformAdmin.js and any service can
 * import it in any order without a circular-evaluation crash.
 *
 * middlewares/platformAdmin.js re-exports PLATFORM_SCOPES for existing callers.
 */
export const PLATFORM_SCOPES = Object.freeze({
  SUPPORT_READ: "support.read",
  SUPPORT_IMPERSONATE: "support.impersonate",
  TENANT_LIFECYCLE: "tenant.lifecycle",
  TENANT_EXPORT: "tenant.export",
  QUEUE_RETRY: "queue.retry",
  BILLING_READ: "billing.read",
  BILLING_WRITE: "billing.write", // plans, commission policies, overrides, statements, record payments
  AUDIT_READ: "audit.read", // platform audit ledger + tenant activity
  PLATFORM_USERS: "platform.users", // invite/suspend/role-change platform staff, revoke sessions
  TENANT_USERS: "tenant.users", // view/revoke merchant staff access from the console
  FLAGS_WRITE: "flags.write", // feature flags, access programs, overrides
  PAYMENTS_WRITE: "payments.write", // platform payment-method catalog (what merchants may enable)
  ANNOUNCEMENTS_SEND: "announcements.send", // send notifications to every store or one store
  // Signup invitation codes: create, list and revoke one's own codes and see
  // the stores registered with them. Owners and promoters only (never admin
  // by role; an owner may grant it).
  INVITE_CODES: "invite_codes.manage",
  // Permanently delete a store and all of its data. Held by OWNER only; an
  // owner may grant it to individual staff (config/platformRoles.js →
  // OWNER_ONLY_GRANTS). Never part of any other role.
  TENANT_DELETE: "tenant.delete",
});
export const ALL_PLATFORM_SCOPES = Object.freeze(Object.values(PLATFORM_SCOPES));
