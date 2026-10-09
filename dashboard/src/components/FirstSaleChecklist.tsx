import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, ChevronRight, Image as ImageIcon, Palette, Plus, Share2, Sparkles, Wallet, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ShareButton } from './ShareButton';
import { api, type OnboardingState } from '../lib/api-client';
import {
  FIRST_SALE_STEPS,
  firstSaleProgress,
  type FirstSaleStepKey,
} from '../lib/onboarding';

// =============================================================================
// "3 steps to your first sale" (PBI 10-17) — replaces the setup checklist on
// the dashboard home behind `onboarding.v2`. One big action per step; the
// completion rules live in lib/onboarding.ts (firstSaleProgress). The share
// and payments-review moments are stamped on the tenant (POST
// /onboarding/events) because nothing else records them.
// =============================================================================

const DISMISSED_KEY = 'dashboard.firstSaleDismissed';

// Routes the steps open. The brand form belongs to the "My store" hub (10-12).
const PRODUCT_FORM_ROUTE = '/dashboard/products/new';
const PAYMENT_METHODS_ROUTE = '/dashboard/payments/methods';
const BRAND_FORM_ROUTE = '/dashboard/store/brand';

const EMPTY_STATE: OnboardingState = { flow: null, sharedAt: null, paymentsReviewedAt: null };

const readDismissed = () => {
  try { return localStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; }
};

export interface FirstSaleChecklistProps {
  productCount: number;
  /** Enabled payment-method codes, or null when unknown (see FirstSaleSignals). */
  enabledPaymentCodes: string[] | null;
  /** Public store URL to share; empty while it isn't known yet. */
  storeUrl: string;
  /** `payments.methods` flag: the merchant can open the payment-methods page. */
  canManagePayments: boolean;
  /** `design.simpleMode` flag: show the "Make it yours" link to the brand form. */
  showBrandLink: boolean;
}

export const FirstSaleChecklist: React.FC<FirstSaleChecklistProps> = ({
  productCount,
  enabledPaymentCodes,
  storeUrl,
  canManagePayments,
  showBrandLink,
}) => {
  const { t } = useTranslation('onboarding');
  const [state, setState] = useState<OnboardingState | null>(null);
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    let active = true;
    api.onboarding.get()
      .then((r) => { if (active) setState(r.data || EMPTY_STATE); })
      // Unknown state reads as "not done yet" rather than hiding the list.
      .catch(() => { if (active) setState(EMPTY_STATE); });
    return () => { active = false; };
  }, []);

  // Optimistic: the step ticks immediately; the server keeps the first time.
  const record = (event: 'shared' | 'payments_reviewed') => {
    const field = event === 'shared' ? 'sharedAt' : 'paymentsReviewedAt';
    setState((s) => ({ ...(s || EMPTY_STATE), [field]: s?.[field] || new Date().toISOString() }));
    api.onboarding.record(event)
      .then((r) => { if (r.data) setState(r.data); })
      .catch(() => { /* stays ticked for this visit; retried on the next tap */ });
  };

  if (!state || dismissed) return null;

  const progress = firstSaleProgress({
    productCount,
    enabledPaymentCodes,
    paymentsReviewedAt: state.paymentsReviewedAt,
    sharedAt: state.sharedAt,
  });
  if (progress.complete) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* private mode */ }
    setDismissed(true);
  };

  const description = (key: FirstSaleStepKey): string => {
    if (key === 'payments') {
      if (enabledPaymentCodes?.length === 0) return t('checklist.step.payments.desc_none');
      return t(canManagePayments ? 'checklist.step.payments.desc_more' : 'checklist.step.payments.desc');
    }
    if (key === 'share' && !storeUrl) return t('checklist.step.share.desc_waiting');
    return t(`checklist.step.${key}.desc`);
  };

  const actionClass = 'h-12 w-full text-base sm:w-auto sm:min-w-[14rem]';

  const action = (key: FirstSaleStepKey, primary: boolean) => {
    const variant = primary ? 'default' : 'outline';
    if (key === 'product') {
      return (
        <Button asChild size="lg" variant={variant} className={actionClass}>
          <Link to={PRODUCT_FORM_ROUTE}>
            <Plus className="h-5 w-5 me-2" />
            {t('checklist.step.product.action')}
          </Link>
        </Button>
      );
    }
    if (key === 'payments') {
      return canManagePayments ? (
        <Button asChild size="lg" variant={variant} className={actionClass}>
          <Link to={PAYMENT_METHODS_ROUTE} onClick={() => record('payments_reviewed')}>
            <Wallet className="h-5 w-5 me-2" />
            {t('checklist.step.payments.action_choose')}
          </Link>
        </Button>
      ) : (
        <Button size="lg" variant={variant} className={actionClass} onClick={() => record('payments_reviewed')}>
          <Check className="h-5 w-5 me-2" />
          {t('checklist.step.payments.action_ok')}
        </Button>
      );
    }
    return (
      <ShareButton
        url={storeUrl}
        message={t('checklist.step.share.message')}
        size="lg"
        variant={variant}
        className={actionClass}
        disabled={!storeUrl}
        onShared={() => record('shared')}
      >
        <Share2 className="h-5 w-5 me-2" />
        {t('checklist.step.share.action')}
      </ShareButton>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-lg leading-snug">{t('checklist.title')}</CardTitle>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-sm font-semibold text-muted-foreground whitespace-nowrap">
              {t('checklist.progress', { done: progress.doneCount, total: progress.total })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={dismiss}
              aria-label={t('checklist.dismiss')}
              title={t('checklist.dismiss')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div
          className="mt-2 h-2 rounded-full bg-muted overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={progress.total}
          aria-valuenow={progress.doneCount}
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${(progress.doneCount / progress.total) * 100}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ol className="space-y-3">
          {FIRST_SALE_STEPS.map((key, i) => {
            const done = progress.done[key];
            const current = progress.current === key;
            return (
              <li
                key={key}
                className={`rounded-xl border p-4 ${current ? 'border-primary bg-primary/5' : ''}`}
                aria-current={current ? 'step' : undefined}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold ${
                      done ? 'bg-green-600 text-white' : current ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}
                    aria-hidden="true"
                  >
                    {done ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${done ? 'text-muted-foreground' : ''}`}>
                      {t(`checklist.step.${key}.title`)}
                    </p>
                    {!done && <p className="text-sm text-muted-foreground mt-0.5">{description(key)}</p>}
                  </div>
                  {done && <Badge variant="success" className="shrink-0">{t('checklist.done')}</Badge>}
                </div>
                {!done && <div className="mt-3">{action(key, current)}</div>}
              </li>
            );
          })}
        </ol>

        {showBrandLink && (
          <Link
            to={BRAND_FORM_ROUTE}
            className="flex items-center gap-3 rounded-xl border border-dashed p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium">{t('checklist.make_it_yours.title')}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{t('checklist.make_it_yours.desc')}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
                  <Sparkles className="h-3.5 w-3.5" /> {t('checklist.make_it_yours.logo')}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
                  <Palette className="h-3.5 w-3.5" /> {t('checklist.make_it_yours.color')}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
                  <ImageIcon className="h-3.5 w-3.5" /> {t('checklist.make_it_yours.cover')}
                </span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 rtl:rotate-180" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
};
