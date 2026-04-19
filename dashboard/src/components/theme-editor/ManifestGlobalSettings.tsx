/**
 * ManifestGlobalSettings — renders global theme settings (colors, typography, layout)
 * and theme-level settings from the manifest schema.
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, Palette, Type, Layout, Settings2 } from 'lucide-react';
import SettingControl from './SettingControl';
import type { SectionSetting } from './types';

interface ManifestGlobalSettingsProps {
  settings: {
    colors: Record<string, string>;
    typography: Record<string, string>;
    layout: Record<string, string> & { containerWidth?: string; maxWidth?: string };
  };
  themeSettings?: SectionSetting[];
  themeSettingValues?: Record<string, unknown>;
  defaultColors?: Record<string, string>;
  defaultTypography?: Record<string, string>;
  onUpdate: (category: 'colors' | 'typography' | 'layout', settings: Record<string, string>) => void;
  onUpdateThemeSetting?: (key: string, value: unknown) => void;
}

const COLOR_LABELS: Record<string, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  accent: 'Accent',
  background: 'Background',
  foreground: 'Text',
  muted: 'Muted Text',
  border: 'Border',
  error: 'Error',
  success: 'Success',
};

const FONT_OPTIONS = [
  { value: 'Inter, system-ui, sans-serif', label: 'Inter' },
  { value: "'Roboto', sans-serif", label: 'Roboto' },
  { value: "'Open Sans', sans-serif", label: 'Open Sans' },
  { value: "'Lato', sans-serif", label: 'Lato' },
  { value: "'Nunito', sans-serif", label: 'Nunito' },
  { value: "'DM Sans', sans-serif", label: 'DM Sans' },
  { value: "'Montserrat', sans-serif", label: 'Montserrat' },
  { value: "system-ui, sans-serif", label: 'System UI' },
  { value: "'Playfair Display', serif", label: 'Playfair Display' },
  { value: "'Merriweather', serif", label: 'Merriweather' },
  { value: "'Lora', serif", label: 'Lora' },
  { value: "'DM Serif Display', serif", label: 'DM Serif Display' },
  { value: "Georgia, serif", label: 'Georgia' },
];

/**
 * Normalize a CSS font-family stack so the dashboard can match a
 * manifest-declared default (e.g. "Nunito, system-ui, sans-serif")
 * against a FONT_OPTIONS entry (e.g. "'Nunito', sans-serif"). Without
 * this, the <select> couldn't pre-select the theme's default and the
 * typography control rendered empty / as the first option (Inter).
 */
function normalizeFontStack(stack: string): string {
  return stack
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, '').toLowerCase())
    .filter(Boolean)
    .join(',');
}

function resolveFontValue(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  const target = normalizeFontStack(raw);
  // Exact match first
  const exact = FONT_OPTIONS.find((f) => f.value === raw);
  if (exact) return exact.value;
  // Match by first (primary) family name, ignoring quotes/case
  const primary = target.split(',')[0];
  const byPrimary = FONT_OPTIONS.find(
    (f) => normalizeFontStack(f.value).split(',')[0] === primary,
  );
  if (byPrimary) return byPrimary.value;
  // Full normalized match
  const full = FONT_OPTIONS.find((f) => normalizeFontStack(f.value) === target);
  return full ? full.value : fallback;
}

export default function ManifestGlobalSettings({
  settings,
  themeSettings,
  themeSettingValues,
  defaultColors,
  defaultTypography,
  onUpdate,
  onUpdateThemeSetting,
}: ManifestGlobalSettingsProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('colors');

  const toggle = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Merge defaults with current values for display
  const displayColors = { ...(defaultColors || {}), ...(settings.colors || {}) };
  const displayTypography = { ...(defaultTypography || {}), ...(settings.typography || {}) };

  return (
    <div className="p-4 space-y-3">
      {/* Theme-level settings (from manifest) */}
      {themeSettings && themeSettings.length > 0 && (
        <CollapsibleSection
          title="Theme Settings"
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
        title="Colors"
        icon={<Palette className="w-4 h-4 text-gray-500" />}
        expanded={expandedSection === 'colors'}
        onToggle={() => toggle('colors')}
      >
        <div className="space-y-4">
          {Object.entries(displayColors).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between">
              <label className="text-sm text-gray-600">
                {COLOR_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^\w/, c => c.toUpperCase())}
              </label>
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
        title="Typography"
        icon={<Type className="w-4 h-4 text-gray-500" />}
        expanded={expandedSection === 'typography'}
        onToggle={() => toggle('typography')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Body Font</label>
            <select
              value={resolveFontValue(displayTypography?.fontFamily, 'Inter, system-ui, sans-serif')}
              onChange={(e) => onUpdate('typography', { fontFamily: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Heading Font</label>
            <select
              value={resolveFontValue(
                displayTypography?.headingFontFamily || displayTypography?.fontFamily,
                'Inter, system-ui, sans-serif',
              )}
              onChange={(e) => onUpdate('typography', { headingFontFamily: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Base Font Size</label>
            <input
              type="text"
              value={displayTypography?.baseFontSize || '16px'}
              onChange={(e) => onUpdate('typography', { baseFontSize: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Line Height</label>
            <input
              type="text"
              value={displayTypography?.lineHeight || '1.5'}
              onChange={(e) => onUpdate('typography', { lineHeight: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Layout */}
      <CollapsibleSection
        title="Layout"
        icon={<Layout className="w-4 h-4 text-gray-500" />}
        expanded={expandedSection === 'layout'}
        onToggle={() => toggle('layout')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Max Content Width</label>
            <input
              type="text"
              value={settings.layout?.containerWidth || settings.layout?.maxWidth || '1280px'}
              onChange={(e) => onUpdate('layout', { containerWidth: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500"
            />
          </div>
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
