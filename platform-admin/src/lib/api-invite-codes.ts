// Signup invitation codes (PBI 10-47). Mirrors routes/platform/inviteCodes.js.
import { http, unwrapData as d } from './api';
import type { OverviewTenant } from '../components/tenant/OverviewCards';

export type SignupMode = 'open' | 'optional' | 'required';
export type InviteCodeStatus = 'active' | 'used' | 'revoked';

export interface InviteCode {
  id: string;
  code: string;
  status: InviteCodeStatus;
  note: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
  createdAt: string;
  usedAt: string | null;
  usedByTenantId: string | null;
  usedByTenantName: string | null;
  revokedAt: string | null;
}

export interface InviteCodeList {
  codes: InviteCode[];
  stats: { created: number; registered: number; unused: number; revoked: number };
  /** Owners only: everyone who created codes, for the filter. */
  promoters?: { id: string; name: string | null; email: string | null }[];
  /** Owners only. */
  signupMode?: SignupMode;
  /** The dashboard signup page (absolute, or a path when the server has no public URL set). */
  signupUrl: string;
}

export interface CodeStore {
  store: OverviewTenant & { _id: string; name: string; email: string; phone: string | null };
  stats: { usersTotal: number; productsTotal: number };
  code: InviteCode;
}

export const inviteCodesApi = {
  list: (params: { promoterId?: string } = {}) => d<InviteCodeList>(http.get('/invite-codes', { params })),
  create: (body: { count: number; note?: string | null }) => d<{ codes: InviteCode[] }>(http.post('/invite-codes', body)),
  revoke: (id: string) => d<InviteCode>(http.post(`/invite-codes/${id}/revoke`)),
  store: (tenantId: string) => d<CodeStore>(http.get(`/invite-codes/stores/${tenantId}`)),
  setSignupMode: (mode: SignupMode) => d<{ signupMode: SignupMode }>(http.put('/invite-codes/signup-mode', { mode })),
};

/** The dashboard signup link that fills the code in. */
export const signupLinkFor = (signupUrl: string, code: string) => {
  const base = /^https?:\/\//.test(signupUrl) ? signupUrl : `${window.location.origin}${signupUrl}`;
  return `${base}?code=${encodeURIComponent(code)}`;
};
