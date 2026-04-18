import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../../components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { FilterPills } from '../../components/ui/filter-pills';
import {
  Users, Plus, MoreHorizontal, Edit, Trash2, Loader2, RefreshCw, Mail, Search, X, Download,
} from 'lucide-react';
import { toCSV, downloadCSV } from '../../lib/utils';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { useConfirm } from '../../components/ui/use-confirm';

// ── Types ─────────────────────────────────────────────────────────────────────

type StaffRole = 'admin' | 'manager' | 'staff';

interface StaffMember {
  _id: string;
  name: string;
  email: string;
  roles: StaffRole[];
  customRoleIds?: string[];
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

interface CustomRole {
  _id: string;
  name: string;
  isSystem: boolean;
}

interface StaffInvite {
  _id: string;
  email: string;
  role: StaffRole;
  invitedBy?: string;
  expiresAt: string;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_OPTIONS: { value: StaffRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'staff', label: 'Staff' },
];

const roleBadgeVariant = (role: StaffRole): 'default' | 'secondary' | 'outline' => {
  if (role === 'admin') return 'default';
  if (role === 'manager') return 'secondary';
  return 'outline';
};

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString() : '—';

const errMsg = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object') {
    const e = err as { response?: { data?: { message?: unknown } }; message?: unknown };
    const serverMsg = e.response?.data?.message;
    if (typeof serverMsg === 'string') return serverMsg;
    if (typeof e.message === 'string') return e.message;
  }
  if (typeof err === 'string') return err;
  return fallback;
};

interface RolesListResponse {
  roles?: CustomRole[];
  data?: { roles?: CustomRole[] };
}

interface StaffListResponse {
  staff?: StaffMember[];
}

interface InvitesListResponse {
  invites?: StaffInvite[];
}

// ── Main component ─────────────────────────────────────────────────────────────

type StaffTab = 'members' | 'invites';

