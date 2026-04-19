import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { Gift, Plus, Copy, AlertCircle, Loader2, Search, X, Ban, CheckCircle2, Download, Inbox, Clock, XCircle } from 'lucide-react';
import { FilterPills } from '../../components/ui/filter-pills';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { toCSV, downloadCSV } from '../../lib/utils';
import { useViewMode, ViewToggle } from '../../components/ui/view-toggle';

interface GiftCard {
  _id: string;
  codeLast4: string;
  initialAmount: number;
  balance: number;
  currency: string;
  status: 'active' | 'redeemed' | 'expired' | 'disabled';
  issuedTo?: { name?: string; email?: string };
  customerId?: string;
  expiresAt?: string;
  createdAt: string;
  coverShipping?: boolean;
  coverTax?: boolean;
}

interface IssueForm {
  initialAmount: string;
  currency: string;
  recipientName: string;
  recipientEmail: string;
  message: string;
  note: string;
  expiresAt: string;
  customerId: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  redeemed: 'bg-gray-100 text-gray-600',
  expired: 'bg-yellow-100 text-yellow-800',
  disabled: 'bg-red-100 text-red-800',
};

const EMPTY_FORM: IssueForm = {
  initialAmount: '',
  currency: 'SDG',
  recipientName: '',
  recipientEmail: '',
  message: '',
  note: '',
  expiresAt: '',
  customerId: '',
};

