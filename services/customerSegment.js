import mongoose from "mongoose";
import { APIError } from "../middlewares/errorHandler.js";

/**
 * Customer segmentation service.
 *
 * Segments are stored as a saved filter; resolution is computed on demand
 * via an aggregation that joins users to their orders. We deliberately do
 * NOT cache or materialise the membership list — orders mutate constantly,
 * and a stale list misleads merchants who target it for promotions.
 *
 * Order accounting:
 *   - Cancelled and Refunded orders are excluded from spend/count, since
 *     "they tried to buy and we refunded them" should not count toward
 *     "high spender" targeting.
 *   - All other statuses (Pending → Delivered) count, even Pending —
 *     because the merchant's intent for "lifetime value" includes
 *     orders that haven't shipped yet.
 */

const EXCLUDED_ORDER_STATUSES = ["Cancelled", "Refunded"];

export const createSegment = async (models, payload) => {
  if (!payload?.name || typeof payload.name !== "string") {
    throw new APIError("Segment name is required", 400);
  }
  validateFilters(payload.filters || {});
  // Mongoose's `unique: true` on the compound (tenantId, name) index will
  // surface a clean E11000 error if the merchant duplicates a name. We
  // pre-check anyway so the API returns a friendly 409 instead of a 500.
  const existing = await models.CustomerSegment.findOne({ name: payload.name.trim() });
  if (existing) throw new APIError(`Segment "${payload.name}" already exists`, 409);

  const created = await models.CustomerSegment.create({
    name: payload.name.trim(),
    description: payload.description || "",
    filters: normaliseFilters(payload.filters || {}),
  });
  return created;
};

export const updateSegment = async (models, segmentId, payload) => {
  if (!mongoose.Types.ObjectId.isValid(segmentId)) {
    throw new APIError("Invalid segment id", 400);
  }
  if (payload.filters) validateFilters(payload.filters);
  const update = {};
  if (payload.name !== undefined) update.name = String(payload.name).trim();
  if (payload.description !== undefined) update.description = String(payload.description);
  if (payload.filters !== undefined) update.filters = normaliseFilters(payload.filters);
  update.updatedAt = new Date();
  const updated = await models.CustomerSegment.findByIdAndUpdate(segmentId, update, { new: true });
  if (!updated) throw new APIError("Segment not found", 404);
  return updated;
};

export const listSegments = async (models) => {
  return models.CustomerSegment.find({}).sort({ name: 1 });
};

export const getSegment = async (models, segmentId) => {
  if (!mongoose.Types.ObjectId.isValid(segmentId)) {
    throw new APIError("Invalid segment id", 400);
  }
  const segment = await models.CustomerSegment.findById(segmentId);
  if (!segment) throw new APIError("Segment not found", 404);
  return segment;
};

export const deleteSegment = async (models, segmentId) => {
  if (!mongoose.Types.ObjectId.isValid(segmentId)) {
    throw new APIError("Invalid segment id", 400);
  }
  const result = await models.CustomerSegment.findByIdAndDelete(segmentId);
  if (!result) throw new APIError("Segment not found", 404);
  return result;
};

/**
 * Resolve a segment (or an ad-hoc filter) to a list of users + summary
 * stats. Used by:
 *   - the dashboard preview ("how many customers match this?")
 *   - email/discount targeting (drives the "send to" picker)
 *   - the segments listing page itself ("VIPs (47)")
 *
 * Returns:
 *   { count, users: [{ _id, name, email, totalSpent, orderCount, lastOrderAt, tags }] }
 */
