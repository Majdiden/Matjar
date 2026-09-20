/**
 * Plan & billing (merchant) — the plan chooser.
 *
 * Two families side by side: "Pay as you sell" (commission on delivered
 * orders, no fee) and "Fixed monthly" (a subscription fee, no percentage).
 * Everything rendered here comes from GET /api/billing/summary, which only
 * ever returns this tenant's data and no internal pricing sources. A switch
 * is scheduled for the next billing period (server-enforced).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { Separator } from '../../components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../../components/ui/dialog';
import { Crown, Check, Loader2, Percent, CreditCard, CalendarClock, Receipt, Info } from 'lucide-react';
import { api, type BillingAvailablePlan, type BillingCommission, type BillingSummary } from '../../lib/api-client';
import { formatPrice, formatDate } from '../../lib/format';
import { useAuth } from '../../contexts/auth-context';
import { toast } from 'sonner';

const FAMILY_ICON = { commission: Percent, subscription: CreditCard, hybrid: Crown } as const;

function tierText(c: BillingCommission | null, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (!c || !c.tiers?.length) return '—';
  return t('subscriptions.pricing.percent_of_sales', { tiers: c.tiers.map((x) => pct(effectiveRate(x.percent, c))).join(' → ') });
}

const pct = (p: number) => `${Number(p).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
/** Tier rate after the store's percent delta, never below zero. */
const effectiveRate = (percent: number, c: BillingCommission) => Math.max(0, percent + (c.percentDelta || 0));

