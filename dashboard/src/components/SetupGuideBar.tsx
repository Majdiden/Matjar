/**
 * Guided setup bar (PBI 10-28): on every dashboard page while a new store's
 * essentials are not done — first product, logo and cover, delivery and
 * returns, share. Shows
 * where the merchant is, what the current step is and one button to do it.
 * It can be folded to a single line but not closed: it goes away by itself
 * once the essentials are done. The home page shows the full checklist
 * instead (FirstSaleChecklist), so the bar is hidden there.
 */
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, ChevronUp, Share2 } from 'lucide-react';
import { Button } from './ui/button';
import { ShareButton } from './ShareButton';
import { useSetupGuide } from '../contexts/setup-guide-context';
import { FIRST_SALE_STEP_ROUTES } from '../lib/onboarding';
import { readJson, writeJson } from '../hooks/useStoreProfile';
import { cn } from '../lib/utils';

const FOLDED_KEY = 'matjar.setupGuide.folded';
const HOME_ROUTE = '/dashboard';

export const SetupGuideBar: React.FC = () => {
  const { t } = useTranslation('onboarding');
  const { pathname } = useLocation();
  const { active, progress, storeUrl, recordShared } = useSetupGuide();
  const [folded, setFolded] = useState(() => readJson<boolean>(FOLDED_KEY) === true);

  if (!active || !progress?.current || pathname === HOME_ROUTE) return null;
  const step = progress.current;
  const route = FIRST_SALE_STEP_ROUTES[step];
  const onStepPage = route != null && (pathname === route || pathname.startsWith(`${route}/`));
  const counter = t('checklist.progress', { done: progress.doneCount, total: progress.total });

  const toggle = () =>
    setFolded((f) => {
      writeJson(FOLDED_KEY, f ? null : true);
      return !f;
    });

  if (folded) {
    return (
      <button
        type="button"
        onClick={toggle}
        className="mb-4 flex min-h-[44px] w-full items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 text-start text-sm"
        aria-expanded={false}
      >
        <span className="font-semibold">{t('guide.title')}</span>
        <span className="text-muted-foreground">· {counter} ·</span>
        <span className="min-w-0 flex-1 truncate">{t(`checklist.step.${step}.title`)}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="sr-only">{t('guide.expand')}</span>
      </button>
    );
  }

  return (
    <section
      aria-label={t('guide.title')}
      className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-3 sm:p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">
          {t('guide.title')} <span className="font-normal text-muted-foreground">· {counter}</span>
        </p>
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={toggle} aria-expanded aria-label={t('guide.fold')}>
          <ChevronUp className="h-4 w-4" />
        </Button>
      </div>

      {/* Steps: done ✓, current highlighted, upcoming muted. */}
      <ol className="mt-2 flex items-center gap-1.5" aria-label={counter}>
        {progress.steps.map((key, i) => {
          const done = progress.done[key];
          const current = key === step;
          return (
            <li key={key} className={cn('flex min-w-0 items-center gap-1.5', i < progress.steps.length - 1 && 'flex-1')} aria-current={current ? 'step' : undefined}>
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  done ? 'bg-green-600 text-white' : current ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              {/* Phones: only the current step's name fits next to the dots. */}
              <span className={cn('truncate text-xs', current ? 'font-semibold' : 'hidden text-muted-foreground sm:inline')}>
                {t(`guide.short.${key}`)}
              </span>
              {i < progress.steps.length - 1 && <span className="h-px min-w-2 flex-1 bg-border" aria-hidden />}
            </li>
          );
        })}
      </ol>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-medium">{t(`checklist.step.${step}.title`)}</p>
          <p className="text-sm text-muted-foreground">
            {onStepPage ? t(`guide.here.${step}`) : t(`checklist.step.${step}.desc`)}
          </p>
        </div>
        {step === 'share' ? (
          <ShareButton
            url={storeUrl}
            message={t('checklist.step.share.message')}
            className="h-11 shrink-0"
            disabled={!storeUrl}
            onShared={recordShared}
          >
            <Share2 className="h-4 w-4 me-2" />
            {t('checklist.step.share.action')}
          </ShareButton>
        ) : (
          route &&
          !onStepPage && (
            <Button asChild className="h-11 shrink-0">
              <Link to={route}>{t(`checklist.step.${step}.action`)}</Link>
            </Button>
          )
        )}
      </div>
    </section>
  );
};
