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

export function usePartName() {
  const { t } = useTranslation(['storeDesign', 'themes']);
  return useCallback(
    (type: string, def?: Pick<SectionDefinition, 'name'>) =>
      t(`storeDesign:homepage.parts.${type}`, {
        defaultValue: t(`themes:sections.${type}.name`, {
          defaultValue: def?.name || t('storeDesign:homepage.unnamed_part'),
        }),
      }),
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
