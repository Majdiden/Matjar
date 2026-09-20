/**
 * Named platform roles → scope sets. The single source of truth for what an
 * operator role may do; the platform-admin UI renders itself from this list.
 *
 * A platform user carries ONE role (`TenantUser.platformRole`); their
 * effective scopes are the role's scopes plus any explicit `platformScopes`
 * grants (used for one-off elevation, e.g. giving Support the export scope).
 * Authorization is always evaluated server-side against the effective set
 * (middlewares/platformAdmin.js → requireScope).
 *
 * OWNER is the only role that can manage platform users' roles up to OWNER
 * and hold every scope; it must never be assignable by a non-owner.
 */
import { PLATFORM_SCOPES } from "./platformScopes.js";

const S = PLATFORM_SCOPES;

export const PLATFORM_ROLES = Object.freeze({
  OWNER: "owner",
  ADMIN: "admin",
  OPERATIONS: "operations",
  SUPPORT: "support",
  FINANCE: "finance",
  DEVELOPER: "developer",
});

export const PLATFORM_ROLE_DEFS = Object.freeze([
  {
    key: PLATFORM_ROLES.OWNER,
    label: "Owner",
    description: "Full access, including platform staff management and tenant deletion.",
    scopes: Object.values(S),
  },
  {
    key: PLATFORM_ROLES.ADMIN,
    label: "Admin",
    description: "Everything except purging tenants and promoting owners.",
    scopes: Object.values(S),
  },
  {
    key: PLATFORM_ROLES.OPERATIONS,
    label: "Operations",
    description: "Store lifecycle, impersonation, flags, queues, audit.",
    scopes: [
      S.SUPPORT_READ,
      S.SUPPORT_IMPERSONATE,
      S.TENANT_LIFECYCLE,
      S.TENANT_USERS,
      S.FLAGS_WRITE,
      S.QUEUE_RETRY,
      S.AUDIT_READ,
      S.BILLING_READ,
    ],
  },
  {
    key: PLATFORM_ROLES.SUPPORT,
    label: "Support",
    description: "Inspect stores, impersonate with consent, manage merchant staff access.",
    scopes: [S.SUPPORT_READ, S.SUPPORT_IMPERSONATE, S.TENANT_USERS, S.AUDIT_READ],
  },
  {
    key: PLATFORM_ROLES.FINANCE,
    label: "Finance",
    description: "Plans, commission policies, statements and payments.",
    scopes: [S.SUPPORT_READ, S.BILLING_READ, S.BILLING_WRITE, S.AUDIT_READ],
  },
  {
    key: PLATFORM_ROLES.DEVELOPER,
    label: "Developer",
    description: "Read-only inspection plus queues, flags and system health.",
    scopes: [S.SUPPORT_READ, S.QUEUE_RETRY, S.FLAGS_WRITE, S.AUDIT_READ],
  },
]);

export function getRoleDef(key) {
  return PLATFORM_ROLE_DEFS.find((r) => r.key === String(key || "").toLowerCase()) || null;
}

/**
 * Role rank for assignment guards. An actor may only grant/revoke roles
 * strictly below their own rank, except OWNER who may manage every role
 * (including other owners).
 */
const ROLE_RANK = Object.freeze({
  [PLATFORM_ROLES.OWNER]: 100,
  [PLATFORM_ROLES.ADMIN]: 80,
  [PLATFORM_ROLES.OPERATIONS]: 50,
  [PLATFORM_ROLES.FINANCE]: 50,
  [PLATFORM_ROLES.DEVELOPER]: 50,
  [PLATFORM_ROLES.SUPPORT]: 40,
});

export function roleRank(role) {
  return ROLE_RANK[String(role || "").toLowerCase()] ?? 0;
}

export function isValidRole(role) {
  return !!getRoleDef(role);
}

/**
 * May `actorRole` assign `targetRole` to someone (invite or role change)?
 *   - OWNER: any role.
 *   - ADMIN: any role except OWNER.
 *   - everyone else, including legacy admins with no role (null): nothing.
 *     Fail-closed: a legacy scope-only admin must be given a named role
 *     (scripts/create-platform-admin.js --role) before they can manage staff.
 * Both arguments are compared case-insensitively.
 */
export function canAssignRole(actorRole, targetRole) {
  const target = String(targetRole || "").toLowerCase();
  if (!isValidRole(target)) return false;
  const actor = String(actorRole || "").toLowerCase();
  if (actor === PLATFORM_ROLES.OWNER) return true;
  if (actor === PLATFORM_ROLES.ADMIN) return target !== PLATFORM_ROLES.OWNER;
  return false;
}

/**
 * May `actorRole` act on (suspend / change the role of / revoke sessions of)
 * a user who currently holds `subjectRole`? Owners can act on anyone; admins
 * on anyone below owner; nobody else.
 */
export function canActOnRole(actorRole, subjectRole) {
  const actor = String(actorRole || "").toLowerCase();
  const subject = String(subjectRole || "").toLowerCase();
  if (actor === PLATFORM_ROLES.OWNER) return true;
  if (actor === PLATFORM_ROLES.ADMIN) return roleRank(subject) < roleRank(PLATFORM_ROLES.OWNER);
  return false;
}

/** Effective scope set = role scopes ∪ explicit grants (deduped, only known scopes). */
export function resolveEffectiveScopes(role, explicitScopes = []) {
  const known = new Set(Object.values(S));
  const set = new Set();
  const def = getRoleDef(role);
  if (def) def.scopes.forEach((s) => set.add(s));
  for (const s of explicitScopes || []) if (known.has(s)) set.add(s);
  return Array.from(set);
}
