/**
 * Platform audit ledger — READ-ONLY controllers. There are deliberately no
 * update/delete handlers: the ledger is append-only.
 */
import mongoose from "mongoose";
import { asyncHandler } from "../../middlewares/errorHandler.js";
import { escapeRegExp, clampInt } from "../../utils/misc.js";
import { getTenantActivity, getPlatformActivity } from "../../services/platform/activity.js";

const MAX_LIMIT = 100;


function parseDate(v) {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d; // undefined = invalid
}

/**
 * GET /api/platform/audit?actor=&action=&tenantId=&resourceType=&from=&to=&page=&limit=
 * `action` matches exactly or as a dotted prefix ("tenant" → tenant.*).
 */
export const listAudit = asyncHandler(async (req, res) => {
  const page = clampInt(req.query.page, 1, 1, 100000);
  const limit = clampInt(req.query.limit, 25, 1, MAX_LIMIT);
  const filter = {};

  if (req.query.actor) {
    const term = String(req.query.actor).trim().slice(0, 120);
    if (term) filter.actorEmail = new RegExp(`^${escapeRegExp(term)}`, "i");
  }
  if (req.query.action) {
    const a = String(req.query.action).trim().slice(0, 80);
    if (!/^[a-z0-9_.]+$/i.test(a)) {
      return res.status(400).json({ success: false, message: "Invalid action filter." });
    }
    filter.action = new RegExp(`^${escapeRegExp(a)}(\\.|$)`);
  }
  if (req.query.tenantId) {
    if (!mongoose.Types.ObjectId.isValid(String(req.query.tenantId))) {
      return res.status(400).json({ success: false, message: "Invalid tenantId." });
    }
    filter.tenantId = new mongoose.Types.ObjectId(String(req.query.tenantId));
  }
  if (req.query.resourceType) {
    const rt = String(req.query.resourceType).trim().slice(0, 60);
    if (!/^[A-Za-z_]+$/.test(rt)) {
      return res.status(400).json({ success: false, message: "Invalid resourceType filter." });
    }
    filter.resourceType = rt;
  }
  if (req.query.outcome && ["success", "failure"].includes(String(req.query.outcome))) {
    filter.outcome = String(req.query.outcome);
  }
  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);
  if (from === undefined || to === undefined) {
    return res.status(400).json({ success: false, message: "Invalid date range." });
  }
  if (from && to && from > to) {
    return res.status(400).json({ success: false, message: "`from` must be before `to`." });
  }
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
  }

  const PlatformAuditLog = mongoose.model("PlatformAuditLog");
  const [rows, total] = await Promise.all([
    PlatformAuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    PlatformAuditLog.countDocuments(filter),
  ]);

  // Attach tenant names for display without a second round-trip from the UI.
  const tenantIds = [...new Set(rows.map((r) => r.tenantId && String(r.tenantId)).filter(Boolean))];
  let names = {};
  if (tenantIds.length) {
    const Tenant = mongoose.model("Tenant");
    const ts = await Tenant.find({ _id: { $in: tenantIds } }).select("name slug").lean();
    names = Object.fromEntries(ts.map((t) => [String(t._id), { name: t.name, slug: t.slug }]));
  }
  const items = rows.map((r) => ({ ...r, tenant: r.tenantId ? names[String(r.tenantId)] || null : null }));

  res.json({
    success: true,
    data: { items, pagination: { total, page, pages: Math.ceil(total / limit), limit } },
  });
});

/** GET /api/platform/audit/actions — distinct action ids for the filter dropdown. */
export const listAuditActions = asyncHandler(async (_req, res) => {
  const PlatformAuditLog = mongoose.model("PlatformAuditLog");
  const actions = await PlatformAuditLog.distinct("action");
  res.json({ success: true, data: actions.sort() });
});

/** GET /api/platform/audit/tenants/:tenantId/activity?page=&limit= */
export const tenantActivity = asyncHandler(async (req, res) => {
  const page = clampInt(req.query.page, 1, 1, 20);
  const limit = clampInt(req.query.limit, 25, 1, MAX_LIMIT);
  const Tenant = mongoose.model("Tenant");
  const exists = await Tenant.exists({ _id: req.params.tenantId });
  if (!exists) return res.status(404).json({ success: false, message: "Tenant not found." });
  const data = await getTenantActivity(req.params.tenantId, { page, limit });
  res.json({ success: true, data });
});

/** GET /api/platform/audit/activity?page=&limit=&tenantId=&source= — platform-wide feed. */
export const platformActivity = asyncHandler(async (req, res) => {
  const page = clampInt(req.query.page, 1, 1, 20);
  const limit = clampInt(req.query.limit, 25, 1, MAX_LIMIT);
  let tenantId = null;
  if (req.query.tenantId) {
    if (!mongoose.Types.ObjectId.isValid(String(req.query.tenantId))) {
      return res.status(400).json({ success: false, message: "Invalid tenantId." });
    }
    tenantId = new mongoose.Types.ObjectId(String(req.query.tenantId));
  }
  const source = ["platform", "merchant"].includes(String(req.query.source)) ? String(req.query.source) : null;
  const data = await getPlatformActivity({ page, limit, tenantId, source });
  res.json({ success: true, data });
});
