/**
 * Signup invitation codes in the platform console (PBI 10-47).
 *
 * Owners and promoters create codes; every code registers one store.
 *   - A promoter sees ONLY their own codes, and only the stores registered
 *     with them (a reduced store view: header, users / products counts,
 *     setup, domains, data). Nothing else on the platform is visible to them.
 *   - An owner sees every code, with who created it, and can filter by
 *     promoter. Only an owner changes the signup mode.
 * Unused codes can be revoked by their creator or an owner.
 */
import mongoose from "mongoose";
import { APIError } from "../../middlewares/errorHandler.js";
import { createScopedModels } from "../../utils/scopedModel.js";
import { PLATFORM_ROLES } from "../../config/platformRoles.js";
import { generateCode, formatCode } from "../signupAccess.js";

export const MAX_CODES_PER_REQUEST = 20;
const LIST_LIMIT = 500;
const GENERATE_ATTEMPTS = 5;

const InviteCode = () => mongoose.model("InviteCode");
const Tenant = () => mongoose.model("Tenant");

const isOwner = (actor) => actor?.role === PLATFORM_ROLES.OWNER;

/** The codes this actor may see: an owner all (or one promoter's), others their own. */
function visibleFilter(actor, { promoterId } = {}) {
  if (isOwner(actor)) return promoterId ? { createdBy: promoterId } : {};
  return { createdBy: actor.id };
}

export function publicCode(c) {
  return {
    id: String(c._id),
    code: formatCode(c.code),
    status: c.status,
    note: c.note || null,
    createdBy: c.createdBy ? String(c.createdBy) : null,
    createdByName: c.createdByName || null,
    createdByEmail: c.createdByEmail || null,
    createdAt: c.createdAt,
    usedAt: c.usedAt || null,
    usedByTenantId: c.usedByTenantId ? String(c.usedByTenantId) : null,
    usedByTenantName: c.usedByTenantName || null,
    revokedAt: c.revokedAt || null,
  };
}

/** Codes + stats for the actor: created, stores registered, unused, revoked. */
export async function listCodes(actor, query = {}) {
  const filter = visibleFilter(actor, query);
  const [rows, counts] = await Promise.all([
    InviteCode().find(filter).sort({ createdAt: -1 }).limit(LIST_LIMIT).lean(),
    InviteCode().aggregate([{ $match: castFilter(filter) }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  const by = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  const stats = {
    created: (by.active || 0) + (by.used || 0) + (by.revoked || 0),
    registered: by.used || 0,
    unused: by.active || 0,
    revoked: by.revoked || 0,
  };
  // Owners can filter by promoter: the people who created codes.
  const promoters = isOwner(actor)
    ? (
        await InviteCode().aggregate([
          { $group: { _id: "$createdBy", name: { $last: "$createdByName" }, email: { $last: "$createdByEmail" } } },
          { $sort: { email: 1 } },
        ])
      ).map((p) => ({ id: String(p._id), name: p.name || null, email: p.email || null }))
    : undefined;
  return { codes: rows.map(publicCode), stats, promoters };
}

/** aggregate() does not cast like find(): ObjectId-ify the creator filter. */
function castFilter(filter) {
  if (!filter.createdBy) return filter;
  return { ...filter, createdBy: new mongoose.Types.ObjectId(String(filter.createdBy)) };
}

/** Create `count` new codes for the actor. */
export async function createCodes(actor, { count = 1, note = null } = {}) {
  const n = Math.min(Math.max(1, Number(count) || 1), MAX_CODES_PER_REQUEST);
  const created = [];
  for (let i = 0; i < n; i++) {
    let doc = null;
    for (let attempt = 0; attempt < GENERATE_ATTEMPTS && !doc; attempt++) {
      try {
        doc = await InviteCode().create({
          code: generateCode(),
          note: note || null,
          createdBy: actor.id,
          createdByEmail: actor.email || null,
          createdByName: actor.name || null,
        });
      } catch (err) {
        if (err?.code !== 11000) throw err; // a duplicate code: draw again
      }
    }
    if (!doc) throw new APIError("Could not create a unique code, try again", 503);
    created.push(doc.toObject());
  }
  return created.map(publicCode);
}

/** Revoke an unused code (its creator or an owner). */
export async function revokeCode(actor, id) {
  const filter = { _id: id, status: "active", ...visibleFilter(actor) };
  const doc = await InviteCode().findOneAndUpdate(
    filter,
    { $set: { status: "revoked", revokedAt: new Date(), revokedByEmail: actor.email || null } },
    { new: true }
  ).lean();
  if (!doc) {
    const exists = await InviteCode().findOne({ _id: id, ...visibleFilter(actor) }).select("status").lean();
    if (!exists) throw new APIError("Code not found", 404);
    throw new APIError(exists.status === "used" ? "This code was already used" : "This code is already revoked", 409);
  }
  return publicCode(doc);
}

/**
 * A store registered with one of the actor's codes, reduced to what a
 * promoter may see. 404 for any other store, so a promoter cannot even learn
 * that it exists.
 */
export async function codeStore(actor, tenantId) {
  const code = await InviteCode()
    .findOne({ usedByTenantId: tenantId, ...visibleFilter(actor) })
    .lean();
  if (!code) throw new APIError("Store not found", 404);
  const t = await Tenant()
    .findById(tenantId)
    .select("name email phone slug domains setupStatus settings.activeTheme settings.niche lastLoginAt lastLoginBy createdAt updatedAt")
    .lean();
  if (!t) throw new APIError("Store not found", 404);

  const models = createScopedModels(mongoose.connection, tenantId);
  const count = async (model) => {
    try {
      return (await models[model]?.countDocuments({})) ?? 0;
    } catch {
      return 0;
    }
  };
  const [usersTotal, productsTotal] = await Promise.all([count("User"), count("Product")]);

  const setupStatus = t.setupStatus ? { ...t.setupStatus } : null;
  if (setupStatus) delete setupStatus.setupToken;
  return {
    store: {
      _id: String(t._id),
      name: t.name,
      email: t.email,
      phone: t.phone || null,
      slug: t.slug,
      domains: t.domains || null,
      setupStatus,
      settings: { activeTheme: t.settings?.activeTheme || null, niche: t.settings?.niche || null },
      lastLoginAt: t.lastLoginAt || null,
      lastLoginBy: t.lastLoginBy || null,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    },
    stats: { usersTotal, productsTotal },
    code: publicCode(code),
  };
}
