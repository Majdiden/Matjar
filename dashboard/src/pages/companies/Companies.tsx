import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getTenantCurrency, getTenantLocale } from '../../lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Skeleton } from '../../components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../../components/ui/dialog';
import { Select } from '../../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Building2, Plus, Pencil, Trash2, Users } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { useConfirm } from '../../components/ui/use-confirm';

interface Company {
  _id: string;
  name: string;
  contacts: Array<{ user: string; role: string }>;
  locations: Array<{ name: string; address: string }>;
  paymentTerms?: {
    type: string;
    creditLimit?: number;
    currentBalance?: number;
  };
  priceAdjustment?: number;
  isActive?: boolean;
  createdAt: string;
}

export const Companies: React.FC = () => {
  const { t } = useTranslation(['companies', 'common']);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', paymentType: 'net30', creditLimit: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const confirm = useConfirm();

  const loadCompanies = useCallback(async () => {
    try {
      setLoading(true);
      const params: { search?: string } = {};
      if (search) params.search = search;
      const res = (await api.companies.getAll(params)) as {
        responseObject?: { companies?: Company[] } | Company[];
        data?: { companies?: Company[] };
      };
      const ro = res.responseObject;
      const list: Company[] = Array.isArray(ro)
        ? ro
        : ro?.companies || res.data?.companies || [];
      setCompanies(list);
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || t('companies.toast.load_failed'));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', paymentType: 'net30', creditLimit: 0 });
    setDialogOpen(true);
  };

  const openEdit = (company: Company) => {
    setEditingId(company._id);
    setForm({
      name: company.name,
      paymentType: company.paymentTerms?.type || 'net30',
      creditLimit: company.paymentTerms?.creditLimit || 0,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) { toast.error(t('companies.form.field.name.error.required')); return; }
    setSaving(true);
    try {
      const data = {
        name: form.name,
        paymentTerms: { type: form.paymentType, creditLimit: Number(form.creditLimit) || 0 },
      };
      if (editingId) {
        await api.companies.update(editingId, data);
        toast.success(t('companies.toast.updated'));
      } else {
        await api.companies.create(data);
        toast.success(t('companies.toast.created'));
      }
      setDialogOpen(false);
      loadCompanies();
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || t('companies.toast.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm({
      title: t('companies.confirm.delete_title'),
      description: t('companies.confirm.delete_description'),
      confirmText: t('common:action.delete'),
      variant: 'destructive',
    }))) return;
    try {
      await api.companies.delete(id);
      toast.success(t('companies.toast.deleted'));
      setCompanies(prev => prev.filter(c => c._id !== id));
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || t('companies.toast.delete_failed'));
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(getTenantLocale(), { style: 'currency', currency: getTenantCurrency() }).format(amount);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('companies.list.title')}</h1>
          <p className="text-muted-foreground">{t('companies.list.subtitle')}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 me-2" />
              {t('companies.action.add_company')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? t('companies.form.title_edit') : t('companies.form.title_create')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('companies.form.field.name.label')}</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('companies.form.field.name.placeholder')} />
              </div>
              <div className="space-y-2">
                <Label>{t('companies.form.field.payment_terms.label')}</Label>
                <Select
                  value={form.paymentType}
                  onChange={e => setForm(f => ({ ...f, paymentType: e.target.value }))}
                  options={[
                    { value: 'net15', label: t('companies.form.payment_type.net15') },
                    { value: 'net30', label: t('companies.form.payment_type.net30') },
                    { value: 'net60', label: t('companies.form.payment_type.net60') },
                    { value: 'net90', label: t('companies.form.payment_type.net90') },
                    { value: 'due_on_receipt', label: t('companies.form.payment_type.due_on_receipt') },
                  ]}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('companies.form.field.credit_limit.label')}</Label>
                <Input type="number" value={form.creditLimit} onChange={e => setForm(f => ({ ...f, creditLimit: Number(e.target.value) }))} placeholder={t('companies.form.field.credit_limit.placeholder')} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common:action.cancel')}</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? t('common:state.saving_ellipsis') : editingId ? t('common:action.update') : t('common:action.create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t('companies.list.all')}</CardTitle>
            <Input
              placeholder={t('companies.list.search_placeholder')}
              className="w-64"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : companies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">{t('companies.list.empty.title')}</h3>
              <p className="text-sm text-muted-foreground mb-4">{t('companies.list.empty.description')}</p>
              <Button onClick={openCreate}><Plus className="h-4 w-4 me-2" />{t('companies.action.add_company')}</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('companies.list.column.company')}</TableHead>
                  <TableHead>{t('companies.list.column.contacts')}</TableHead>
                  <TableHead>{t('companies.list.column.payment_terms')}</TableHead>
                  <TableHead>{t('companies.list.column.credit_limit')}</TableHead>
                  <TableHead>{t('companies.list.column.balance')}</TableHead>
                  <TableHead className="text-end">{t('companies.list.column.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map(company => (
                  <TableRow key={company._id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{company.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{company.contacts?.length || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {company.paymentTerms?.type?.replace('_', ' ') || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell>{company.paymentTerms?.creditLimit ? formatCurrency(company.paymentTerms.creditLimit) : '-'}</TableCell>
                    <TableCell>{company.paymentTerms?.currentBalance != null ? formatCurrency(company.paymentTerms.currentBalance) : '-'}</TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(company)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(company._id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
