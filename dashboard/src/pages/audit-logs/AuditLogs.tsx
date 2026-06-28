import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select } from '../../components/ui/select';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Shield, ChevronRight } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';

interface AuditLog {
  _id: string;
  actor: string | null;
  actorDisplay?: string;
  actorEmail?: string;
  action: string;
  resource: string;
  resourceId?: string;
  changes?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

interface AuditLogsListResponse {
  responseObject?: {
    logs?: AuditLog[];
    pagination?: { total: number; pages: number };
  };
  data?: {
    logs?: AuditLog[];
    pagination?: { total: number; pages: number };
  };
}

interface AuditLogsQuery {
  page: number;
  limit: number;
  action?: string;
  resource?: string;
}

const actionColor = (action: string) => {
  if (action.includes('create') || action.includes('add')) return 'default' as const;
  if (action.includes('update') || action.includes('edit')) return 'secondary' as const;
  if (action.includes('delete') || action.includes('remove')) return 'destructive' as const;
  return 'outline' as const;
};

// Fallback label for actions not present in the action_label map: turn a
// dotted/underscored machine string (e.g. "order.status_updated") into a
// human-readable phrase ("Order status updated").
const humanize = (value: string) => {
  const text = String(value).replace(/[._]+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// Map a backend action string to its i18n lookup key. The backend emits dotted
// names ("order.created"); dots would misdrill into the keySeparator, so we
// flatten them to underscores and look the key up under `audit:action_label`.
const actionLabelKey = (action: string) => `audit:action_label.${action.replace(/\./g, '_')}`;

export const AuditLogs: React.FC = () => {
  const { t } = useTranslation(['audit', 'common']);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params: AuditLogsQuery = { page, limit: 25 };
      if (actionFilter) params.action = actionFilter;
      if (resourceFilter) params.resource = resourceFilter;
      const res = (await api.auditLogs.getAll(params)) as AuditLogsListResponse;
      const logsList = res.responseObject?.logs || res.data?.logs || [];
      setLogs(logsList);
      setPagination(res.responseObject?.pagination || res.data?.pagination || { total: 0, pages: 1 });
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || t('audit.toast.load_failed'));
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, resourceFilter, t]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('audit.list.title')}</h1>
        <p className="text-muted-foreground">{t('audit.list.subtitle')}</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base">{t('audit.list.card_title')}</CardTitle>
            <div className="flex items-center gap-2">
              <div className="w-40">
                <Select
                  value={resourceFilter}
                  onChange={e => { setResourceFilter(e.target.value); setPage(1); }}
                  options={[
                    { value: '', label: t('audit.filter.all_resources') },
                    { value: 'Product', label: t('audit.filter.resource.product') },
                    { value: 'Order', label: t('audit.filter.resource.order') },
                    { value: 'Customer', label: t('audit.filter.resource.customer') },
                    { value: 'Settings', label: t('audit.filter.resource.settings') },
                    { value: 'Discount', label: t('audit.filter.resource.discount') },
                    { value: 'Theme', label: t('audit.filter.resource.theme') },
                    { value: 'Market', label: t('audit.filter.resource.market') },
                  ]}
                />
              </div>
              <div className="w-40">
                <Select
                  value={actionFilter}
                  onChange={e => { setActionFilter(e.target.value); setPage(1); }}
                  options={[
                    { value: '', label: t('audit.filter.all_actions') },
                    { value: 'create', label: t('audit.filter.action.create') },
                    { value: 'update', label: t('audit.filter.action.update') },
                    { value: 'delete', label: t('audit.filter.action.delete') },
                  ]}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Shield className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">{t('audit.list.empty_title')}</h3>
              <p className="text-sm text-muted-foreground">{t('audit.list.empty_description')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('audit.list.column.time')}</TableHead>
                  <TableHead>{t('audit.list.column.actor')}</TableHead>
                  <TableHead>{t('audit.list.column.action')}</TableHead>
                  <TableHead>{t('audit.list.column.resource')}</TableHead>
                  <TableHead>{t('audit.list.column.resource_id')}</TableHead>
                  <TableHead>{t('audit.list.column.ip')}</TableHead>
                  <TableHead className="text-end">{t('audit.list.column.details')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => (
                  <TableRow key={log._id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLog(log)}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col">
                        <span className="font-medium">{log.actorDisplay || t('audit.detail.system_actor')}</span>
                        {log.actorEmail && (
                          <span className="text-xs text-muted-foreground">{log.actorEmail}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={actionColor(log.action)}>{t(actionLabelKey(log.action), { defaultValue: humanize(log.action) })}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{t(`audit:resource_label.${String(log.resource).toLowerCase()}`, { defaultValue: log.resource })}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {log.resourceId ? log.resourceId.slice(0, 12) + '...' : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.ip || '-'}</TableCell>
                    <TableCell className="text-end">
                      <ChevronRight className="h-4 w-4 text-muted-foreground inline rtl:rotate-180" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                {t('common:action.previous')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t('audit.pagination.page_of', { page, total: pagination.pages })}
              </span>
              <Button variant="outline" size="sm" disabled={page === pagination.pages} onClick={() => setPage(p => p + 1)}>
                {t('common:action.next')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('audit.detail.title')}</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground">{t('audit.detail.field.action')}</p>
                  <Badge variant={actionColor(selectedLog.action)}>{t(actionLabelKey(selectedLog.action), { defaultValue: humanize(selectedLog.action) })}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('audit.detail.field.resource')}</p>
                  <p className="font-medium">{t(`audit:resource_label.${String(selectedLog.resource).toLowerCase()}`, { defaultValue: selectedLog.resource })}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('audit.detail.field.actor')}</p>
                  <p className="font-medium">{selectedLog.actorDisplay || t('audit.detail.system_actor')}</p>
                  {selectedLog.actorEmail && (
                    <p className="text-xs text-muted-foreground">{selectedLog.actorEmail}</p>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground">{t('audit.detail.field.time')}</p>
                  <p>{new Date(selectedLog.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('audit.detail.field.ip_address')}</p>
                  <p className="font-mono">{selectedLog.ip || t('audit.detail.na')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('audit.detail.field.resource_id')}</p>
                  <p className="font-mono text-xs break-all">{selectedLog.resourceId || t('audit.detail.na')}</p>
                </div>
              </div>
              {selectedLog.changes && Object.keys(selectedLog.changes).length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-2">{t('audit.detail.field.changes')}</p>
                  <pre className="bg-muted rounded-lg p-3 text-xs overflow-auto max-h-64">
                    {JSON.stringify(selectedLog.changes, null, 2)}
                  </pre>
                </div>
              )}
              {selectedLog.userAgent && (
                <div>
                  <p className="text-muted-foreground">{t('audit.detail.field.user_agent')}</p>
                  <p className="text-xs text-muted-foreground break-all">{selectedLog.userAgent}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
