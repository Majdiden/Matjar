/**
 * Consent-based impersonation controllers.
 *
 * Two audiences share this file:
 *   - OWNER side  (merchant dashboard, `authenticate` + tenant context):
 *       getState, approve, deny, revoke.
 *   - SUPPORT side (platform admin, `platformAuthenticate` + requireScope):
 *       request, approveByCode, enter, exit.
 *
 * All business logic + audit + realtime lives in services/impersonation.js.
 * These handlers only marshal request identity into the service.
 */

import mongoose from "mongoose";
import { asyncHandler } from "../middlewares/errorHandler.js";
import {
  requestImpersonation,
  approveImpersonation,
  denyImpersonation,
  enterImpersonation,
  endImpersonation,
  getImpersonationState,
} from "../services/impersonation.js";
import { createScopedModels } from "../utils/scopedModel.js";
import logger from "../utils/logger.js";

// Map service-thrown validation errors to 400 (vs a 500). The service
// throws plain Error with a human message for every expected rejection.
function sendServiceError(res, err, fallback = "Request failed.") {
  const msg = err?.message || fallback;
  return res.status(400).json({ success: false, message: msg });
}

// ---------------------------------------------------------------------------
// Owner side (merchant dashboard)
// ---------------------------------------------------------------------------

/**
 * GET /api/impersonation/state
 * Drives the whole dashboard shell: pending consent popups (owner only),
 * the active session (freeze overlay for owner / banner for support), and
 * which role the current viewer is.
 */
export const getStateController = asyncHandler(async (req, res) => {
  const viewerRole = req.impersonation ? "support" : "owner";
  const state = await getImpersonationState({
    tenantId: req.tenantId,
    viewerRole,
    ownerUserId: req.user.userId,
  });
  res.json({ success: true, data: state });
});

/** POST /api/impersonation/:grantId/approve — owner clicks Approve. */
export const approveController = asyncHandler(async (req, res) => {
  try {
    const grant = await approveImpersonation({
      tenantId: req.tenantId,
      grantId: req.params.grantId,
      ownerUserId: req.user.userId,
      method: "dashboard",
    });
    res.json({ success: true, data: grant });
  } catch (err) {
    return sendServiceError(res, err);
  }
});

/** POST /api/impersonation/:grantId/deny — owner declines. */
export const denyController = asyncHandler(async (req, res) => {
  try {
    const grant = await denyImpersonation({
      tenantId: req.tenantId,
      grantId: req.params.grantId,
      ownerUserId: req.user.userId,
    });
    res.json({ success: true, data: grant });
  } catch (err) {
    return sendServiceError(res, err);
  }
});

/**
 * POST /api/impersonation/:grantId/revoke — owner ends the live session.
 * Immediate: the grant flips to cancelled and the next impersonated request
 * 401s. The support session is kicked via the realtime channel.
 */
export const revokeController = asyncHandler(async (req, res) => {
  try {
    const grant = await endImpersonation({
      tenantId: req.tenantId,
      grantId: req.params.grantId,
      by: "owner",
      actorId: req.user.userId,
    });
    logger.warn("Impersonation revoked by owner", {
      tenantId: String(req.tenantId),
      grantId: req.params.grantId,
    });
    res.json({ success: true, data: grant });
  } catch (err) {
    return sendServiceError(res, err);
  }
});

/**
 * POST /api/impersonation/:grantId/exit-self
 * Called by the IMPERSONATING session itself (support inside the merchant
 * dashboard, holding only the tenant impersonation token). Ends the grant
 * the current token is bound to. The token's `impersonation` claim is the
 * authorization — support can only exit the exact grant they're running.
 */
export const exitSelfController = asyncHandler(async (req, res) => {
  if (!req.impersonation || req.impersonation.grantId !== req.params.grantId) {
    return res
      .status(403)
      .json({ success: false, message: "Not an impersonated session for this grant." });
  }
  try {
    const grant = await endImpersonation({
      tenantId: req.tenantId,
      grantId: req.params.grantId,
      by: "support",
      actorId: req.impersonation.supportUserId,
    });
    res.json({ success: true, data: grant });
  } catch (err) {
    return sendServiceError(res, err);
  }
});

