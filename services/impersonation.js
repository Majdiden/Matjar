/**
 * Support-staff impersonation.
 *
 * A platform admin can mint a short-lived tenant JWT for any store's
 * admin user so they can reproduce a bug or walk a merchant through
 * a flow. Every mint is audit-logged with:
 *   - platformUserId (who)
 *   - tenantId (into which store)
 *   - impersonatedUserId (as whom)
 *   - reason (free text — required; no silent impersonation)
 *
 * Tokens are capped at 30 minutes and carry an `impersonatedBy` claim
 * so downstream audit entries written during the session can be traced
 * back to the real actor, not just the impersonated one.
 */

import crypto from "crypto";
import mongoose from "mongoose";
import { signJWT } from "../utils/misc.js";
import { createScopedModels } from "../utils/scopedModel.js";
import * as repo from "../repositories/impersonation.js";
import { emit } from "./notification.js";
import { IMPERSONATION_TERMINAL } from "../schemas/store/impersonationGrant.js";
import logger from "../utils/logger.js";

const MAX_TTL_SECONDS = 30 * 60;

export async function mintImpersonationToken({
  platformUser,
  tenantId,
  reason,
  ttlSeconds = MAX_TTL_SECONDS,
}) {
  if (!reason || String(reason).trim().length < 4) {
    throw new Error("Impersonation reason is required (min 4 chars)");
  }
  const ttl = Math.min(Math.max(Number(ttlSeconds) || MAX_TTL_SECONDS, 60), MAX_TTL_SECONDS);

  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findById(tenantId);
  if (!tenant) throw new Error("Tenant not found");

  const models = createScopedModels(mongoose.connection, tenant._id);
  const adminUser = await models.User.findOne({ roles: "admin", isActive: true })
    .select("_id email tokenVersion roles")
    .lean();
  if (!adminUser) throw new Error("No admin user found for tenant");

  const token = signJWT(
    {
      userId: String(adminUser._id),
      tenantId: String(tenant._id),
      tokenVersion: adminUser.tokenVersion ?? 0,
      impersonatedBy: platformUser.id,
      impersonationReason: reason.slice(0, 200),
    },
    `${ttl}s`
  );

  // Audit the mint itself into the tenant's own log so the merchant can
  // see that a support agent logged in on their behalf.
  try {
    await models.AuditLog.create({
      tenantId: tenant._id,
      actor: null,
      actorName: `platform:${platformUser.email || platformUser.id}`,
      action: "impersonation.minted",
      resource: "user",
      resourceId: adminUser._id,
      metadata: { reason: reason.slice(0, 200), ttlSeconds: ttl },
    });
  } catch (_) {
    // Audit failures must not block the support workflow.
  }

  return {
    token,
    tenantId: String(tenant._id),
    userId: String(adminUser._id),
    userEmail: adminUser.email,
    expiresIn: ttl,
  };
}

// ===========================================================================
// Consent-based impersonation (Customer Support ⇄ store Owner)
// ===========================================================================
//
// Unlike mintImpersonationToken above (silent, operator-side only), this
// flow REQUIRES the store owner's explicit approval before a token is ever
// minted. The ImpersonationGrant document is the single source of truth and
// is re-checked on every impersonated request (middlewares/auth.js) so an
// owner revoke ends the session instantly.
//
// All state transitions use an atomic findOneAndUpdate guarded on the prior
// status — that IS the single-use / race guard, so no multi-document
// transaction is needed. Notification emit + audit writes are fire-and-forget
// and never block or roll back a transition.

// Approval window: the owner must decide within this. Short so a stale
// request can't be approved much later.
const APPROVAL_WINDOW_SECONDS = 5 * 60;
// Session TTL granted on approval (capped, revocable).
const SESSION_TTL_SECONDS = 45 * 60;

// Unambiguous alphabet (no O/0, I/1) for a code a human reads aloud.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateConsentCode(len = 6) {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

