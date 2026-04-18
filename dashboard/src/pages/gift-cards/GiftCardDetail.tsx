import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

// Shape helpers for loosely-typed api-client responses.
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
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [card, setCard] = useState<GiftCardFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Adjust dialog
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustSign, setAdjustSign] = useState<1 | -1>(1);

  // Refund dialog
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
      toast.error('Failed to load gift card');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadCard(); }, [loadCard]);

  const handleToggleStatus = async () => {
    if (!card) return;
    const endpoint = card.status === 'disabled' ? 'enable' : 'disable';
    const label = card.status === 'disabled' ? 'enabled' : 'disabled';
    try {
      setActionLoading(true);
      const res = await api.post(`/gift-cards/${card._id}/${endpoint}`);
      setCard(unwrap<GiftCardFull>(res) ?? card);
      toast.success(`Gift card ${label}`);
    } catch (err) {
      const e = err as ApiErrorLike;
      toast.error(e?.response?.data?.message ?? `Failed to ${endpoint} gift card`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdjust = async () => {
    const amt = parseFloat(adjustAmount);
    if (isNaN(amt) || amt <= 0) { toast.error('Enter a valid positive amount'); return; }
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
      toast.success('Balance adjusted');
    } catch (err) {
      const e = err as ApiErrorLike;
      toast.error(e?.response?.data?.message ?? 'Adjustment failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefund = async () => {
    const amt = parseFloat(refundAmount);
    if (isNaN(amt) || amt <= 0) { toast.error('Enter a valid positive amount'); return; }
    try {
      setActionLoading(true);
      // Refund is exposed via adjust with positive amount internally,
      // but we call the dedicated service. Use the adjust endpoint for now
      // since a separate /refund endpoint isn't in the router (refund is service-level).
      // We model a refund as a positive adjust with a note.
      const res = await api.post(`/gift-cards/${card!._id}/adjust`, {
        amount: amt,
        note: refundNote || 'Refund',
      });
      setCard(unwrap<GiftCardFull>(res) ?? card);
      setRefundOpen(false);
      setRefundAmount('');
      setRefundNote('');
      toast.success('Refund applied');
    } catch (err) {
      const e = err as ApiErrorLike;
      toast.error(e?.response?.data?.message ?? 'Refund failed');
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
        <p className="text-muted-foreground">Gift card not found.</p>
        <Button variant="link" onClick={() => navigate('/dashboard/gift-cards')}>Back to list</Button>
      </div>
    );
  }

  const balancePct = card.initialAmount > 0 ? (card.balance / card.initialAmount) * 100 : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/gift-cards')}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Gift Cards
        </Button>
        <h1 className="text-xl font-semibold font-mono">
          ••••-••••-••••-{card.codeLast4}
        </h1>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[card.status]}`}>
          {card.status}
        </span>
        {card.coverShipping && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            Covers shipping
          </span>
        )}
        {card.coverTax && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
            Covers tax
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Overview card */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Balance</p>
                  <p className="font-semibold text-lg">{formatMoney(card.balance, card.currency)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Initial Amount</p>
                  <p className="font-medium">{formatMoney(card.initialAmount, card.currency)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Currency</p>
                  <p className="font-medium">{card.currency}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-medium capitalize">{card.status}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Recipient</p>
                  <p className="font-medium">
                    {card.issuedTo?.name || card.issuedTo?.email
                      ? `${card.issuedTo.name ?? ''} ${card.issuedTo.email ? `<${card.issuedTo.email}>` : ''}`.trim()
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Customer ID</p>
                  <p className="font-mono text-xs">{card.customerId ?? '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Expires</p>
                  <p className="font-medium">{card.expiresAt ? formatDate(card.expiresAt) : 'Never'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Issued</p>
                  <p className="font-medium">{formatDate(card.createdAt)}</p>
                </div>
                {card.message && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Message</p>
                    <p className="font-medium italic">"{card.message}"</p>
                  </div>
                )}
                {card.note && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Internal Note</p>
                    <p className="font-medium">{card.note}</p>
                  </div>
                )}
              </div>

              {/* Balance bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Remaining balance</span>
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

          {/* Transactions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Transaction History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Balance After</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {card.transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No transactions
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

        {/* Actions sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full"
                variant="outline"
                onClick={handleToggleStatus}
                disabled={actionLoading || card.status === 'expired' || card.status === 'redeemed'}
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : card.status === 'disabled' ? (
                  <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                ) : (
                  <Ban className="w-4 h-4 mr-2 text-red-600" />
                )}
                {card.status === 'disabled' ? 'Enable Card' : 'Disable Card'}
              </Button>

              <Button
                className="w-full"
                variant="outline"
                onClick={() => { setAdjustSign(1); setAdjustOpen(true); }}
                disabled={actionLoading || card.status === 'disabled' || card.status === 'expired'}
              >
                <PlusCircle className="w-4 h-4 mr-2 text-blue-600" />
                Adjust Balance
              </Button>

              <Button
                className="w-full"
                variant="outline"
                onClick={() => setRefundOpen(true)}
                disabled={actionLoading || card.status === 'disabled' || card.status === 'expired'}
              >
                <RefreshCw className="w-4 h-4 mr-2 text-purple-600" />
                Refund to Card
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Adjust Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust Balance</DialogTitle>
            <DialogDescription>
              Current balance: {formatMoney(card.balance, card.currency)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Button
                variant={adjustSign === 1 ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAdjustSign(1)}
              >
                + Add
              </Button>
              <Button
                variant={adjustSign === -1 ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAdjustSign(-1)}
              >
                − Subtract
              </Button>
            </div>
            <div className="space-y-1">
              <Label>Amount ({card.currency})</Label>
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
              <Label>Note (required for audit trail)</Label>
              <Input
                placeholder="Reason for adjustment"
                value={adjustNote}
                onChange={e => setAdjustNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancel</Button>
            <Button onClick={handleAdjust} disabled={actionLoading}>
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Refund to Gift Card</DialogTitle>
            <DialogDescription>
              Add balance back to this card (e.g. for a returned order).
              Current balance: {formatMoney(card.balance, card.currency)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Refund Amount ({card.currency})</Label>
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
              <Label>Note</Label>
              <Input
                placeholder="Reason for refund"
                value={refundNote}
                onChange={e => setRefundNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)}>Cancel</Button>
            <Button onClick={handleRefund} disabled={actionLoading}>
              {actionLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GiftCardDetail;