// ---------------------------------------------------------------------------
// Support side (platform admin)
// ---------------------------------------------------------------------------

/**
 * POST /api/platform/tenants/:tenantId/impersonation/request
 * Support requests access to a store for a ticket. Pushes a consent popup
 * to the owner. Returns the grant (no code — that only shows in the owner's
 * dashboard) so support can poll for approval.
 */
export const requestController = asyncHandler(async (req, res) => {
  try {
    const grant = await requestImpersonation({
      platformUser: req.platformUser,
      tenantId: req.params.tenantId,
      ticket: req.body?.ticket,
    });
    logger.warn("Impersonation requested", {
      tenantId: req.params.tenantId,
      by: req.platformUser.email,
      ticket: grant.ticket,
    });
    res.status(201).json({ success: true, data: grant });
  } catch (err) {
    return sendServiceError(res, err);
  }
});

/**
 * GET /api/platform/tenants/:tenantId/impersonation/:grantId
 * Poll a grant's status while waiting for the owner to approve.
 */
export const pollController = asyncHandler(async (req, res) => {
  try {
    // Sweep so a lapsed request/session self-expires while support polls.
    await getImpersonationState({
      tenantId: req.params.tenantId,
      viewerRole: "support",
      ownerUserId: null,
    });
    const models = createScopedModels(mongoose.connection, req.params.tenantId);
    const g = await models.ImpersonationGrant.findById(req.params.grantId)
      .select("status ticket sessionExpiresAt approvalExpiresAt supportUserId")
      .lean();
    if (!g) return res.status(404).json({ success: false, message: "Grant not found." });
    if (String(g.supportUserId) !== String(req.platformUser.id)) {
      return res.status(403).json({ success: false, message: "Not your grant." });
    }
    res.json({
      success: true,
      data: {
        grantId: String(g._id),
        status: g.status,
        ticket: g.ticket,
        sessionExpiresAt: g.sessionExpiresAt,
        approvalExpiresAt: g.approvalExpiresAt,
      },
    });
  } catch (err) {
    return sendServiceError(res, err);
  }
});

/**
 * POST /api/platform/tenants/:tenantId/impersonation/:grantId/approve-code
 * Phone fallback: the owner read the 6-char code to support, who enters it
 * here to approve on the owner's behalf.
 */
export const approveByCodeController = asyncHandler(async (req, res) => {
  try {
    const grant = await approveImpersonation({
      tenantId: req.params.tenantId,
      grantId: req.params.grantId,
      method: "code",
      code: req.body?.code,
    });
    logger.warn("Impersonation approved by code", {
      tenantId: req.params.tenantId,
      by: req.platformUser.email,
      grantId: req.params.grantId,
    });
    res.json({ success: true, data: grant });
  } catch (err) {
    return sendServiceError(res, err);
  }
});

/**
 * POST /api/platform/tenants/:tenantId/impersonation/:grantId/enter
 * Consume an approved grant: mint the impersonation token + freeze the owner.
 */
export const enterController = asyncHandler(async (req, res) => {
  try {
    const result = await enterImpersonation({
      platformUser: req.platformUser,
      tenantId: req.params.tenantId,
      grantId: req.params.grantId,
    });
    logger.warn("Impersonation session started", {
      tenantId: req.params.tenantId,
      by: req.platformUser.email,
      grantId: req.params.grantId,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    return sendServiceError(res, err);
  }
});

/**
 * POST /api/platform/tenants/:tenantId/impersonation/:grantId/exit
 * Support exits — unfreezes the owner and ends the grant.
 */
export const exitController = asyncHandler(async (req, res) => {
  try {
    const grant = await endImpersonation({
      tenantId: req.params.tenantId,
      grantId: req.params.grantId,
      by: "support",
      actorId: req.platformUser.id,
    });
    res.json({ success: true, data: grant });
  } catch (err) {
    return sendServiceError(res, err);
  }
});
