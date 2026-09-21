// Incident register (Phase C, workstream C2). Mirrors routes/platform/incidents.js.
import { http, unwrapData as d, cleanParams } from './api';


export const INCIDENT_SEVERITIES = ['sev1', 'sev2', 'sev3', 'sev4'] as const;
export const INCIDENT_STATUSES = ['investigating', 'identified', 'monitoring', 'resolved'] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const SEVERITY_LABEL: Record<IncidentSeverity, string> = {
  sev1: 'Sev 1 · outage',
  sev2: 'Sev 2 · major',
  sev3: 'Sev 3 · minor',
  sev4: 'Sev 4 · low',
};
export const STATUS_LABEL: Record<IncidentStatus, string> = {
  investigating: 'Investigating',
  identified: 'Identified',
  monitoring: 'Monitoring',
  resolved: 'Resolved',
};

export interface IncidentTimelineEntry {
  id: string;
  at: string;
  by: string | null;
  byEmail: string | null;
  text: string;
  status: IncidentStatus | null;
}

export interface IncidentSummary {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  startedAt: string;
  affectedTenantCount: number;
}

export interface Incident extends IncidentSummary {
  detectedAt: string | null;
  resolvedAt: string | null;
  affectedServices: string[];
  affectedTenantIds: string[];
  ownerId: string | null;
  ownerEmail: string | null;
  timeline: IncidentTimelineEntry[];
  resolutionNotes: string | null;
  createdBy: string;
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentInput {
  title: string;
  severity: IncidentSeverity;
  status?: IncidentStatus;
  startedAt: string;
  detectedAt?: string | null;
  affectedServices?: string[];
  affectedTenantIds?: string[];
  ownerId?: string | null;
  note?: string;
}

export const incidentsApi = {
  list: (params: { status?: IncidentStatus; severity?: IncidentSeverity; open?: '1'; page?: number; limit?: number }) =>
    d<{ incidents: Incident[]; pagination: { total: number; page: number; pages: number } }>(
      http.get('/incidents', { params: cleanParams(params) })
    ),
  openSummary: () => d<{ incidents: IncidentSummary[] }>(http.get('/incidents/open-summary')),
  get: (id: string) => d<Incident>(http.get(`/incidents/${id}`)),
  create: (body: IncidentInput) => d<Incident>(http.post('/incidents', body)),
  update: (id: string, body: Partial<IncidentInput> & { reason: string }) =>
    d<Incident>(http.patch(`/incidents/${id}`, body)),
  addTimeline: (id: string, body: { text: string; status?: IncidentStatus }) =>
    d<Incident>(http.post(`/incidents/${id}/timeline`, body)),
  resolve: (id: string, body: { resolutionNotes: string; resolvedAt?: string }) =>
    d<Incident>(http.post(`/incidents/${id}/resolve`, body)),
};
