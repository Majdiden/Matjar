import React, { useCallback, useEffect, useState } from 'react';
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
      toast.error(e?.message || 'Failed to load companies');
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
    if (!form.name) { toast.error('Company name is required'); return; }
    setSaving(true);
    try {
      const data = {
        name: form.name,
        paymentTerms: { type: form.paymentType, creditLimit: Number(form.creditLimit) || 0 },
      };
      if (editingId) {
        await api.companies.update(editingId, data);
        toast.success('Company updated');
      } else {
        await api.companies.create(data);
        toast.success('Company created');
      }
      setDialogOpen(false);
      loadCompanies();
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || 'Failed to save company');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm({
      title: 'Delete company?',
      description: 'This removes the B2B company account and unlinks its contacts.',
      confirmText: 'Delete',
      variant: 'destructive',
    }))) return;
    try {
      await api.companies.delete(id);
      toast.success('Company deleted');
      setCompanies(prev => prev.filter(c => c._id !== id));
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || 'Failed to delete company');
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat(getTenantLocale(), { style: 'currency', currency: getTenantCurrency() }).format(amount);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Companies</h1>
          <p className="text-muted-foreground">Manage B2B company accounts and payment terms</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Company
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Company' : 'Create Company'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Acme Corp" />
              </div>
              <div className="space-y-2">
                <Label>Payment Terms</Label>
                <Select
                  value={form.paymentType}
                  onChange={e => setForm(f => ({ ...f, paymentType: e.target.value }))}
                  options={[
                    { value: 'net15', label: 'Net 15' },
                    { value: 'net30', label: 'Net 30' },
                    { value: 'net60', label: 'Net 60' },
                    { value: 'net90', label: 'Net 90' },
                    { value: 'due_on_receipt', label: 'Due on Receipt' },
                  ]}
                />
              </div>
              <div className="space-y-2">
                <Label>Credit Limit</Label>
                <Input type="number" value={form.creditLimit} onChange={e => setForm(f => ({ ...f, creditLimit: Number(e.target.value) }))} placeholder="10000" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">All Companies</CardTitle>
            <Input
              placeholder="Search companies..."
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
              <h3 className="text-lg font-semibold">No companies</h3>
              <p className="text-sm text-muted-foreground mb-4">Add B2B company accounts with custom payment terms.</p>
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Company</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Contacts</TableHead>
                  <TableHead>Payment Terms</TableHead>
                  <TableHead>Credit Limit</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                    <TableCell className="text-right">
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
