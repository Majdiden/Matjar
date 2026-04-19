import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
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
import { ArrowLeft, Loader2, RefreshCw, PlusCircle, Ban, CheckCircle } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';

interface Transaction {
  _id: string;
  type: 'issue' | 'redeem' | 'refund' | 'adjust';
  amount: number;
  balanceAfter: number;
  orderId?: string;
  note?: string;
  by?: string;
  createdAt: string;
}

interface GiftCardFull {
  _id: string;
  codeLast4: string;
  initialAmount: number;
  balance: number;
  currency: string;
  status: 'active' | 'redeemed' | 'expired' | 'disabled';
  issuedTo?: { name?: string; email?: string };
  customerId?: string;
  issuedBy?: string;
  note?: string;
  message?: string;
  expiresAt?: string;
  orderId?: string;
  coverShipping?: boolean;
  coverTax?: boolean;
  transactions: Transaction[];
  createdAt: string;
  updatedAt: string;
}

interface ApiEnvelope<T> {
  data?: T;
  responseObject?: { data?: T };
}

interface ApiErrorLike {
  message?: string;
  response?: { data?: { message?: string } };
}

const unwrap = <T,>(res: unknown): T | undefined => {
  const envelope = res as ApiEnvelope<T> | undefined;
  return envelope?.data ?? envelope?.responseObject?.data;
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  redeemed: 'bg-gray-100 text-gray-600',
  expired: 'bg-yellow-100 text-yellow-800',
  disabled: 'bg-red-100 text-red-800',
};

const TX_TYPE_COLORS: Record<string, string> = {
  issue: 'bg-blue-100 text-blue-800',
  redeem: 'bg-orange-100 text-orange-800',
  refund: 'bg-green-100 text-green-800',
  adjust: 'bg-purple-100 text-purple-800',
};

