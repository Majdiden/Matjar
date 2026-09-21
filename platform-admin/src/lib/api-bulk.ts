// Bulk tenant operations (Phase C, workstream C2). Mirrors routes/platform/bulk.js.
// Reversible actions only, ≤50 tenants, reason + fresh re-authentication.
import { http, unwrapData as d, PLATFORM_SCOPES, hasScope, type PlatformScope, type PlatformUser } from './api';


export const BULK_ACTIONS = ['suspend', 'unsuspend', 'add_to_program', 'remove_from_program', 'change_plan'] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];
export const BULK_MAX_TENANTS = 50;

export const BULK_ACTION_LABEL: Record<BulkAction, string> = {
  suspend: 'Suspend',
  unsuspend: 'Unsuspend',
  add_to_program: 'Add to program',
  remove_from_program: 'Remove from program',
  change_plan: 'Change plan',
};

/** Scope each action needs — mirrors controllers/platform/bulk.js BULK_ACTION_SCOPE. */
export const BULK_ACTION_SCOPE: Record<BulkAction, PlatformScope> = {
  suspend: PLATFORM_SCOPES.TENANT_LIFECYCLE,
  unsuspend: PLATFORM_SCOPES.TENANT_LIFECYCLE,
  add_to_program: PLATFORM_SCOPES.FLAGS_WRITE,
  remove_from_program: PLATFORM_SCOPES.FLAGS_WRITE,
  change_plan: PLATFORM_SCOPES.BILLING_WRITE,
};
export const allowedBulkActions = (user: PlatformUser | null): BulkAction[] =>
  BULK_ACTIONS.filter((a) => hasScope(user, BULK_ACTION_SCOPE[a]));

export interface BulkParams {
  programId?: string;
  planKey?: string;
  effectiveAt?: 'immediately' | 'next_period';
}

export interface BulkResult {
  tenantId: string;
  ok: boolean;
  error?: string;
  code?: number;
}

export interface BulkResponse {
  batchId: string;
  results: BulkResult[];
  summary: { total: number; ok: number; failed: number };
}

export const bulkApi = {
  tenants: (body: { action: BulkAction; tenantIds: string[]; reason: string; params?: BulkParams }) =>
    d<BulkResponse>(http.post('/bulk/tenants', body)),
};
