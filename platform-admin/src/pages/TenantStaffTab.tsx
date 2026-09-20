import { useCallback, useEffect, useState } from 'react';
import { hasScope, PLATFORM_SCOPES } from '../lib/api';
import { tenantUsersApi, type TenantInviteRow, type TenantStaffRow } from '../lib/api-tenant-users';
import { useAuth } from '../contexts/auth-context';
import { DataList, type DataListColumn } from '../components/ui/DataList';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { PageSpinner, EmptyState, ErrorState } from '../components/ui/Spinner';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../components/ui/toast-context';
import { formatDate } from '../lib/utils';
import { RefreshCw, UserX, UserCheck, Send, Trash2, KeyRound } from 'lucide-react';

const ROLE_VARIANT: Record<string, React.ComponentProps<typeof Badge>['variant']> = {
  admin: 'default',
  manager: 'secondary',
  staff: 'outline',
};

/**
 * Merchant staff of one tenant, read through the platform console. Revoke /
 * reactivate require a reason and are written to the platform audit ledger.
 * The server refuses to revoke the tenant's only active admin.
 */
export default function TenantStaffTab({ tenantId }: { tenantId: string }) {
  const toast = useToast();
  const { user } = useAuth();
  const canManage = hasScope(user, PLATFORM_SCOPES.TENANT_USERS);

  const [staff, setStaff] = useState<TenantStaffRow[]>([]);
  const [invites, setInvites] = useState<TenantInviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'revoke' | 'reactivate'; row: TenantStaffRow } | null>(null);
  const [inviteConfirm, setInviteConfirm] = useState<{ kind: 'resend' | 'revoke'; row: TenantInviteRow } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, i] = await Promise.all([tenantUsersApi.list(tenantId), tenantUsersApi.invites(tenantId)]);
      setStaff(s);
      setInvites(i);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (canManage) void load();
  }, [canManage, load]);

  if (!canManage) {
    return <EmptyState title="No access" description="Viewing merchant staff requires the tenant.users scope." />;
  }

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
      throw err;
    } finally {
      setBusy(null);
    }
  };

  const staffColumns: DataListColumn<TenantStaffRow>[] = [
    {
      id: 'name',
      header: 'Member',
      primary: true,
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{r.name || '—'}</div>
          <div className="truncate text-xs text-muted-foreground" dir="ltr">{r.email}</div>
        </div>
      ),
    },
    {
      id: 'roles',
      header: 'Roles',
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.roles.map((role) => (
            <Badge key={role} variant={ROLE_VARIANT[role] || 'outline'} className="capitalize">
              {role}
            </Badge>
          ))}
          {r.customRoles.map((name) => (
            <Badge key={name} variant="secondary">
              {name}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <div className="flex flex-wrap items-center gap-1">
          {r.isActive ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="destructive">{r.deactivatedBy === 'merchant' ? 'Removed by merchant' : 'Revoked by platform'}</Badge>
          )}
          {!r.emailVerified && <Badge variant="outline" className="text-[10px]">Email unverified</Badge>}
        </div>
      ),
    },
    {
      id: 'passkeys',
      header: 'Passkeys',
      cell: (r) => (
        <span className="inline-flex items-center gap-1 text-xs">
          <KeyRound className="h-3 w-3 text-muted-foreground" /> {r.passkeyCount}
        </span>
      ),
    },
    { id: 'lastLogin', header: 'Last login', cell: (r) => <span className="text-xs text-muted-foreground">{r.lastLoginAt ? formatDate(r.lastLoginAt) : 'never'}</span> },
    { id: 'joined', header: 'Joined', cell: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span> },
    {
      id: 'actions',
      align: 'end',
      cell: (r) =>
        r.isActive ? (
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirm({ kind: 'revoke', row: r })} loading={busy === r.id}>
            <UserX className="h-3.5 w-3.5" /> Revoke
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={r.deactivatedBy === 'merchant'}
            title={r.deactivatedBy === 'merchant' ? 'Removed by the store owner; only the merchant can restore' : undefined}
            onClick={() => setConfirm({ kind: 'reactivate', row: r })}
            loading={busy === r.id}
          >
            <UserCheck className="h-3.5 w-3.5" /> Reactivate
          </Button>
        ),
    },
  ];

  const inviteColumns: DataListColumn<TenantInviteRow>[] = [
    { id: 'email', header: 'Invitee', primary: true, cell: (r) => <span dir="ltr">{r.email}</span> },
    { id: 'role', header: 'Role', cell: (r) => <Badge variant={ROLE_VARIANT[r.role] || 'outline'} className="capitalize">{r.role}</Badge> },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <Badge variant={r.status === 'pending' ? 'secondary' : r.status === 'expired' ? 'warning' : 'outline'} className="capitalize">
          {r.status}
        </Badge>
      ),
    },
    { id: 'invitedBy', header: 'Invited by', cell: (r) => <span className="text-xs">{r.invitedBy || '—'}</span> },
    { id: 'expires', header: 'Expires', cell: (r) => <span className="text-xs text-muted-foreground">{formatDate(r.expiresAt)}</span> },
    {
      id: 'actions',
      align: 'end',
      cell: (r) =>
        r.status === 'revoked' ? null : (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" loading={busy === `resend-${r.id}`} onClick={() => setInviteConfirm({ kind: 'resend', row: r })}>
              <Send className="h-3.5 w-3.5" /> Resend
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" loading={busy === `revoke-${r.id}`} onClick={() => setInviteConfirm({ kind: 'revoke', row: r })}>
              <Trash2 className="h-3.5 w-3.5" /> Revoke
            </Button>
          </div>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Merchant staff with dashboard access. Revoking ends every session immediately; the store's only admin
          cannot be revoked.
        </p>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : loading && staff.length === 0 ? (
        <PageSpinner />
      ) : (
        <>
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Staff ({staff.length})</h3>
            {staff.length === 0 ? (
              <EmptyState title="No staff" description="This store has no staff accounts." />
            ) : (
              <DataList columns={staffColumns} rows={staff} rowKey={(r) => r.id} rowClassName={(r) => (r.isActive ? undefined : 'opacity-70')} />
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Invitations ({invites.filter((i) => i.status === 'pending').length} pending)</h3>
            {invites.length === 0 ? (
              <EmptyState title="No open invitations" />
            ) : (
              <DataList columns={inviteColumns} rows={invites} rowKey={(r) => r.id} />
            )}
          </section>
        </>
      )}

      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === 'revoke' ? `Revoke access for ${confirm.row.name || confirm.row.email}` : `Reactivate ${confirm?.row.name || confirm?.row.email || ''}`}
        description={
          confirm?.kind === 'revoke'
            ? 'The member is deactivated and signed out everywhere. Reversible from this page. Recorded in the platform audit log.'
            : 'The member can sign in again with their existing credentials. Recorded in the platform audit log.'
        }
        fields={[{ name: 'reason', label: 'Reason', type: 'textarea', required: true, minLength: 4, placeholder: 'Support ticket, merchant request, security incident…' }]}
        confirmLabel={confirm?.kind === 'revoke' ? 'Revoke access' : 'Reactivate'}
        confirmVariant={confirm?.kind === 'revoke' ? 'destructive' : 'default'}
        onConfirm={async (v) => {
          if (!confirm) return;
          const { kind, row } = confirm;
          await run(
            row.id,
            () => (kind === 'revoke' ? tenantUsersApi.revoke(tenantId, row.id, v.reason) : tenantUsersApi.reactivate(tenantId, row.id, v.reason)),
            kind === 'revoke' ? 'Access revoked' : 'Access reactivated'
          );
        }}
      />
      <ConfirmModal
        open={!!inviteConfirm}
        onClose={() => setInviteConfirm(null)}
        title={inviteConfirm?.kind === 'resend' ? `Resend invitation to ${inviteConfirm.row.email}` : `Revoke invitation for ${inviteConfirm?.row.email || ''}`}
        description={
          inviteConfirm?.kind === 'resend'
            ? 'A fresh 7-day link is emailed to the invitee; the old link stops working. Recorded in the platform audit log.'
            : 'The invitation link is invalidated. Recorded in the platform audit log.'
        }
        fields={[{ name: 'reason', label: 'Reason', type: 'textarea', required: true, minLength: 4, placeholder: 'Support ticket, merchant request…' }]}
        confirmLabel={inviteConfirm?.kind === 'resend' ? 'Resend' : 'Revoke invitation'}
        confirmVariant={inviteConfirm?.kind === 'resend' ? 'default' : 'destructive'}
        onConfirm={async (v) => {
          if (!inviteConfirm) return;
          const { kind, row } = inviteConfirm;
          await run(
            `${kind}-${row.id}`,
            () => (kind === 'resend' ? tenantUsersApi.resendInvite(tenantId, row.id, v.reason) : tenantUsersApi.revokeInvite(tenantId, row.id, v.reason)),
            kind === 'resend' ? 'Invitation resent' : 'Invitation revoked'
          );
        }}
      />
    </div>
  );
}