export const Subscriptions: React.FC = () => {
  const { t } = useTranslation(['subscriptions', 'common']);
  const { can } = useAuth();
  const canSwitch = can('settings.write');

  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<BillingAvailablePlan | null>(null);
  const [switching, setSwitching] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.billing.summary();
      if (!res.responseObject) throw new Error('empty');
      setSummary(res.responseObject);
    } catch (err) {
      const e = err as { message?: string };
      setError(e?.message || t('subscriptions.toast.load_failed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const byFamily = useMemo(() => {
    const plans = summary?.availablePlans ?? [];
    return {
      commission: plans.filter((p) => p.family === 'commission'),
      subscription: plans.filter((p) => p.family === 'subscription'),
    };
  }, [summary]);

  const confirmSwitch = async () => {
    if (!target) return;
    setSwitching(true);
    try {
      await api.billing.requestPlanChange(target.key);
      toast.success(t('subscriptions.toast.switched', { name: target.name }));
      setTarget(null);
      await load();
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || t('subscriptions.toast.switch_failed'));
    } finally {
      setSwitching(false);
    }
  };

  const cancelScheduled = async () => {
    setCancelling(true);
    try {
      await api.billing.cancelPlanChange();
      toast.success(t('subscriptions.toast.cancelled'));
      await load();
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || t('subscriptions.toast.cancel_failed'));
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40" />
        <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
      </div>
    );
  }
  if (error || !summary) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t('subscriptions.toast.load_failed')}</AlertTitle>
        <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={load}>{t('common:action.try_again')}</Button>
        </AlertDescription>
      </Alert>
    );
  }

  const { plan, pricing, currentPeriod, recent30d, statements, scheduledChange, nextPeriodStartsAt } = summary;
  const currency = currentPeriod.currency || pricing.baseFee.currency;
  const scheduledPlan = scheduledChange ? summary.availablePlans.find((p) => p.key === scheduledChange.toPlan) : null;
  const CurrentIcon = FAMILY_ICON[plan.family] ?? Crown;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('subscriptions.list.title')}</h1>
        <p className="text-muted-foreground">{t('subscriptions.list.subtitle')}</p>
      </div>

      {scheduledChange && (
        <Alert>
          <CalendarClock className="h-4 w-4" />
          <AlertTitle>{t('subscriptions.scheduled.title')}</AlertTitle>
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>{t('subscriptions.scheduled.body', { name: scheduledPlan?.name ?? scheduledChange.toPlan, date: formatDate(scheduledChange.effectiveAt) })}</span>
            {scheduledChange.cancellable && canSwitch && (
              <Button variant="outline" size="sm" onClick={cancelScheduled} disabled={cancelling} className="shrink-0">
                {cancelling ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : null}{t('subscriptions.scheduled.cancel')}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Current plan */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-10 w-10 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
                <CurrentIcon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <CardTitle>{plan.name ? t('subscriptions.list.current_plan_title', { name: plan.name }) : t('subscriptions.list.no_plan')}</CardTitle>
                <CardDescription className="mt-1">
                  {plan.family === 'commission'
                    ? `${t('subscriptions.pricing.no_fee')} · ${tierText(pricing.commission, t)}`
                    : pricing.chargesBaseFee
                      ? t(pricing.baseFee.interval === 'year' ? 'subscriptions.pricing.per_year' : 'subscriptions.pricing.per_month', { amount: formatPrice(pricing.baseFee.amount, pricing.baseFee.currency) })
                      : t('subscriptions.pricing.no_fee')}
                  {plan.family === 'hybrid' && pricing.commission && ` + ${tierText(pricing.commission, t)}`}
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{t(`subscriptions.family.${plan.family}.label`)}</Badge>
              {pricing.trialEndsAt && new Date(pricing.trialEndsAt) > new Date() && (
                <Badge variant="outline">{t('subscriptions.list.trial_ends', { date: formatDate(pricing.trialEndsAt) })}</Badge>
              )}
              {pricing.feeHolidayUntil && new Date(pricing.feeHolidayUntil) >= new Date() && (
                <Badge variant="outline">{t('subscriptions.list.fee_holiday', { date: formatDate(pricing.feeHolidayUntil) })}</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm font-medium">{t('subscriptions.period.title', { period: currentPeriod.periodKey })}</p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label={t('subscriptions.period.gmv')} value={formatPrice(currentPeriod.gmv, currency)} sub={t('subscriptions.period.orders', { count: currentPeriod.count })} />
            {pricing.chargesCommission && <Stat label={t('subscriptions.period.commission')} value={formatPrice(currentPeriod.commission, currency)} strong />}
            {pricing.chargesBaseFee && <Stat label={t(pricing.baseFee.interval === 'year' ? 'subscriptions.period.base_fee_year' : 'subscriptions.period.base_fee_month')} value={formatPrice(pricing.baseFee.amount, pricing.baseFee.currency)} strong />}
            {currentPeriod.credits > 0 && <Stat label={t('subscriptions.period.credits')} value={formatPrice(currentPeriod.credits, currency)} />}
            <Stat label={t('subscriptions.period.next_statement')} value={formatDate(nextPeriodStartsAt)} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{t('subscriptions.period.recent_30d', { amount: formatPrice(recent30d.gmv, currency), count: recent30d.orders })}</p>
        </CardContent>
      </Card>

      {/* Plan chooser */}
      <div>
        <h2 className="text-xl font-semibold mb-4">{t('subscriptions.list.available_plans')}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {(['commission', 'subscription'] as const).map((family) => {
            const Icon = FAMILY_ICON[family];
            const list = byFamily[family];
            return (
              <Card key={family} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{t(`subscriptions.family.${family}.label`)}</CardTitle>
                  </div>
                  <CardDescription>{t(`subscriptions.family.${family}.tagline`)}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  {list.length === 0 && <p className="text-sm text-muted-foreground">{t(`subscriptions.family.${family}.empty`)}</p>}
                  {list.map((p) => (
                    <PlanCard
                      key={p.key}
                      plan={p}
                      currency={currency}
                      recentOrders={recent30d.orders}
                      canSwitch={canSwitch}
                      scheduledTo={scheduledChange?.toPlan === p.key}
                      onSwitch={() => setTarget(p)}
                      t={t}
                    />
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Statements */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{t('subscriptions.list.statements')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {statements.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('subscriptions.list.no_statements')}</p>
          ) : (
            <div className="divide-y rounded-md border">
              {statements.map((s) => (
                <div key={s.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium tabular-nums">{s.periodKey}</span>
                    <StatementBadge status={s.status} t={t} />
                    {s.dueAt && ['issued', 'partially_paid', 'overdue'].includes(s.status) && (
                      <span className="text-xs text-muted-foreground">{t('subscriptions.statement.due', { date: formatDate(s.dueAt) })}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm sm:text-end">
                    <Stat label={t('subscriptions.statement.amount_due')} value={formatPrice(s.amountDue, s.currency)} small />
                    <Stat label={t('subscriptions.statement.paid')} value={formatPrice(s.amountPaid, s.currency)} small />
                    <Stat label={t('subscriptions.statement.balance')} value={formatPrice(s.balance, s.currency)} small strong />
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t('subscriptions.statement.how_to_pay')}
          </p>
        </CardContent>
      </Card>

      {/* Switch dialog */}
      <Dialog open={!!target} onOpenChange={(open) => !open && !switching && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('subscriptions.switch_dialog.title', { name: target?.name })}</DialogTitle>
            <DialogDescription>{t('subscriptions.switch_dialog.description')}</DialogDescription>
          </DialogHeader>
          {target && (
            <div className="py-2 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{t('subscriptions.switch_dialog.you_pay')}</span>
                <span className="font-semibold text-end">{planPriceText(target, t)}</span>
              </div>
              <Separator />
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{t('subscriptions.switch_dialog.effective')}</span>
                <span>{t('subscriptions.switch_dialog.next_period')} · {formatDate(target.nextPeriodStartsAt || nextPeriodStartsAt)}</span>
              </div>
              <Separator />
              <EstimateLine plan={target} currency={currency} recentOrders={recent30d.orders} t={t} />
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setTarget(null)} disabled={switching}>{t('common:action.cancel')}</Button>
            <Button onClick={confirmSwitch} disabled={switching}>
              {switching ? <><Loader2 className="h-4 w-4 me-2 animate-spin" />{t('common:state.processing', { defaultValue: 'Processing…' })}</> : t('subscriptions.action.confirm_change')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ------------------------------------------------------------ pieces

type T = (k: string, o?: Record<string, unknown>) => string;

function planPriceText(p: BillingAvailablePlan, t: T): string {
  if (p.family === 'commission') return `${t('subscriptions.pricing.no_fee')} · ${tierText(p.commission, t)}`;
  const base = t(p.interval === 'year' ? 'subscriptions.pricing.per_year' : 'subscriptions.pricing.per_month', { amount: formatPrice(p.basePrice, p.baseCurrency) });
  return p.family === 'hybrid' && p.commission ? `${base} + ${tierText(p.commission, t)}` : base;
}

function Stat({ label, value, sub, strong, small }: { label: string; value: string; sub?: string; strong?: boolean; small?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground truncate">{label}</div>
      <div className={`${small ? 'text-sm' : 'text-lg'} ${strong ? 'font-semibold' : ''} tabular-nums [overflow-wrap:anywhere]`} dir="ltr">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function StatementBadge({ status, t }: { status: string; t: T }) {
  const variant: 'default' | 'secondary' | 'destructive' | 'outline' =
    status === 'paid' ? 'default' : status === 'overdue' ? 'destructive' : status === 'draft' || status === 'waived' || status === 'void' ? 'outline' : 'secondary';
  return <Badge variant={variant}>{t(`subscriptions.status.${status}`, { defaultValue: status })}</Badge>;
}

function EstimateLine({ plan, currency, recentOrders, t }: { plan: BillingAvailablePlan; currency: string; recentOrders: number; t: T }) {
  const e = plan.estimate;
  const baseCcy = plan.baseCurrency || currency;
  const base = e?.monthlyBase || 0;
  const commission = e?.estimatedCommission || 0;
  if (recentOrders === 0 && plan.family === 'commission') {
    return <p className="text-xs text-muted-foreground">{t('subscriptions.estimate.no_sales')}</p>;
  }
  // The base fee is in the plan currency and commission in the store currency;
  // only add them when they are the same currency, otherwise show both parts.
  const sameCurrency = base === 0 || commission === 0 || baseCcy === currency;
  const line = sameCurrency
    ? t('subscriptions.estimate.approx', { amount: formatPrice(base + commission, base > 0 && commission === 0 ? baseCcy : currency) })
    : t('subscriptions.estimate.approx_parts', { base: formatPrice(base, baseCcy), commission: formatPrice(commission, currency) });
  return (
    <div className="text-xs">
      <div className="text-muted-foreground">{t('subscriptions.estimate.title')}</div>
      <div className="text-sm font-semibold" dir="ltr">{line}</div>
      {plan.family === 'hybrid' && sameCurrency && base > 0 && commission > 0 && (
        <div className="text-muted-foreground">{t('subscriptions.estimate.breakdown', { base: formatPrice(base, baseCcy), commission: formatPrice(commission, currency) })}</div>
      )}
      {e?.fxMissing && <div className="text-amber-700">{t('subscriptions.estimate.fx_missing')}</div>}
    </div>
  );
}

function PlanCard({ plan, currency, recentOrders, canSwitch, scheduledTo, onSwitch, t }: {
  plan: BillingAvailablePlan; currency: string; recentOrders: number; canSwitch: boolean; scheduledTo: boolean; onSwitch: () => void; t: T;
}) {
  const c = plan.commission;
  const fmtBound = (v: number) => (c ? formatPrice(v, c.currency) : String(v));
  const disabledReason = plan.current
    ? t('subscriptions.action.current')
    : !plan.selfService
      ? t('subscriptions.action.not_self_service')
      : plan.availableAfter
        ? t('subscriptions.action.min_term', { date: formatDate(plan.availableAfter) })
        : null;

  return (
    <div className={`rounded-lg border p-3 ${plan.current ? 'border-primary bg-primary/5' : ''}`}>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{plan.name}</span>
            {plan.current && <Badge>{t('subscriptions.action.current')}</Badge>}
            {scheduledTo && <Badge variant="secondary"><CalendarClock className="h-3 w-3 me-1" />{t('subscriptions.scheduled.title')}</Badge>}
          </div>
          {plan.description && <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>}
        </div>
        <div className="text-sm font-medium sm:text-end" dir="ltr">{planPriceText(plan, t)}</div>
      </div>

      {c && c.tiers.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs">
          {c.tiers.map((tier, i) => {
            const from = i === 0 ? 0 : c.tiers[i - 1].upTo ?? 0;
            const range = c.tiers.length === 1
              ? t('subscriptions.pricing.tier_open')
              : tier.upTo == null
                ? t('subscriptions.pricing.tier_range_last', { from: fmtBound(from) })
                : i === 0
                  ? t('subscriptions.pricing.tier_range_first', { upTo: fmtBound(tier.upTo) })
                  : t('subscriptions.pricing.tier_range_middle', { from: fmtBound(from), upTo: fmtBound(tier.upTo) });
            return (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{range}</span>
                <span className="tabular-nums" dir="ltr">
                  {pct(effectiveRate(tier.percent, c))}
                  {(tier.fixedPerOrder ?? 0) > 0 && <span className="text-muted-foreground"> {t('subscriptions.pricing.plus_per_order', { amount: formatPrice(tier.fixedPerOrder, c.currency) })}</span>}
                </span>
              </li>
            );
          })}
          {c.minFee != null && c.minFee > 0 && <li className="text-muted-foreground">{t('subscriptions.pricing.min_fee', { amount: formatPrice(c.minFee, c.currency) })}</li>}
          {c.tiers.length > 1 && (
            <li className="text-muted-foreground">{t(c.tierMode === 'bracket' ? 'subscriptions.pricing.tier_mode_bracket' : 'subscriptions.pricing.tier_mode_marginal')}</li>
          )}
        </ul>
      )}

      <ul className="mt-2 space-y-0.5 text-xs">
        {plan.family !== 'commission' && plan.trialDays > 0 && (
          <li className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" />{t('subscriptions.pricing.trial_days', { count: plan.trialDays })}</li>
        )}
        {(plan.features ?? []).slice(0, 6).map((f, i) => (
          <li key={i} className="flex items-start gap-1.5"><Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" /><span>{f}</span></li>
        ))}
      </ul>

      {!plan.current && (
        <div className="mt-3">
          <EstimateLine plan={plan} currency={currency} recentOrders={recentOrders} t={t} />
        </div>
      )}

      <div className="mt-3">
        {plan.current ? (
          <Button variant="outline" className="w-full" disabled>{t('subscriptions.action.current')}</Button>
        ) : disabledReason ? (
          <Button variant="outline" className="w-full" disabled title={disabledReason}>{disabledReason}</Button>
        ) : !canSwitch ? (
          <Button variant="outline" className="w-full" disabled title={t('subscriptions.action.no_permission')}>{t('subscriptions.action.switch')}</Button>
        ) : (
          <Button className="w-full" onClick={onSwitch} disabled={scheduledTo}>{t('subscriptions.action.switch')}</Button>
        )}
        {!plan.current && !disabledReason && !canSwitch && (
          <p className="mt-1 text-xs text-muted-foreground">{t('subscriptions.action.no_permission')}</p>
        )}
      </div>
    </div>
  );
}

export default Subscriptions;
