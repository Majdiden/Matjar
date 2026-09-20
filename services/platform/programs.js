/**
 * Access programs + tenant feature overrides (Phase B).
 *
 * Programs are admin-DB rows; membership is `tenant.accessPrograms` (array of
 * program keys, in join order — later programs win when two override the same
 * flag). Every mutation invalidates the affected tenants' cached resolution.
 */
import mongoose from "mongoose";
import { APIError } from "../../middlewares/errorHandler.js";
import { escapeRegExp } from "../../utils/misc.js";
import { invalidateTenantFeatureCache, isProgramActive } from "../featureFlags.js";
import { getFlagDef } from "../../config/featureFlags.js";

import { LIMIT_KEYS } from "../../config/limits.js";

function Program() {
  return mongoose.model("AccessProgram");
}
function Tenant() {
  return mongoose.model("Tenant");
}
function FeatureOverride() {
  return mongoose.model("FeatureOverride");
}

/** Normalise `[{key,value}]` → stored `[{k,v}]` (boolean, registry-known). */
export function toStoredFeatureOverrides(list = []) {
  const out = [];
  const seen = new Set();
  for (const it of list || []) {
    const key = String(it?.key ?? it?.k ?? "").trim();
    const value = it?.value ?? it?.v;
    if (!key || typeof value !== "boolean" || getFlagDef(key)?.type !== "boolean") continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ k: key, v: value });
  }
  return out;
}

