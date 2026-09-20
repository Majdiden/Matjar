// Platform audit ledger + tenant activity (read-only). Owner: A1.
import { http } from './api';

export interface AuditRow {
  _id: string;
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  actorType: 'platform_user' | 'system';
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  tenantId?: string | null;
  tenant?: { name: string; slug: string } | null;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  outcome: 'success' | 'failure';
  createdAt: string;
}

export interface AuditQuery {
  actor?: string;
  action?: string;
  tenantId?: string;
  resourceType?: string;
  outcome?: 'success' | 'failure';
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface ActivityItem {
  at: string;
  source: 'platform' | 'merchant';
  actor?: string | null;
  action: string;
  label: string;
  resourceType?: string | null;
  resourceId?: string | null;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  details?: unknown;
  outcome?: 'success' | 'failure';
}

export const auditApi = {
  list: async (params: AuditQuery = {}) => {
    const res = await http.get('/audit', { params });
    return res.data.data as {
      items: AuditRow[];
      pagination: { total: number; page: number; pages: number; limit: number };
    };
  },
  actions: async () => {
    const res = await http.get('/audit/actions');
    return res.data.data as string[];
  },
  tenantActivity: async (tenantId: string, params: { page?: number; limit?: number } = {}) => {
    const res = await http.get(`/audit/tenants/${tenantId}/activity`, { params });
    return res.data.data as { items: ActivityItem[]; page: number; limit: number; hasMore: boolean };
  },
};
