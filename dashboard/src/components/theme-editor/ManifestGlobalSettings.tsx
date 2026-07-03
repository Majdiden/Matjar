/**
 * ManifestGlobalSettings — renders global theme settings (colors, typography, layout)
 * and theme-level settings from the manifest schema.
 *
 * Manifest-driven since audit 1.4:
 *   - Colour tokens iterate the manifest palette; labels come from the
 *     i18n bundle (stable keys), then the manifest's `colorLabels`
 *     (guaranteed unique per manifest), then a humanized key.
 *   - Font selects merge the theme's manifest-declared fonts (its
 *     Google Fonts) ahead of the platform list.
 *   - The layout panel exposes every key present in the manifest's
 *     layout defaults, rendered via SettingControl by inferred type.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Palette, Type, Layout, Settings2 } from 'lucide-react';
import SettingControl from './SettingControl';
import type {
  AnySectionSetting,
  SectionSetting,
  ThemeFontOption,
} from '@matjar/theme-shared/types/theme';

interface ManifestGlobalSettingsProps {
  settings: {
    colors: Record<string, string>;
    typography: Record<string, string>;
    layout: Record<string, string> & { containerWidth?: string; maxWidth?: string };
  };
  themeSettings?: SectionSetting[];
  themeSettingValues?: Record<string, unknown>;
  defaultColors?: Record<string, string>;
  /** Unique per-manifest colour-token labels (defineTheme fills these). */
  colorLabels?: Record<string, string>;
  defaultTypography?: Record<string, string>;
  /** Manifest layout defaults — drives which layout controls render. */
  defaultLayout?: Record<string, string>;
  /** Theme-shipped fonts, merged ahead of the platform font list. */
  manifestFonts?: ThemeFontOption[];
  onUpdate: (category: 'colors' | 'typography' | 'layout', settings: Record<string, string>) => void;
  onUpdateThemeSetting?: (key: string, value: unknown) => void;
}

const FONT_OPTIONS: ThemeFontOption[] = [
  { value: 'Inter, system-ui, sans-serif', label: 'Inter' },
  { value: "'Roboto', sans-serif", label: 'Roboto' },
  { value: "'Open Sans', sans-serif", label: 'Open Sans' },
  { value: "'Lato', sans-serif", label: 'Lato' },
  { value: "'Nunito', sans-serif", label: 'Nunito' },
  { value: "'DM Sans', sans-serif", label: 'DM Sans' },
  { value: "'Montserrat', sans-serif", label: 'Montserrat' },
  { value: 'system-ui, sans-serif', label: 'System UI' },
  { value: "'Playfair Display', serif", label: 'Playfair Display' },
  { value: "'Merriweather', serif", label: 'Merriweather' },
  { value: "'Lora', serif", label: 'Lora' },
  { value: "'DM Serif Display', serif", label: 'DM Serif Display' },
  { value: 'Georgia, serif', label: 'Georgia' },
];

/**
 * Normalize a CSS font-family stack so the dashboard can match a
 * manifest-declared default (e.g. "Nunito, system-ui, sans-serif")
 * against a font option (e.g. "'Nunito', sans-serif"). Without this,
 * the <select> couldn't pre-select the theme's default and the
 * typography control rendered empty / as the first option (Inter).
 */
function normalizeFontStack(stack: string): string {
  return stack
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, '').toLowerCase())
    .filter(Boolean)
    .join(',');
}

function primaryFamily(stack: string): string {
  return normalizeFontStack(stack).split(',')[0] || '';
}

/**
 * Merge manifest fonts ahead of the platform list, deduping by primary
 * family name so "Inter" doesn't appear twice.
 */