export function publicProgram(p) {
  if (!p) return null;
  return {
    _id: String(p._id),
    key: p.key,
    name: p.name,
    description: p.description || "",
    status: p.status,
    eligibility: { countries: p.eligibility?.countries || [], planKeys: p.eligibility?.planKeys || [] },
    featureOverrides: (p.featureOverrides || []).map((o) => ({ key: o.k, value: o.v })),
    limitOverrides: Object.fromEntries(LIMIT_KEYS.map((k) => [k, p.limitOverrides?.[k] ?? null])),
    startsAt: p.startsAt || null,
    endsAt: p.endsAt || null,
    memberCount: p.memberCount ?? undefined,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function assertWindow(startsAt, endsAt) {
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
    throw new APIError("endsAt must be after startsAt", 400);
  }
}

export async function listPrograms({ page = 1, limit = 25, status, q } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (q) {
    const rx = new RegExp(escapeRegExp(String(q).trim()), "i");
    filter.$or = [{ key: rx }, { name: rx }];
  }
  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    Program().find(filter).sort({ status: 1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    Program().countDocuments(filter),
  ]);
  const keys = rows.map((r) => r.key);
  const counts = keys.length
    ? await Tenant().aggregate([
        { $match: { accessPrograms: { $in: keys }, deletedAt: null } },
        { $unwind: "$accessPrograms" },
        { $match: { accessPrograms: { $in: keys } } },
        { $group: { _id: "$accessPrograms", n: { $sum: 1 } } },
      ])
    : [];
  const countBy = new Map(counts.map((c) => [c._id, c.n]));
  return {
    programs: rows.map((r) => publicProgram({ ...r, memberCount: countBy.get(r.key) || 0 })),
    pagination: { total, page, pages: Math.ceil(total / limit) || 1 },
  };
}

export async function getProgram(id) {
  const p = await Program().findById(id).lean();
  if (!p) throw new APIError("Program not found", 404);
  const memberCount = await Tenant().countDocuments({ accessPrograms: p.key, deletedAt: null });
  return publicProgram({ ...p, memberCount });
}

export async function createProgram(body, createdBy) {
  assertWindow(body.startsAt, body.endsAt);
  const exists = await Program().findOne({ key: body.key }).lean();
  if (exists) throw new APIError(`A program with key "${body.key}" already exists`, 409);
  const doc = await Program().create({
    key: body.key,
    name: body.name,
    description: body.description || "",
    status: body.status || "draft",
    eligibility: { countries: body.eligibility?.countries || [], planKeys: body.eligibility?.planKeys || [] },
    featureOverrides: toStoredFeatureOverrides(body.featureOverrides),
    limitOverrides: Object.fromEntries(LIMIT_KEYS.map((k) => [k, body.limitOverrides?.[k] ?? null])),
    startsAt: body.startsAt || null,
    endsAt: body.endsAt || null,
    createdBy: createdBy || null,
  });
  return publicProgram(doc.toObject());
}

/** Members of a program (tenant ids) — used to invalidate caches after edits. */
async function memberIds(key) {
  const rows = await Tenant().find({ accessPrograms: key }).select("_id").lean();
  return rows.map((r) => r._id);
}

export async function updateProgram(id, patch) {
  const p = await Program().findById(id);
  if (!p) throw new APIError("Program not found", 404);
  const before = publicProgram(p.toObject());
  if (patch.name !== undefined) p.name = patch.name;
  if (patch.description !== undefined) p.description = patch.description;
  if (patch.status !== undefined) {
    if (p.status === "closed") throw new APIError("A closed program cannot be reopened", 409);
    if (patch.status === "closed") throw new APIError("Use the close action to close a program", 400);
    p.status = patch.status;
  }
  if (patch.eligibility !== undefined) {
    p.eligibility = {
      countries: patch.eligibility.countries ?? p.eligibility?.countries ?? [],
      planKeys: patch.eligibility.planKeys ?? p.eligibility?.planKeys ?? [],
    };
  }
  if (patch.featureOverrides !== undefined) p.featureOverrides = toStoredFeatureOverrides(patch.featureOverrides);
  if (patch.limitOverrides !== undefined) {
    for (const k of LIMIT_KEYS) {
      if (patch.limitOverrides[k] !== undefined) p.limitOverrides[k] = patch.limitOverrides[k];
    }
  }
  if (patch.startsAt !== undefined) p.startsAt = patch.startsAt;
  if (patch.endsAt !== undefined) p.endsAt = patch.endsAt;
  assertWindow(p.startsAt, p.endsAt);
  await p.save();
  for (const tid of await memberIds(p.key)) invalidateTenantFeatureCache(tid);
  return { before, after: publicProgram(p.toObject()) };
}

export async function closeProgram(id) {
  const p = await Program().findById(id);
  if (!p) throw new APIError("Program not found", 404);
  if (p.status === "closed") throw new APIError("Program is already closed", 409);
  const before = { status: p.status };
  p.status = "closed";
  await p.save();
  for (const tid of await memberIds(p.key)) invalidateTenantFeatureCache(tid);
  return { before, after: { status: "closed" }, program: publicProgram(p.toObject()) };
}

export async function listMembers(id, { page = 1, limit = 25 } = {}) {
  const p = await Program().findById(id).select("key").lean();
  if (!p) throw new APIError("Program not found", 404);
  const filter = { accessPrograms: p.key };
  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    Tenant()
      .find(filter)
      .select("name slug email subscriptionPlan lifecycle.state deletedAt createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Tenant().countDocuments(filter),
  ]);
  return {
    members: rows.map((t) => ({
      tenantId: String(t._id),
      name: t.name,
      slug: t.slug,
      email: t.email,
      subscriptionPlan: t.subscriptionPlan,
      lifecycle: t.lifecycle?.state || null,
      deleted: !!t.deletedAt,
    })),
    pagination: { total, page, pages: Math.ceil(total / limit) || 1 },
  };
}

export async function addMember(id, tenantId) {
  const p = await Program().findById(id).select("key status").lean();
  if (!p) throw new APIError("Program not found", 404);
  if (p.status === "closed") throw new APIError("Cannot add members to a closed program", 409);
  const t = await Tenant().findById(tenantId).select("accessPrograms deletedAt name slug").lean();
  if (!t || t.deletedAt) throw new APIError("Tenant not found", 404);
  if ((t.accessPrograms || []).includes(p.key)) throw new APIError("Tenant is already a member", 409);
  await Tenant().updateOne({ _id: tenantId }, { $addToSet: { accessPrograms: p.key } });
  invalidateTenantFeatureCache(tenantId);
  return { programKey: p.key, tenant: { id: String(t._id), name: t.name, slug: t.slug } };
}

export async function removeMember(id, tenantId) {
  const p = await Program().findById(id).select("key").lean();
  if (!p) throw new APIError("Program not found", 404);
  const t = await Tenant().findById(tenantId).select("accessPrograms name slug").lean();
  if (!t) throw new APIError("Tenant not found", 404);
  if (!(t.accessPrograms || []).includes(p.key)) throw new APIError("Tenant is not a member", 404);
  await Tenant().updateOne({ _id: tenantId }, { $pull: { accessPrograms: p.key } });
  invalidateTenantFeatureCache(tenantId);
  return { programKey: p.key, tenant: { id: String(t._id), name: t.name, slug: t.slug } };
}

