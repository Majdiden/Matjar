/**
 * "Delivery, returns and payment" screen (PBI 10-11) at
 * /dashboard/store/policies.
 *
 * A few short questions; the server writes the delivery, returns and payment
 * policies from them (services/generatedPages.js) using the delivery areas
 * and payment methods the store already has, in the store's language. The
 * same answers drive the trust badges on product pages. Policies the
 * merchant rewrote by hand are only replaced after they confirm.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AlertTriangle, Banknote, Clock, Loader2, RotateCcw, Truck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useConfirm } from '../../components/ui/use-confirm';
import { api, type PolicyAnswers, type StorePoliciesState } from '../../lib/api-client';
import { AnswerField } from './AnswerField';
import { StoreScreen } from './StoreScreen';
import {
  EMPTY_ANSWER, fromDraft, hasArabic, isEditedConflict, toAsciiDigits, toDraft, type AnswerDraft,
} from './answers';

/** Server-side limits (services/generatedPages.js). */
const MAX_LENGTH = { areas: 300, fee: 200, time: 100, conditions: 600 } as const;
const RETURN_DAYS_MIN = 1;
const RETURN_DAYS_MAX = 90;
const POLICY_KEYS = ['delivery', 'returns', 'cod'] as const;

interface Draft {
  areas: AnswerDraft;
  fee: AnswerDraft;
  time: AnswerDraft;
  accepted: boolean | null;
  days: string;
  conditions: AnswerDraft;
}

const EMPTY_DRAFT: Draft = {
  areas: EMPTY_ANSWER, fee: EMPTY_ANSWER, time: EMPTY_ANSWER, accepted: null, days: '', conditions: EMPTY_ANSWER,
};

type FieldErrors = Partial<Record<'areas' | 'time' | 'accepted' | 'days', string>>;

