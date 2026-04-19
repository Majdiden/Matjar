/**
 * PromoBannerGrid — TONMART-style three-equal promo cards.
 *
 * Each card is a pale panel with a product image on the right, a
 * bold category label, small subtitle, and a "SHOP NOW" pill CTA.
 * Column count configurable via `columns` setting.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useThemeSettings } from '@shared/theme/ThemeProvider';
import type { SectionComponentProps } from '@shared/components/sections';
import { useTranslation } from 'react-i18next';

interface PromoBlock {
  id?: string;
  type?: string;
  settings?: {
    eyebrow?: string;
    title?: string;
    subtitle?: string;
    cta_text?: string;
    cta_url?: string;
    image?: string;
  };
}

const Card: React.FC<{ block: PromoBlock }> = ({ block }) => {
  const { t } = useTranslation(['theme']);
  const b = block.settings || {};
  return (
    <Link
      to={b.cta_url || '/products'}
      className="group relative flex items-center gap-4 rounded-lg border overflow-hidden p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'color-mix(in srgb, var(--color-foreground) 3%, transparent)',
        minHeight: 180,
      }}
    >
      <div className="flex-1 min-w-0">
        {b.eyebrow && (
          <p
            className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1"
            style={{ color: 'var(--color-primary)' }}
          >
            {b.eyebrow}
          </p>
        )}
        <h3
          className="text-lg font-black uppercase tracking-wide mb-1"
          style={{ color: 'var(--color-foreground)' }}
        >
          {b.title || t('theme.section.promo_banner.default_title')}
        </h3>
        <p className="text-[11px] uppercase tracking-wider mb-4" style={{ color: 'var(--color-muted)' }}>
          {b.subtitle || ''}
        </p>
        <span
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-colors group-hover:bg-[color:var(--color-primary)] group-hover:text-white group-hover:border-[color:var(--color-primary)]"
          style={{
            color: 'var(--color-foreground)',
            borderColor: 'var(--color-foreground)',
          }}
        >
          {b.cta_text || t('theme.section.promo_banner.default_cta')}
        </span>
      </div>
      <div className="shrink-0 w-28 h-28 flex items-center justify-center">
        {b.image ? (
          <img
            src={b.image}
            alt={b.title || ''}
            className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div
            className="w-full h-full rounded-lg"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--color-primary) 20%, transparent), transparent 70%)',
            }}
          />
        )}
      </div>
    </Link>
  );
};

export const PromoBannerGridSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const s = useThemeSettings(id);
  const blocks: PromoBlock[] = (section?.blocks as PromoBlock[]) || [];

  if (blocks.length === 0) return null;

  const cols = s.columns === '2' ? 2 : s.columns === '4' ? 4 : 3;

  return (
    <section className="py-10" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="max-w-7xl mx-auto px-4">
        <div
          className="grid gap-5"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {blocks.map((block, i) => (
            <Card key={block.id || `promo-${i}`} block={block} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default PromoBannerGridSection;
