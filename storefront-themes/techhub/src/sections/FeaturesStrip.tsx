/**
 * FeaturesStrip — TONMART-style 3-icon service-promise bar.
 * Pulls block data from section settings (icon type + title + subtitle)
 * and renders them in an equal-width row with minimal dividers.
 */
import React from 'react';
import { useThemeSettings } from '@matjar/theme-shared/theme/ThemeProvider';
import type { SectionComponentProps } from '@matjar/theme-shared/components/sections';
import { useTranslation } from 'react-i18next';

interface FeatureBlock {
  id: string;
  type: string;
  settings: {
    icon?: string;
    title?: string;
    subtitle?: string;
  };
}

const ICONS: Record<string, React.ReactNode> = {
  truck: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h11v8H3zM14 10h4l3 3v2h-7zM7 17a2 2 0 100 2 2 2 0 000-2zm10 0a2 2 0 100 2 2 2 0 000-2z" />
  ),
  shield: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 3v5c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-3zM9 12l2 2 4-4" />
  ),
  headset: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 13v-1a8 8 0 0116 0v1M4 14h3v5H4zM17 14h3v5h-3zM17 19a3 3 0 01-3 3h-2" />
  ),
  refresh: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M5 15a8 8 0 0014 2M19 9a8 8 0 00-14-2" />
  ),
  card: (
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18v12H3zM3 11h18M7 15h2M12 15h5" />
  ),
};

export const FeaturesStripSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const { t } = useTranslation(['theme']);
  useThemeSettings(id);
  const blocks = (section?.blocks || []) as FeatureBlock[];

  if (blocks.length === 0) return null;

  return (
    <section
      className="border-y py-10"
      style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}
    >
      <div className="max-w-7xl mx-auto px-4">
        <div
          className="grid gap-px"
          style={{
            gridTemplateColumns: `repeat(${blocks.length}, minmax(0, 1fr))`,
            backgroundColor: 'var(--color-border)',
          }}
        >
          {blocks.map((block) => {
            const iconKey = (block.settings.icon as string) || 'truck';
            const iconPath = ICONS[iconKey] || ICONS.truck;
            return (
              <div
                key={block.id}
                className="flex items-center gap-4 px-6 py-2"
                style={{ backgroundColor: 'var(--color-background)' }}
              >
                <div
                  className="h-12 w-12 rounded-full flex items-center justify-center shrink-0 border-2"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--color-primary) 40%, transparent)',
                    color: 'var(--color-primary)',
                  }}
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    {iconPath}
                  </svg>
                </div>
                <div className="min-w-0">
                  <h3
                    className="text-sm font-bold uppercase tracking-wide"
                    style={{ color: 'var(--color-foreground)' }}
                  >
                    {block.settings.title || t('theme.section.features_strip.default_title')}
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
                    {block.settings.subtitle || ''}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturesStripSection;
