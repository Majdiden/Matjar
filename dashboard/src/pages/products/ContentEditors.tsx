import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { CONTENT_SECTION_MAX, SECTION_KEY_RE, SUGGESTED_SECTIONS, slugifyKey, type ContentSectionRow, type SpecRow } from './contentSections';

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// ── Specifications ───────────────────────────────────────────────────────
export function SpecificationsEditor({ rows, onChange }: { rows: SpecRow[]; onChange: (rows: SpecRow[]) => void }) {
  const { t } = useTranslation(['products']);
  const update = (i: number, patch: Partial<SpecRow>) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('products.form.section.specifications.title')}</CardTitle>
        <CardDescription>{t('products.form.section.specifications.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">{t('products.form.specifications.empty')}</p>}
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_1fr_auto] items-start">
            <Input
              placeholder={t('products.form.specifications.key_placeholder')}
              value={row.key}
              onChange={(e) => update(i, { key: e.target.value })}
              className="sm:col-span-1 col-span-1"
            />
            <div className="flex gap-1 sm:order-3">
              <Button type="button" variant="ghost" size="icon" aria-label={t('products.form.content_sections.move_up')} disabled={i === 0} onClick={() => onChange(move(rows, i, i - 1))}><ArrowUp className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label={t('products.form.content_sections.move_down')} disabled={i === rows.length - 1} onClick={() => onChange(move(rows, i, i + 1))}><ArrowDown className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label={t('products.form.specifications.remove')} onClick={() => onChange(rows.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
            <Input
              placeholder={t('products.form.specifications.value_placeholder')}
              value={row.value}
              onChange={(e) => update(i, { value: e.target.value })}
              className="col-span-2 sm:col-span-1 sm:order-2"
            />
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, { key: '', value: '' }])}>
          <Plus className="h-4 w-4 me-1" /> {t('products.form.specifications.add')}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Content sections ─────────────────────────────────────────────────────
export function ContentSectionsEditor({ rows, onChange }: { rows: ContentSectionRow[]; onChange: (rows: ContentSectionRow[]) => void }) {
  const { t } = useTranslation(['products']);
  const full = rows.length >= CONTENT_SECTION_MAX;
  const keyCounts = rows.reduce<Record<string, number>>((acc, r) => { acc[r.key] = (acc[r.key] || 0) + 1; return acc; }, {});

  const update = (i: number, patch: Partial<ContentSectionRow>) =>
    onChange(rows.map((r, idx) => {
      if (idx !== i) return r;
      const next = { ...r, ...patch };
      if (patch.title !== undefined && next.autoKey) next.key = slugifyKey(patch.title);
      return next;
    }));

  const add = (preset?: { key: string; title: string; titleAr: string }) => {
    if (full) return;
    onChange([...rows, { key: preset?.key ?? '', title: preset?.title ?? '', titleAr: preset?.titleAr ?? '', body: '', bodyAr: '', autoKey: !preset }]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('products.form.section.content_sections.title')}</CardTitle>
        <CardDescription>{t('products.form.section.content_sections.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{t('products.form.content_sections.suggested')}</span>
          {SUGGESTED_SECTIONS.map((p) => {
            const used = rows.some((r) => r.key === p.key);
            return (
              <button
                key={p.key}
                type="button"
                disabled={used || full}
                onClick={() => add(p)}
                className="rounded-full border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t(`products.form.content_sections.preset.${p.key}`)}
              </button>
            );
          })}
        </div>

        {rows.map((row, i) => {
          const keyInvalid = !SECTION_KEY_RE.test(row.key);
          const keyDup = keyCounts[row.key] > 1;
          return (
            <div key={i} className="rounded-lg border p-3 sm:p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{row.title || t('products.form.content_sections.untitled')} <span className="text-muted-foreground">#{i + 1}</span></span>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="icon" aria-label={t('products.form.content_sections.move_up')} disabled={i === 0} onClick={() => onChange(move(rows, i, i - 1))}><ArrowUp className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" aria-label={t('products.form.content_sections.move_down')} disabled={i === rows.length - 1} onClick={() => onChange(move(rows, i, i + 1))}><ArrowDown className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" aria-label={t('products.form.content_sections.remove')} onClick={() => onChange(rows.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                <div className="space-y-1.5">
                  <Label>{t('products.form.content_sections.title_label')}</Label>
                  <Input maxLength={80} value={row.title} onChange={(e) => update(i, { title: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('products.form.content_sections.key_label')}</Label>
                  <Input
                    dir="ltr"
                    className="font-mono text-xs"
                    value={row.key}
                    onChange={(e) => update(i, { key: e.target.value.toLowerCase(), autoKey: false })}
                  />
                  {(keyInvalid || keyDup) && (
                    <p className="text-xs text-destructive">
                      {keyDup ? t('products.form.content_sections.key_duplicate') : t('products.form.content_sections.key_invalid')}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t('products.form.content_sections.body_label')}</Label>
                <Textarea rows={4} maxLength={5000} value={row.body} onChange={(e) => update(i, { body: e.target.value })} />
                <p className="text-xs text-muted-foreground">{t('products.form.content_sections.body_hint')}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t('products.form.content_sections.title_ar_label')}</Label>
                  <Input dir="rtl" maxLength={80} value={row.titleAr} onChange={(e) => update(i, { titleAr: e.target.value })} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>{t('products.form.content_sections.body_ar_label')}</Label>
                  <Textarea dir="rtl" rows={4} maxLength={5000} value={row.bodyAr} onChange={(e) => update(i, { bodyAr: e.target.value })} />
                </div>
              </div>
            </div>
          );
        })}

        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="outline" size="sm" disabled={full} onClick={() => add()}>
            <Plus className="h-4 w-4 me-1" /> {t('products.form.content_sections.add')}
          </Button>
          <span className="text-xs text-muted-foreground">{rows.length} / {CONTENT_SECTION_MAX}</span>
        </div>
      </CardContent>
    </Card>
  );
}
