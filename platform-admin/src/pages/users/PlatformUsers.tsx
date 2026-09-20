import { useCallback, useEffect, useState } from 'react';
import { hasScope, PLATFORM_SCOPES } from '../../lib/api';
import {
  usersApi,
  canAssignRole,
  roleRank,
  type PlatformStaffUser,
  type PlatformInvite,
  type PlatformRoleDef,
  type PlatformSession,
} from '../../lib/api-users';
import { useReauth } from '../../components/useReauth';
import { useAuth } from '../../contexts/auth-context';
import { Button } from '../../components/ui/Button';
import { Input, Label, Select } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { DataList, type DataListColumn } from '../../components/ui/DataList';
import { PageSpinner, ErrorState, EmptyState } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/toast-context';
import { formatDate, formatRelative } from '../../lib/utils';
import { Users, UserPlus, RefreshCw, Mail, Ban, Play, KeyRound, LogOut, ShieldCheck, ShieldOff, X, MonitorSmartphone } from 'lucide-react';

type Action = 'role' | 'suspend' | 'reactivate' | 'revoke' | 'force-reset' | 'reset-mfa';

const ROLE_TONE: Record<string, React.ComponentProps<typeof Badge>['variant']> = {
  owner: 'default',
  admin: 'secondary',
};

