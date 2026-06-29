/**
 * HeroShowcase — imagery-forward product spotlight hero.
 *
 * Migrated to the shared <Hero> component (spotlight variant, dark tone) so
 * the techhub hero is image-first and token-driven like the rest of the
 * storefront catalogue. The merchant's existing hero-showcase settings are
 * preserved: `eyebrow`, `heading_line1` / `heading_line2`, the primary button
 * text/url, and `product_source` (which now selects the spotlight product
 * photo shown as the hero media).
 */
import React from 'react';
import { useThemeSettings } from '@shared/theme/ThemeProvider';
import { useFeaturedProducts, useProducts } from '@shared/hooks/useProducts';
import { Hero } from '@shared/components/sections/Hero';
import type { SectionComponentProps } from '@shared/components/sections';
import { useTranslation } from 'react-i18next';

// Niche default hero image (electronics) so the spotlight hero is never empty.
const HERO_DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=1600&q=80&auto=format&fit=crop';

export const HeroShowcaseSection: React.FC<SectionComponentProps> = ({ id }) => {
  const { t } = useTranslation(['theme']);
  const s = useThemeSettings(id);

  // Honour the merchant's `product_source` setting: pick the spotlight product
  // photo (featured vs newest) to use as the hero media.
  const source: 'featured' | 'newest' = s.product_source === 'newest' ? 'newest' : 'featured';
  const { products: featured } = useFeaturedProducts(1);
  const { products: newest } = useProducts({ sort: 'newest', limit: 1 });
  const spotlight = (source === 'newest' ? newest : featured)[0];

  // Two-line headline joins with a space (keeps both i18n fallback keys live).
  const line1 = s.heading_line1 || t('theme.hero.showcase.headline_line1');
  const line2 = s.heading_line2 || t('theme.hero.showcase.headline_line2');
  const title = [line1, line2].filter(Boolean).join(' ');

  return (
    <Hero
      variant="spotlight"
      tone="dark"
      title={title}
      primaryCta={{
        label: s.primary_button_text || t('theme.hero.showcase.cta'),
        href: (s.primary_button_url as string) || '/products',
      }}
      saleText={s.eyebrow || t('theme.hero.showcase.eyebrow')}
      media={spotlight?.images?.[0]}
      defaultImage={HERO_DEFAULT_IMAGE}
    />
  );
};

export default HeroShowcaseSection;