export const resolveSegment = async (models, filterOrSegment, { limit = 100, tenantId } = {}) => {
  const filters = filterOrSegment?.filters
    ? filterOrSegment.filters.toObject?.() ?? filterOrSegment.filters
    : filterOrSegment || {};
  // Tenant id is needed inside the $lookup pipeline so the joined orders
  // are tenant-scoped too. The scoped User model only injects $match on
  // its OWN documents — sub-pipelines run against the raw collection.
  // Caller (the controller) passes req.tenant._id explicitly; we coerce
  // here so passing a string id from a test still works.
  if (!tenantId) {
    throw new Error("resolveSegment requires tenantId — cannot run $lookup without it");
  }
  const tid = mongoose.Types.ObjectId.isValid(tenantId)
    ? new mongoose.Types.ObjectId(tenantId)
    : tenantId;

  // Stage 1 — narrow the user side first using indexed predicates so the
  // expensive $lookup runs over as few rows as possible. Tag and email
  // filters can be applied here before joining orders.
  //
  // We must mirror the staff-exclusion semantics used by the customers
  // list controller (see controllers/customer.js): a "customer" is any
  // non-staff user. Filtering by `roles: "customer"` would silently drop
  // legacy users whose `roles` array is missing/empty (created before
  // the default landed or via older guest-checkout paths) — which is
  // why merchants saw 0 matches on segments they knew should populate.
  const userMatch = { roles: { $nin: ["admin", "manager", "staff"] } };
  if (filters.tags && filters.tags.length > 0) {
    userMatch.tags = { $all: filters.tags };
  }
  if (filters.emailContains) {
    // Escape regex metacharacters so a merchant typing "a.b@c" doesn't
    // accidentally build a regex that matches everything.
    const escaped = String(filters.emailContains).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    userMatch.email = { $regex: escaped, $options: "i" };
  }
  if (filters.acceptsMarketing === true || filters.acceptsMarketing === false) {
    userMatch.acceptsMarketing = filters.acceptsMarketing;
  }

  // Stage 2 — join orders, compute aggregates. We exclude cancelled/
  // refunded so spend/count reflect realised revenue.
  const pipeline = [
    { $match: userMatch },
    {
      $lookup: {
        from: "orders",
        let: { userId: "$_id" },
        pipeline: [
          {
            $match: {
              tenantId: tid,
              $expr: { $eq: ["$user", "$$userId"] },
              status: { $nin: EXCLUDED_ORDER_STATUSES },
            },
          },
          { $project: { totalAmount: 1, createdAt: 1 } },
        ],
        as: "orders",
      },
    },
    {
      $addFields: {
        orderCount: { $size: "$orders" },
        totalSpent: { $sum: "$orders.totalAmount" },
        lastOrderAt: { $max: "$orders.createdAt" },
      },
    },
  ];

  // Stage 3 — apply the order-derived filters now that aggregates exist.
  const aggMatch = {};
  if (filters.totalSpentMin != null) aggMatch.totalSpent = { ...(aggMatch.totalSpent || {}), $gte: filters.totalSpentMin };
  if (filters.totalSpentMax != null) aggMatch.totalSpent = { ...(aggMatch.totalSpent || {}), $lte: filters.totalSpentMax };
  if (filters.orderCountMin != null) aggMatch.orderCount = { ...(aggMatch.orderCount || {}), $gte: filters.orderCountMin };
  if (filters.orderCountMax != null) aggMatch.orderCount = { ...(aggMatch.orderCount || {}), $lte: filters.orderCountMax };
  if (filters.lastOrderAfter) aggMatch.lastOrderAt = { ...(aggMatch.lastOrderAt || {}), $gte: new Date(filters.lastOrderAfter) };
  if (filters.lastOrderBefore) aggMatch.lastOrderAt = { ...(aggMatch.lastOrderAt || {}), $lte: new Date(filters.lastOrderBefore) };
  if (Object.keys(aggMatch).length > 0) pipeline.push({ $match: aggMatch });

  pipeline.push({
    $project: {
      _id: 1,
      name: 1,
      email: 1,
      totalSpent: 1,
      orderCount: 1,
      lastOrderAt: 1,
      tags: 1,
    },
  });
  pipeline.push({ $sort: { totalSpent: -1, _id: 1 } });
  pipeline.push({ $limit: limit });

  const users = await models.User.aggregate(pipeline);
  return { count: users.length, users };
};

function validateFilters(f) {
  if (typeof f !== "object" || f === null) {
    throw new APIError("filters must be an object", 400);
  }
  const numericFields = [
    "totalSpentMin",
    "totalSpentMax",
    "orderCountMin",
    "orderCountMax",
  ];
  for (const k of numericFields) {
    if (f[k] != null && (typeof f[k] !== "number" || f[k] < 0 || !Number.isFinite(f[k]))) {
      throw new APIError(`${k} must be a non-negative number`, 400);
    }
  }
  if (f.totalSpentMin != null && f.totalSpentMax != null && f.totalSpentMax < f.totalSpentMin) {
    throw new APIError("totalSpentMax must be ≥ totalSpentMin", 400);
  }
  if (f.orderCountMin != null && f.orderCountMax != null && f.orderCountMax < f.orderCountMin) {
    throw new APIError("orderCountMax must be ≥ orderCountMin", 400);
  }
  if (f.lastOrderAfter && f.lastOrderBefore) {
    if (new Date(f.lastOrderBefore) < new Date(f.lastOrderAfter)) {
      throw new APIError("lastOrderBefore must be ≥ lastOrderAfter", 400);
    }
  }
  if (f.tags != null && !Array.isArray(f.tags)) {
    throw new APIError("tags must be an array of strings", 400);
  }
}

function normaliseFilters(f) {
  const out = {};
  for (const k of [
    "totalSpentMin",
    "totalSpentMax",
    "orderCountMin",
    "orderCountMax",
    "lastOrderAfter",
    "lastOrderBefore",
    "tags",
    "emailContains",
    "acceptsMarketing",
  ]) {
    if (f[k] !== undefined) out[k] = f[k];
  }
  if (out.tags) out.tags = out.tags.map((t) => String(t).trim()).filter(Boolean);
  return out;
}