// Normalize a ticket reference: strip a leading "#", trim, cap length.
function normalizeTicket(raw) {
  const s = String(raw ?? "").trim().replace(/^#+/, "").trim();
  return s.slice(0, 40);
}

/** Public (safe) projection of a grant for API responses. Never leaks `code`. */
export function publicGrant(g) {
  if (!g) return null;
  return {
    grantId: String(g._id),
    tenantId: String(g.tenantId),
    status: g.status,
    ticket: g.ticket,
    supportUserId: String(g.supportUserId),
    supportName: g.supportName,
    supportEmail: g.supportEmail,
    ownerUserId: String(g.ownerUserId),
    approvalExpiresAt: g.approvalExpiresAt,
    sessionExpiresAt: g.sessionExpiresAt,
    requestedAt: g.requestedAt,
    approvedAt: g.approvedAt,
    startedAt: g.startedAt,
  };
}

// Fire-and-forget audit write. Never throws into the caller.
function auditGrant(models, action, grant, extra = {}) {
  try {
    models.AuditLog.create({
      tenantId: grant.tenantId,
      actor: extra.actor ?? null,
      actorName: extra.actorName ?? `platform:${grant.supportEmail || grant.supportUserId}`,
      action,
      resource: "impersonation",
      resourceId: grant._id,
      metadata: {
        grantId: String(grant._id),
        ticket: grant.ticket,
        supportUserId: String(grant.supportUserId),
        supportEmail: grant.supportEmail,
        ownerUserId: String(grant.ownerUserId),
        ownerEmail: grant.ownerEmail,
        ...extra.metadata,
      },
    }).catch((err) =>
      logger.warn(`impersonation audit write failed (${action}): ${err?.message}`)
    );
  } catch (err) {
    logger.warn(`impersonation audit threw (${action}): ${err?.message}`);
  }
}

// Emit a realtime notification to the owner user. Because the impersonating
// support session authenticates AS the owner user, a single notification
// addressed to ownerUserId reaches BOTH the owner's real dashboard and the
// support session on the same tenant SSE channel.
function emitToOwner(models, grant, type, { severity = "info", title, body, extraData } = {}) {
  void emit(models, grant.tenantId, {
    type,
    severity,
    title,
    body,
    resourceType: "impersonation",
    resourceId: grant._id,
    recipientUserIds: [grant.ownerUserId],
    data: {
      grantId: String(grant._id),
      ticket: grant.ticket,
      status: grant.status,
      supportName: grant.supportName,
      supportEmail: grant.supportEmail,
      ...extraData,
    },
  });
}

/**
 * Support requests impersonation access to a store, tied to a ticket.
 * Creates the grant (status "requested") and pushes a consent request to
 * the store owner in real time (SSE + Web Push). Returns the operator-safe
 * grant shape (no code — the code only ever appears in the owner's session).
 */
export async function requestImpersonation({ platformUser, tenantId, ticket }) {
  const normalizedTicket = normalizeTicket(ticket);
  if (!normalizedTicket) throw new Error("A support ticket number is required.");

  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findById(tenantId).select("_id name isActive");
  if (!tenant || !tenant.isActive) throw new Error("Tenant not found.");

  const models = createScopedModels(mongoose.connection, tenant._id);

  // The store owner is the tenant's admin user — the same identity the
  // impersonation token will assume, and the only one who can consent.
  const owner = await models.User.findOne({ roles: "admin", isActive: true })
    .select("_id email name firstName lastName")
    .lean();
  if (!owner) throw new Error("No store owner (admin) found for this store.");

  // Guard: refuse to stack a second live request from the same operator for
  // the same store while one is still pending/active — avoids a pile of
  // popups on the owner and ambiguous approvals.
  const existing = await models.ImpersonationGrant.findOne({
    supportUserId: platformUser.id,
    status: { $in: ["requested", "approved", "active"] },
  }).lean();
  if (existing) {
    if (existing.status === "requested" && existing.approvalExpiresAt > new Date()) {
      throw new Error("You already have a pending request for this store.");
    }
    if (["approved", "active"].includes(existing.status) && existing.sessionExpiresAt > new Date()) {
      throw new Error("You already have an active session for this store.");
    }
  }

  const now = new Date();
  const grant = await repo.createGrant(models, {
    supportUserId: platformUser.id,
    supportName: platformUser.name,
    supportEmail: platformUser.email,
    ownerUserId: owner._id,
    ownerName: owner.name || [owner.firstName, owner.lastName].filter(Boolean).join(" "),
    ownerEmail: owner.email,
    ticket: normalizedTicket,
    status: "requested",
    code: generateConsentCode(),
    approvalExpiresAt: new Date(now.getTime() + APPROVAL_WINDOW_SECONDS * 1000),
    requestedAt: now,
  });

  auditGrant(models, "impersonation.requested", grant, {
    metadata: { approvalWindowSeconds: APPROVAL_WINDOW_SECONDS },
  });

  // Owner consent popup — carries the code so the owner can read it to
  // support on the phone (fallback approval path). Only the owner receives it.
  emitToOwner(models, grant, "impersonation.requested", {
    severity: "warning",
    title: "Customer support is requesting access",
    body: `Support wants to access your store for ticket #${grant.ticket}. Approve only if you are working with them.`,
    extraData: { code: grant.code, approvalExpiresAt: grant.approvalExpiresAt },
  });

  return { ...publicGrant(grant), storeName: tenant.name };
}

/**
 * Owner approves a pending request from their authenticated dashboard
 * (primary path) OR support submits the code the owner read to them
 * (fallback path). Either way the owner must have consented.
 *
 *  - method "dashboard": ownerUserId must match the grant's owner.
 *  - method "code": the submitted code must match; identity is the support
 *    operator (they don't hold an owner session).
 */
export async function approveImpersonation({ tenantId, grantId, ownerUserId, method, code }) {
  const models = createScopedModels(mongoose.connection, tenantId);
  const grant = await repo.findGrantById(models, grantId);
  if (!grant) throw new Error("Request not found.");
  if (grant.status !== "requested") {
    throw new Error(
      IMPERSONATION_TERMINAL.includes(grant.status)
        ? "This request is no longer pending."
        : "This request has already been handled."
    );
  }
  if (grant.approvalExpiresAt <= new Date()) {
    await repo.transitionGrant(models, grantId, ["requested"], {
      status: "expired",
      endedBy: "system",
      endedAt: new Date(),
    });
    auditGrant(models, "impersonation.expired", grant, { metadata: { phase: "approval" } });
    throw new Error("This request has expired.");
  }

  if (method === "dashboard") {
    if (String(grant.ownerUserId) !== String(ownerUserId)) {
      throw new Error("Only the store owner can approve this request.");
    }
  } else if (method === "code") {
    if (!code || String(code).trim().toUpperCase() !== grant.code) {
      throw new Error("Incorrect consent code.");
    }
  } else {
    throw new Error("Invalid approval method.");
  }

  const now = new Date();
  const updated = await repo.transitionGrant(models, grantId, ["requested"], {
    status: "approved",
    approvedAt: now,
    approvalMethod: method,
    sessionExpiresAt: new Date(now.getTime() + SESSION_TTL_SECONDS * 1000),
  });
  if (!updated) throw new Error("This request has already been handled.");

  auditGrant(models, "impersonation.approved", updated, {
    actor: method === "dashboard" ? ownerUserId : null,
    actorName: method === "dashboard" ? updated.ownerEmail : `platform:${updated.supportEmail}`,
    metadata: { approvalMethod: method, sessionTtlSeconds: SESSION_TTL_SECONDS },
  });

  // Tell the owner's dashboard the request was approved (dismiss the popup,
  // and once support enters, the freeze overlay takes over).
  emitToOwner(models, updated, "impersonation.approved", {
    severity: "info",
    title: "Support access approved",
    body: `You approved support access for ticket #${updated.ticket}.`,
  });

  return publicGrant(updated);
}

/** Owner denies a pending request. */
export async function denyImpersonation({ tenantId, grantId, ownerUserId }) {
  const models = createScopedModels(mongoose.connection, tenantId);
  const grant = await repo.findGrantById(models, grantId);
  if (!grant) throw new Error("Request not found.");
  if (String(grant.ownerUserId) !== String(ownerUserId)) {
    throw new Error("Only the store owner can deny this request.");
  }
  if (grant.status !== "requested") {
    throw new Error("This request is no longer pending.");
  }
  const updated = await repo.transitionGrant(models, grantId, ["requested"], {
    status: "denied",
    deniedAt: new Date(),
    endedBy: "owner",
  });
  if (!updated) throw new Error("This request is no longer pending.");

  auditGrant(models, "impersonation.denied", updated, {
    actor: ownerUserId,
    actorName: updated.ownerEmail,
  });
  emitToOwner(models, updated, "impersonation.denied", {
    severity: "info",
    title: "Support access denied",
    body: `You denied support access for ticket #${updated.ticket}.`,
  });
  return publicGrant(updated);
}

/**
 * Support "enters" an approved grant — this is the single-use consumption:
 * approved → active, mints the impersonation token, and freezes the owner.
 * Only the requesting operator can enter, and only from "approved".
 */
export async function enterImpersonation({ platformUser, tenantId, grantId }) {
  const models = createScopedModels(mongoose.connection, tenantId);
  const grant = await repo.findGrantById(models, grantId);
  if (!grant) throw new Error("Grant not found.");
  if (String(grant.supportUserId) !== String(platformUser.id)) {
    throw new Error("This grant belongs to another operator.");
  }
  if (grant.status !== "approved") {
    throw new Error(
      grant.status === "active"
        ? "This session is already active."
        : "This grant is not approved (it may have expired or been revoked)."
    );
  }
  if (!grant.sessionExpiresAt || grant.sessionExpiresAt <= new Date()) {
    await repo.transitionGrant(models, grantId, ["approved"], {
      status: "expired",
      endedBy: "system",
      endedAt: new Date(),
    });
    auditGrant(models, "impersonation.expired", grant, { metadata: { phase: "session" } });
    throw new Error("This grant has expired.");
  }

  const now = new Date();
  const updated = await repo.transitionGrant(models, grantId, ["approved"], {
    status: "active",
    startedAt: now,
  });
  if (!updated) throw new Error("This grant is no longer usable.");

  // Mint the impersonation token bound to this grant. TTL = remaining
  // session window. The token assumes the owner user's identity but carries
  // the `impersonation` claim so every request is tagged + revocation-checked.
  const owner = await models.User.findById(updated.ownerUserId)
    .select("_id email tokenVersion")
    .lean();
  if (!owner) throw new Error("Store owner user no longer exists.");

  const remainingSeconds = Math.max(
    60,
    Math.floor((new Date(updated.sessionExpiresAt).getTime() - Date.now()) / 1000)
  );
  const token = signJWT(
    {
      userId: String(owner._id),
      tenantId: String(tenantId),
      tokenVersion: owner.tokenVersion ?? 0,
      // Legacy fields consumed by utils/audit.js to attribute actions.
      impersonatedBy: String(platformUser.id),
      impersonationReason: `ticket #${updated.ticket}`,
      // Consent-grant binding — checked on every request by auth middleware.
      impersonation: {
        grantId: String(updated._id),
        supportUserId: String(platformUser.id),
        ticket: updated.ticket,
      },
    },
    `${remainingSeconds}s`
  );

  auditGrant(models, "impersonation.started", updated, {
    metadata: { sessionExpiresAt: updated.sessionExpiresAt },
  });

  // Freeze the owner's dashboard.
  emitToOwner(models, updated, "impersonation.started", {
    severity: "warning",
    title: "Support session started",
    body: `Customer support is now assisting with ticket #${updated.ticket}.`,
    extraData: { sessionExpiresAt: updated.sessionExpiresAt },
  });

  return {
    token,
    grantId: String(updated._id),
    tenantId: String(tenantId),
    userId: String(owner._id),
    userEmail: owner.email,
    ticket: updated.ticket,
    expiresIn: remainingSeconds,
  };
}

/**
 * End a live grant. `by`:
 *   - "support": operator clicked "Exit impersonation".
 *   - "owner":   owner clicked "End session" (revoke). Immediate — the next
 *                impersonated request 401s because the grant is no longer active.
 * Emits an unfreeze/kick to the shared owner channel either way.
 */
export async function endImpersonation({ tenantId, grantId, by, actorId }) {
  const models = createScopedModels(mongoose.connection, tenantId);
  const grant = await repo.findGrantById(models, grantId);
  if (!grant) throw new Error("Grant not found.");

  if (by === "owner" && String(grant.ownerUserId) !== String(actorId)) {
    throw new Error("Only the store owner can end this session.");
  }
  if (by === "support" && String(grant.supportUserId) !== String(actorId)) {
    throw new Error("This grant belongs to another operator.");
  }

  if (IMPERSONATION_TERMINAL.includes(grant.status)) {
    // Idempotent — already ended; just report the terminal state.
    return publicGrant(grant);
  }

  const now = new Date();
  const nextStatus = by === "owner" ? "cancelled" : "ended";
  const set = { status: nextStatus, endedAt: now, endedBy: by };
  if (by === "owner") set.revokedAt = now;

  const updated = await repo.transitionGrant(
    models,
    grantId,
    ["requested", "approved", "active"],
    set
  );
  if (!updated) return publicGrant(grant);

  const startedMs = updated.startedAt ? new Date(updated.startedAt).getTime() : null;
  const durationMs = startedMs ? now.getTime() - startedMs : null;

  auditGrant(models, `impersonation.${nextStatus}`, updated, {
    actor: by === "owner" ? actorId : null,
    actorName: by === "owner" ? updated.ownerEmail : `platform:${updated.supportEmail}`,
    metadata: { endedBy: by, durationMs },
  });

  // Unfreeze the owner + kick the support session (same shared channel).
  emitToOwner(models, updated, by === "owner" ? "impersonation.revoked" : "impersonation.ended", {
    severity: "info",
    title: by === "owner" ? "Support session ended by you" : "Support session ended",
    body:
      by === "owner"
        ? `You ended the support session for ticket #${updated.ticket}.`
        : `Customer support finished assisting with ticket #${updated.ticket}.`,
  });

  return publicGrant(updated);
}

/**
 * State for the dashboard shell (drives the consent popup, freeze overlay,
 * and support banner). Sweeps expiries first so a reload after the window
 * lapsed doesn't show a stale popup/overlay.
 *
 * viewerRole: "support" when the caller holds an impersonation token,
 * otherwise "owner". The overlay (owner) vs banner (support) is chosen off this.
 */
export async function getImpersonationState({ tenantId, viewerRole, ownerUserId }) {
  const models = createScopedModels(mongoose.connection, tenantId);

  const expired = await repo.sweepExpired(models);
  for (const g of expired) {
    auditGrant(models, "impersonation.expired", g, { metadata: { phase: "sweep" } });
    emitToOwner(models, { ...g, status: "expired" }, "impersonation.expired", {
      severity: "info",
      title: "Support request expired",
      body: `The support request for ticket #${g.ticket} expired.`,
    });
  }

  const active = await repo.findActiveForTenant(models);

  // Only the real owner sees pending consent popups; a support session never
  // needs to approve anything.
  let pending = [];
  if (viewerRole === "owner") {
    const rows = await repo.listPendingForTenant(models);
    // Include the code so the owner can read it to support (fallback path).
    pending = rows
      .filter((g) => String(g.ownerUserId) === String(ownerUserId))
      .map((g) => ({ ...publicGrant(g), code: g.code }));
  }

  // Attach the store name so the support banner can read "Impersonating <Store>".
  let storeName = null;
  if (active) {
    try {
      const Tenant = mongoose.model("Tenant");
      const t = await Tenant.findById(tenantId).select("name").lean();
      storeName = t?.name || null;
    } catch {
      /* non-fatal */
    }
  }
  const activePublic = active ? { ...publicGrant(active), storeName } : null;

  return { viewerRole, pending, active: activePublic };
}

