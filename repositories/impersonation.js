/**
 * Repository for consent-based impersonation grants. All access goes
 * through the tenant-scoped model so tenantId is injected automatically
 * and a grant can never be read/written across stores.
 */

export const createGrant = async (models, data) => {
  const doc = await models.ImpersonationGrant.create(data);
  return doc.toObject ? doc.toObject() : doc;
};

export const findGrantById = async (models, grantId) => {
  return models.ImpersonationGrant.findById(grantId).lean();
};

/**
 * Atomic status transition. Only flips the grant when its CURRENT status
 * is one of `fromStatuses` — this is the single-use / race guard. Returns
 * the updated (post-transition) document, or null if the precondition
 * failed (already approved, expired, cancelled, etc.).
 */
export const transitionGrant = async (models, grantId, fromStatuses, set) => {
  return models.ImpersonationGrant.findOneAndUpdate(
    { _id: grantId, status: { $in: fromStatuses } },
    { $set: set },
    { new: true }
  ).lean();
};

/** Pending (awaiting owner decision) requests for a tenant, not yet expired. */
export const listPendingForTenant = async (models) => {
  return models.ImpersonationGrant.find({
    status: "requested",
    approvalExpiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .lean();
};

/** The single live (active + unexpired) grant for a tenant, if any. */
export const findActiveForTenant = async (models) => {
  return models.ImpersonationGrant.findOne({
    status: "active",
    sessionExpiresAt: { $gt: new Date() },
  })
    .sort({ startedAt: -1 })
    .lean();
};

/**
 * Bulk-expire grants whose approval window or session TTL has elapsed but
 * whose status hasn't caught up yet. Returns the list of rows that were
 * transitioned so the caller can audit each. Cheap — only touches rows in
 * non-terminal states.
 */
export const sweepExpired = async (models) => {
  const now = new Date();
  const stale = await models.ImpersonationGrant.find({
    $or: [
      { status: "requested", approvalExpiresAt: { $lte: now } },
      { status: { $in: ["approved", "active"] }, sessionExpiresAt: { $lte: now } },
    ],
  }).lean();
  if (stale.length === 0) return [];
  const ids = stale.map((g) => g._id);
  await models.ImpersonationGrant.updateMany(
    { _id: { $in: ids }, status: { $in: ["requested", "approved", "active"] } },
    { $set: { status: "expired", endedBy: "system", endedAt: now } }
  );
  return stale;
};
