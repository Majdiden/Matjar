/**
 * Per-tenant resource limits — the single list of limit keys shared by the
 * plan catalog (plan.limits), access programs (limitOverrides), tenant
 * overrides (tenant.limitOverrides) and the usage resolver. `null` = unlimited.
 * Not enforced yet (Phase B records and displays only).
 */
export const LIMIT_KEYS = Object.freeze(["maxProducts", "maxStaff", "maxOrdersPerMonth", "maxStorageMB"]);

/** Plan catalog accepts one extra key that has no usage counter yet. */
export const PLAN_LIMIT_KEYS = Object.freeze([...LIMIT_KEYS, "maxApiRequestsPerDay"]);
