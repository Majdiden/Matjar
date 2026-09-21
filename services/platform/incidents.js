/**
 * Platform incidents — CRUD + timeline + resolve. Platform-only records.
 * Controllers audit; this module only owns the data rules.
 */
import mongoose from "mongoose";
import { APIError } from "../../middlewares/errorHandler.js";
import { INCIDENT_OPEN_STATUSES, INCIDENT_MAX_TIMELINE } from "../../schemas/incident.js";

const Incident = () => mongoose.model("Incident");

export function publicIncident(i) {
  if (!i) return null;
  return {
    id: String(i._id),
    title: i.title,
    severity: i.severity,
    status: i.status,
    startedAt: i.startedAt,
    detectedAt: i.detectedAt,
    resolvedAt: i.resolvedAt,
    affectedServices: i.affectedServices || [],
    affectedTenantIds: (i.affectedTenantIds || []).map(String),
    affectedTenantCount: (i.affectedTenantIds || []).length,
    ownerId: i.ownerId ? String(i.ownerId) : null,
    ownerEmail: i.ownerEmail || null,
    timeline: (i.timeline || []).map((e) => ({
      id: String(e._id),
      at: e.at,
      by: e.by ? String(e.by) : null,
      byEmail: e.byEmail || null,
      text: e.text,
      status: e.status || null,
    })),
    resolutionNotes: i.resolutionNotes || null,
    createdBy: String(i.createdBy),
    createdByEmail: i.createdByEmail || null,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}

/** Snapshot of the fields an audit before/after should carry. */
export function incidentSnapshot(i) {
  if (!i) return null;
  return {
    title: i.title,
    severity: i.severity,
    status: i.status,
    ownerEmail: i.ownerEmail || null,
    affectedTenantCount: (i.affectedTenantIds || []).length,
    affectedServices: i.affectedServices || [],
    resolvedAt: i.resolvedAt || null,
  };
}

async function resolveOwner(ownerId) {
  if (!ownerId) return { ownerId: null, ownerEmail: null };
  const TenantUser = mongoose.model("TenantUser");
  const u = await TenantUser.findOne({ _id: ownerId, platformAdmin: true }).select("email").lean();
  if (!u) throw new APIError("Owner must be a platform user", 400);
  return { ownerId: u._id, ownerEmail: u.email };
}

async function validTenantIds(ids = []) {
  if (!ids.length) return [];
  const Tenant = mongoose.model("Tenant");
  const found = await Tenant.find({ _id: { $in: ids } }).select("_id").lean();
  const ok = new Set(found.map((t) => String(t._id)));
  return ids.filter((id) => ok.has(String(id)));
}

export async function listIncidents({ status, severity, open, page = 1, limit = 25 } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (severity) filter.severity = severity;
  if (open) filter.status = { $ne: "resolved" };
  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    Incident().find(filter).sort({ startedAt: -1 }).skip(skip).limit(limit).lean(),
    Incident().countDocuments(filter),
  ]);
  return {
    incidents: rows.map((r) => ({ ...publicIncident(r), timeline: undefined })),
    pagination: { total, page, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/** Small read used by the Overview strip: open incidents, newest first, ≤ 5. */
export async function openIncidentsSummary(limit = 5) {
  const rows = await Incident()
    .find({ status: { $ne: "resolved" } })
    .sort({ severity: 1, startedAt: -1 })
    .limit(limit)
    .select("title severity status startedAt affectedTenantIds")
    .lean();
  return rows.map((r) => ({
    id: String(r._id),
    title: r.title,
    severity: r.severity,
    status: r.status,
    startedAt: r.startedAt,
    affectedTenantCount: (r.affectedTenantIds || []).length,
  }));
}

export async function getIncident(id) {
  const i = await Incident().findById(id).lean();
  if (!i) throw new APIError("Incident not found", 404);
  return i;
}

export async function createIncident(body, actor) {
  const owner = await resolveOwner(body.ownerId);
  const affectedTenantIds = await validTenantIds(body.affectedTenantIds || []);
  const doc = await Incident().create({
    title: body.title,
    severity: body.severity,
    status: body.status || "investigating",
    startedAt: body.startedAt,
    detectedAt: body.detectedAt ?? new Date(),
    affectedServices: body.affectedServices || [],
    affectedTenantIds,
    ...owner,
    timeline: body.note
      ? [{ at: new Date(), by: actor.id, byEmail: actor.email, text: body.note, status: body.status || "investigating" }]
      : [],
    createdBy: actor.id,
    createdByEmail: actor.email,
  });
  return doc.toObject();
}

export async function updateIncident(id, patch, actor) {
  const doc = await Incident().findById(id);
  if (!doc) throw new APIError("Incident not found", 404);
  if (doc.status === "resolved") {
    throw new APIError("A resolved incident cannot be edited; open a new one", 409);
  }
  const before = incidentSnapshot(doc);
  const { reason, ...fields } = patch;
  if (fields.ownerId !== undefined) Object.assign(doc, await resolveOwner(fields.ownerId));
  if (fields.affectedTenantIds) doc.affectedTenantIds = await validTenantIds(fields.affectedTenantIds);
  for (const k of ["title", "severity", "startedAt", "detectedAt", "affectedServices"]) {
    if (fields[k] !== undefined) doc[k] = fields[k];
  }
  if (fields.status && fields.status !== doc.status) {
    if (doc.timeline.length >= INCIDENT_MAX_TIMELINE) {
      throw new APIError(`Timeline is full (${INCIDENT_MAX_TIMELINE} entries); resolve and open a new incident`, 409);
    }
    doc.status = fields.status;
    doc.timeline.push({ at: new Date(), by: actor.id, byEmail: actor.email, text: reason, status: fields.status });
  }
  await doc.save();
  return { before, after: incidentSnapshot(doc), doc: doc.toObject() };
}

export async function addTimelineEntry(id, { text, status }, actor) {
  const doc = await Incident().findById(id);
  if (!doc) throw new APIError("Incident not found", 404);
  if (doc.status === "resolved") throw new APIError("Incident is resolved", 409);
  if (status && !INCIDENT_OPEN_STATUSES.includes(status)) {
    throw new APIError("Use the resolve action to resolve an incident", 400);
  }
  if (doc.timeline.length >= INCIDENT_MAX_TIMELINE) {
    throw new APIError(`Timeline is full (${INCIDENT_MAX_TIMELINE} entries); resolve and open a new incident`, 409);
  }
  const before = incidentSnapshot(doc);
  if (status) doc.status = status;
  doc.timeline.push({ at: new Date(), by: actor.id, byEmail: actor.email, text, status: status || null });
  await doc.save();
  return { before, after: incidentSnapshot(doc), doc: doc.toObject() };
}

export async function resolveIncident(id, { resolutionNotes, resolvedAt }, actor) {
  const doc = await Incident().findById(id);
  if (!doc) throw new APIError("Incident not found", 404);
  if (doc.status === "resolved") throw new APIError("Incident is already resolved", 409);
  const before = incidentSnapshot(doc);
  const resolvedTime = resolvedAt || new Date();
  if (doc.startedAt && resolvedTime < doc.startedAt) {
    throw new APIError("resolvedAt cannot be before the incident started", 400);
  }
  doc.status = "resolved";
  doc.resolvedAt = resolvedTime;
  doc.resolutionNotes = resolutionNotes;
  doc.timeline.push({ at: new Date(), by: actor.id, byEmail: actor.email, text: resolutionNotes, status: "resolved" });
  await doc.save();
  return { before, after: incidentSnapshot(doc), doc: doc.toObject() };
}