export const StorePolicies: React.FC = () => {
  const { t, i18n } = useTranslation(['storePages']);
  const confirm = useConfirm();
  const [state, setState] = useState<StorePoliciesState | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const applyState = (s: StorePoliciesState) => {
    setState(s);
    const a = s.answers;
    setDraft({
      areas: toDraft(a ? a.delivery.areas : s.suggestions?.areas),
      fee: toDraft(a?.delivery.fee),
      time: toDraft(a?.delivery.time),
      accepted: a ? a.returns.accepted : null,
      days: a?.returns.days ? String(a.returns.days) : '',
      conditions: toDraft(a?.returns.conditions),
    });
  };

  useEffect(() => {
    let alive = true;
    api.storePages.getPolicies()
      .then((res) => { if (alive) applyState(res.data); })
      .catch(() => toast.error(t('storePages:common.error_load')))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const hasZones = (state?.zones.length ?? 0) > 0;
  const hasPayment = Boolean(state && (state.payment.cod || state.payment.transfers.length));
  // Only the policies this save would write can lose hand edits.
  const editedKeys = POLICY_KEYS.filter((k) => state?.policies[k].edited && (k !== 'cod' || hasPayment));
  const editedNames = editedKeys.map((k) => t(`storePages:policies.page_${k}`)).join(i18n.dir() === 'rtl' ? '، ' : ', ');
  const days = Number(toAsciiDigits(draft.days.trim()));

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (!hasZones && !hasArabic(draft.areas)) next.areas = t('storePages:policies.error_areas');
    if (!hasArabic(draft.time)) next.time = t('storePages:policies.error_time');
    if (draft.accepted === null) next.accepted = t('storePages:policies.error_accepted');
    if (draft.accepted && !(Number.isInteger(days) && days >= RETURN_DAYS_MIN && days <= RETURN_DAYS_MAX)) {
      next.days = t('storePages:policies.error_days');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const askToReplace = () =>
    confirm({
      title: t('storePages:policies.confirm_title'),
      description: t('storePages:policies.confirm_body'),
      confirmText: t('storePages:policies.confirm_ok'),
      cancelText: t('storePages:common.confirm_cancel'),
      variant: 'destructive',
    });

  const save = async () => {
    if (!validate()) return;
    let overwrite = false;
    if (editedKeys.length) {
      if (!(await askToReplace())) return;
      overwrite = true;
    }
    const answers: PolicyAnswers = {
      delivery: { areas: fromDraft(draft.areas), fee: fromDraft(draft.fee), time: fromDraft(draft.time) },
      returns: draft.accepted
        ? { accepted: true, days, conditions: fromDraft(draft.conditions) }
        : { accepted: false },
    };
    setSaving(true);
    try {
      let res;
      try {
        res = await api.storePages.savePolicies(answers, overwrite);
      } catch (err) {
        if (!isEditedConflict(err) || overwrite || !(await askToReplace())) throw err;
        res = await api.storePages.savePolicies(answers, true);
      }
      applyState(res.data);
      toast.success(t('storePages:policies.saved'));
    } catch (err) {
      if (!isEditedConflict(err)) toast.error(t('storePages:common.error_save'));
    } finally {
      setSaving(false);
    }
  };

  const formatZonePrice = (price: number | null) =>
    !price ? t('storePages:policies.zone_free') : `${price.toLocaleString(i18n.language)} ${state?.currency || ''}`.trim();

  return (
    <StoreScreen title={t('storePages:policies.title')} intro={t('storePages:policies.intro')} loading={loading}>
      {state && (
        <p className="text-sm text-muted-foreground">
          {state.language === 'en' ? t('storePages:policies.language_note_en') : t('storePages:policies.language_note_ar')}
        </p>
      )}

      {editedKeys.length > 0 && (
        <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>{t('storePages:policies.edited_notice', { pages: editedNames })}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="h-5 w-5" />
            {t('storePages:policies.delivery_title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {hasZones && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('storePages:policies.zones_hint')}</p>
              <ul className="space-y-1 text-sm">
                {state!.zones.map((z) => (
                  <li key={z.name} className="flex justify-between gap-3 rounded-md bg-muted/50 px-3 py-2">
                    <span className="font-medium">{z.name}</span>
                    <span className="text-muted-foreground">
                      {formatZonePrice(z.price)}{z.days ? ` · ${z.days}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <AnswerField
            label={hasZones ? t('storePages:policies.areas_extra_label') : t('storePages:policies.areas_label')}
            placeholder={t('storePages:policies.areas_placeholder')}
            value={draft.areas}
            onChange={(v) => set('areas', v)}
            maxLength={MAX_LENGTH.areas}
            error={errors.areas}
          />
          {!hasZones && (
            <AnswerField
              label={t('storePages:policies.fee_label')}
              placeholder={t('storePages:policies.fee_placeholder')}
              value={draft.fee}
              onChange={(v) => set('fee', v)}
              maxLength={MAX_LENGTH.fee}
            />
          )}
          <AnswerField
            label={t('storePages:policies.time_label')}
            placeholder={t('storePages:policies.time_placeholder')}
            value={draft.time}
            onChange={(v) => set('time', v)}
            maxLength={MAX_LENGTH.time}
            error={errors.time}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RotateCcw className="h-5 w-5" />
            {t('storePages:policies.returns_title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="text-base font-medium">{t('storePages:policies.accepted_label')}</Label>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('storePages:policies.accepted_label')}>
              {[true, false].map((value) => (
                <Button
                  key={String(value)}
                  type="button"
                  role="radio"
                  aria-checked={draft.accepted === value}
                  variant={draft.accepted === value ? 'default' : 'outline'}
                  className="h-11"
                  onClick={() => set('accepted', value)}
                >
                  {value ? t('storePages:policies.yes') : t('storePages:policies.no')}
                </Button>
              ))}
            </div>
            {errors.accepted && <p className="text-sm text-destructive">{errors.accepted}</p>}
          </div>

          {draft.accepted && (
            <>
              <div className="space-y-2">
                <Label htmlFor="return-days" className="text-base font-medium">
                  <Clock className="inline h-4 w-4 me-1 align-[-2px]" />
                  {t('storePages:policies.days_label')}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="return-days"
                    inputMode="numeric"
                    dir="ltr"
                    maxLength={2}
                    className="max-w-[6rem]"
                    value={draft.days}
                    aria-invalid={errors.days ? true : undefined}
                    onChange={(e) => set('days', e.target.value)}
                  />
                  <span className="text-muted-foreground">{t('storePages:policies.days_suffix')}</span>
                </div>
                {errors.days && <p className="text-sm text-destructive">{errors.days}</p>}
              </div>
              <AnswerField
                label={t('storePages:policies.conditions_label')}
                placeholder={t('storePages:policies.conditions_placeholder')}
                value={draft.conditions}
                onChange={(v) => set('conditions', v)}
                maxLength={MAX_LENGTH.conditions}
                multiline
              />
            </>
          )}
        </CardContent>
      </Card>

      {state && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Banknote className="h-5 w-5" />
              {t('storePages:policies.payment_title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {hasPayment ? (
              <>
                <p className="text-sm text-muted-foreground">{t('storePages:policies.payment_hint')}</p>
                <ul className="flex flex-wrap gap-2">
                  {state.payment.cod && (
                    <li className="rounded-full border px-3 py-1 text-sm">{t('storePages:policies.payment_cod')}</li>
                  )}
                  {state.payment.transfers.map((p) => (
                    <li key={p.code} className="rounded-full border px-3 py-1 text-sm">
                      {t('storePages:policies.payment_transfer', { name: p.label })}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t('storePages:policies.payment_none')}</p>
            )}
            <Button asChild variant="link" className="h-auto p-0">
              <Link to="/dashboard/payments/methods">{t('storePages:policies.payment_manage')}</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Button className="w-full h-11 text-base" onClick={save} disabled={saving || !state}>
        {saving && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
        {state?.answers ? t('storePages:policies.update') : t('storePages:policies.save')}
      </Button>
    </StoreScreen>
  );
};

export default StorePolicies;
