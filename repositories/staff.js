const STAFF_ROLES = ["admin", "manager", "staff"];

// ── Staff users ───────────────────────────────────────────────────────────────

export const listStaffRepo = async (models) =>
  models.User.find({ roles: { $elemMatch: { $in: STAFF_ROLES } }, isActive: true })
    .select("-password")
    .sort({ createdAt: -1 })
    .lean();

export const getStaffRepo = async (models, id) =>
  models.User.findOne({ _id: id, roles: { $elemMatch: { $in: STAFF_ROLES } } })
    .select("-password")
    .lean();

export const createStaffRepo = async (models, data) => {
  const user = await models.User.create(data);
  const obj = user.toObject();
  delete obj.password;
  return obj;
};

export const updateStaffRolesRepo = async (models, id, { roles, customRoleIds }) => {
  const update = { updatedAt: Date.now() };
  if (roles !== undefined) update.roles = roles;
  if (customRoleIds !== undefined) update.customRoleIds = customRoleIds;
  return models.User.findByIdAndUpdate(id, { $set: update }, { new: true })
    .select("-password")
    .lean();
};

export const softDeleteStaffRepo = async (models, id) =>
  models.User.findByIdAndUpdate(
    id,
    { $set: { isActive: false, updatedAt: Date.now() } },
    { new: true }
  )
    .select("-password")
    .lean();

export const countAdminsRepo = async (models) =>
  models.User.countDocuments({ roles: "admin", isActive: true });

// ── Invites ───────────────────────────────────────────────────────────────────

// `token` is a sha256 hash of the raw invite token. Never expose it via the
// management API — it's sensitive operational material even though not
// directly redeemable. Lookups that need the hash (verify/accept flow) use
// getInviteByTokenRepo which is internal to services/staff.js.
export const listInvitesRepo = async (models) =>
  models.StaffInvite.find({
    acceptedAt: null,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .select("-token")
    .sort({ createdAt: -1 })
    .lean();

export const getInviteRepo = async (models, id) =>
  models.StaffInvite.findById(id).select("-token").lean();

export const getInviteByTokenRepo = async (models, hashedToken) =>
  models.StaffInvite.findOne({ token: hashedToken }).lean();

export const createInviteRepo = async (models, data) =>
  models.StaffInvite.create(data);

export const markInviteAcceptedRepo = async (models, id) =>
  models.StaffInvite.findByIdAndUpdate(
    id,
    { $set: { acceptedAt: new Date(), updatedAt: Date.now() } },
    { new: true }
  ).lean();

/**
 * Atomically claim an unused, unrevoked, unexpired invite by its hashed token.
 * Returns the pre-update invite if claim succeeded, null otherwise.
 */
export const claimInviteByTokenRepo = async (models, hashedToken) =>
  models.StaffInvite.findOneAndUpdate(
    {
      token: hashedToken,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { acceptedAt: new Date(), updatedAt: Date.now() } },
    { new: false }
  ).lean();

export const revokeInviteRepo = async (models, id) =>
  models.StaffInvite.findByIdAndUpdate(
    id,
    { $set: { revokedAt: new Date(), updatedAt: Date.now() } },
    { new: true }
  ).lean();

export const refreshInviteTokenRepo = async (models, id, hashedToken, expiresAt) =>
  models.StaffInvite.findByIdAndUpdate(
    id,
    { $set: { token: hashedToken, expiresAt, updatedAt: Date.now() } },
    { new: true }
  ).lean();

export const deleteExpiredInvitesRepo = async (models) =>
  models.StaffInvite.deleteMany({
    acceptedAt: null,
    revokedAt: null,
    expiresAt: { $lte: new Date() },
  });
