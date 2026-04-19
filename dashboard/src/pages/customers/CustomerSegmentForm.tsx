import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getTenantCurrency, getTenantLocale } from '../../lib/format';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { ArrowLeft, Eye, Loader2, Save } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';

interface SegmentFilters {
  totalSpentMin?: number | '';
  totalSpentMax?: number | '';
  orderCountMin?: number | '';
  orderCountMax?: number | '';
  lastOrderAfter?: string;
  lastOrderBefore?: string;
  tags?: string;
  emailContains?: string;
  acceptsMarketing?: 'any' | 'true' | 'false';
}

interface PreviewUser {
  _id: string;
  name: string;
  email: string;
  totalSpent: number;
  orderCount: number;
  lastOrderAt?: string;
}

// Shape of the payload actually sent to
// POST /customer-segments/preview and stored on a saved segment. All
// fields are optional — a preview with no filters matches every
// customer.
interface SegmentFiltersPayload {
  totalSpentMin?: number;
  totalSpentMax?: number;
  orderCountMin?: number;
  orderCountMax?: number;
  lastOrderAfter?: string;
  lastOrderBefore?: string;
  tags?: string[];
  emailContains?: string;
  acceptsMarketing?: boolean;
}

interface RawSegment {
  _id: string;
  name: string;
  description?: string;
  filters?: Partial<Record<keyof SegmentFiltersPayload, unknown>>;
}

const errMsg = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  if (typeof err === 'string') return err;
  return fallback;
};

const emptyForm = (): { name: string; description: string; filters: SegmentFilters } => ({
  name: '',
  description: '',
  filters: {
    totalSpentMin: '',
    totalSpentMax: '',
    orderCountMin: '',
    orderCountMax: '',
    lastOrderAfter: '',
    lastOrderBefore: '',
    tags: '',
    emailContains: '',
    acceptsMarketing: 'any',
  },
});

const buildFiltersPayload = (f: SegmentFilters): SegmentFiltersPayload => {
  const out: SegmentFiltersPayload = {};
  if (f.totalSpentMin !== '' && f.totalSpentMin != null) out.totalSpentMin = Number(f.totalSpentMin);
  if (f.totalSpentMax !== '' && f.totalSpentMax != null) out.totalSpentMax = Number(f.totalSpentMax);
  if (f.orderCountMin !== '' && f.orderCountMin != null) out.orderCountMin = Number(f.orderCountMin);
  if (f.orderCountMax !== '' && f.orderCountMax != null) out.orderCountMax = Number(f.orderCountMax);
  if (f.lastOrderAfter) out.lastOrderAfter = f.lastOrderAfter;
  if (f.lastOrderBefore) out.lastOrderBefore = f.lastOrderBefore;
  if (f.tags) out.tags = f.tags.split(',').map((t) => t.trim()).filter(Boolean);
  if (f.emailContains) out.emailContains = f.emailContains;
  if (f.acceptsMarketing === 'true') out.acceptsMarketing = true;
  if (f.acceptsMarketing === 'false') out.acceptsMarketing = false;
  return out;
};

const filtersToForm = (f: Partial<Record<keyof SegmentFiltersPayload, unknown>> = {}): SegmentFilters => ({
  totalSpentMin: (f.totalSpentMin as number | undefined) ?? '',
  totalSpentMax: (f.totalSpentMax as number | undefined) ?? '',
  orderCountMin: (f.orderCountMin as number | undefined) ?? '',
  orderCountMax: (f.orderCountMax as number | undefined) ?? '',
  lastOrderAfter: f.lastOrderAfter ? String(f.lastOrderAfter).slice(0, 10) : '',
  lastOrderBefore: f.lastOrderBefore ? String(f.lastOrderBefore).slice(0, 10) : '',
  tags: Array.isArray(f.tags) ? (f.tags as string[]).join(', ') : '',
  emailContains: (f.emailContains as string | undefined) ?? '',
  acceptsMarketing: f.acceptsMarketing === true ? 'true' : f.acceptsMarketing === false ? 'false' : 'any',
});

const formatMoney = (n: number) =>
  new Intl.NumberFormat(getTenantLocale(), { style: 'currency', currency: getTenantCurrency() }).format(n || 0);

