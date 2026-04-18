import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/authorize.js";
import { asyncHandler } from "../middlewares/errorHandler.js";

const router = Router();
router.use(authenticate, requirePermission("audit.read"));

router.get("/", asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, resource, action, actor } = req.query;
  const filter = {};
  if (resource) filter.resource = { $regex: `^${resource}$`, $options: "i" };
  if (action) filter.action = { $regex: action, $options: "i" };
  if (actor) filter.actor = actor;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [logsRaw, total] = await Promise.all([
    req.models.AuditLog.find(filter)
      .populate("actor", "name email firstName lastName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    req.models.AuditLog.countDocuments(filter),
  ]);

  // Flatten the actor relation into a stable display string so the
  // dashboard table doesn't have to know about populate shapes or fall
  // back logic for system / deleted-user events.
  const logs = logsRaw.map((l) => {
    const a = l.actor;
    let actorDisplay = l.actorName || "system";
    if (a && typeof a === "object") {
      actorDisplay =
        a.name ||
        [a.firstName, a.lastName].filter(Boolean).join(" ") ||
        a.email ||
        "system";
    }
    return {
      ...l,
      actor: a?._id ? String(a._id) : (typeof a === "string" ? a : null),
      actorDisplay,
      actorEmail: a?.email,
    };
  });

  res.json({
    success: true,
    data: { logs, pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } },
  });
}));

export default router;
