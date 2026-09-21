/**
 * Platform incident controllers. Reads: support.read. Writes: tenant.lifecycle
 * (routes). Every write records a platform audit row.
 */
import { asyncHandler } from "../../middlewares/errorHandler.js";
import { recordPlatformAudit } from "../../services/platform/audit.js";
import * as svc from "../../services/platform/incidents.js";

const actorOf = (req) => ({ id: req.platformUser.id, email: req.platformUser.email });

export const list = asyncHandler(async (req, res) => {
  const data = await svc.listIncidents(req.query);
  res.json({ success: true, data });
});

export const openSummary = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { incidents: await svc.openIncidentsSummary() } });
});

export const get = asyncHandler(async (req, res) => {
  res.json({ success: true, data: svc.publicIncident(await svc.getIncident(req.params.id)) });
});

export const create = asyncHandler(async (req, res) => {
  const doc = await svc.createIncident(req.body, actorOf(req));
  await recordPlatformAudit(req, {
    action: "incident.create",
    resourceType: "Incident",
    resourceId: doc._id,
    reason: req.body.note || null,
    after: svc.incidentSnapshot(doc),
  });
  res.status(201).json({ success: true, data: svc.publicIncident(doc) });
});

export const update = asyncHandler(async (req, res) => {
  const { before, after, doc } = await svc.updateIncident(req.params.id, req.body, actorOf(req));
  await recordPlatformAudit(req, {
    action: "incident.update",
    resourceType: "Incident",
    resourceId: doc._id,
    reason: req.body.reason,
    before,
    after,
  });
  res.json({ success: true, data: svc.publicIncident(doc) });
});

export const addTimeline = asyncHandler(async (req, res) => {
  const { before, after, doc } = await svc.addTimelineEntry(req.params.id, req.body, actorOf(req));
  await recordPlatformAudit(req, {
    action: "incident.timeline.add",
    resourceType: "Incident",
    resourceId: doc._id,
    reason: req.body.text,
    before,
    after,
  });
  res.status(201).json({ success: true, data: svc.publicIncident(doc) });
});

export const resolve = asyncHandler(async (req, res) => {
  const { before, after, doc } = await svc.resolveIncident(req.params.id, req.body, actorOf(req));
  await recordPlatformAudit(req, {
    action: "incident.resolve",
    resourceType: "Incident",
    resourceId: doc._id,
    reason: req.body.resolutionNotes,
    before,
    after,
  });
  res.json({ success: true, data: svc.publicIncident(doc) });
});