function mergeFonts(manifestFonts: ThemeFontOption[] | undefined): ThemeFontOption[] {
  const merged: ThemeFontOption[] = [];
  const seen = new Set<string>();
  for (const f of [...(manifestFonts || []), ...FONT_OPTIONS]) {
    const value = f.stack || f.value;
    const key = primaryFamily(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push({ label: f.label, value });
  }
  return merged;
}

function resolveFontValue(
  fonts: ThemeFontOption[],
  raw: string | undefined,
  fallback: string,
): string {
  if (!raw) return fallback;
  const target = normalizeFontStack(raw);
  // Exact match first
  const exact = fonts.find((f) => f.value === raw);
  if (exact) return exact.value;
  // Match by first (primary) family name, ignoring quotes/case
  const primary = target.split(',')[0];
  const byPrimary = fonts.find((f) => primaryFamily(f.value) === primary);
  if (byPrimary) return byPrimary.value;
  // Full normalized match
  const full = fonts.find((f) => normalizeFontStack(f.value) === target);
  return full ? full.value : fallback;
}

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

export default function ManifestGlobalSettings({
  settings,
  themeSettings,
  themeSettingValues,
  defaultColors,
  colorLabels,
  defaultTypography,
  defaultLayout,
  manifestFonts,
  onUpdate,
  onUpdateThemeSetting,
}: ManifestGlobalSettingsProps) {
  const { t } = useTranslation('themes');
  const [expandedSection, setExpandedSection] = useState<string | null>('colors');

  const toggle = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const fonts = mergeFonts(manifestFonts);

  // The manifest palette is the source of truth for WHICH colour tokens
  // exist — stray legacy keys in the tenant doc (e.g. `text`,
  // `textSecondary` from the pre-manifest default bag) would otherwise
  // render duplicate-looking rows (two "Text" tokens, audit 3.9.6).
  // Only when no manifest is available do we fall back to showing every
  // stored key.
  const manifestColorKeys = Object.keys(defaultColors || {});
  const displayColors: Record<string, string> =
    manifestColorKeys.length > 0
      ? Object.fromEntries(
          manifestColorKeys.map((key) => [
            key,
            settings.colors?.[key] ?? (defaultColors || {})[key] ?? '',
          ])
        )
      : { ...(settings.colors || {}) };
  const displayTypography = { ...(defaultTypography || {}), ...(settings.typography || {}) };

  // Stable-id i18n first (ar stays translated), then the manifest's
  // unique label, then a humanized key as the last resort.
  const colorLabel = (key: string): string =>
    t(`themes:editor.color_labels.${key}`, {
      defaultValue: colorLabels?.[key] || humanizeKey(key),
    });

  // ── Layout controls: one per key in the manifest layout defaults ──
  const layoutKeys = Object.keys(defaultLayout || {});
  const effectiveLayoutKeys = layoutKeys.length > 0 ? layoutKeys : ['maxWidth'];

  const layoutSettingFor = (key: string): AnySectionSetting => {
    const label = t(`themes:editor.layout_labels.${key}`, { defaultValue: humanizeKey(key) });
    if (key === 'headerStyle' || key === 'footerStyle') {
      const values = key === 'headerStyle'
        ? ['standard', 'centered', 'minimal']
        : ['standard', 'minimal', 'expanded'];
      // A theme may ship a bespoke keyword (e.g. elegance's
      // "transparent" header) — surface it as a selectable option so
      // the select doesn't silently display the wrong value.
      const current = layoutValueFor(key);
      if (current && !values.includes(current)) values.unshift(current);
      return {
        id: key,
        type: 'select',
        label,
        options: values.map((v) => ({
          value: v,
          label: t(`themes:editor.layout_options.${v}`, { defaultValue: humanizeKey(v) }),
        })),
      };
    }
    return { id: key, type: 'text', label };
  };

  const layoutValueFor = (key: string): string => {
    const stored = settings.layout?.[key];
    if (stored !== undefined && stored !== '') return stored;
    // Legacy tenants stored the content width under `containerWidth`.
    if (key === 'maxWidth' && settings.layout?.containerWidth) {
      return settings.layout.containerWidth;
    }
    return (defaultLayout || {})[key] ?? (key === 'maxWidth' ? '1280px' : '');
  };

  const handleLayoutChange = (key: string, value: string) => {
    // Keep the legacy `containerWidth` alias in sync when editing the
    // content width so older readers of the stored bag stay coherent.
    if (key === 'maxWidth') {
      onUpdate('layout', { maxWidth: value, containerWidth: value });
    } else {
      onUpdate('layout', { [key]: value });
    }
  };

  return (
    <div className="p-4 space-y-3">
      {/* Theme-level settings (from manifest) */}
      {themeSettings && themeSettings.length > 0 && (
        <CollapsibleSection
          title={t('themes:editor.global_settings.title')}
          icon={<Settings2 className="w-4 h-4 text-gray-500" />}
          expanded={expandedSection === 'theme'}
          onToggle={() => toggle('theme')}
        >
          <div className="space-y-4">
            {themeSettings.map((setting) => (
              <SettingControl
                key={setting.id}
                setting={setting}
                value={themeSettingValues?.[setting.id]}
                onChange={(v) => onUpdateThemeSetting?.(setting.id, v)}
              />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Colors */}
      <CollapsibleSection
        title={t('themes:editor.global_settings.colors')}
        icon={<Palette className="w-4 h-4 text-gray-500" />}
        expanded={expandedSection === 'colors'}
        onToggle={() => toggle('colors')}
      >
        <div className="space-y-4">
          {Object.entries(displayColors).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between">
              <label className="text-sm text-gray-600">{colorLabel(key)}</label>
              <div className="flex items-center gap-2">
                <div className="relative w-8 h-8 rounded-full border border-gray-200 overflow-hidden shadow-sm">
                  <input
                    type="color"
                    value={value || '#000000'}
                    onChange={(e) => onUpdate('colors', { [key]: e.target.value })}
                    className="absolute inset-0 w-[150%] h-[150%] -top-1/4 -start-1/4 cursor-pointer p-0 border-0"
                  />
                </div>
                <input
                  type="text"
                  value={value || '#000000'}
                  onChange={(e) => onUpdate('colors', { [key]: e.target.value })}
                  className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Typography */}
      <CollapsibleSection
        title={t('themes:editor.global_settings.typography')}
        icon={<Type className="w-4 h-4 text-gray-500" />}
        expanded={expandedSection === 'typography'}
        onToggle={() => toggle('typography')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t('themes:editor.global_settings.body_font')}</label>
            <select
              value={resolveFontValue(fonts, displayTypography?.fontFamily, 'Inter, system-ui, sans-serif')}
              onChange={(e) => onUpdate('typography', { fontFamily: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500"
            >
              {fonts.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t('themes:editor.global_settings.heading_font')}</label>
            <select
              value={resolveFontValue(
                fonts,
                displayTypography?.headingFontFamily || displayTypography?.fontFamily,
                'Inter, system-ui, sans-serif',
              )}
              onChange={(e) => onUpdate('typography', { headingFontFamily: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500"
            >
              {fonts.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t('themes:editor.global_settings.base_font_size')}</label>
            <input
              type="text"
              value={displayTypography?.baseFontSize || '16px'}
              onChange={(e) => onUpdate('typography', { baseFontSize: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{t('themes:editor.global_settings.line_height')}</label>
            <input
              type="text"
              value={displayTypography?.lineHeight || '1.5'}
              onChange={(e) => onUpdate('typography', { lineHeight: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Layout — every key the manifest declares, not just width */}
      <CollapsibleSection
        title={t('themes:editor.global_settings.layout')}
        icon={<Layout className="w-4 h-4 text-gray-500" />}
        expanded={expandedSection === 'layout'}
        onToggle={() => toggle('layout')}
      >
        <div className="space-y-4">
          {effectiveLayoutKeys.map((key) => (
            <SettingControl
              key={key}
              setting={layoutSettingFor(key)}
              value={layoutValueFor(key)}
              onChange={(v) => handleLayoutChange(key, String(v ?? ''))}
            />
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}

function CollapsibleSection({
  title,
  icon,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-sm text-gray-900">{title}</span>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400 rtl:rotate-180" />
        )}
      </button>
      {expanded && <div className="p-4">{children}</div>}
    </div>
  );
}