interface CustomerOption {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface ApiEnvelope<T> {
  data?: T;
  responseObject?: { data?: T };
}

interface CustomerListResponse {
  customers?: CustomerOption[];
}

interface IssuedGiftCardResponse {
  code?: string;
}

interface GiftCardListResponse {
  items?: GiftCard[];
  total?: number;
  pages?: number;
}

interface DomainInfoShape {
  settings?: { giftCards?: { enabled?: boolean } };
}

interface ApiErrorLike {
  message?: string;
  response?: { data?: { message?: string } };
}

const unwrap = <T,>(res: unknown): T | undefined => {
  const envelope = res as ApiEnvelope<T> | undefined;
  return envelope?.data ?? envelope?.responseObject?.data;
};

const unwrapCustomer = (res: unknown): CustomerOption | undefined => {
  const envelope = res as ApiEnvelope<CustomerOption> | CustomerOption | undefined;
  if (envelope && typeof envelope === 'object') {
    if ('_id' in envelope && (envelope as CustomerOption)._id) return envelope as CustomerOption;
    const inner = (envelope as ApiEnvelope<CustomerOption>).data
      ?? (envelope as ApiEnvelope<CustomerOption>).responseObject?.data;
    if (inner && inner._id) return inner;
  }
  return undefined;
};

const unwrapCustomerList = (res: unknown): CustomerOption[] => {
  const envelope = res as
    | (ApiEnvelope<CustomerListResponse> & CustomerListResponse)
    | undefined;
  const list =
    envelope?.data?.customers
    ?? envelope?.responseObject?.data?.customers
    ?? envelope?.customers
    ?? [];
  return Array.isArray(list) ? list : [];
};

const CustomerSelect: React.FC<{ value: string; onChange: (id: string) => void }> = ({ value, onChange }) => {
  const { t } = useTranslation(['marketing']);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<CustomerOption | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!value) { setSelected(null); return; }
    if (selected?._id === value) return;
    (async () => {
      try {
        const res = await api.customers.getById(value);
        const c = unwrapCustomer(res);
        if (c?._id) setSelected(c);
      } catch { /* ignore */ }
    })();
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.customers.getAll({ limit: 10, search: q.trim() || undefined });
        setResults(unwrapCustomerList(res));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const label = selected
    ? `${[selected.firstName, selected.lastName].filter(Boolean).join(' ').trim() || selected.email || selected._id}${selected.email ? ` · ${selected.email}` : ''}`
    : '';

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="ps-8 pe-8"
          placeholder={t('marketing.gift_card.issue_dialog.field.customer.search_placeholder')}
          value={open ? query : label}
          onFocus={() => { setOpen(true); setQuery(''); }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        />
        {selected && (
          <button
            type="button"
            aria-label="Clear customer"
            onClick={() => { onChange(''); setSelected(null); setQuery(''); }}
            className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-60 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> {t('marketing.gift_card.issue_dialog.field.customer.searching')}
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">{t('marketing.gift_card.issue_dialog.field.customer.no_customers')}</div>
          ) : (
            results.map((c) => {
              const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
              return (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => { onChange(c._id); setSelected(c); setOpen(false); }}
                  className="block w-full text-start px-3 py-2 text-sm hover:bg-accent"
                >
                  <div className="font-medium">{name || t('marketing.gift_card.issue_dialog.field.customer.no_name')}</div>
                  {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

const GiftCards: React.FC = () => {
  const { t } = useTranslation(['marketing', 'common']);
  const navigate = useNavigate();
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState('');
  const [searchLast4, setSearchLast4] = useState('');

  const [issueOpen, setIssueOpen] = useState(false);
  const [form, setForm] = useState<IssueForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [successOpen, setSuccessOpen] = useState(false);
  const [issuedCode, setIssuedCode] = useState('');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useViewMode('giftCards.viewMode', 'table');

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selected.size === cards.length) setSelected(new Set());
    else setSelected(new Set(cards.map((c) => c._id)));
  };

  const handleBulkToggle = async (enable: boolean) => {
    if (selected.size === 0) return;
    const ids = [...selected];
    const action = enable ? 'enable' : 'disable';
    const results = await Promise.allSettled(ids.map((id) => api.post(`/gift-cards/${id}/${action}`)));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    if (ok) toast.success(enable
      ? t('marketing.gift_card.toast.bulk_toggled_enable', { count: ok })
      : t('marketing.gift_card.toast.bulk_toggled_disable', { count: ok }));
    if (failed) toast.error(t('marketing.gift_card.toast.bulk_failed', { count: failed }));
    setSelected(new Set());
    loadCards();
  };

  const handleBulkExport = () => {
    const all = cards.filter((c) => selected.has(c._id));
    if (all.length === 0) {
      toast.message(t('marketing.gift_card.toast.no_export'));
      return;
    }
    const csv = toCSV<GiftCard>(all, [
      { key: 'codeLast4', label: 'Code (last 4)' },
      { key: 'initialAmount', label: 'Initial', get: (c) => (c.initialAmount ?? 0).toFixed(2) },
      { key: 'balance', label: 'Balance', get: (c) => (c.balance ?? 0).toFixed(2) },
      { key: 'currency', label: 'Currency' },
      { key: 'status', label: 'Status' },
      { key: 'recipient', label: 'Recipient', get: (c) => c.issuedTo?.email || c.issuedTo?.name || '' },
      { key: 'expiresAt', label: 'Expires', get: (c) => c.expiresAt ? new Date(c.expiresAt).toISOString().slice(0, 10) : '' },
      { key: 'createdAt', label: 'Created', get: (c) => c.createdAt ? new Date(c.createdAt).toISOString().slice(0, 10) : '' },
    ]);
    downloadCSV(csv, 'gift-cards-selected');
    toast.success(t('marketing.gift_card.toast.exported', { count: all.length }));
  };

  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [togglingFeature, setTogglingFeature] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.domains.getInfo();
        const data = unwrap<DomainInfoShape>(res);
        setFeatureEnabled(data?.settings?.giftCards?.enabled !== false);
      } catch { /* keep default */ }
    })();
  }, []);

