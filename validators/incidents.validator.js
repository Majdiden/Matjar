import { z } from "zod";
import { objectId, reason } from "./platform.validator.js";
import { INCIDENT_SEVERITIES, INCIDENT_STATUSES, INCIDENT_OPEN_STATUSES, INCIDENT_MAX_TENANTS } from "../schemas/incident.js";

const isoDate = z.string().datetime({ offset: true }).or(z.date());

const serviceName = z.string().trim().min(1).max(60).regex(/^[a-z0-9._-]+$/i);

const incidentBody = z.object({
  title: z.string().trim().min(3).max(200),
  severity: z.enum(INCIDENT_SEVERITIES),
  // "resolved" is only reachable through POST /:id/resolve (requires notes).
  status: z.enum(INCIDENT_OPEN_STATUSES).optional(),
  startedAt: isoDate,
  detectedAt: isoDate.nullable().optional(),
  affectedServices: z.array(serviceName).max(50).optional(),
  affectedTenantIds: z.array(objectId).max(INCIDENT_MAX_TENANTS).optional(),
  ownerId: objectId.nullable().optional(),
  // First timeline entry / reason for opening.
  note: z.string().trim().min(1).max(2000).optional(),
});

export const createIncidentSchema = z.object({ body: incidentBody });

export const updateIncidentSchema = z.object({
  params: z.object({ id: objectId }),
  body: incidentBody.partial().extend({ reason }).refine((b) => Object.keys(b).length > 1, {
    message: "Nothing to update",
  }),
});

export const incidentTimelineSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    text: z.string().trim().min(1).max(2000),
    status: z.enum(INCIDENT_OPEN_STATUSES).optional(),
  }),
});

export const resolveIncidentSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    resolutionNotes: z.string().trim().min(4).max(5000),
    resolvedAt: isoDate.optional(),
  }),
});

export const listIncidentsSchema = z.object({
  query: z
    .object({
      status: z.enum(INCIDENT_STATUSES).optional(),
      severity: z.enum(INCIDENT_SEVERITIES).optional(),
      open: z.enum(["1", "true"]).optional(),
      page: z.coerce.number().int().min(1).max(10000).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    })
    .refine((q) => !(q.status && q.open), { message: "Use either status or open, not both", path: ["open"] }),
});

export const incidentIdSchema = z.object({ params: z.object({ id: objectId }) });
