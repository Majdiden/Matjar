import { Router } from "express";
import * as StaffController from "../controllers/staff.js";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import { validateObjectId } from "../middlewares/platformAdmin.js";

const router = Router();
const vid = validateObjectId("id");

// ── Public routes (token-based — no JWT required) ─────────────────────────────
// These must be declared BEFORE the authenticate middleware is applied so that
// unauthenticated invitees can reach them.
router.get("/invites/verify", StaffController.verifyInvite);
router.post("/invites/accept", StaffController.acceptInvite);

// ── Authenticated + admin-only routes ─────────────────────────────────────────
router.use(authenticate, requirePermission("team.manage"));

// Invites — declared before /:id to prevent "invites" being captured as an id
router.get("/invites", StaffController.listInvites);
router.post("/invites", StaffController.createInvite);
router.post("/invites/:id/resend", vid, StaffController.resendInvite);
router.delete("/invites/:id", vid, StaffController.revokeInvite);

// Staff members (parameterised routes last)
router.get("/", StaffController.listStaff);
router.get("/:id", vid, StaffController.getStaff);
router.patch("/:id", vid, StaffController.updateStaffRole);
router.delete("/:id", vid, StaffController.removeStaff);

export default router;
