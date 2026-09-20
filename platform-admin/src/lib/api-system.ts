// System health, integrations, webhook inspector. Owner: B3.
import { http } from './api';

export type HealthStatus = 'ok' | 'degraded' | 'down' | 'unknown';
export type IntegrationHealth = 'ok' | 'degraded' | 'down' | 'not_configured';

export interface QueueRow {
  name: string;
  paused?: boolean;
  waiting?: number;
  active?: number;
  delayed?: number;
  failed?: number;
  completed?: number;
  error?: string;
}

export interface HealthCheck {
  name: string;
  status: HealthStatus;
  latencyMs?: number;
  error?: string;
  // api
  uptimeSec?: number;
  nodeVersion?: string;
  environment?: string;
  memory?: { rssMb: number; heapUsedMb: number };
  // mongo
  replica?: { isReplicaSet: boolean; isPrimary: boolean } | null;
  // redis
  connectionState?: string;
  // queues
  queues?: QueueRow[];
}

export interface Integration {
  name: string;
  kind: string;
  environment: string;
  configured: boolean;
  enabled: boolean;
  health: IntegrationHealth;
  lastSuccessAt?: string | null;
  lastErrorAt?: string | null;
  lastError?: string | null;
  note?: string | null;
  providers?: string[];
}

export interface SystemHealth {
  overall: HealthStatus;
  checks: HealthCheck[];
  integrations: Integration[];
  generatedAt: string;
}

export interface WebhookDeliveryRow {
  _id: string;
  tenantId: string;
  tenant?: { name: string; slug: string } | null;
  webhookId: string;
  event: string;
  url: string;
  status: 'success' | 'failed';
  responseStatus?: number | null;
  error?: string | null;
  durationMs?: number | null;
  attempt?: number;
  retryOf?: string | null;
  createdAt: string;
}

export interface WebhookDeliveryDetail extends WebhookDeliveryRow {
  payload?: unknown;
}

export interface WebhookDeliveryQuery {
  tenantId?: string;
  status?: 'success' | 'failed';
  event?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export const systemApi = {
  health: async (refresh = false) => {
    const res = await http.get('/system/health', { params: refresh ? { refresh: 1 } : {} });
    return res.data.data as SystemHealth;
  },
  integrations: async () => {
    const res = await http.get('/system/integrations');
    return res.data.data as { integrations: Integration[]; generatedAt: string };
  },
  webhooks: {
    list: async (params: WebhookDeliveryQuery = {}) => {
      const res = await http.get('/webhooks/deliveries', { params });
      return res.data.data as {
        items: WebhookDeliveryRow[];
        pagination: { total: number; page: number; pages: number; limit: number };
      };
    },
    events: async () => {
      const res = await http.get('/webhooks/events');
      return res.data.data as string[];
    },
    get: async (tenantId: string, id: string) => {
      const res = await http.get(`/webhooks/deliveries/${tenantId}/${id}`);
      return res.data.data as WebhookDeliveryDetail;
    },
    retry: async (tenantId: string, id: string) => {
      const res = await http.post(`/webhooks/deliveries/${tenantId}/${id}/retry`);
      return res.data.data as {
        result: { success: boolean; status: number; error?: string };
        delivery: WebhookDeliveryRow | null;
      };
    },
  },
};

export function formatUptime(sec?: number): string {
  if (!sec && sec !== 0) return '—';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
