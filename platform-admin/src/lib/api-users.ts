import { http, type PlatformUser } from './api';

/** Session user as returned by /me and /login (role + forced-reset flag). */
export type PlatformSessionUser = PlatformUser & {
  role?: string | null;
  mustResetPassword?: boolean;
  mfaEnabled?: boolean;
  roles?: PlatformRoleDef[];
};

export interface PlatformSession {
  id: string;
  ip: string | null;
  userAgent: string | null;
  mfaVerified: boolean;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt: string | null;
  current: boolean;
}

export interface MfaStatus {
  enabled: boolean;
  enrolledAt: string | null;
  recoveryCodesRemaining: number;
}

export interface SecuritySettings {
  requireMfaForRoles: string[];
}

export interface PlatformRoleDef {
  key: string;
  label: string;
  description: string;
  scopes: string[];
}

export interface PlatformStaffUser {
  id: string;
  name: string;
  email: string;
  role: string | null;
  status: 'active' | 'suspended';
  scopes: string[];
  explicitScopes: string[];
  mustResetPassword: boolean;
  mfaEnabled: boolean;
  mfaEnrolledAt: string | null;
  lastLoginAt: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  createdAt: string | null;
}

export interface PlatformInvite {
  id: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  invitedBy: string | null;
  expiresAt: string;
  createdAt: string;
}

// Role rank mirrors config/platformRoles.js (server enforces; this only
// trims the role picker to what the current operator may grant).
const ROLE_RANK: Record<string, number> = {
  owner: 100,
  admin: 80,
  operations: 50,
  finance: 50,
  developer: 50,
  support: 40,
};
export function roleRank(role?: string | null): number {
  return ROLE_RANK[String(role || '').toLowerCase()] ?? 0;
}
export function canAssignRole(actorRole: string | null | undefined, target: string): boolean {
  const actor = String(actorRole || '').toLowerCase();
  if (actor === 'owner') return true;
  if (actor === 'admin') return target !== 'owner';
  return false;
}

export const usersApi = {
  list: async () => {
    const res = await http.get('/users');
    return res.data.data as { users: PlatformStaffUser[]; roles: PlatformRoleDef[] };
  },
  changeRole: async (id: string, role: string, reason?: string) => {
    const res = await http.patch(`/users/${id}/role`, { role, reason });
    return res.data.data as PlatformStaffUser;
  },
  suspend: async (id: string, reason: string) => {
    const res = await http.post(`/users/${id}/suspend`, { reason });
    return res.data.data as PlatformStaffUser;
  },
  reactivate: async (id: string, reason?: string) => {
    const res = await http.post(`/users/${id}/reactivate`, { reason });
    return res.data.data as PlatformStaffUser;
  },
  revokeSessions: async (id: string, reason?: string) => {
    const res = await http.post(`/users/${id}/revoke-sessions`, { reason });
    return res.data.data as PlatformStaffUser;
  },
  forcePasswordReset: async (id: string, reason?: string) => {
    const res = await http.post(`/users/${id}/force-password-reset`, { reason });
    return res.data.data as PlatformStaffUser;
  },
  changeOwnPassword: async (currentPassword: string, password: string) => {
    const res = await http.post('/users/me/password', { currentPassword, password });
    return res.data as { success: boolean; message: string };
  },
  resetMfa: async (id: string, reason?: string) => {
    const res = await http.post(`/users/${id}/reset-mfa`, { reason });
    return res.data.data as MfaStatus;
  },
  sessions: {
    mine: async () => (await http.get('/users/me/sessions')).data.data as PlatformSession[],
    revokeMine: async (sessionId: string) => (await http.delete(`/users/me/sessions/${sessionId}`)).data.data as PlatformSession,
    revokeMyOthers: async () => (await http.delete('/users/me/sessions')).data.data as { revoked: number },
    ofUser: async (id: string) => (await http.get(`/users/${id}/sessions`)).data.data as PlatformSession[],
    revokeOfUser: async (id: string, sessionId: string, reason?: string) =>
      (await http.delete(`/users/${id}/sessions/${sessionId}`, { data: { reason } })).data.data as PlatformSession,
  },
  mfa: {
    status: async () => (await http.get('/auth/mfa/status')).data.data as MfaStatus,
    beginEnroll: async (currentPassword: string) =>
      (await http.post('/auth/mfa/enroll', { currentPassword })).data.data as { secret: string; otpauth: string; issuer: string; account: string },
    confirmEnroll: async (code: string) =>
      (await http.post('/auth/mfa/enroll/confirm', { code })).data.data as { recoveryCodes: string[]; status: MfaStatus },
    disable: async (currentPassword: string, code: string) =>
      (await http.post('/auth/mfa/disable', { currentPassword, code })).data.data as MfaStatus,
    regenerateRecovery: async (code: string) =>
      (await http.post('/auth/mfa/recovery-codes', { code })).data.data as { recoveryCodes: string[]; status: MfaStatus },
  },
  security: {
    get: async () => (await http.get('/security/settings')).data.data as { settings: SecuritySettings; roles: PlatformRoleDef[] },
    update: async (settings: SecuritySettings) => (await http.put('/security/settings', settings)).data.data as { settings: SecuritySettings },
  },
  invites: {
    list: async () => {
      const res = await http.get('/users/invites');
      return res.data.data as PlatformInvite[];
    },
    create: async (email: string, role: string) => {
      const res = await http.post('/users/invites', { email, role });
      return res.data.data as PlatformInvite;
    },
    resend: async (id: string) => {
      const res = await http.post(`/users/invites/${id}/resend`);
      return res.data.data as PlatformInvite;
    },
    revoke: async (id: string) => {
      const res = await http.delete(`/users/invites/${id}`);
      return res.data.data as PlatformInvite;
    },
  },
  // Public (no token) — the interceptor simply sends no Authorization header.
  public: {
    acceptInvite: async (token: string, name: string, password: string) => {
      const res = await http.post('/auth/accept-invite', { token, name, password });
      return res.data as { success: boolean; message: string };
    },
    requestReset: async (email: string) => {
      const res = await http.post('/auth/password-reset', { email });
      return res.data as { success: boolean; message: string };
    },
    confirmReset: async (token: string, password: string) => {
      const res = await http.post('/auth/password-reset/confirm', { token, password });
      return res.data as { success: boolean; message: string };
    },
  },
};
