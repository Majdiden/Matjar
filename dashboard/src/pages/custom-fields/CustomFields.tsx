import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Skeleton } from '../../components/ui/skeleton';
import { Select } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { FileCode, Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { useConfirm } from '../../components/ui/use-confirm';

// Custom field (metafield) values can be any JSON — string, number,
// boolean, date string, URL, HSL color, rich text HTML, or a nested
// object. `unknown` forces call-sites to narrow before rendering/
// comparing, matching the backend's loose storage model.
type CustomFieldValue = unknown;

interface CustomField {
  _id: string;
  resource: string;
  resourceId?: string;
  namespace: string;
  key: string;
  type: string;
  value: CustomFieldValue;
  createdAt: string;
}

// Shape of GET /custom-fields — the API routes have historically
// returned data under multiple wrappers, so tolerate all of them.
interface CustomFieldsListResponse {
  responseObject?: { customFields?: CustomField[] } | CustomField[];
  data?: { customFields?: CustomField[] };
}

interface ApiErrorLike { message?: string; error?: string }

const FIELD_TYPE_VALUES = ['string', 'number', 'boolean', 'date', 'json', 'url', 'color', 'richtext'] as const;
const RESOURCE_VALUES = ['product', 'category', 'order', 'customer', 'store', 'page'] as const;

export const CustomFields: React.FC = () => {
  const { t } = useTranslation(['settings', 'common']);
  const cf = (key: string, opts?: Record<string, unknown>) => t(`settings.custom_fields.${key}`, opts);

  const FIELD_TYPES = FIELD_TYPE_VALUES.map((v) => ({ value: v, label: cf(`type.${v}`) }));
  const RESOURCES = [
    { value: '', label: cf('resource.all') },
    ...RESOURCE_VALUES.map((v) => ({ value: v, label: cf(`resource.${v}`) })),
  ];

  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [resourceFilter, setResourceFilter] = useState('');
  const [form, setForm] = useState({ resource: 'product', resourceId: '', namespace: 'custom', key: '', type: 'string', value: '' });
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  useEffect(() => { loadFields();
    // loadFields closes over `resourceFilter`; refetching when the filter
    // changes is the whole point. The function is redeclared each render,
    // so adding it to the deps array would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceFilter]);

  const loadFields = async () => {
    try {
      setLoading(true);
      const params: { resource?: string } = {};
      if (resourceFilter) params.resource = resourceFilter;
      const res = (await api.customFields.getAll(params)) as CustomFieldsListResponse;
      // Narrow the variants: the three historical response shapes.
      const responseObject = res.responseObject;
      let list: CustomField[] = [];
      if (Array.isArray(responseObject)) list = responseObject;
      else if (responseObject?.customFields) list = responseObject.customFields;
      else if (res.data?.customFields) list = res.data.customFields;
      setFields(list);
    } catch (err: unknown) {
      const e = err as ApiErrorLike;
      toast.error(e?.message || cf('toast.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingField(null);
    setForm({ resource: 'product', resourceId: '', namespace: 'custom', key: '', type: 'string', value: '' });
    setDialogOpen(true);
  };

  const openEdit = (field: CustomField) => {
    setEditingField(field);
    setForm({
      resource: field.resource,
      resourceId: field.resourceId || '',
      namespace: field.namespace,
      key: field.key,
      type: field.type,
      value: typeof field.value === 'object' ? JSON.stringify(field.value) : String(field.value),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.key || !form.resource) { toast.error(cf('validation.resource_key_required')); return; }
    setSaving(true);
    try {
      const data = { ...form, value: form.type === 'json' ? JSON.parse(form.value) : form.type === 'number' ? Number(form.value) : form.type === 'boolean' ? form.value === 'true' : form.value };
      if (editingField) {
        await api.customFields.update(editingField._id, data);
        toast.success(cf('toast.updated'));
      } else {
        await api.customFields.create(data);
        toast.success(cf('toast.created'));
      }
      setDialogOpen(false);
      loadFields();
    } catch (err: unknown) {
      const e = err as ApiErrorLike;
      toast.error(e?.message || cf('toast.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm({
      title: cf('confirm.delete_title'),
      description: cf('confirm.delete_description'),
      confirmText: cf('confirm.delete_confirm'),
      variant: 'destructive',
    }))) return;
    try {
      await api.customFields.delete(id);
      toast.success(cf('toast.deleted'));
      setFields(prev => prev.filter(f => f._id !== id));
    } catch (err: unknown) {
      const e = err as ApiErrorLike;
      toast.error(e?.message || cf('toast.delete_failed'));
    }
  };

  const truncateValue = (value: CustomFieldValue) => {
    const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return str.length > 50 ? str.slice(0, 50) + '...' : str;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{cf('title')}</h1>
          <p className="text-muted-foreground">{cf('description')}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 me-2" />
              {cf('add_button')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingField ? cf('dialog.title_edit') : cf('dialog.title_create')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{cf('field.resource')}</Label>
                  <Select value={form.resource} onChange={e => setForm(f => ({ ...f, resource: e.target.value }))}
                    options={RESOURCES.filter(r => r.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{cf('field.type')}</Label>
                  <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    options={FIELD_TYPES} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{cf('field.namespace')}</Label>
                  <Input value={form.namespace} onChange={e => setForm(f => ({ ...f, namespace: e.target.value }))} placeholder="custom" />
                </div>
                <div className="space-y-2">
                  <Label>{cf('field.key')}</Label>
                  <Input value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value }))} placeholder="my_field" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{cf('field.resource_id')}</Label>
                <Input value={form.resourceId} onChange={e => setForm(f => ({ ...f, resourceId: e.target.value }))} placeholder={cf('field.resource_id_placeholder')} />
              </div>
              <div className="space-y-2">
                <Label>{cf('field.value')}</Label>
                {form.type === 'json' || form.type === 'richtext' ? (
                  <Textarea value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} rows={4} />
                ) : form.type === 'color' ? (
                  <div className="flex gap-2">
                    <Input type="color" value={form.value || '#000000'} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} className="w-16 h-10 p-1" />
                    <Input value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="#000000" />
                  </div>
                ) : form.type === 'boolean' ? (
                  <Select value={form.value || 'false'} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} options={[{ value: 'true', label: cf('boolean.true') }, { value: 'false', label: cf('boolean.false') }]} />
                ) : (
                  <Input type={form.type === 'number' ? 'number' : form.type === 'date' ? 'date' : 'text'}
                    value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common:action.cancel')}</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? cf('saving') : editingField ? t('common:action.update') : t('common:action.create')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{cf('table_title')}</CardTitle>
            <div className="w-48">
              <Select
                value={resourceFilter}
                onChange={e => setResourceFilter(e.target.value)}
                options={RESOURCES}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileCode className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">{cf('empty.title')}</h3>
              <p className="text-sm text-muted-foreground mb-4">{cf('empty.description')}</p>
              <Button onClick={openCreate}><Plus className="h-4 w-4 me-2" />{cf('add_button')}</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{cf('column.resource')}</TableHead>
                  <TableHead>{cf('column.namespace_key')}</TableHead>
                  <TableHead>{cf('column.type')}</TableHead>
                  <TableHead>{cf('column.value')}</TableHead>
                  <TableHead className="text-end">{cf('column.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map(field => (
                  <TableRow key={field._id}>
                    <TableCell>
                      <Badge variant="outline">{field.resource}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">{field.namespace}.{field.key}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{field.type}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {truncateValue(field.value)}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(field)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(field._id)}>
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
