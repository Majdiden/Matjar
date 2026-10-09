/**
 * Bottom sheet of the homepage simple editor (PBI 10-13): the basic settings
 * of ONE homepage section (basicSettingsOf — at most 3), with plain labels
 * and big controls:
 *
 *   text / textarea → BilingualField (Arabic first, English optional; stored
 *                     as `<id>__ar` + `<id>`, see lib/homepageEditor.ts)
 *   image           → ImageField (phone gallery / camera, shrunk, uploaded)
 *   color           → ColorField swatches
 *   checkbox        → a switch row
 *   select          → large options
 *   number / range  → a number box
 *
 * A setting bound to the brand kit (`bind`) that still shows the brand value
 * says "From your store info" with a link to the store-info form; changing
 * it here makes it the page's own value, and "Use my store info again"
 * removes that value so the brand kit fills it again.
 *
 * The sheet is non-modal on purpose: the phone preview above it stays
 * visible (not dimmed) while the merchant edits, and follows each change.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Check, RotateCcw } from 'lucide-react';
import type { AnySectionSetting, SectionDefinition, SettingSource } from '@matjar/theme-shared/types/theme';
import type { BrandKit } from '@matjar/theme-shared/types/commerce';
import { basicSettingsOf } from '@matjar/theme-shared/theme/settingLevels';
import { brandSettingValues } from '@matjar/theme-shared/theme/brandBindings';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Switch } from '../../components/ui/switch';
import { BilingualField } from '../../components/BilingualField';
import { useFieldValue } from '../../hooks/useFieldValue';
import { useStoreProfile } from '../../hooks/useStoreProfile';
import { api } from '../../lib/api-client';
import { sameBilingual } from '../../lib/bilingual';
import {
  ARABIC_TWIN_SUFFIX,
  effectiveBilingual,
  effectiveValue,
  isShown,
  sourceOf,
  withoutOverride,
  writeBilingual,
  type HomeSection,
  type HomepageOp,
} from '../../lib/homepageEditor';
import { cn } from '../../lib/utils';
import { ColorField, fieldInputClass, ImageField } from './brandFields';
import { useFieldName, usePartName } from './homepageNames';

interface SheetProps {
  section: HomeSection | null;
  definition?: SectionDefinition;
  onClose: () => void;
  onChange: (op: HomepageOp) => void;
  /** Save state + Undo, shown at the bottom of the sheet. */
  status?: React.ReactNode;
}

const isBlank = (v: unknown) => v == null || (typeof v === 'string' && v.trim() === '');

