/**
 * "About page" screen (PBI 10-9) at /dashboard/store/about.
 *
 * Four short questions and an optional photo; the server writes the About
 * page from them (services/generatedPages.js) in Arabic, and in English when
 * English answers are given. If the merchant has since rewritten the page by
 * hand, saving asks before replacing their text.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ExternalLink, ImagePlus, Loader2, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { MediaPicker } from '../../components/MediaPicker';
import { useConfirm } from '../../components/ui/use-confirm';
import { useStorefrontHost } from '../../hooks/useStorefrontHost';
import { api, type StoreAboutState } from '../../lib/api-client';
import { AnswerField } from './AnswerField';
import { StoreScreen } from './StoreScreen';
import {
  EMPTY_ANSWER, fromDraft, hasArabic, isEditedConflict, toAsciiDigits, toDraft, type AnswerDraft,
} from './answers';

/** Server-side limits (services/generatedPages.js ABOUT_TEXT_MAX_LENGTH). */
const MAX_LENGTH = { products: 200, city: 80, different: 600 } as const;
const YEAR_PATTERN = /^\d{4}$/;

interface Draft {
  products: AnswerDraft;
  since: string;
  city: AnswerDraft;
  different: AnswerDraft;
  photo: string;
}

const EMPTY_DRAFT: Draft = {
  products: EMPTY_ANSWER, since: '', city: EMPTY_ANSWER, different: EMPTY_ANSWER, photo: '',
};

export const StoreAbout: React.FC = () => {
  const { t } = useTranslation(['storePages']);
  const confirm = useConfirm();
  const host = useStorefrontHost();
  const [state, setState] = useState<StoreAboutState | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [errors, setErrors] = useState<{ products?: string; since?: string }>({});

  const applyState = (s: StoreAboutState) => {
    setState(s);
    const a = s.answers;
    setDraft({
      products: toDraft(a?.products),
      since: a?.since ? String(a.since) : '',
      city: toDraft(a?.city ?? s.suggestions?.city),
      different: toDraft(a?.different),
      photo: a?.photo || '',
    });
  };

  useEffect(() => {
    let alive = true;
    api.storePages.getAbout()
      .then((res) => { if (alive) applyState(res.data); })
      .catch(() => toast.error(t('storePages:common.error_load')))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!hasArabic(draft.products)) next.products = t('storePages:about.error_products');
    const year = toAsciiDigits(draft.since.trim());
    if (year && !YEAR_PATTERN.test(year)) next.since = t('storePages:about.error_since');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const askToReplace = () =>
    confirm({
      title: t('storePages:about.confirm_title'),
      description: t('storePages:about.confirm_body'),
      confirmText: t('storePages:about.confirm_ok'),
      cancelText: t('storePages:common.confirm_cancel'),
      variant: 'destructive',
    });

  const save = async () => {
    if (!validate()) return;
    let overwrite = false;
    if (state?.edited) {
      if (!(await askToReplace())) return;
      overwrite = true;
    }
    const year = toAsciiDigits(draft.since.trim());
    const answers = {
      products: fromDraft(draft.products),
      since: year ? Number(year) : null,
      city: fromDraft(draft.city),
      different: fromDraft(draft.different),
      photo: draft.photo || null,
    };
    setSaving(true);
    try {
      let res;
      try {
        res = await api.storePages.saveAbout(answers, overwrite);
      } catch (err) {
        // Edited elsewhere since this screen loaded: ask, then retry once.
        if (!isEditedConflict(err) || overwrite || !(await askToReplace())) throw err;
        res = await api.storePages.saveAbout(answers, true);
      }
      applyState(res.data);
      toast.success(t('storePages:about.saved'));
    } catch (err) {
      if (!isEditedConflict(err)) toast.error(t('storePages:common.error_save'));
    } finally {
      setSaving(false);
    }
  };

  const arabicPage = state?.pages.find((p) => p.locale === 'ar' && p.generated) || null;
  const generated = Boolean(state?.answers);

  return (
    <StoreScreen title={t('storePages:about.title')} intro={t('storePages:about.intro')} loading={loading}>
      {state?.edited && (
        <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>{t('storePages:about.edited_notice')}</p>
        </div>
      )}

      <Card>
        <CardContent className="space-y-6 pt-6">
          <AnswerField
            label={t('storePages:about.products_label')}
            placeholder={t('storePages:about.products_placeholder')}
            value={draft.products}
            onChange={(v) => set('products', v)}
            maxLength={MAX_LENGTH.products}
            error={errors.products}
          />

          <div className="space-y-2">
            <Label htmlFor="about-since" className="text-base font-medium">{t('storePages:about.since_label')}</Label>
            <Input
              id="about-since"
              inputMode="numeric"
              dir="ltr"
              maxLength={4}
              className="max-w-[8rem]"
              placeholder={t('storePages:about.since_placeholder')}
              value={draft.since}
              aria-invalid={errors.since ? true : undefined}
              onChange={(e) => set('since', e.target.value)}
            />
            {errors.since && <p className="text-sm text-destructive">{errors.since}</p>}
          </div>

          <AnswerField
            label={t('storePages:about.city_label')}
            placeholder={t('storePages:about.city_placeholder')}
            value={draft.city}
            onChange={(v) => set('city', v)}
            maxLength={MAX_LENGTH.city}
          />

          <AnswerField
            label={t('storePages:about.different_label')}
            placeholder={t('storePages:about.different_placeholder')}
            value={draft.different}
            onChange={(v) => set('different', v)}
            maxLength={MAX_LENGTH.different}
            multiline
          />

          <div className="space-y-2">
            <Label className="text-base font-medium">{t('storePages:about.photo_label')}</Label>
            {draft.photo ? (
              <div className="space-y-2">
                <img src={draft.photo} alt="" className="w-full max-h-56 rounded-lg object-cover border" />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                    <ImagePlus className="h-4 w-4 me-1" />
                    {t('storePages:about.photo_change')}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => set('photo', '')}>
                    <Trash2 className="h-4 w-4 me-1" />
                    {t('storePages:about.photo_remove')}
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="button" variant="outline" onClick={() => setPickerOpen(true)}>
                <ImagePlus className="h-4 w-4 me-1" />
                {t('storePages:about.photo_choose')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Button className="w-full h-11 text-base" onClick={save} disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
        {generated ? t('storePages:about.update') : t('storePages:about.save')}
      </Button>

      {generated && (
        <div className="flex flex-col sm:flex-row gap-2">
          {host && (
            <Button asChild variant="outline" className="flex-1">
              <a href={`https://${host}/about`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 me-1" />
                {t('storePages:common.view_on_store')}
              </a>
            </Button>
          )}
          {arabicPage && (
            <Button asChild variant="ghost" className="flex-1">
              <Link to={`/dashboard/pages/${arabicPage.id}/edit`}>
                <Pencil className="h-4 w-4 me-1" />
                {t('storePages:about.edit_by_hand')}
              </Link>
            </Button>
          )}
        </div>
      )}

      <MediaPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={(asset) => set('photo', asset.url)} />
    </StoreScreen>
  );
};

export default StoreAbout;
