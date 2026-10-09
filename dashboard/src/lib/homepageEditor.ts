/**
 * Homepage simple editor (PBI 10-13) — pure helpers, no React.
 *
 * Dependency-free on purpose (type imports only) so the unit tests can load
 * this file directly with Node's type stripping, like ./storeProfile.ts.
 *
 * ## Bilingual text settings
 *
 * A text setting is stored as a base key plus an optional Arabic twin
 * `<id>__ar` (same convention as the full editor's SettingControl). The
 * storefront shows the twin to Arabic visitors and the base key to everyone
 * else (ThemeProvider → resolveI18nSettings). The simple editor edits both
 * through one Arabic-first BilingualField, mapped exactly like a bilingual
 * brand-kit text (10-7):
 *
 *   write { ar, en? }:  `<id>__ar` ← ar;  `<id>` ← en, or ar when there is no English
 *   read:               ar ← `<id>__ar`;  en ← `<id>` when it differs from the twin
 *
 * So English visitors read English, or Arabic when none was given, and a
 * value written here reads back unchanged. A base value with no twin (typed
 * in the full editor) is shown as Arabic when it contains Arabic letters,
 * else as the English text. Clearing both writes `<id>: ""` and drops the twin.
 *
 * ## Where a value comes from
 *
 * GET /api/theme-customization annotates each section with
 * `settingSources[id]` ('override' | 'brand' | 'default') and `brandValues`
 * (the brand-kit keys the storefront fills, incl. `__ar` twins). The value a
 * customer sees is `brandValues[key]` when the source is 'brand', else
 * `settings[key]`. Handing a setting back to the brand kit removes its key
 * and twin from the stored settings.
 */
import type { SettingSource } from '@matjar/theme-shared/types/theme';

export const ARABIC_TWIN_SUFFIX = '__ar';

export interface BilingualText {
  ar?: string;
  en?: string;
}

/** One homepage section instance as GET /theme-customization returns it. */
export interface HomeSection {
  id: string;
  type: string;
  order?: number;
  disabled?: boolean;
  enabled?: boolean;
  /** False when the active theme no longer declares the type. */
  known?: boolean;
  settings: Record<string, unknown>;
  settingSources?: Record<string, SettingSource>;
  brandValues?: Record<string, string>;
  [key: string]: unknown;
}

/** A change sent to the server; the newest op per `opKey` wins. */
export type HomepageOp =
  | {
      kind: 'settings';
      sectionId: string;
      settings: Record<string, unknown>;
      /** Display only (never sent): where the changed values now come from. */
      sources?: Record<string, SettingSource>;
      brandValues?: Record<string, string>;
    }
  | { kind: 'visible'; sectionId: string; visible: boolean }
  | { kind: 'order'; sectionIds: string[] };

export const opKey = (op: HomepageOp): string =>
  op.kind === 'order' ? 'order' : `${op.kind}:${op.sectionId}`;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

const ARABIC_LETTERS = /[؀-ۿݐ-ݿࢠ-ࣿ]/;
export const hasArabicLetters = (text: string): boolean => ARABIC_LETTERS.test(text);

const twinKey = (id: string) => `${id}${ARABIC_TWIN_SUFFIX}`;

/** The `{ ar, en }` the BilingualField shows for a text setting. */
export function readBilingual(settings: Record<string, unknown> | null | undefined, id: string): BilingualText {
  const base = str(settings?.[id]);
  const twin = str(settings?.[twinKey(id)]);
  if (twin.trim()) return { ar: twin, en: base.trim() && base !== twin ? base : '' };
  if (!base.trim()) return { ar: '', en: '' };
  return hasArabicLetters(base) ? { ar: base, en: '' } : { ar: '', en: base };
}

/** `settings` with a bilingual value written to `<id>` and `<id>__ar`. */
export function writeBilingual(
  settings: Record<string, unknown>,
  id: string,
  value: BilingualText,
): Record<string, unknown> {
  const ar = (value.ar || '').trim();
  const en = (value.en || '').trim();
  const next = { ...settings };
  if (ar) {
    next[id] = en || ar;
    next[twinKey(id)] = ar;
  } else {
    next[id] = en;
    delete next[twinKey(id)];
  }
  return next;
}

/** `settings` without a setting's own value (and twin): the brand kit fills it again. */
export function withoutOverride(settings: Record<string, unknown>, id: string): Record<string, unknown> {
  const next = { ...settings };
  delete next[id];
  delete next[twinKey(id)];
  return next;
}

export const sourceOf = (section: HomeSection, id: string): SettingSource =>
  section.settingSources?.[id] ?? 'default';

/** The value customers see for one stored key (`id` or `id__ar`). */
export function effectiveValue(section: HomeSection, key: string, sourceId = key): unknown {
  if (sourceOf(section, sourceId) === 'brand' && section.brandValues && key in section.brandValues) {
    return section.brandValues[key];
  }
  return section.settings?.[key];
}