export default function HomepageSectionSheet({ section, definition, onClose, onChange, status }: SheetProps) {
  const { t } = useTranslation('storeDesign');
  const partName = usePartName();
  const fieldName = useFieldName();
  const { profile } = useStoreProfile();

  const settings = basicSettingsOf<AnySectionSetting>(definition as { settings?: AnySectionSetting[] } | undefined);

  /** The brand-kit keys a bound setting would show, or null (not bound / not filled in). */
  const brandFill = (def: AnySectionSetting): Record<string, string> | null => {
    if (!section || !def.bind) return null;
    if (sourceOf(section, def.id) === 'brand' && section.brandValues) {
      const keys = [def.id, `${def.id}${ARABIC_TWIN_SUFFIX}`].filter((k) => k in section.brandValues!);
      if (keys.length) return Object.fromEntries(keys.map((k) => [k, section.brandValues![k]]));
    }
    if (!profile) return null;
    return brandSettingValues(def.id, def.bind, {
      name: profile.storeName,
      logo: profile.logo,
      brand: profile.brand as BrandKit,
    });
  };

  /** Save new settings for `def`, noting where its value now comes from. */
  const commit = (def: AnySectionSetting, next: Record<string, unknown>, handBack = false) => {
    if (!section) return;
    const fill = brandFill(def);
    const value = next[def.id];
    const twin = next[`${def.id}${ARABIC_TWIN_SUFFIX}`];
    const overridden =
      !handBack &&
      ((value !== undefined && value !== def.default && !(isBlank(value) && isBlank(def.default))) || !isBlank(twin));
    const source: SettingSource = overridden ? 'override' : fill ? 'brand' : 'default';
    const brandValues = { ...(section.brandValues || {}) };
    delete brandValues[def.id];
    delete brandValues[`${def.id}${ARABIC_TWIN_SUFFIX}`];
    if (source === 'brand' && fill) Object.assign(brandValues, fill);
    onChange({ kind: 'settings', sectionId: section.id, settings: next, sources: { [def.id]: source }, brandValues });
  };

  return (
    <Dialog open={!!section} onOpenChange={(open) => !open && onClose()} modal={false}>
      <DialogContent
        className="max-h-[60dvh] gap-3 shadow-[0_-8px_30px_rgba(0,0,0,0.18)] sm:!max-h-[85vh] sm:overflow-y-auto"
        // Don't pop the phone keyboard up over the preview on open, and keep
        // the sheet open while the merchant scrolls or taps the preview.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {section && (
          <>
            <DialogHeader className="pe-8 text-start">
              <DialogTitle className="text-lg">{partName(section.type, definition)}</DialogTitle>
              <DialogDescription>{t('homepage.sheet_help')}</DialogDescription>
            </DialogHeader>

            <label className="flex min-h-[52px] cursor-pointer items-center justify-between gap-3 rounded-lg border px-3">
              <span className="text-base font-medium">{t('homepage.show_part')}</span>
              <Switch
                checked={isShown(section)}
                onCheckedChange={(visible) => onChange({ kind: 'visible', sectionId: section.id, visible })}
                className="scale-125"
              />
            </label>

            {settings.length === 0 && <p className="text-sm text-muted-foreground">{t('homepage.no_fields')}</p>}

            {settings.map((def) => (
              <SettingField
                key={`${section.id}:${def.id}`}
                section={section}
                def={def}
                label={fieldName(def)}
                brandFill={brandFill(def)}
                onCommit={(next) => commit(def, next)}
                onUseBrand={() => commit(def, withoutOverride(section.settings, def.id), true)}
              />
            ))}

            {/* Kept in view at the bottom of the sheet: the save state with
                Undo, and the way out. */}
            <div className="sticky -bottom-4 -mx-4 -mb-4 space-y-2 border-t bg-background p-4 pt-3 sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:px-6 sm:pb-6">
              {status}
              <Button className="h-12 w-full text-base" onClick={onClose}>
                <Check className="h-5 w-5 me-2" />
                {t('homepage.done')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

interface SettingFieldProps {
  section: HomeSection;
  def: AnySectionSetting;
  label: string;
  brandFill: Record<string, string> | null;
  onCommit: (settings: Record<string, unknown>) => void;
  onUseBrand: () => void;
}

function SettingField({ section, def, label, brandFill, onCommit, onUseBrand }: SettingFieldProps) {
  const source = sourceOf(section, def.id);
  const hint = def.bind ? (
    <BrandHint source={source} canUseBrand={source === 'override' && !!brandFill} onUseBrand={onUseBrand} />
  ) : null;
  const set = (value: unknown) => onCommit({ ...section.settings, [def.id]: value });

  switch (def.type) {
    case 'text':
    case 'textarea':
    case 'richtext':
      return <TextField section={section} def={def} label={label} hint={hint} onCommit={onCommit} />;
    case 'image':
      return (
        <FieldBlock label={label} hint={hint}>
          <ImageField
            kind="photo"
            url={String(effectiveValue(section, def.id) || '') || null}
            upload={async (file) => {
              const res = (await api.upload.contentImage(file)) as { data?: { url?: string } };
              if (!res?.data?.url) throw new Error('upload failed');
              return res.data.url;
            }}
            onUploaded={(url) => set(url)}
            onRemove={() => set('')}
          />
        </FieldBlock>
      );
    case 'color':
      return (
        <FieldBlock label={label} hint={hint}>
          <ColorField
            value={String(effectiveValue(section, def.id) ?? def.default ?? '') || null}
            onSave={(color) => (color ? set(color) : onCommit(withoutOverride(section.settings, def.id)))}
          />
        </FieldBlock>
      );
    case 'checkbox': {
      const checked = Boolean(section.settings[def.id] ?? def.default);
      return (
        <label className="flex min-h-[52px] cursor-pointer items-center justify-between gap-3 rounded-lg border px-3">
          <span className="text-base font-medium">{label}</span>
          <Switch checked={checked} onCheckedChange={(v) => set(v)} className="scale-125" />
        </label>
      );
    }
    case 'select':
      return <SelectField def={def} label={label} value={String(section.settings[def.id] ?? def.default ?? '')} onSelect={set} />;
    case 'number':
    case 'range':
      return <NumberField def={def} label={label} value={section.settings[def.id] ?? def.default} onCommit={set} />;
    default:
      return null;
  }
}

function FieldBlock({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-base font-semibold">{label}</p>
      {hint}
      {children}
    </div>
  );
}

function BrandHint({ source, canUseBrand, onUseBrand }: { source: SettingSource; canUseBrand: boolean; onUseBrand: () => void }) {
  const { t } = useTranslation('storeDesign');
  if (source === 'brand') {
    return (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
          <BadgeCheck className="h-4 w-4" aria-hidden />
          {t('homepage.from_brand')}
        </span>
        <Link to="/dashboard/store/brand" className="inline-flex min-h-[40px] items-center font-medium text-primary underline-offset-2 hover:underline">
          {t('homepage.edit_brand')}
        </Link>
      </span>
    );
  }
  if (canUseBrand) {
    return (
      <button
        type="button"
        onClick={onUseBrand}
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <RotateCcw className="h-4 w-4" aria-hidden />
        {t('homepage.use_brand')}
      </button>
    );
  }
  if (source === 'default') {
    return (
      <span className="block text-sm text-muted-foreground">
        {t('homepage.brand_tip')}{' '}
        <Link to="/dashboard/store/brand" className="font-medium text-primary hover:underline">
          {t('homepage.edit_brand')}
        </Link>
      </span>
    );
  }
  return null;
}

function TextField({
  section,
  def,
  label,
  hint,
  onCommit,
}: {
  section: HomeSection;
  def: AnySectionSetting;
  label: string;
  hint: React.ReactNode;
  onCommit: (settings: Record<string, unknown>) => void;
}) {
  // What customers see now (the brand value when it comes from store info);
  // follows undo and other changes until the merchant types.
  const shown = effectiveBilingual(section, def.id);
  const [value, setValue] = useFieldValue(shown);
  return (
    <div className="space-y-2">
      <BilingualField
        id={`hp-${section.id}-${def.id}`}
        label={label}
        help={hint}
        value={value}
        onChange={setValue}
        multiline={def.type !== 'text'}
        rows={def.type === 'text' ? undefined : 3}
        placeholder={def.placeholder ? { en: def.placeholder } : undefined}
        onCommit={(v) => {
          if (sameBilingual(v, shown)) return;
          onCommit(writeBilingual(section.settings, def.id, v));
        }}
      />
    </div>
  );
}

const optionKey = (label: string) => String(label).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

function SelectField({ def, label, value, onSelect }: { def: AnySectionSetting; label: string; value: string; onSelect: (v: string) => void }) {
  const { t } = useTranslation('themes');
  return (
    <div className="space-y-2" role="radiogroup" aria-label={label}>
      <p className="text-base font-semibold">{label}</p>
      <div className="grid gap-2">
        {(def.options || []).map((opt) => {
          const selected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => !selected && onSelect(opt.value)}
              className={cn(
                'flex min-h-[48px] items-center justify-between gap-2 rounded-lg border px-3 text-start text-base',
                selected ? 'border-primary bg-primary/5 font-semibold' : 'hover:bg-accent',
              )}
            >
              {t(`themes:options.${optionKey(opt.label)}`, { defaultValue: opt.label })}
              {selected && <Check className="h-5 w-5 text-primary" aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NumberField({ def, label, value, onCommit }: { def: AnySectionSetting; label: string; value: unknown; onCommit: (v: number) => void }) {
  const server = value == null ? '' : String(value);
  const [text, setText] = useFieldValue(server);
  const id = `hp-num-${def.id}`;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-base font-semibold">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        dir="ltr"
        min={def.min}
        max={def.max}
        step={def.step || 1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = Number(text);
          if (text.trim() === '' || !Number.isFinite(n) || text === server) return;
          const clamped = Math.min(def.max ?? n, Math.max(def.min ?? n, n));
          setText(String(clamped));
          onCommit(clamped);
        }}
        className={cn(fieldInputClass, 'max-w-[10rem]')}
      />
    </div>
  );
}
