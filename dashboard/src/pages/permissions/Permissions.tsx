import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { Separator } from '../../components/ui/separator';
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
  Shield, Plus, MoreHorizontal, Edit, Trash2, Loader2, Save, ShieldCheck,
} from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { useConfirm } from '../../components/ui/use-confirm';

interface Role {
  _id: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
}

interface PermissionCatalogGroup {
  key: string;
  label: string;
  permissions: { key: string; label: string }[];
}

export const Permissions: React.FC = () => {
  const { t } = useTranslation(['staff', 'common']);
  const [roles, setRoles] = useState<Role[]>([]);
  const [catalog, setCatalog] = useState<PermissionCatalogGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as string[],
  });

  useEffect(() => { loadRoles(); }, []);

  const loadRoles = async () => {
    try {
      setLoading(true);
      interface RolesResponseData {
        catalog?: PermissionCatalogGroup[];
        roles?: Role[];
      }
      const response = (await api.get('/roles')) as {
        data?: RolesResponseData;
        responseObject?: RolesResponseData | { data?: RolesResponseData };
      };
      const ro = response.responseObject;
      const roWithData = ro as { data?: RolesResponseData } | undefined;
      const data: RolesResponseData | undefined =
        response.data || roWithData?.data || (ro as RolesResponseData | undefined);
      setCatalog(data?.catalog || []);
      setRoles(data?.roles || []);
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || t('staff.role.toast.load_failed'));
      setCatalog([]);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditingRole(null);
    setFormData({ name: '', description: '', permissions: [] });
    setDialogOpen(true);
  };

  const openEditDialog = (role: Role) => {
    setEditingRole(role);
    setFormData({ name: role.name, description: role.description, permissions: [...role.permissions] });
    setDialogOpen(true);
  };

  const togglePermission = (key: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter(p => p !== key)
        : [...prev.permissions, key],
    }));
  };

  const toggleGroup = (group: PermissionCatalogGroup) => {
    const allKeys = group.permissions.map(p => p.key);
    const allSelected = allKeys.every(k => formData.permissions.includes(k));
    setFormData(prev => ({
      ...prev,
      permissions: allSelected
        ? prev.permissions.filter(p => !allKeys.includes(p))
        : [...new Set([...prev.permissions, ...allKeys])],
    }));
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { toast.error(t('staff.role.toast.name_required')); return; }
    try {
      setSaving(true);
      if (editingRole) {
        await api.patch(`/roles/${editingRole._id}`, formData);
        toast.success(t('staff.role.toast.updated'));
      } else {
        await api.post('/roles', formData);
        toast.success(t('staff.role.toast.created'));
      }
      setDialogOpen(false);
      await loadRoles();
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || t('staff.role.toast.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role: Role) => {
    if (role.isSystem) { toast.error(t('staff.role.toast.builtin_no_delete')); return; }
    if (!(await confirm({
      title: t('staff.role.confirm_delete.title', { name: role.name }),
      description: t('staff.role.confirm_delete.description'),
      confirmText: t('staff.role.confirm_delete.confirm_text'),
      variant: 'destructive',
    }))) return;
    try {
      await api.delete(`/roles/${role._id}`);
      toast.success(t('staff.role.toast.deleted'));
      await loadRoles();
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || t('staff.role.toast.delete_failed'));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const isSystemRole = editingRole?.isSystem === true;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('staff.role.list.title')}</h1>
          <p className="text-muted-foreground">
            {t('staff.role.list.subtitle')}
          </p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          {t('staff.role.form.create_button')}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('staff.role.list.column.role')}</TableHead>
                <TableHead>{t('staff.role.list.column.description')}</TableHead>
                <TableHead>{t('staff.role.list.column.permissions')}</TableHead>
                <TableHead>{t('staff.role.list.column.type')}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map(role => (
                <TableRow key={role._id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {role.permissions.includes('*') ? (
                        <ShieldCheck className="h-4 w-4 text-primary" />
                      ) : (
                        <Shield className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-medium">{role.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {role.description}
                  </TableCell>
                  <TableCell>
                    {role.permissions.includes('*') ? (
                      <Badge>{t('staff.role.list.all_permissions')}</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {t('staff.role.list.permission_count', { count: role.permissions.length })}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={role.isSystem ? 'secondary' : 'outline'}>
                      {role.isSystem ? t('staff.role.list.type_builtin') : t('staff.role.list.type_custom')}
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
                        <DropdownMenuItem onClick={() => openEditDialog(role)}>
                          <Edit className="h-4 w-4 mr-2" />
                          {role.isSystem ? t('common:action.view') : t('common:action.edit')}
                        </DropdownMenuItem>
                        {!role.isSystem && (
                          <DropdownMenuItem onClick={() => handleDelete(role)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />{t('common:action.delete')}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRole
                ? (isSystemRole ? t('staff.role.form.title_view', { name: editingRole.name }) : t('staff.role.form.title_edit'))
                : t('staff.role.form.title_create')}
            </DialogTitle>
            <DialogDescription>
              {isSystemRole
                ? t('staff.role.form.description_builtin')
                : editingRole
                  ? t('staff.role.form.description_edit')
                  : t('staff.role.form.description_create')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('staff.role.form.field.name.label')}</Label>
                <Input
                  placeholder={t('staff.role.form.field.name.placeholder')}
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  disabled={isSystemRole}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('staff.role.form.field.description.label')}</Label>
                <Input
                  placeholder={t('staff.role.form.field.description.placeholder')}
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  disabled={isSystemRole}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold">{t('staff.role.form.field.permissions.label')}</h3>
              {formData.permissions.includes('*') && (
                <Card className="border-primary/40">
                  <CardContent className="py-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{t('staff.role.form.wildcard_notice')}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
              {catalog.map(group => {
                const allKeys = group.permissions.map(p => p.key);
                const allSelected = allKeys.every(k => formData.permissions.includes(k));

                return (
                  <Card key={group.key}>
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{group.label}</CardTitle>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {allKeys.filter(k => formData.permissions.includes(k)).length}/{allKeys.length}
                          </span>
                          <Switch
                            checked={allSelected}
                            onCheckedChange={() => toggleGroup(group)}
                            disabled={isSystemRole}
                          />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 pt-0">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {group.permissions.map(perm => (
                          <label
                            key={perm.key}
                            className="flex items-center gap-2 text-sm cursor-pointer"
                          >
                            <Switch
                              checked={formData.permissions.includes(perm.key)}
                              onCheckedChange={() => togglePermission(perm.key)}
                              className="scale-75"
                              disabled={isSystemRole}
                            />
                            <span>{perm.label}</span>
                          </label>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              {isSystemRole ? t('staff.role.form.close_button') : t('common:action.cancel')}
            </Button>
            {!isSystemRole && (
              <Button onClick={handleSave} disabled={saving}>
                {saving
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('common:state.saving_ellipsis')}</>
                  : <><Save className="h-4 w-4 mr-2" />{t('staff.role.form.save_button')}</>
                }
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Permissions;
