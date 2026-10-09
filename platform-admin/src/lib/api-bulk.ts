// Bulk tenant operations (Phase C, workstream C2). Mirrors routes/platform/bulk.js.
// Reversible actions only, ≤50 tenants, reason + fresh re-authentication.
import { http, unwrapData as d, PLATFORM_SCOPES, hasScope, type PlatformScope, type PlatformUser } from './api';


export const BULK_ACTIONS = [
  'suspend',
  'unsuspend',
  'schedule_deletion',
  'cancel_deletion',
  'add_to_program',
  'remove_from_program',
  'change_plan',
  'cancel_plan_change',
] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];
export const BULK_MAX_TENANTS = 50;
// Schedule-deletion grace window — mirrors validators/bulk.validator.js.
export const BULK_MIN_GRACE_DAYS = 1;
export const BULK_MAX_GRACE_DAYS = 90;
/** Actions that take a store offline; the confirm button renders destructive. */
export const BULK_DESTRUCTIVE: ReadonlySet<BulkAction> = new Set(['suspend', 'schedule_deletion']);

export const BULK_ACTION_LABEL: Record<BulkAction, string> = {
  suspend: 'Suspend',
  unsuspend: 'Unsuspend',
  schedule_deletion: 'Schedule deletion',
  cancel_deletion: 'Cancel scheduled deletion',
  add_to_program: 'Add to program',
  remove_from_program: 'Remove from program',
  change_plan: 'Change plan',
  cancel_plan_change: 'Cancel scheduled plan change',
};

/** Scope each action needs — mirrors controllers/platform/bulk.js BULK_ACTION_SCOPE. */
export const BULK_ACTION_SCOPE: Record<BulkAction, PlatformScope> = {
  suspend: PLATFORM_SCOPES.TENANT_LIFECYCLE,
  unsuspend: PLATFORM_SCOPES.TENANT_LIFECYCLE,
  schedule_deletion: PLATFORM_SCOPES.TENANT_LIFECYCLE,
  cancel_deletion: PLATFORM_SCOPES.TENANT_LIFECYCLE,
  add_to_program: PLATFORM_SCOPES.FLAGS_WRITE,
  remove_from_program: PLATFORM_SCOPES.FLAGS_WRITE,
  change_plan: PLATFORM_SCOPES.BILLING_WRITE,
  cancel_plan_change: PLATFORM_SCOPES.BILLING_WRITE,
};
export const allowedBulkActions = (user: PlatformUser | null): BulkAction[] =>
  BULK_ACTIONS.filter((a) => hasScope(user, BULK_ACTION_SCOPE[a]));

export interface BulkParams {
  programId?: string;
  planKey?: string;
  effectiveAt?: 'immediately' | 'next_period';
  graceDays?: number;
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

// Permanent deletion — NOT one of the reversible BULK_ACTIONS. Own route,
// scope (tenant.delete), typed phrase and password. Mirrors
// validators/bulk.validator.js.
export const BULK_DELETE_MAX_TENANTS = 20;
export const bulkDeleteConfirmationPhrase = (count: number) => `delete ${count} ${count === 1 ? 'store' : 'stores'}`;

export const bulkApi = {
  tenants: (body: { action: BulkAction; tenantIds: string[]; reason: string; params?: BulkParams }) =>
    d<BulkResponse>(http.post('/bulk/tenants', body)),
  deletePermanently: (body: { tenantIds: string[]; reason: string; confirmation: string; password: string }) =>
    d<BulkResponse>(http.post('/bulk/tenants/delete-permanently', body)),
};