export const Staff: React.FC = () => {
  const confirm = useConfirm();
  const [tab, setTab] = useState<StaffTab>('members');

  // Staff tab state
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = (ids: string[]) => {
    if (selected.size === ids.length) setSelected(new Set());
    else setSelected(new Set(ids));
  };

  const handleBulkRemove = async () => {
    if (selected.size === 0) return;
    const ok = await confirm({
      title: `Remove ${selected.size} staff member${selected.size === 1 ? '' : 's'}?`,
      description: 'They will lose dashboard access immediately.',
      confirmText: 'Remove',
      variant: 'destructive',
    });
    if (!ok) return;
    const ids = [...selected];
    const results = await Promise.allSettled(ids.map(id => api.delete(`/staff/${id}`)));
    const good = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - good;
    if (good) toast.success(`${good} removed`);
    if (failed) toast.error(`${failed} failed`);
    setSelected(new Set());
    loadStaff();
  };

  const handleBulkExport = () => {
    const all = staff.filter(m => selected.has(m._id));
    if (all.length === 0) {
      toast.message('No staff to export');
      return;
    }
    const csv = toCSV<StaffMember & Record<string, unknown>>(
      all as (StaffMember & Record<string, unknown>)[],
      [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'roles', label: 'Roles', get: (m) => (m.roles || []).join(', ') },
        { key: 'isActive', label: 'Status', get: (m) => (m.isActive ? 'active' : 'inactive') },
        { key: 'lastLoginAt', label: 'Last login', get: (m) => m.lastLoginAt ? new Date(m.lastLoginAt).toISOString().slice(0, 10) : '' },
      ]
    );
    downloadCSV(csv, 'staff-selected');
    toast.success(`Exported ${all.length} staff`);
  };

  const filteredStaff = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((m) =>
      m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [staff, search]);

  // Invites tab state
  const [invites, setInvites] = useState<StaffInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<StaffRole>('staff');
  const [inviteSaving, setInviteSaving] = useState(false);

  // Role edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [editRoles, setEditRoles] = useState<StaffRole[]>([]);
  const [editCustomRoleIds, setEditCustomRoleIds] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  // Available custom roles (tenant-defined; excludes built-in system roles).
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);

  useEffect(() => {
    loadStaff();
    loadInvites();
    loadCustomRoles();
  }, []);

  const loadCustomRoles = async () => {
    try {
      const res = await api.get<RolesListResponse>('/roles') as {
        data?: RolesListResponse;
        responseObject?: RolesListResponse;
      };
      const all: CustomRole[] =
        res.data?.roles || res.responseObject?.data?.roles || [];
      setCustomRoles(all.filter((r) => !r.isSystem));
    } catch {
      setCustomRoles([]);
    }
  };

  // ── Data loaders ────────────────────────────────────────────────────────────

  const loadStaff = async () => {
    try {
      setStaffLoading(true);
      const res = await api.get<StaffListResponse>('/staff') as {
        data?: StaffListResponse;
        responseObject?: StaffListResponse;
      };
      setStaff(res.data?.staff || res.responseObject?.staff || []);
    } catch {
      setStaff([]);
    } finally {
      setStaffLoading(false);
    }
  };

  const loadInvites = async () => {
    try {
      setInvitesLoading(true);
      const res = await api.get<InvitesListResponse>('/staff/invites') as {
        data?: InvitesListResponse;
        responseObject?: InvitesListResponse;
      };
      setInvites(res.data?.invites || res.responseObject?.invites || []);
    } catch {
      setInvites([]);
    } finally {
      setInvitesLoading(false);
    }
  };

  // ── Invite actions ──────────────────────────────────────────────────────────

  const openInviteDialog = () => {
    setInviteEmail('');
    setInviteRole('staff');
    setInviteOpen(true);
  };

  const submitInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error('Email is required');
      return;
    }
    try {
      setInviteSaving(true);
      await api.post('/staff/invites', { email: inviteEmail.trim(), role: inviteRole });
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteOpen(false);
      loadInvites();
    } catch (err) {
      toast.error(errMsg(err, 'Failed to send invitation'));
    } finally {
      setInviteSaving(false);
    }
  };

  const handleResendInvite = async (invite: StaffInvite) => {
    try {
      await api.post(`/staff/invites/${invite._id}/resend`);
      toast.success(`Invitation resent to ${invite.email}`);
      loadInvites();
    } catch (err) {
      toast.error(errMsg(err, 'Failed to resend invitation'));
    }
  };

  const handleRevokeInvite = async (invite: StaffInvite) => {
    const ok = await confirm({
      title: 'Revoke invitation?',
      description: `This will revoke the invitation sent to ${invite.email}. They will no longer be able to accept it.`,
      confirmText: 'Revoke',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await api.delete(`/staff/invites/${invite._id}`);
      toast.success('Invitation revoked');
      loadInvites();
    } catch (err) {
      toast.error(errMsg(err, 'Failed to revoke invitation'));
    }
  };

  // ── Staff member actions ────────────────────────────────────────────────────

  const openEditDialog = (member: StaffMember) => {
    setEditingMember(member);
    setEditRoles([...member.roles]);
    setEditCustomRoleIds([...(member.customRoleIds || [])]);
    setEditOpen(true);
  };

  const toggleEditRole = (role: StaffRole) => {
    setEditRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const toggleEditCustomRole = (id: string) => {
    setEditCustomRoleIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const submitEditRoles = async () => {
    if (!editingMember) return;
    if (editRoles.length === 0) {
      toast.error('At least one role is required');
      return;
    }
    try {
      setEditSaving(true);
      await api.patch(`/staff/${editingMember._id}`, {
        roles: editRoles,
        customRoleIds: editCustomRoleIds,
      });
      toast.success('Roles updated');
      setEditOpen(false);
      loadStaff();
    } catch (err) {
      toast.error(errMsg(err, 'Failed to update roles'));
    } finally {
      setEditSaving(false);
    }
  };

  const handleRemoveStaff = async (member: StaffMember) => {
    const ok = await confirm({
      title: 'Remove staff member?',
      description: `${member.name} will lose access to the dashboard. This action can be undone by re-inviting them.`,
      confirmText: 'Remove',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await api.delete(`/staff/${member._id}`);
      toast.success(`${member.name} removed`);
      loadStaff();
    } catch (err) {
      toast.error(errMsg(err, 'Failed to remove staff member'));
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff & Team</h1>
          <p className="text-muted-foreground">Manage team members and pending invitations.</p>
        </div>
        <Button onClick={openInviteDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Invite staff
        </Button>
      </div>

      <FilterPills<StaffTab>
        items={[
          { id: 'members', label: 'Team members', icon: Users, count: staff.length },
          { id: 'invites', label: 'Pending invites', icon: Mail, count: invites.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div>
        {tab === 'members' && (<>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team members
              </CardTitle>
              <CardDescription>Admins, managers, and staff with dashboard access.</CardDescription>
            </CardHeader>
            <CardContent>
              {staffLoading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : staff.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>No staff members yet. Invite someone to get started.</p>
                </div>
              ) : (
                <>
                <div className="relative max-w-md mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                {selected.size > 0 && (
                  <div className="flex items-center justify-between p-3 mb-3 rounded-lg border bg-primary/5">
                    <p className="text-sm font-medium">{selected.size} selected</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
                        <X className="h-3.5 w-3.5 mr-1.5" />Clear
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleBulkExport}>
                        <Download className="h-3.5 w-3.5 mr-1.5" />Export CSV
                      </Button>
                      <Button variant="destructive" size="sm" onClick={handleBulkRemove}>
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />Remove
                      </Button>
                    </div>
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <input
                          type="checkbox"
                          checked={selected.size === filteredStaff.length && filteredStaff.length > 0}
                          onChange={() => toggleSelectAll(filteredStaff.map(m => m._id))}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Last login</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[50px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaff.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                          No staff match your search.
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredStaff.map((member) => (
                      <TableRow key={member._id} className={selected.has(member._id) ? 'bg-primary/5' : ''}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selected.has(member._id)}
                            onChange={() => toggleSelect(member._id)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                        </TableCell>
                        <TableCell className="font-medium">{member.name}</TableCell>
                        <TableCell className="text-muted-foreground">{member.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {member.roles.map((r) => (
                              <Badge key={r} variant={roleBadgeVariant(r)}>
                                {r}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {fmtDate(member.lastLoginAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={member.isActive ? 'default' : 'secondary'}>
                            {member.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(member)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit roles
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleRemoveStaff(member)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </>
              )}
            </CardContent>
          </Card>
        </>)}

        {tab === 'invites' && (<>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Pending invites
              </CardTitle>
              <CardDescription>Invitations that have been sent but not yet accepted.</CardDescription>
            </CardHeader>
            <CardContent>
              {invitesLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : invites.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Mail className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>No pending invitations.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Invited</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="w-[50px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invites.map((invite) => (
                      <TableRow key={invite._id}>
                        <TableCell className="font-medium">{invite.email}</TableCell>
                        <TableCell>
                          <Badge variant={roleBadgeVariant(invite.role)}>{invite.role}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {fmtDate(invite.createdAt)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {fmtDate(invite.expiresAt)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleResendInvite(invite)}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Resend
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleRevokeInvite(invite)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Revoke
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>)}
      </div>

      {/* ── Invite staff dialog ─────────────────────────────────────────────── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a staff member</DialogTitle>
            <DialogDescription>
              An invitation link will be emailed to them. It expires in 7 days.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitInvite()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as StaffRole)}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviteSaving}>
              Cancel
            </Button>
            <Button onClick={submitInvite} disabled={inviteSaving}>
              {inviteSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit roles dialog ───────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit roles — {editingMember?.name}</DialogTitle>
            <DialogDescription>
              Select one or more roles for this team member.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Built-in roles</div>
              {ROLE_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={editRoles.includes(opt.value)}
                    onChange={() => toggleEditRole(opt.value)}
                  />
                  <span className="font-medium capitalize">{opt.label}</span>
                </label>
              ))}
            </div>
            {customRoles.length > 0 && (
              <div className="space-y-3 border-t pt-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Custom roles</div>
                {customRoles.map((r) => (
                  <label key={r._id} className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={editCustomRoleIds.includes(r._id)}
                      onChange={() => toggleEditCustomRole(r._id)}
                    />
                    <span className="font-medium">{r.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
              Cancel
            </Button>
            <Button onClick={submitEditRoles} disabled={editSaving}>
              {editSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Staff;
