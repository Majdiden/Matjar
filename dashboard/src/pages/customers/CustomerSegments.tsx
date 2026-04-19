import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getTenantCurrency, getTenantLocale } from '../../lib/format';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { Users, Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { useConfirm } from '../../components/ui/use-confirm';

interface SegmentFilters {
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

interface Segment {
  _id: string;
  name: string;
  description?: string;
  filters: SegmentFilters;
  createdAt: string;
  updatedAt: string;
}

const formatMoney = (n: number) =>
  new Intl.NumberFormat(getTenantLocale(), { style: 'currency', currency: getTenantCurrency() }).format(n || 0);

const errMsg = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  if (typeof err === 'string') return err;
  return fallback;
};

const CustomerSegments: React.FC = () => {
  const { t } = useTranslation(['customers', 'common']);
  const navigate = useNavigate();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const confirm = useConfirm();

  const loadSegments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.customerSegments.getAll() as { data?: Segment[]; responseObject?: Segment[] };
      const data: Segment[] = res.data || res.responseObject || [];
      setSegments(data);
      data.forEach(async (s) => {
        try {
          const p = await api.customerSegments.preview(s._id) as { data?: { count?: number }; responseObject?: { count?: number } };
          setCounts((prev) => ({ ...prev, [s._id]: p.data?.count ?? p.responseObject?.count ?? 0 }));
        } catch {
          // non-fatal
        }
      });
    } catch (err) {
      toast.error(errMsg(err, t('segment.toast.load_failed')));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSegments(); }, [loadSegments]);

  const remove = async (seg: Segment) => {
    if (!(await confirm({
      title: t('segment.confirm.delete_title', { name: seg.name }),
      description: t('segment.confirm.delete_description'),
      confirmText: t('segment.confirm.delete_confirm'),
      variant: 'destructive',
    }))) return;
    try {
      await api.customerSegments.delete(seg._id);
      toast.success(t('segment.toast.deleted'));
      await loadSegments();
    } catch (err) {
      toast.error(errMsg(err, t('segment.toast.delete_failed')));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6" /> {t('segment.list.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('segment.list.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadSegments} disabled={loading}>
            <RefreshCw className={`h-4 w-4 me-2 ${loading ? 'animate-spin' : ''}`} />
            {t('common:action.refresh')}
          </Button>
          <Button size="sm" onClick={() => navigate('/dashboard/customers/segments/new')}>
            <Plus className="h-4 w-4 me-2" /> {t('segment.list.new_segment')}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : segments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="font-semibold mb-1">{t('segment.list.empty.title')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('segment.list.empty.description')}
            </p>
            <Button onClick={() => navigate('/dashboard/customers/segments/new')}>
              <Plus className="h-4 w-4 me-2" /> {t('segment.list.new_segment')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {segments.map((seg) => (
            <Card key={seg._id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate">{seg.name}</CardTitle>
                    {seg.description && (
                      <CardDescription className="line-clamp-2 mt-1">{seg.description}</CardDescription>
                    )}
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {counts[seg._id] != null ? t('segment.list.customer_count', { count: counts[seg._id] }) : '…'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between gap-3">
                <div className="text-xs text-muted-foreground space-y-1">
                  {seg.filters?.totalSpentMin != null && (
                    <div>{t('segment.list.filter.spent_gte', { value: formatMoney(seg.filters.totalSpentMin) })}</div>
                  )}
                  {seg.filters?.totalSpentMax != null && (
                    <div>{t('segment.list.filter.spent_lte', { value: formatMoney(seg.filters.totalSpentMax) })}</div>
                  )}
                  {seg.filters?.orderCountMin != null && (
                    <div>{t('segment.list.filter.orders_gte', { value: seg.filters.orderCountMin })}</div>
                  )}
                  {Array.isArray(seg.filters?.tags) && seg.filters.tags.length > 0 && (
                    <div>{t('segment.list.filter.tags', { value: seg.filters.tags.join(', ') })}</div>
                  )}
                  {seg.filters?.acceptsMarketing === true && <div>{t('segment.list.filter.accepts_marketing')}</div>}
                  {seg.filters?.emailContains && <div>{t('segment.list.filter.email_contains', { value: seg.filters.emailContains })}</div>}
                </div>
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/dashboard/customers/segments/${seg._id}/edit`)}
                  >
                    <Pencil className="h-4 w-4 me-1" /> {t('common:action.edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => remove(seg)}
                  >
                    <Trash2 className="h-4 w-4 me-1" /> {t('common:action.delete')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerSegments;
