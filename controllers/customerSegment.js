import * as Service from "../services/customerSegment.js";
import { asyncHandler } from "../middlewares/errorHandler.js";
import { logAudit } from "../utils/audit.js";

export const listSegments = asyncHandler(async (req, res) => {
  const segments = await Service.listSegments(req.models);
  res.json({ success: true, data: segments });
});

export const getSegment = asyncHandler(async (req, res) => {
  const segment = await Service.getSegment(req.models, req.params.id);
  res.json({ success: true, data: segment });
});

export const createSegment = asyncHandler(async (req, res) => {
  const segment = await Service.createSegment(req.models, req.body);
  logAudit(req.models, {
    action: "customerSegment.created",
    resource: "CustomerSegment",
    resourceId: segment._id,
    changes: req.body,
    req,
  });
  res.status(201).json({ success: true, data: segment });
});

export const updateSegment = asyncHandler(async (req, res) => {
  const segment = await Service.updateSegment(req.models, req.params.id, req.body);
  logAudit(req.models, {
    action: "customerSegment.updated",
    resource: "CustomerSegment",
    resourceId: segment._id,
    changes: req.body,
    req,
  });
  res.json({ success: true, data: segment });
});

export const deleteSegment = asyncHandler(async (req, res) => {
  await Service.deleteSegment(req.models, req.params.id);
  logAudit(req.models, {
    action: "customerSegment.deleted",
    resource: "CustomerSegment",
    resourceId: req.params.id,
    req,
  });
  res.json({ success: true });
});

// Resolve a saved segment to its current member list.
export const previewSegment = asyncHandler(async (req, res) => {
  const segment = await Service.getSegment(req.models, req.params.id);
  const result = await Service.resolveSegment(req.models, segment, {
    limit: 200,
    tenantId: req.tenant?._id,
  });
  res.json({ success: true, data: result });
});

// Resolve an ad-hoc filter without saving — drives the dashboard's
// "preview matches" button while a merchant is building a new segment.
export const previewFilters = asyncHandler(async (req, res) => {
  const result = await Service.resolveSegment(
    req.models,
    { filters: req.body || {} },
    { limit: 200, tenantId: req.tenant?._id }
  );
  res.json({ success: true, data: result });
});
