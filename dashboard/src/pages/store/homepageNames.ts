/**
 * Plain-words names for the homepage simple editor (PBI 10-13).
 *
 * Simple mode never shows design vocabulary, so a part of the page and each
 * of its fields get a plain name from `storeDesign:homepage.parts.<type>` /
 * `storeDesign:homepage.fields.<settingId>`, falling back to the full
 * editor's translated names (`themes:sections.<type>.name`,
 * `themes:settings.<id>.label`) and finally to the theme's own label.
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { AnySectionSetting, SectionDefinition } from '@matjar/theme-shared/types/theme';

/** Setting ids themes use for "which products this grid shows". */
const PRODUCT_SOURCE_KEYS = ['source', 'product_source'] as const;
/** Sources with their own plain name ("New arrivals", "Featured products"…). */
const NAMED_SOURCES = new Set(['newest', 'featured', 'sale', 'popular']);

/** The product source a section shows: its own value, else the theme default. */
function productSourceOf(def: Pick<SectionDefinition, 'settings'> | undefined, settings?: Record<string, unknown>) {
  for (const key of PRODUCT_SOURCE_KEYS) {
    const value = settings?.[key] ?? def?.settings?.find((s) => s.id === key)?.default;
    if (typeof value === 'string' && NAMED_SOURCES.has(value)) return value;
  }
  return null;
}

/**
 * A part's plain name. Themes reuse one product-grid type for both "new
 * arrivals" and "featured products", so a grid is named by what it shows
 * when it has a product source setting.
 */
export function usePartName() {
  const { t } = useTranslation(['storeDesign', 'themes']);
  return useCallback(
    (type: string, def?: Pick<SectionDefinition, 'name' | 'settings'>, settings?: Record<string, unknown>) => {
      const source = productSourceOf(def, settings);
      if (source) return t(`storeDesign:homepage.parts_by_source.${source}`);
      return t(`storeDesign:homepage.parts.${type}`, {
        defaultValue: t(`themes:sections.${type}.name`, {
          defaultValue: def?.name || t('storeDesign:homepage.unnamed_part'),
        }),
      });
    },
    [t],
  );
}

export function useFieldName() {
  const { t } = useTranslation(['storeDesign', 'themes']);
  return useCallback(
    (setting: Pick<AnySectionSetting, 'id' | 'label'>) =>
      t(`storeDesign:homepage.fields.${setting.id}`, {
        defaultValue: t(`themes:settings.${setting.id}.label`, { defaultValue: setting.label }),
      }),
    [t],
  );
}
