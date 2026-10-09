/**
 * Simple-mode levels (PBI 10).
 *
 * The phone-first simple editor shows only `basic` settings; the full editor
 * shows everything. Settings default to `advanced` (opt in to simple mode),
 * sections default to `basic` (every section can be shown, hidden and moved
 * in simple mode; only its basic settings are editable there).
 *
 * The backend mirror of these constants lives in utils/themeManifestRules.js
 * (manifest validation); tests/unit/themeBindingsParity.test.js keeps the two
 * in sync.
 */
import type { SettingLevel } from '../types/theme';

export const SETTING_LEVELS: readonly SettingLevel[] = Object.freeze(['basic', 'advanced'] as const);

/** Level of a setting that does not declare one. */
export const DEFAULT_SETTING_LEVEL: SettingLevel = 'advanced';

/** Level of a section that does not declare one. */
export const DEFAULT_SECTION_LEVEL: SettingLevel = 'basic';

/** Most `basic` settings a section may declare (enforced by the validator). */
export const MAX_BASIC_SETTINGS_PER_SECTION = 4;

/** True when the setting is editable in the simple editor. */
export function isBasicSetting(setting: { level?: SettingLevel | string } | null | undefined): boolean {
  return (setting?.level ?? DEFAULT_SETTING_LEVEL) === 'basic';
}

/** True when the section is listed in the simple editor. */
export function isBasicSection(section: { level?: SettingLevel | string } | null | undefined): boolean {
  return (section?.level ?? DEFAULT_SECTION_LEVEL) === 'basic';
}

/** The settings of a section the simple editor shows, in manifest order. */
export function basicSettingsOf<T extends { level?: SettingLevel | string }>(
  section: { settings?: T[] } | null | undefined,
): T[] {
  return (Array.isArray(section?.settings) ? section!.settings! : []).filter(isBasicSetting);
}