const GiftCardDetail: React.FC = () => {
  const { t } = useTranslation(['marketing', 'common']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [card, setCard] = useState<GiftCardFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustSign, setAdjustSign] = useState<1 | -1>(1);

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundNote, setRefundNote] = useState('');

  const loadCard = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await api.get(`/gift-cards/${id}`);
      setCard(unwrap<GiftCardFull>(res) ?? null);
    } catch {
      toast.error(t('marketing.gift_card.toast.load_failed'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => { loadCard(); }, [loadCard]);

  const handleToggleStatus = async () => {
    if (!card) return;
    const endpoint = card.status === 'disabled' ? 'enable' : 'disable';
    const label = card.status === 'disabled' ? t('marketing.gift_card.toast.enabled') : t('marketing.gift_card.toast.disabled');
    try {
      setActionLoading(true);
      const res = await api.post(`/gift-cards/${card._id}/${endpoint}`);
      setCard(unwrap<GiftCardFull>(res) ?? card);
      toast.success(label);
    } catch (err) {
      const e = err as ApiErrorLike;
      toast.error(e?.response?.data?.message ?? t('marketing.gift_card.toast.toggle_failed', { action: endpoint }));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdjust = async () => {
    const amt = parseFloat(adjustAmount);
    if (isNaN(amt) || amt <= 0) { toast.error(t('marketing.gift_card.toast.amount_invalid')); return; }
    try {
      setActionLoading(true);
      const finalAmount = adjustSign * amt;
      const res = await api.post(`/gift-cards/${card!._id}/adjust`, {
        amount: finalAmount,
        note: adjustNote,
      });
      setCard(unwrap<GiftCardFull>(res) ?? card);
      setAdjustOpen(false);
      setAdjustAmount('');
      setAdjustNote('');
      toast.success(t('marketing.gift_card.toast.balance_adjusted'));
    } catch (err) {
      const e = err as ApiErrorLike;
      toast.error(e?.response?.data?.message ?? t('marketing.gift_card.toast.adjustment_failed'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefund = async () => {
    const amt = parseFloat(refundAmount);
    if (isNaN(amt) || amt <= 0) { toast.error(t('marketing.gift_card.toast.amount_invalid')); return; }
    try {
      setActionLoading(true);
      const res = await api.post(`/gift-cards/${card!._id}/adjust`, {
        amount: amt,
        note: refundNote || 'Refund',
      });
      setCard(unwrap<GiftCardFull>(res) ?? card);
      setRefundOpen(false);
      setRefundAmount('');
      setRefundNote('');
      toast.success(t('marketing.gift_card.toast.refund_applied'));
    } catch (err) {
      const e = err as ApiErrorLike;
      toast.error(e?.response?.data?.message ?? t('marketing.gift_card.toast.refund_failed'));
    } finally {
      setActionLoading(false);
    }
  };

  const formatMoney = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!card) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">{t('marketing.gift_card.detail.not_found')}</p>
        <Button variant="link" onClick={() => navigate('/dashboard/gift-cards')}>{t('marketing.gift_card.detail.not_found_back')}</Button>
      </div>
    );
  }

  const balancePct = card.initialAmount > 0 ? (card.balance / card.initialAmount) * 100 : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/gift-cards')}>
          <ArrowLeft className="w-4 h-4 me-1 rtl:rotate-180" />
          {t('marketing.gift_card.detail.back_link')}
        </Button>
        <h1 className="text-xl font-semibold font-mono">
          ••••-••••-••••-{card.codeLast4}
        </h1>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[card.status]}`}>
          {card.status}
        </span>
        {card.coverShipping && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            {t('marketing.gift_card.list.tag.covers_shipping')}
          </span>
        )}
        {card.coverTax && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
            {t('marketing.gift_card.list.tag.covers_tax')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('marketing.gift_card.detail.section.overview')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">{t('marketing.gift_card.detail.field.balance')}</p>
                  <p className="font-semibold text-lg">{formatMoney(card.balance, card.currency)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('marketing.gift_card.detail.field.initial_amount')}</p>
                  <p className="font-medium">{formatMoney(card.initialAmount, card.currency)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('marketing.gift_card.detail.field.currency')}</p>
                  <p className="font-medium">{card.currency}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('marketing.gift_card.detail.field.status')}</p>
                  <p className="font-medium capitalize">{card.status}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('marketing.gift_card.detail.field.recipient')}</p>
                  <p className="font-medium">
                    {card.issuedTo?.name || card.issuedTo?.email
                      ? `${card.issuedTo.name ?? ''} ${card.issuedTo.email ? `<${card.issuedTo.email}>` : ''}`.trim()
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('marketing.gift_card.detail.field.customer_id')}</p>
                  <p className="font-mono text-xs">{card.customerId ?? '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('marketing.gift_card.detail.field.expires')}</p>
                  <p className="font-medium">{card.expiresAt ? formatDate(card.expiresAt) : t('marketing.gift_card.detail.expires_never')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('marketing.gift_card.detail.field.issued')}</p>
                  <p className="font-medium">{formatDate(card.createdAt)}</p>
                </div>
                {card.message && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">{t('marketing.gift_card.detail.field.message')}</p>
                    <p className="font-medium italic">"{card.message}"</p>
                  </div>
                )}
                {card.note && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">{t('marketing.gift_card.detail.field.note')}</p>
                    <p className="font-medium">{card.note}</p>
                  </div>
                )}
              </div>

              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{t('marketing.gift_card.detail.field.remaining_balance')}</span>
                  <span>{balancePct.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, balancePct))}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('marketing.gift_card.detail.section.transactions')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('marketing.gift_card.detail.tx_column.type')}</TableHead>
                    <TableHead>{t('marketing.gift_card.detail.tx_column.amount')}</TableHead>
                    <TableHead>{t('marketing.gift_card.detail.tx_column.balance_after')}</TableHead>
                    <TableHead>{t('marketing.gift_card.detail.tx_column.order')}</TableHead>
                    <TableHead>{t('marketing.gift_card.detail.tx_column.note')}</TableHead>
                    <TableHead>{t('marketing.gift_card.detail.tx_column.date')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {card.transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {t('marketing.gift_card.detail.tx_empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    [...card.transactions].reverse().map(tx => (
                      <TableRow key={tx._id}>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TX_TYPE_COLORS[tx.type] ?? ''}`}>
                            {tx.type}
                          </span>
                        </TableCell>
                        <TableCell className={`font-medium font-mono ${tx.type === 'redeem' ? 'text-red-600' : 'text-green-600'}`}>
                          {tx.type === 'redeem' ? '-' : tx.type === 'adjust' && tx.amount < 0 ? '' : '+'}
                          {formatMoney(Math.abs(tx.amount), card.currency)}
                        </TableCell>
                        <TableCell className="font-mono">
                          {formatMoney(tx.balanceAfter, card.currency)}
                        </TableCell>
                        <TableCell>
                          {tx.orderId ? (
                            <span className="font-mono text-xs text-blue-600 cursor-pointer"
                              onClick={() => navigate(`/orders/${tx.orderId}`)}>
                              {String(tx.orderId).slice(-8)}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">
                          {tx.note ?? '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(tx.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('marketing.gift_card.detail.section.actions')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full"
                variant="outline"
                onClick={handleToggleStatus}
                disabled={actionLoading || card.status === 'expired' || card.status === 'redeemed'}
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 me-2 animate-spin" />
                ) : card.status === 'disabled' ? (
                  <CheckCircle className="w-4 h-4 me-2 text-green-600" />
                ) : (
                  <Ban className="w-4 h-4 me-2 text-red-600" />
                )}
                {card.status === 'disabled' ? t('marketing.gift_card.detail.action.enable') : t('marketing.gift_card.detail.action.disable')}
              </Button>

              <Button
                className="w-full"
                variant="outline"
                onClick={() => { setAdjustSign(1); setAdjustOpen(true); }}
                disabled={actionLoading || card.status === 'disabled' || card.status === 'expired'}
              >
                <PlusCircle className="w-4 h-4 me-2 text-blue-600" />
                {t('marketing.gift_card.detail.action.adjust')}
              </Button>

              <Button
                className="w-full"
                variant="outline"
                onClick={() => setRefundOpen(true)}
                disabled={actionLoading || card.status === 'disabled' || card.status === 'expired'}
              >
                <RefreshCw className="w-4 h-4 me-2 text-purple-600" />
                {t('marketing.gift_card.detail.action.refund')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Adjust Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('marketing.gift_card.adjust_dialog.title')}</DialogTitle>
            <DialogDescription>
              {t('marketing.gift_card.adjust_dialog.current_balance', { balance: formatMoney(card.balance, card.currency) })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Button
                variant={adjustSign === 1 ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAdjustSign(1)}
              >
                {t('marketing.gift_card.adjust_dialog.add')}
              </Button>
              <Button
                variant={adjustSign === -1 ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAdjustSign(-1)}
              >
                {t('marketing.gift_card.adjust_dialog.subtract')}
              </Button>
            </div>
            <div className="space-y-1">
              <Label>{t('marketing.gift_card.adjust_dialog.field.amount.label', { currency: card.currency })}</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={adjustAmount}
                onChange={e => setAdjustAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>{t('marketing.gift_card.adjust_dialog.field.note.label')}</Label>
              <Input
                placeholder={t('marketing.gift_card.adjust_dialog.field.note.placeholder')}
                value={adjustNote}
                onChange={e => setAdjustNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>{t('common:action.cancel')}</Button>
            <Button onClick={handleAdjust} disabled={actionLoading}>
              {actionLoading && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
              {t('marketing.gift_card.adjust_dialog.apply_button')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('marketing.gift_card.refund_dialog.title')}</DialogTitle>
            <DialogDescription>
              {t('marketing.gift_card.refund_dialog.description', { balance: formatMoney(card.balance, card.currency) })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>{t('marketing.gift_card.refund_dialog.field.amount.label', { currency: card.currency })}</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={refundAmount}
                onChange={e => setRefundAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>{t('marketing.gift_card.refund_dialog.field.note.label')}</Label>
              <Input
                placeholder={t('marketing.gift_card.refund_dialog.field.note.placeholder')}
                value={refundNote}
                onChange={e => setRefundNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)}>{t('common:action.cancel')}</Button>
            <Button onClick={handleRefund} disabled={actionLoading}>
              {actionLoading && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
              {t('marketing.gift_card.refund_dialog.refund_button')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GiftCardDetail;
