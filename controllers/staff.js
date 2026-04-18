import * as StaffService from "../services/staff.js";
import { APIError, asyncHandler } from "../middlewares/errorHandler.js";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { createScopedModels } from "../utils/scopedModel.js";

const hashInviteToken = (raw) =>
  crypto.createHash("sha256").update(raw).digest("hex");

async function ensureInviteTenantContext(req, rawToken) {
  if (req.models && req.tenantId) return;
  if (!rawToken) return;

  const invite = await mongoose.connection.db.collection("staffinvites").findOne(
    { token: hashInviteToken(rawToken) },
    { projection: { tenantId: 1 } }
  );

  if (!invite?.tenantId) {
    throw new APIError("Invalid invitation token", 404);
  }
  req.tenantId = invite.tenantId;
  req.models = createScopedModels(mongoose.connection, invite.tenantId);
}

// ── Staff users ───────────────────────────────────────────────────────────────

export const listStaff = asyncHandler(async (req, res) => {
  const staff = await StaffService.listStaff(req.models);
  res.json({ success: true, data: { staff } });
});

export const getStaff = asyncHandler(async (req, res) => {
  const member = await StaffService.getStaff(req.models, req.params.id);
  res.json({ success: true, data: member });
});

export const updateStaffRole = asyncHandler(async (req, res) => {
  const { roles, customRoleIds } = req.body || {};
  const updated = await StaffService.updateStaffRole(
    req.models,
    req.params.id,
    { roles, customRoleIds },
    req.user.userId
  );
  res.json({ success: true, data: updated });
});

export const removeStaff = asyncHandler(async (req, res) => {
  await StaffService.removeStaff(req.models, req.params.id, req.user.userId);
  res.json({ success: true });
});

// ── Invites ───────────────────────────────────────────────────────────────────

export const listInvites = asyncHandler(async (req, res) => {
  const invites = await StaffService.listInvites(req.models);
  res.json({ success: true, data: { invites } });
});

export const createInvite = asyncHandler(async (req, res) => {
  const { email, role } = req.body || {};
  const result = await StaffService.createInvite(req.models, req.tenantId, {
    email,
    role,
    invitedById: req.user.userId,
    tenant: req.tenant,
  });
  res.status(201).json({ success: true, data: result });
});

export const resendInvite = asyncHandler(async (req, res) => {
  const result = await StaffService.resendInvite(req.models, req.params.id, { tenant: req.tenant });
  res.json({ success: true, data: result });
});

export const revokeInvite = asyncHandler(async (req, res) => {
  await StaffService.revokeInvite(req.models, req.params.id);
  res.json({ success: true });
});

// ── Public routes (no auth required — invitee has no account yet) ─────────────

export const verifyInvite = asyncHandler(async (req, res) => {
  const { token } = req.query;
  await ensureInviteTenantContext(req, token);
  const info = await StaffService.verifyInviteToken(req.models, token);
  res.json({ success: true, data: info });
});

export const acceptInvite = asyncHandler(async (req, res) => {
  const { token, name, password } = req.body || {};
  await ensureInviteTenantContext(req, token);
  const user = await StaffService.acceptInvite(req.models, req.tenantId, {
    token,
    name,
    password,
  });
  res.status(201).json({ success: true, data: user });
});