export default function PlatformUsers() {
  const toast = useToast();
  const { user: me } = useAuth();
  const canManage = hasScope(me, PLATFORM_SCOPES.PLATFORM_USERS);

  const [users, setUsers] = useState<PlatformStaffUser[]>([]);
  const [roles, setRoles] = useState<PlatformRoleDef[]>([]);
  const [invites, setInvites] = useState<PlatformInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('support');
  const [inviting, setInviting] = useState(false);

  const [pending, setPending] = useState<{ action: Action; user: PlatformStaffUser } | null>(null);
  const [roleChoice, setRoleChoice] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const reauth = useReauth();
  const [sessionsFor, setSessionsFor] = useState<PlatformStaffUser | null>(null);
  const [userSessions, setUserSessions] = useState<PlatformSession[] | null>(null);

  const openSessions = async (u: PlatformStaffUser) => {
    setSessionsFor(u);
    setUserSessions(null);
    try {
      setUserSessions(await usersApi.sessions.ofUser(u.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load sessions');
      setSessionsFor(null);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, inv] = await Promise.all([usersApi.list(), usersApi.invites.list()]);
      setUsers(list.users);
      setRoles(list.roles);
      setInvites(inv);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load platform users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Roles the current operator may grant (server enforces; this trims the picker).
  const grantable = roles.filter((r) => canAssignRole(me?.role, r.key));

  const submitInvite = async () => {
    setInviting(true);
    try {
      await usersApi.invites.create(inviteEmail.trim(), inviteRole);
      toast.success(`Invitation sent to ${inviteEmail.trim()}`);
      setInviteOpen(false);
      setInviteEmail('');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setInviting(false);
    }
  };

  const run = async (label: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(label);
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

  const canActOn = (u: PlatformStaffUser) => {
    if (!canManage || u.id === me?.id) return false;
    if (me?.role === 'owner') return true;
    if (me?.role === 'admin') return roleRank(u.role) < roleRank('owner');
    return false;
  };

  const columns: DataListColumn<PlatformStaffUser>[] = [
    {
      id: 'user',
      header: 'User',
      primary: true,
      cell: (u) => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 font-medium">
            <span className="truncate">{u.name}</span>
            {u.id === me?.id && <Badge variant="outline" className="text-[10px]">you</Badge>}
          </div>
          <div className="truncate text-xs text-muted-foreground" dir="ltr">{u.email}</div>
        </div>
      ),
    },
    {
      id: 'role',
      header: 'Role',
      cell: (u) =>
        u.role ? (
          <Badge variant={ROLE_TONE[u.role] || 'outline'} className="capitalize">{u.role}</Badge>
        ) : (
          <span className="text-xs text-muted-foreground" title={u.explicitScopes.join(', ')}>
            legacy · {u.explicitScopes.length} scope(s)
          </span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (u) =>
        u.status === 'suspended' ? (
          <span title={u.suspensionReason || ''}>
            <Badge variant="destructive">Suspended</Badge>
          </span>
        ) : u.mustResetPassword ? (
          <Badge variant="warning">Reset required</Badge>
        ) : (
          <Badge variant="success">Active</Badge>
        ),
    },
    {
      id: 'mfa',
      header: '2FA',
      cell: (u) =>
        u.mfaEnabled ? (
          <Badge variant="success" className="text-[10px]">On</Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">Off</Badge>
        ),
    },
    {
      id: 'lastLogin',
      header: 'Last login',
      cell: (u) => <span className="text-xs text-muted-foreground">{u.lastLoginAt ? formatRelative(u.lastLoginAt) : 'never'}</span>,
    },
    {
      id: 'created',
      header: 'Added',
      hideOnMobile: true,
      cell: (u) => <span className="text-xs text-muted-foreground">{formatDate(u.createdAt)}</span>,
    },
    {
      id: 'actions',
      align: 'end',
      cell: (u) =>
        canActOn(u) ? (
          <div className="flex flex-wrap justify-end gap-1">
            <Button variant="ghost" size="sm" title="Change role" onClick={() => { setRoleChoice(u.role || 'support'); setPending({ action: 'role', user: u }); }}>
              <ShieldCheck className="h-3.5 w-3.5" />
            </Button>
            {u.status === 'suspended' ? (
              <Button variant="ghost" size="sm" title="Reactivate" onClick={() => setPending({ action: 'reactivate', user: u })}>
                <Play className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button variant="ghost" size="sm" title="Suspend" onClick={() => setPending({ action: 'suspend', user: u })}>
                <Ban className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="sm" title="Sign out everywhere" onClick={() => setPending({ action: 'revoke', user: u })}>
              <LogOut className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" title="Force password reset" onClick={() => setPending({ action: 'force-reset', user: u })}>
              <KeyRound className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" title="Sessions" onClick={() => openSessions(u)}>
              <MonitorSmartphone className="h-3.5 w-3.5" />
            </Button>
            {u.mfaEnabled && (
              <Button variant="ghost" size="sm" title="Reset two-factor (lost device)" onClick={() => setPending({ action: 'reset-mfa', user: u })}>
                <ShieldOff className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ) : null,
    },
  ];

  if (loading) return <PageSpinner />;
  if (error) return <ErrorState error={error} onRetry={load} />;

  const pendingInvites = invites.filter((i) => i.status === 'pending' || i.status === 'expired');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Users className="mt-1 h-6 w-6 shrink-0 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Platform users</h1>
            <p className="text-sm text-muted-foreground">
              Operators of the console. Roles decide what each person can do; the server enforces every action.
              {!canManage && ' (read-only — you lack the platform.users scope)'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          {canManage && grantable.length > 0 && (
            <Button size="sm" onClick={() => { setInviteRole(grantable[grantable.length - 1].key); setInviteOpen(true); }}>
              <UserPlus className="h-3.5 w-3.5" /> Invite
            </Button>
          )}
        </div>
      </div>

      {users.length === 0 ? (
        <EmptyState title="No platform users" description="Bootstrap the first owner with scripts/create-platform-admin.js." />
      ) : (
        <DataList columns={columns} rows={users} rowKey={(u) => u.id} />
      )}

      {canManage && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Pending invitations</h2>
          {pendingInvites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending invitations.</p>
          ) : (
            <DataList
              rows={pendingInvites}
              rowKey={(i) => i.id}
              columns={[
                { id: 'email', header: 'Email', primary: true, cell: (i) => <span dir="ltr">{i.email}</span> },
                { id: 'role', header: 'Role', cell: (i) => <Badge variant="outline" className="capitalize">{i.role}</Badge> },
                {
                  id: 'expires',
                  header: 'Expires',
                  cell: (i) =>
                    i.status === 'expired' ? <Badge variant="warning">Expired</Badge> : <span className="text-xs text-muted-foreground">{formatRelative(i.expiresAt)}</span>,
                },
                {
                  id: 'actions',
                  align: 'end',
                  cell: (i) => (
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" title="Resend" loading={busy === `resend:${i.id}`}
                        onClick={() => run(`resend:${i.id}`, () => usersApi.invites.resend(i.id), 'Invitation resent').catch(() => {})}>
                        <Mail className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" title="Revoke" className="text-destructive" loading={busy === `revoke:${i.id}`}
                        onClick={() => run(`revoke:${i.id}`, () => usersApi.invites.revoke(i.id), 'Invitation revoked').catch(() => {})}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
          )}
        </section>
      )}

      {/* Invite modal */}
      <Modal
        open={inviteOpen}
        onClose={inviting ? () => {} : () => setInviteOpen(false)}
        title="Invite a platform user"
        description="They receive an email link (valid 72 hours) to set their name and password."
        footer={
          <>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviting}>Cancel</Button>
            <Button onClick={submitInvite} loading={inviting} disabled={!/^\S+@\S+\.\S+$/.test(inviteEmail.trim())}>
              Send invitation
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" type="email" autoComplete="off" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="ops@matjar.to" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <Select id="invite-role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              {grantable.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">{roles.find((r) => r.key === inviteRole)?.description}</p>
          </div>
        </div>
      </Modal>

      {/* Change role */}
      <Modal
        open={pending?.action === 'role'}
        onClose={() => setPending(null)}
        title={`Change role — ${pending?.user.name ?? ''}`}
        description="Their current sessions are signed out so the new scope set applies immediately."
        footer={
          <>
            <Button variant="outline" onClick={() => setPending(null)}>Cancel</Button>
            <Button
              loading={busy === 'role'}
              disabled={!roleChoice || roleChoice === pending?.user.role}
              onClick={async () => {
                const u = pending!.user;
                // Granting or removing OWNER requires a fresh identity check (server enforces).
                if (roleChoice === 'owner' || u.role === 'owner') {
                  try { await reauth.ensure(); } catch { return; }
                }
                run('role', () => usersApi.changeRole(u.id, roleChoice), 'Role updated').then(() => setPending(null)).catch(() => {});
              }}
            >
              Change role
            </Button>
          </>
        }
      >
        <Select value={roleChoice} onChange={(e) => setRoleChoice(e.target.value)}>
          {grantable.map((r) => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </Select>
        <p className="mt-2 text-xs text-muted-foreground">{roles.find((r) => r.key === roleChoice)?.description}</p>
      </Modal>

      <ConfirmModal
        open={pending?.action === 'suspend'}
        onClose={() => setPending(null)}
        title={`Suspend ${pending?.user.name ?? ''}`}
        description="They are signed out immediately and cannot sign in until reactivated."
        fields={[{ name: 'reason', label: 'Reason', type: 'textarea', required: true, minLength: 4, help: 'Recorded in the audit log.' }]}
        confirmLabel="Suspend"
        confirmVariant="destructive"
        onConfirm={async (v) => { await run('suspend', () => usersApi.suspend(pending!.user.id, v.reason), 'User suspended'); }}
      />
      <ConfirmModal
        open={pending?.action === 'reactivate'}
        onClose={() => setPending(null)}
        title={`Reactivate ${pending?.user.name ?? ''}`}
        description="They can sign in again with their existing password."
        fields={[{ name: 'reason', label: 'Reason (optional)', type: 'text' }]}
        confirmLabel="Reactivate"
        onConfirm={async (v) => { await run('reactivate', () => usersApi.reactivate(pending!.user.id, v.reason || undefined), 'User reactivated'); }}
      />
      <ConfirmModal
        open={pending?.action === 'revoke'}
        onClose={() => setPending(null)}
        title={`Sign out ${pending?.user.name ?? ''} everywhere`}
        description="Every active session for this user is invalidated immediately."
        fields={[{ name: 'reason', label: 'Reason (optional)', type: 'text' }]}
        confirmLabel="Revoke sessions"
        onConfirm={async (v) => { await run('revoke', () => usersApi.revokeSessions(pending!.user.id, v.reason || undefined), 'Sessions revoked'); }}
      />
      <ConfirmModal
        open={pending?.action === 'force-reset'}
        onClose={() => setPending(null)}
        title={`Force password reset — ${pending?.user.name ?? ''}`}
        description="Their sessions are revoked, a reset link is emailed, and the console stays locked until they set a new password."
        fields={[{ name: 'reason', label: 'Reason (optional)', type: 'text' }]}
        confirmLabel="Force reset"
        confirmVariant="destructive"
        onConfirm={async (v) => { await run('force-reset', () => usersApi.forcePasswordReset(pending!.user.id, v.reason || undefined), 'Reset required — email sent'); }}
      />
      <ConfirmModal
        open={pending?.action === 'reset-mfa'}
        onClose={() => setPending(null)}
        title={`Reset two-factor — ${pending?.user.name ?? ''}`}
        description="Use this when an operator lost their authenticator and recovery codes. Their 2FA is removed and every session is signed out; they should re-enrol at next sign-in. You will be asked to confirm your identity."
        fields={[{ name: 'reason', label: 'Reason', type: 'text', required: true, minLength: 4 }]}
        confirmLabel="Reset two-factor"
        confirmVariant="destructive"
        onConfirm={async (v) => {
          // A cancelled re-auth is not an error: keep the confirm open quietly.
          try { await reauth.ensure(); } catch { throw new Error('Confirm your identity to continue.'); }
          await run('reset-mfa', () => usersApi.resetMfa(pending!.user.id, v.reason), 'Two-factor reset');
        }}
      />

      <Modal
        open={!!sessionsFor}
        onClose={() => { setSessionsFor(null); setUserSessions(null); }}
        title={`Sessions — ${sessionsFor?.name ?? ''}`}
        description="Signed-in devices for this operator (last 24 h incl. revoked). Revoking signs that device out within 30 seconds."
        className="max-w-2xl"
      >
        {userSessions === null ? (
          <PageSpinner />
        ) : userSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions recorded.</p>
        ) : (
          <ul className="divide-y text-sm">
            {userSessions.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-medium">{s.userAgent?.slice(0, 60) || 'Unknown device'}</span>
                    {s.mfaVerified && <Badge variant="outline" className="text-[10px]">2FA</Badge>}
                    {s.revokedAt && <Badge variant="destructive" className="text-[10px]">revoked</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground" dir="ltr">{s.ip || '—'} · active {formatRelative(s.lastSeenAt)}</div>
                </div>
                {!s.revokedAt && new Date(s.expiresAt) > new Date() && (
                  <Button variant="ghost" size="sm" title="Revoke" onClick={async () => {
                    try {
                      await usersApi.sessions.revokeOfUser(sessionsFor!.id, s.id, 'revoked by operator');
                      toast.success('Session revoked');
                      setUserSessions(await usersApi.sessions.ofUser(sessionsFor!.id));
                    } catch (err) { toast.error(err instanceof Error ? err.message : 'Failed'); }
                  }}>
                    <LogOut className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal>
      {reauth.modal}
    </div>
  );
}
