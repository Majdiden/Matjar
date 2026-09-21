// Customer privacy operations on one tenant (Phase C, workstream C2).
// Mirrors routes/platform/privacy.js — lookup needs tenant.export, the two
// mutations additionally need a fresh re-authentication (X-Reauth).
import { http, unwrapData as d } from './api';


export interface PrivacyCustomer {
  id: string;
  name: string | null;
  email: string;
  isActive: boolean;
  anonymizedAt: string | null;
  createdAt: string;
  ordersCount: number;
}

export const privacyApi = {
  lookup: (tenantId: string, email: string) =>
    d<{ customers: PrivacyCustomer[] }>(http.get(`/tenants/${tenantId}/privacy/customers`, { params: { email } })),
  anonymise: (tenantId: string, userId: string, reason: string) =>
    d<{ userId: string; anonymizedAt: string }>(
      http.post(`/tenants/${tenantId}/privacy/customers/${userId}/anonymise`, { reason })
    ),
  requestExport: (tenantId: string, userId: string, reason: string) =>
    d<{ exportId: string; status: string; statusUrl: string }>(
      http.post(`/tenants/${tenantId}/privacy/customers/${userId}/export`, { reason })
    ),
};