// ---------------------------------------------------------------- tenant feature overrides

export function publicOverride(o) {
  return {
    _id: String(o._id),
    key: o.key,
    value: o.value,
    reason: o.reason,
    createdAt: o.createdAt,
    endsAt: o.endsAt || null,
    revokedAt: o.revokedAt || null,
    active: !o.revokedAt && (!o.endsAt || new Date(o.endsAt) > new Date()),
  };
}

export async function listTenantOverrides(tenantId, { includeRevoked = false } = {}) {
  const filter = { scope: "tenant", scopeId: tenantId };
  if (!includeRevoked) filter.revokedAt = null;
  const rows = await FeatureOverride().find(filter).sort({ createdAt: -1 }).limit(200).lean();
  return rows.map(publicOverride);
}

/** Create (replacing any live override for the same key). */
export async function createTenantOverride(tenantId, { key, value, reason, endsAt }, createdBy) {
  if (endsAt && new Date(endsAt) <= new Date()) throw new APIError("endsAt must be in the future", 400);
  const t = await Tenant().findById(tenantId).select("_id deletedAt").lean();
  if (!t || t.deletedAt) throw new APIError("Tenant not found", 404);
  // Create first, then revoke every OTHER live override for the key. Order
  // matters for the failure case: if the revoke step fails, the tenant has
  // two live rows and the resolver still applies the NEWEST (createdAt desc),
  // so the operator's intent holds; the stale row is cleaned up on the next
  // write or revoke.
  const doc = await FeatureOverride().create({
    scope: "tenant",
    scopeId: tenantId,
    key,
    value,
    reason,
    endsAt: endsAt || null,
    createdBy: createdBy || null,
  });
  const others = await FeatureOverride()
    .find({ scope: "tenant", scopeId: tenantId, key, revokedAt: null, _id: { $ne: doc._id } })
    .sort({ createdAt: -1 })
    .lean();
  if (others.length) {
    await FeatureOverride().updateMany(
      { scope: "tenant", scopeId: tenantId, key, revokedAt: null, _id: { $ne: doc._id } },
      { $set: { revokedAt: new Date(), revokedBy: createdBy || null } }
    );
  }
  invalidateTenantFeatureCache(tenantId);
  return { override: publicOverride(doc.toObject()), replaced: others[0] ? publicOverride(others[0]) : null };
}

export async function revokeTenantOverride(tenantId, overrideId, revokedBy) {
  const doc = await FeatureOverride().findOneAndUpdate(
    { _id: overrideId, scope: "tenant", scopeId: tenantId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedBy: revokedBy || null } },
    { new: true }
  ).lean();
  if (!doc) throw new APIError("Override not found or already revoked", 404);
  invalidateTenantFeatureCache(tenantId);
  return publicOverride(doc);
}

/** Per-flag counts of where a flag is switched on/off below the global layer. */
export async function flagOverrideCounts() {
  const [programs, tenantRows] = await Promise.all([
    Program().find({ status: "active" }).select("key status startsAt endsAt featureOverrides").lean(),
    FeatureOverride().aggregate([
      { $match: { scope: "tenant", revokedAt: null, $or: [{ endsAt: null }, { endsAt: { $gt: new Date() } }] } },
      { $group: { _id: { key: "$key", value: "$value" }, n: { $sum: 1 } } },
    ]),
  ]);
  const out = {};
  const ensure = (k) => (out[k] ||= { programsOn: [], programsOff: [], tenantsOn: 0, tenantsOff: 0 });
  for (const p of programs) {
    if (!isProgramActive(p)) continue; // drafts / out-of-window programs apply nothing
    for (const o of p.featureOverrides || []) {
      const e = ensure(o.k);
      (o.v ? e.programsOn : e.programsOff).push(p.key);
    }
  }
  for (const r of tenantRows) {
    const e = ensure(r._id.key);
    if (r._id.value) e.tenantsOn += r.n;
    else e.tenantsOff += r.n;
  }
  return out;
}
