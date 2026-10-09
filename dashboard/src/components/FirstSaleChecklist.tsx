import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Plus, Share2, Sparkles, Truck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ShareButton } from './ShareButton';
import { useSetupGuide } from '../contexts/setup-guide-context';
import { FIRST_SALE_STEP_ROUTES, type FirstSaleStepKey } from '../lib/onboarding';

// =============================================================================
// "Ready to sell" checklist on the dashboard home (PBI 10-17, 10-28): the
// essentials — first product, logo and cover, delivery and returns, share — one big action per
// step, the current one highlighted. Progress comes from the guided-setup
// context (contexts/SetupGuideContext.tsx), the same source as the guide bar
// on other pages. It stays until the essentials are done; there is no
// "hide", by design.
// =============================================================================

const STEP_ICONS: Record<FirstSaleStepKey, React.ElementType> = {
  product: Plus,
  brand: Sparkles,
  policies: Truck,
  share: Share2,
};

export const FirstSaleChecklist: React.FC = () => {
  const { t } = useTranslation('onboarding');
  const { progress, storeUrl, recordShared } = useSetupGuide();

  if (!progress || progress.complete) return null;

  const actionClass = 'h-12 w-full text-base sm:w-auto sm:min-w-[14rem]';

  const action = (key: FirstSaleStepKey, primary: boolean) => {
    const variant = primary ? 'default' : 'outline';
    const Icon = STEP_ICONS[key];
    if (key === 'share') {
      return (
        <ShareButton
          url={storeUrl}
          message={t('checklist.step.share.message')}
          size="lg"
          variant={variant}
          className={actionClass}
          disabled={!storeUrl}
          onShared={recordShared}
        >
          <Icon className="h-5 w-5 me-2" />
          {t('checklist.step.share.action')}
        </ShareButton>
      );
    }
    return (
      <Button asChild size="lg" variant={variant} className={actionClass}>
        <Link to={FIRST_SALE_STEP_ROUTES[key] as string}>
          <Icon className="h-5 w-5 me-2" />
          {t(`checklist.step.${key}.action`)}
        </Link>
      </Button>
    );
  };

  const description = (key: FirstSaleStepKey): string =>
    key === 'share' && !storeUrl ? t('checklist.step.share.desc_waiting') : t(`checklist.step.${key}.desc`);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-lg leading-snug">{t('checklist.title')}</CardTitle>
          <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-muted-foreground">
            {t('checklist.progress', { done: progress.doneCount, total: progress.total })}
          </span>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
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
      <CardContent>
        <ol className="space-y-3">
          {progress.steps.map((key, i) => {
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
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      done ? 'bg-green-600 text-white' : current ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}
                    aria-hidden="true"
                  >
                    {done ? <Check className="h-4 w-4" /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`font-medium ${done ? 'text-muted-foreground' : ''}`}>{t(`checklist.step.${key}.title`)}</p>
                    {!done && <p className="mt-0.5 text-sm text-muted-foreground">{description(key)}</p>}
                  </div>
                  {done && <Badge variant="success" className="shrink-0">{t('checklist.done')}</Badge>}
                </div>
                {!done && <div className="mt-3">{action(key, current)}</div>}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
};