const CustomerSegmentForm: React.FC = () => {
  const { t } = useTranslation(['customers', 'common']);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<{ count: number; users: PreviewUser[] } | null>(null);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        setLoading(true);
        const res = await api.customerSegments.getAll() as {
          data?: RawSegment[];
          responseObject?: RawSegment[];
        };
        const list: RawSegment[] = res.data || res.responseObject || [];
        const seg = list.find((s) => s._id === id);
        if (!seg) {
          toast.error(t('segment.toast.not_found'));
          navigate('/dashboard/customers/segments');
          return;
        }
        setForm({
          name: seg.name,
          description: seg.description || '',
          filters: filtersToForm(seg.filters),
        });
      } catch (err) {
        toast.error(errMsg(err, t('segment.toast.segment_load_failed')));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit, navigate]);

  const setFilter = <K extends keyof SegmentFilters>(k: K, v: SegmentFilters[K]) =>
    setForm((p) => ({ ...p, filters: { ...p.filters, [k]: v } }));

  const runPreview = async () => {
    try {
      setPreviewLoading(true);
      const filters = buildFiltersPayload(form.filters);
      const res = await api.customerSegments.previewFilters(filters) as {
        data?: { count?: number; users?: PreviewUser[] };
        responseObject?: { count?: number; users?: PreviewUser[] };
      };
      const payload = res.data || res.responseObject || {};
      setPreview({ count: payload.count || 0, users: payload.users || [] });
    } catch (err) {
      toast.error(errMsg(err, t('segment.toast.preview_failed')));
    } finally {
      setPreviewLoading(false);
    }
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error(t('segment.form.field.name.error.required'));
      return;
    }
    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        description: form.description,
        filters: buildFiltersPayload(form.filters),
      };
      if (isEdit && id) {
        await api.customerSegments.update(id, payload);
        toast.success(t('segment.toast.updated'));
      } else {
        await api.customerSegments.create(payload);
        toast.success(t('segment.toast.created'));
      }
      navigate('/dashboard/customers/segments');
    } catch (err) {
      toast.error(errMsg(err, t('segment.toast.save_failed')));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/customers/segments')}>
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isEdit ? t('segment.form.title_edit') : t('segment.form.title_create')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('segment.form.subtitle')}
            </p>
          </div>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Save className="h-4 w-4 me-2" />}
          {isEdit ? t('segment.form.action.save_changes') : t('segment.form.action.create_segment')}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('segment.form.section.details')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="seg-name">{t('segment.form.field.name.label')} *</Label>
                <Input
                  id="seg-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t('segment.form.field.name.placeholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seg-desc">{t('segment.form.field.description.label')}</Label>
                <Textarea
                  id="seg-desc"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  placeholder={t('segment.form.field.description.placeholder')}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('segment.form.section.spend')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t('segment.form.field.total_spent_min.label')}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.filters.totalSpentMin}
                    onChange={(e) => setFilter('totalSpentMin', e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label className="text-xs">{t('segment.form.field.total_spent_max.label')}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.filters.totalSpentMax}
                    onChange={(e) => setFilter('totalSpentMax', e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('segment.form.section.orders')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t('segment.form.field.order_count_min.label')}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.filters.orderCountMin}
                    onChange={(e) => setFilter('orderCountMin', e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label className="text-xs">{t('segment.form.field.order_count_max.label')}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.filters.orderCountMax}
                    onChange={(e) => setFilter('orderCountMax', e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label className="text-xs">{t('segment.form.field.last_order_after.label')}</Label>
                  <Input
                    type="date"
                    value={form.filters.lastOrderAfter}
                    onChange={(e) => setFilter('lastOrderAfter', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">{t('segment.form.field.last_order_before.label')}</Label>
                  <Input
                    type="date"
                    value={form.filters.lastOrderBefore}
                    onChange={(e) => setFilter('lastOrderBefore', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('segment.form.section.profile')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{t('segment.form.field.tags.label')}</Label>
                  <Input
                    value={form.filters.tags}
                    onChange={(e) => setFilter('tags', e.target.value)}
                    placeholder={t('segment.form.field.tags.placeholder')}
                  />
                </div>
                <div>
                  <Label className="text-xs">{t('segment.form.field.email_contains.label')}</Label>
                  <Input
                    value={form.filters.emailContains}
                    onChange={(e) => setFilter('emailContains', e.target.value)}
                    placeholder={t('segment.form.field.email_contains.placeholder')}
                  />
                </div>
                <div>
                  <Label className="text-xs">{t('segment.form.field.marketing_consent.label')}</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={form.filters.acceptsMarketing}
                    onChange={(e) => setFilter('acceptsMarketing', e.target.value as 'any' | 'true' | 'false')}
                  >
                    <option value="any">{t('segment.form.field.marketing_consent.any')}</option>
                    <option value="true">{t('segment.form.field.marketing_consent.subscribed')}</option>
                    <option value="false">{t('segment.form.field.marketing_consent.not_subscribed')}</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4" /> {t('segment.form.section.preview')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" size="sm" onClick={runPreview} disabled={previewLoading} className="w-full">
                {previewLoading ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Eye className="h-4 w-4 me-2" />}
                {t('segment.form.preview.run')}
              </Button>
              {preview ? (
                <div className="space-y-2">
                  <p className="text-sm">
                    <strong>{preview.count}</strong> {t('segment.form.preview.match')}
                  </p>
                  {preview.users.length > 0 && (
                    <div className="max-h-96 overflow-y-auto rounded border bg-background">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            <th className="text-start p-2">{t('segment.form.preview.column.name')}</th>
                            <th className="text-start p-2">{t('segment.form.preview.column.email')}</th>
                            <th className="text-end p-2">{t('segment.form.preview.column.orders')}</th>
                            <th className="text-end p-2">{t('segment.form.preview.column.spent')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.users.slice(0, 50).map((u) => (
                            <tr key={u._id} className="border-t">
                              <td className="p-2 truncate max-w-[120px]">{u.name || '—'}</td>
                              <td className="p-2 truncate max-w-[180px]">{u.email}</td>
                              <td className="p-2 text-end">{u.orderCount}</td>
                              <td className="p-2 text-end">{formatMoney(u.totalSpent)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t('segment.form.preview.hint')}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CustomerSegmentForm;
