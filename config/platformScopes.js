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
});
export const ALL_PLATFORM_SCOPES = Object.freeze(Object.values(PLATFORM_SCOPES));
