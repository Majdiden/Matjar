import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { ArrowLeft, Gift, Loader2, Copy, AlertCircle, Search, X } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';

interface IssueForm {
  initialAmount: string;
  currency: string;
  recipientName: string;
  recipientEmail: string;
  message: string;
  note: string;
  expiresAt: string;
  customerId: string;
  coverShipping: boolean;
  coverTax: boolean;
}

const EMPTY_FORM: IssueForm = {
  initialAmount: '',
  currency: 'SDG',
  recipientName: '',
  recipientEmail: '',
  message: '',
  note: '',
  expiresAt: '',
  customerId: '',
  coverShipping: false,
  coverTax: false,
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

interface ApiErrorLike {
  message?: string;
  response?: { data?: { message?: string } };
}

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

const unwrap = <T,>(res: unknown): T | undefined => {
  const envelope = res as ApiEnvelope<T> | undefined;
  return envelope?.data ?? envelope?.responseObject?.data;
};

interface CustomerSelectProps {
  value: string;
  onChange: (id: string, customer?: CustomerOption | null) => void;
}

const CustomerSelect: React.FC<CustomerSelectProps> = ({ value, onChange }) => {
  const { t } = useTranslation(['marketing']);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<CustomerOption | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

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
            aria-label={t('marketing.gift_card.issue.field.customer.clear_aria')}
            onClick={() => { onChange('', null); setSelected(null); setQuery(''); }}
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
                  onClick={() => { onChange(c._id, c); setSelected(c); setOpen(false); }}
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

const GiftCardNew: React.FC = () => {
  const { t } = useTranslation(['marketing', 'common']);
  const navigate = useNavigate();
  const [form, setForm] = useState<IssueForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [issuedCode, setIssuedCode] = useState('');

  const lastAutofill = useRef<{ name: string; email: string }>({ name: '', email: '' });

  const handleCustomerSelected = (id: string, customer?: CustomerOption | null) => {
    setForm((f) => {
      const next = { ...f, customerId: id };
      if (!customer) return next;
      const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
      const derivedName = fullName || customer.email || '';
      const derivedEmail = customer.email || '';
      if (!f.recipientName || f.recipientName === lastAutofill.current.name) {
        next.recipientName = derivedName;
      }
      if (!f.recipientEmail || f.recipientEmail === lastAutofill.current.email) {
        next.recipientEmail = derivedEmail;
      }
      lastAutofill.current = { name: derivedName, email: derivedEmail };
      return next;
    });
  };

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
        coverShipping: form.coverShipping,
        coverTax: form.coverTax,
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
      setSuccessOpen(true);
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

  const handleDone = () => {
    setSuccessOpen(false);
    navigate('/dashboard/gift-cards');
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/gift-cards')}>
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>
        <div className="flex items-center gap-2">
          <Gift className="w-6 h-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">{t('marketing.gift_card.form.page_title')}</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('marketing.gift_card.form.card_title')}</CardTitle>
          <CardDescription>
            {t('marketing.gift_card.form.card_description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>{t('marketing.gift_card.issue_dialog.field.customer.label')}</Label>
            <CustomerSelect
              value={form.customerId}
              onChange={handleCustomerSelected}
            />
          </div>

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

          <div className="pt-2 border-t space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('marketing.gift_card.form.field.cover_shipping.label')}</Label>
                <p className="text-xs text-muted-foreground">{t('marketing.gift_card.form.field.cover_shipping.hint')}</p>
              </div>
              <Switch
                checked={form.coverShipping}
                onCheckedChange={(v) => setForm(f => ({ ...f, coverShipping: !!v }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>{t('marketing.gift_card.form.field.cover_tax.label')}</Label>
                <p className="text-xs text-muted-foreground">{t('marketing.gift_card.form.field.cover_tax.hint')}</p>
              </div>
              <Switch
                checked={form.coverTax}
                onCheckedChange={(v) => setForm(f => ({ ...f, coverTax: !!v }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate('/dashboard/gift-cards')}>{t('common:action.cancel')}</Button>
            <Button onClick={handleIssue} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : null}
              {t('marketing.gift_card.issue_dialog.issue_button')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={successOpen} onOpenChange={(v) => { if (!v) handleDone(); else setSuccessOpen(v); }}>
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
            <Button onClick={handleDone}>{t('common:action.done')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GiftCardNew;
