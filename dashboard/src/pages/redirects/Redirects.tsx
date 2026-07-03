/**
 * Redirects (audit 6.7) — table of merchant-defined URL redirects with a
 * create/edit dialog and hit counts. Route: /dashboard/redirects
 * (Storefront group). Exact-match 301/302 mapping enforced by the
 * storefront middleware.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../../components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { CornerDownRight, Plus, MoreHorizontal, Edit, Trash2, Loader2 } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { useConfirm } from '../../components/ui/use-confirm';

interface RedirectRow {
  _id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  hits: number;
}

interface EditState {
  _id?: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
}

const BLANK: EditState = { fromPath: '', toPath: '', statusCode: 301 };

export const Redirects: React.FC = () => {
  const { t } = useTranslation(['redirects', 'common']);
  const confirm = useConfirm();
  const [rows, setRows] = useState<RedirectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [edit, setEdit] = useState<EditState>(BLANK);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const res = (await api.redirects.list({ limit: 200 })) as { data?: { redirects?: RedirectRow[] } };
      setRows(res?.data?.redirects || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => { setEdit(BLANK); setDialogOpen(true); };
  const openEdit = (r: RedirectRow) => {
    setEdit({ _id: r._id, fromPath: r.fromPath, toPath: r.toPath, statusCode: r.statusCode });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!edit.fromPath.trim() || !edit.toPath.trim()) {
      toast.error(t('redirects:toast.paths_required'));
      return;
    }
    try {
      setSaving(true);
      if (edit._id) {
        await api.redirects.update(edit._id, {
          fromPath: edit.fromPath.trim(),
          toPath: edit.toPath.trim(),
          statusCode: edit.statusCode,
        });
        toast.success(t('redirects:toast.saved'));
      } else {
        await api.redirects.create({
          fromPath: edit.fromPath.trim(),
          toPath: edit.toPath.trim(),
          statusCode: edit.statusCode,
        });
        toast.success(t('redirects:toast.created'));
      }
      setDialogOpen(false);
      load();
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || t('redirects:toast.error_save'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r: RedirectRow) => {
    if (!(await confirm({
      title: t('redirects:confirm.delete_title'),
      description: t('redirects:confirm.delete_description', { from: r.fromPath }),
      confirmText: t('common:action.delete'),
      variant: 'destructive',
    }))) return;
    try {
      await api.redirects.delete(r._id);
      toast.success(t('redirects:toast.deleted'));
      setRows((prev) => prev.filter((x) => x._id !== r._id));
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || t('redirects:toast.error_delete'));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('redirects:list.title')}</h1>
          <p className="text-muted-foreground">{t('redirects:list.subtitle')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 me-2" />{t('redirects:list.action.add')}
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-12">
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <CornerDownRight className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('redirects:list.empty.title')}</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">{t('redirects:list.empty.hint')}</p>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 me-2" />{t('redirects:list.empty.action')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('redirects:list.column.from')}</TableHead>
                  <TableHead>{t('redirects:list.column.to')}</TableHead>
                  <TableHead>{t('redirects:list.column.type')}</TableHead>
                  <TableHead className="text-end">{t('redirects:list.column.hits')}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r._id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(r)}>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded" dir="ltr">{r.fromPath}</code>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded" dir="ltr">{r.toPath}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.statusCode === 301 ? 'default' : 'secondary'}>{r.statusCode}</Badge>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{r.hits}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(r)}>
                            <Edit className="h-4 w-4 me-2" />{t('common:action.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(r)} className="text-destructive">
                            <Trash2 className="h-4 w-4 me-2" />{t('common:action.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{edit._id ? t('redirects:dialog.title_edit') : t('redirects:dialog.title_new')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>{t('redirects:dialog.from.label')}</Label>
              <Input
                dir="ltr"
                value={edit.fromPath}
                onChange={(e) => setEdit((s) => ({ ...s, fromPath: e.target.value }))}
                placeholder="/old-page"
              />
              <p className="text-xs text-muted-foreground">{t('redirects:dialog.from.hint')}</p>
            </div>
            <div className="space-y-1">
              <Label>{t('redirects:dialog.to.label')}</Label>
              <Input
                dir="ltr"
                value={edit.toPath}
                onChange={(e) => setEdit((s) => ({ ...s, toPath: e.target.value }))}
                placeholder="/pages/new-page"
              />
              <p className="text-xs text-muted-foreground">{t('redirects:dialog.to.hint')}</p>
            </div>
            <div className="space-y-1">
              <Label>{t('redirects:dialog.type.label')}</Label>
              <select
                value={edit.statusCode}
                onChange={(e) => setEdit((s) => ({ ...s, statusCode: Number(e.target.value) }))}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value={301}>{t('redirects:dialog.type.permanent')}</option>
                <option value={302}>{t('redirects:dialog.type.temporary')}</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              {t('common:action.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 me-2 animate-spin" />{t('common:state.saving_ellipsis')}</> : t('common:action.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Redirects;
