/**
 * FeaturesStrip — TONMART-style 3-icon service-promise bar.
 * Renders the merchant's own blocks (icon type + title + subtitle); with
 * none typed, the store's delivery / returns / payment facts
 * (useTrustLines). Never demo promises — hidden when there is nothing.
 */
import React from 'react';
import { useThemeSettings } from '@matjar/theme-shared/theme/ThemeProvider';
import type { SectionComponentProps } from '@matjar/theme-shared/components/sections';
import { merchantText } from '@matjar/theme-shared/theme/heroContent';
import { useTrustLines, type TrustLine } from '@matjar/theme-shared/components/commerce/TrustBadges';

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

// Demo copy older installs stored as literal block settings — treated as unset.
const LEGACY_DEMO_TEXT = new Set([
  'Free US Shipping', 'For US customers on orders above $200',
  'Secure Payment', 'We accept Visa, AmEx, Paypal and more',
  '1 Year Warranty', 'All of our products are made with care',
]);
const blockText = (value: unknown): string => {
  const text = merchantText(value) || '';
  return LEGACY_DEMO_TEXT.has(text) ? '' : text;
};

// Techhub icon for each store trust line.
const TRUST_LINE_ICON: Record<TrustLine['icon'], string> = {
  cash: 'card',
  transfer: 'card',
  truck: 'truck',
  clock: 'truck',
  return: 'refresh',
};

export const FeaturesStripSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  useThemeSettings(id);
  const trustLines = useTrustLines();
  const blocks = (section?.blocks || []) as FeatureBlock[];
  const merchantItems = blocks
    .map((block) => ({
      id: block.id,
      icon: (block.settings.icon as string) || 'truck',
      title: blockText(block.settings.title),
      subtitle: blockText(block.settings.subtitle),
    }))
    .filter((item) => item.title || item.subtitle);
  const items = merchantItems.length > 0
    ? merchantItems
    : trustLines.map((line) => ({ id: line.key, icon: TRUST_LINE_ICON[line.icon], title: line.text, subtitle: '' }));

  if (items.length === 0) return null;

  return (
    <section
      className="border-y py-10"
      style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}
    >
      <div className="max-w-7xl mx-auto px-4">
        <div
          className="grid gap-px"
          style={{
            gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
            backgroundColor: 'var(--color-border)',
          }}
        >
          {items.map((item) => {
            const iconPath = ICONS[item.icon] || ICONS.truck;
            return (
              <div
                key={item.id}
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
                  {item.title && (
                    <h3
                      className="text-sm font-bold uppercase tracking-wide"
                      style={{ color: 'var(--color-foreground)' }}
                    >
                      {item.title}
                    </h3>
                  )}
                  {item.subtitle && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
                      {item.subtitle}
                    </p>
                  )}
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
