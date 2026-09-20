import { http } from './api';

export interface TenantStaffRow {
  id: string;
  name: string;
  email: string;
  deactivatedBy: 'merchant' | 'platform' | null;
  roles: string[];
  customRoles: string[];
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  passkeyCount: number;
}

export interface TenantInviteRow {
  id: string;
  email: string;
  role: string;
  invitedBy: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  status: 'pending' | 'expired' | 'revoked';
}

const base = (tenantId: string) => `/tenants/${encodeURIComponent(tenantId)}/users`;

export const tenantUsersApi = {
  list: async (tenantId: string) => {
    const res = await http.get(base(tenantId));
    return res.data.data as TenantStaffRow[];
  },
  invites: async (tenantId: string) => {
    const res = await http.get(`${base(tenantId)}/invites`);
    return res.data.data as TenantInviteRow[];
  },
  revoke: async (tenantId: string, userId: string, reason: string) => {
    const res = await http.post(`${base(tenantId)}/${encodeURIComponent(userId)}/revoke`, { reason });
    return res.data.data as { userId: string; isActive: boolean };
  },
  reactivate: async (tenantId: string, userId: string, reason: string) => {
    const res = await http.post(`${base(tenantId)}/${encodeURIComponent(userId)}/reactivate`, { reason });
    return res.data.data as { userId: string; isActive: boolean };
  },
  resendInvite: async (tenantId: string, inviteId: string, reason: string) => {
    const res = await http.post(`${base(tenantId)}/invites/${encodeURIComponent(inviteId)}/resend`, { reason });
    return res.data.data as { email: string; role: string; expiresAt: string };
  },
  revokeInvite: async (tenantId: string, inviteId: string, reason: string) => {
    const res = await http.delete(`${base(tenantId)}/invites/${encodeURIComponent(inviteId)}`, { data: { reason } });
    return res.data.data as { inviteId: string; revoked: boolean };
  },
};