  const handleToggleFeature = async (v: boolean) => {
    setTogglingFeature(true);
    try {
      await api.settings.update({ giftCards: { enabled: v } });
      setFeatureEnabled(v);
      toast.success(v ? t('marketing.gift_card.toast.enabled') : t('marketing.gift_card.toast.disabled'));
    } catch (err) {
      const e = err as ApiErrorLike;
      toast.error(e?.message || t('marketing.gift_card.toast.feature_update_failed'));
    } finally {
      setTogglingFeature(false);
    }
  };

  const loadCards = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (statusFilter) params.status = statusFilter;
      if (searchLast4) params.search = searchLast4;
      const qs = new URLSearchParams(params).toString();
      const res = await api.get(`/gift-cards?${qs}`);
      const data = unwrap<GiftCardListResponse>(res) ?? {};
      setCards(data.items ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, searchLast4]);

  useEffect(() => { loadCards(); }, [loadCards]);

  const handleIssue = async () => {
    if (!form.initialAmount || isNaN(Number(form.initialAmount))) {
      toast.error(t('marketing.gift_card.toast.amount_invalid'));
      return;
    }
    try {
      setSaving(true);
      const payload: Record<string, unknown> = {
        initialAmount: Number(form.initialAmount),
        currency: form.currency,
        message: form.message,
        note: form.note,
      };
      if (form.recipientName || form.recipientEmail) {
        payload.issuedTo = { name: form.recipientName, email: form.recipientEmail };
      }
      if (form.expiresAt) payload.expiresAt = new Date(form.expiresAt).toISOString();
      if (form.customerId) payload.customerId = form.customerId;

      const res = await api.post('/gift-cards', payload);
      const card =
        unwrap<IssuedGiftCardResponse>(res)
        ?? (res as { responseObject?: IssuedGiftCardResponse } | undefined)?.responseObject;
      setIssuedCode(card?.code ?? '');
      setIssueOpen(false);
      setSuccessOpen(true);
      setForm(EMPTY_FORM);
      loadCards();
    } catch (err) {
      const e = err as ApiErrorLike;
      toast.error(e?.response?.data?.message ?? t('marketing.gift_card.toast.issue_failed'));
    } finally {
      setSaving(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(issuedCode);
    toast.success(t('marketing.gift_card.toast.code_copied'));
  };

  const formatMoney = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gift className="w-6 h-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">{t('marketing.gift_card.list.title')}</h1>
          {!loading && (
            <span className="text-sm text-muted-foreground ms-1">({total})</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border px-3 h-9 text-sm">
            <span className="text-muted-foreground">{t('marketing.gift_card.list.feature_toggle_label')}</span>
            <Switch
              checked={featureEnabled}
              onCheckedChange={handleToggleFeature}
              disabled={togglingFeature}
            />
            <span className="font-medium">{featureEnabled ? t('marketing.gift_card.list.feature_on') : t('marketing.gift_card.list.feature_off')}</span>
          </div>
          <Button onClick={() => navigate('/dashboard/gift-cards/new')} disabled={!featureEnabled}>
            <Plus className="w-4 h-4 me-2" />
            {t('marketing.gift_card.list.issue_button')}
          </Button>
        </div>
      </div>

      <FilterPills
        items={[
          { id: '', label: t('marketing.gift_card.list.filter.all'), icon: Inbox },
          { id: 'active', label: t('marketing.gift_card.list.filter.active'), icon: CheckCircle2 },
          { id: 'redeemed', label: t('marketing.gift_card.list.filter.redeemed'), icon: Gift },
          { id: 'expired', label: t('marketing.gift_card.list.filter.expired'), icon: Clock },
          { id: 'disabled', label: t('marketing.gift_card.list.filter.disabled'), icon: XCircle },
        ]}
        value={statusFilter}
        onChange={(v) => { setStatusFilter(v); setPage(1); }}
      />

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="ps-9"
            placeholder={t('marketing.gift_card.list.search_placeholder')}
            maxLength={4}
            value={searchLast4}
            onChange={e => { setSearchLast4(e.target.value.replace(/\D/g, '')); setPage(1); }}
          />
        </div>
        <div className="ml-auto">
          <ViewToggle mode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-primary/5">
          <p className="text-sm font-medium">{t('marketing.gift_card.list.selected_count', { count: selected.size })}</p>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
              <X className="h-3.5 w-3.5 me-1.5" />{t('common:action.cancel')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkToggle(false)}>
              <Ban className="h-3.5 w-3.5 me-1.5" />{t('marketing.gift_card.list.bulk.disable')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkToggle(true)}>
              <CheckCircle2 className="h-3.5 w-3.5 me-1.5" />{t('marketing.gift_card.list.bulk.enable')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleBulkExport}>
              <Download className="h-3.5 w-3.5 me-1.5" />{t('marketing.gift_card.list.bulk.export_csv')}
            </Button>
          </div>
        </div>
      )}

      {viewMode === 'table' ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <input
                      type="checkbox"
                      checked={selected.size === cards.length && cards.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </TableHead>
                  <TableHead>{t('marketing.gift_card.list.column.code')}</TableHead>
                  <TableHead>{t('marketing.gift_card.list.column.recipient')}</TableHead>
                  <TableHead>{t('marketing.gift_card.list.column.initial')}</TableHead>
                  <TableHead>{t('marketing.gift_card.list.column.balance')}</TableHead>
                  <TableHead>{t('marketing.gift_card.list.column.status')}</TableHead>
                  <TableHead>{t('marketing.gift_card.list.column.expires')}</TableHead>
                  <TableHead>{t('marketing.gift_card.list.column.created')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : cards.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      {t('marketing.gift_card.list.empty_title')}
                    </TableCell>
                  </TableRow>
                ) : (
                  cards.map(card => (
                    <TableRow
                      key={card._id}
                      className={`cursor-pointer hover:bg-muted/50 ${selected.has(card._id) ? 'bg-primary/5' : ''}`}
                      onClick={() => navigate(`/dashboard/gift-cards/${card._id}`)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(card._id)}
                          onChange={() => toggleSelect(card._id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </TableCell>
                      <TableCell className="font-mono font-medium">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>••••-••••-••••-{card.codeLast4 ?? '????'}</span>
                          {card.coverShipping && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-sans font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              {t('marketing.gift_card.list.tag.covers_shipping')}
                            </span>
                          )}
                          {card.coverTax && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-sans font-medium bg-purple-50 text-purple-700 border border-purple-200">
                              {t('marketing.gift_card.list.tag.covers_tax')}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {card.issuedTo?.email ?? card.issuedTo?.name ?? (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>{formatMoney(card.initialAmount, card.currency)}</TableCell>
                      <TableCell>{formatMoney(card.balance, card.currency)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[card.status] ?? ''}`}>
                          {t(`common.status.${card.status}`, { ns: 'common', defaultValue: card.status })}
                        </span>
                      </TableCell>
                      <TableCell>{formatDate(card.expiresAt)}</TableCell>
                      <TableCell>{formatDate(card.createdAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      ) : cards.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Gift className="h-10 w-10 mb-3" />
            <p>{t('marketing.gift_card.list.empty_title')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => {
            const isSel = selected.has(card._id);
            return (
              <Card
                key={card._id}
                className={`cursor-pointer hover:shadow-md transition-shadow group ${isSel ? 'border-primary/50 bg-primary/5' : ''}`}
                onClick={() => navigate(`/dashboard/gift-cards/${card._id}`)}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <input
                      type="checkbox"
                      checked={isSel}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSelect(card._id)}
                      className="h-4 w-4 rounded border-gray-300 flex-shrink-0 mt-1"
                    />
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[card.status] ?? ''}`}>
                      {t(`common.status.${card.status}`, { ns: 'common', defaultValue: card.status })}
                    </span>
                  </div>
                  <div>
                    <p className="font-mono text-sm font-semibold tracking-wider">
                      ••••-••••-••••-{card.codeLast4 ?? '????'}
                    </p>
                    {card.issuedTo?.email || card.issuedTo?.name ? (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {card.issuedTo?.email ?? card.issuedTo?.name}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('marketing.gift_card.list.card_balance_label')}</p>
                      <p className="text-xl font-bold tabular-nums">{formatMoney(card.balance, card.currency)}</p>
                    </div>
                    <div className="text-end">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('marketing.gift_card.list.card_initial_label')}</p>
                      <p className="text-sm text-muted-foreground tabular-nums">{formatMoney(card.initialAmount, card.currency)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {card.coverShipping && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        {t('marketing.gift_card.list.tag.covers_shipping')}
                      </span>
                    )}
                    {card.coverTax && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                        {t('marketing.gift_card.list.tag.covers_tax')}
                      </span>
                    )}
                  </div>
                  <div className="pt-2 border-t text-xs text-muted-foreground flex items-center justify-between">
                    <span>{t('marketing.gift_card.list.card_expires', { date: formatDate(card.expiresAt) })}</span>
                    <span>{t('marketing.gift_card.list.card_created', { date: formatDate(card.createdAt) })}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            {t('common:action.previous')}
          </Button>
          <span className="text-sm text-muted-foreground">{t('common:pagination.page_of', { n: page, total: pages })}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
            {t('common:action.next')}
          </Button>
        </div>
      )}

      {/* Issue Dialog */}
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('marketing.gift_card.issue_dialog.title')}</DialogTitle>
            <DialogDescription>
              {t('marketing.gift_card.issue_dialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t('marketing.gift_card.issue_dialog.field.amount.label')}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.initialAmount}
                  onChange={e => setForm(f => ({ ...f, initialAmount: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('marketing.gift_card.issue_dialog.field.currency.label')}</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['SDG', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'EGP'].map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t('marketing.gift_card.issue_dialog.field.recipient_name.label')}</Label>
              <Input
                placeholder={t('marketing.gift_card.issue_dialog.field.recipient_name.placeholder')}
                value={form.recipientName}
                onChange={e => setForm(f => ({ ...f, recipientName: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>{t('marketing.gift_card.issue_dialog.field.recipient_email.label')}</Label>
              <Input
                type="email"
                placeholder={t('marketing.gift_card.issue_dialog.field.recipient_email.placeholder')}
                value={form.recipientEmail}
                onChange={e => setForm(f => ({ ...f, recipientEmail: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>{t('marketing.gift_card.issue_dialog.field.message.label')}</Label>
              <Input
                placeholder={t('marketing.gift_card.issue_dialog.field.message.placeholder')}
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>{t('marketing.gift_card.issue_dialog.field.note.label')}</Label>
              <Input
                placeholder={t('marketing.gift_card.issue_dialog.field.note.placeholder')}
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>{t('marketing.gift_card.issue_dialog.field.expires_at.label')}</Label>
              <Input
                type="date"
                value={form.expiresAt}
                onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>{t('marketing.gift_card.issue_dialog.field.customer.label')}</Label>
              <CustomerSelect
                value={form.customerId}
                onChange={(id) => setForm(f => ({ ...f, customerId: id }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueOpen(false)}>{t('common:action.cancel')}</Button>
            <Button onClick={handleIssue} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : null}
              {t('marketing.gift_card.issue_dialog.issue_button')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success / Code reveal dialog */}
      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-green-700">{t('marketing.gift_card.success_dialog.title')}</DialogTitle>
            <DialogDescription>
              {t('marketing.gift_card.success_dialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="my-4 p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
            <div className="flex items-center gap-2 text-amber-800 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{t('marketing.gift_card.success_dialog.warning')}</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-lg font-bold tracking-widest bg-white border rounded px-3 py-2 text-center">
                {issuedCode}
              </code>
              <Button size="sm" variant="outline" onClick={copyCode}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setSuccessOpen(false)}>{t('common:action.done')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GiftCards;