/** The bilingual text customers see for a text setting. */
export function effectiveBilingual(section: HomeSection, id: string): BilingualText {
  if (sourceOf(section, id) === 'brand' && section.brandValues) {
    return readBilingual(section.brandValues, id);
  }
  return readBilingual(section.settings, id);
}

export const isShown = (section: HomeSection): boolean =>
  !(section.disabled === true || section.enabled === false);

/** Sections in display order (by `order`, then list position). */
export function sortSections<T extends { order?: number }>(sections: readonly T[]): T[] {
  return sections
    .map((s, i) => ({ s, i, o: Number.isFinite(Number(s.order)) ? Number(s.order) : i }))
    .sort((a, b) => a.o - b.o || a.i - b.i)
    .map(({ s }) => s);
}

/**
 * Move `id` one step up (-1) or down (+1) among the `listed` sections only,
 * swapping places with its listed neighbour in the full order. Sections the
 * simple editor does not list keep their positions. Null when it can't move.
 */
export function moveAmong(allIds: readonly string[], listedIds: readonly string[], id: string, delta: -1 | 1): string[] | null {
  const listedPos = listedIds.indexOf(id);
  const neighbour = listedIds[listedPos + delta];
  if (listedPos < 0 || neighbour === undefined) return null;
  const a = allIds.indexOf(id);
  const b = allIds.indexOf(neighbour);
  if (a < 0 || b < 0) return null;
  const next = allIds.slice();
  next[a] = neighbour;
  next[b] = id;
  return next;
}

/**
 * A saved order brought up to date with the current section list: ids that
 * no longer exist are dropped, new ones are kept in their current place at
 * the end. The reorder API drops any section missing from the list it gets.
 */
export function reconcileOrder(savedIds: readonly string[], currentIds: readonly string[]): string[] {
  const current = new Set(currentIds);
  const kept = savedIds.filter((id, i) => current.has(id) && savedIds.indexOf(id) === i);
  const seen = new Set(kept);
  return [...kept, ...currentIds.filter((id) => !seen.has(id))];
}

/** The section list after an op (sections keep their annotations). */
export function applyOp(sections: readonly HomeSection[], op: HomepageOp): HomeSection[] {
  switch (op.kind) {
    case 'settings':
      return sections.map((s) =>
        s.id === op.sectionId
          ? {
              ...s,
              settings: { ...op.settings },
              settingSources: op.sources ? { ...s.settingSources, ...op.sources } : s.settingSources,
              brandValues: op.brandValues ? { ...op.brandValues } : s.brandValues,
            }
          : s,
      );
    case 'visible':
      return sections.map((s) =>
        s.id === op.sectionId ? { ...s, disabled: !op.visible, enabled: op.visible } : s,
      );
    case 'order': {
      const ids = reconcileOrder(op.sectionIds, sortSections(sections).map((s) => s.id));
      const byId = new Map(sections.map((s) => [s.id, s]));
      return ids.map((id, order) => ({ ...(byId.get(id) as HomeSection), order }));
    }
  }
}

export const applyOps = (sections: readonly HomeSection[], ops: readonly HomepageOp[]): HomeSection[] =>
  ops.reduce<HomeSection[]>((list, op) => applyOp(list, op), sections.slice());

/** The op that puts back what `op` changes, read from the list before it. Null if nothing to undo. */
export function inverseOp(before: readonly HomeSection[], op: HomepageOp): HomepageOp | null {
  if (op.kind === 'order') {
    return { kind: 'order', sectionIds: sortSections(before).map((s) => s.id) };
  }
  const section = before.find((s) => s.id === op.sectionId);
  if (!section) return null;
  return op.kind === 'settings'
    ? {
        kind: 'settings',
        sectionId: op.sectionId,
        settings: { ...section.settings },
        sources: { ...section.settingSources },
        brandValues: { ...section.brandValues },
      }
    : { kind: 'visible', sectionId: op.sectionId, visible: isShown(section) };
}

/**
 * Settings for the preview's SECTION_UPDATE message. The storefront merges
 * the message over what it has, so a key removed from the stored settings
 * (handed back to the brand kit) is sent as its default instead: the theme
 * default for a base key, blank for an `__ar` twin.
 */
export function liveSettings(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...next };
  for (const key of Object.keys(prev)) {
    if (!(key in next)) out[key] = key in defaults ? defaults[key] : '';
  }
  return out;
}

/** Drop saved ops that no longer fit the current list (section gone). */
export function opFits(op: HomepageOp, sections: readonly HomeSection[]): boolean {
  if (op.kind === 'order') return true;
  return sections.some((s) => s.id === op.sectionId);
}
