/**
 * Techhub overrides for the universal product feed sections so any
 * merchant-added `featured-products` / `new-arrivals` / `product-grid`
 * block renders with TonmartProductCard instead of the generic
 * `_shared` ProductCard.
 *
 * These are drop-in replacements registered into TECHHUB_SECTION_REGISTRY
 * and shadow the defaults from DEFAULT_SECTION_REGISTRY.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useThemeSettings } from '@shared/theme/ThemeProvider';
import { useFeaturedProducts, useProducts } from '@shared/hooks/useProducts';
import { Skeleton } from '@shared/components/primitives/Skeleton';
import type { SectionComponentProps } from '@shared/components/sections';
import { TonmartProductCard } from '../components/TonmartProductCard';
import { useTranslation } from 'react-i18next';

const Header: React.FC<{ title: string; subtitle?: string; viewAllHref?: string }> = ({
  title,
  subtitle,
  viewAllHref,
}) => {
  const { t } = useTranslation(['theme']);
  return (
    <div className="flex items-end justify-between mb-8">
      <div>
        <h2
          className="text-xl md:text-2xl font-black uppercase tracking-wide"
          style={{ color: 'var(--color-foreground)' }}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {viewAllHref && (
        <Link
          to={viewAllHref}
          className="text-[11px] font-bold uppercase tracking-wider hover:opacity-70 inline-flex items-center gap-1"
          style={{ color: 'var(--color-primary)' }}
        >
          {t('theme.section.tonmart_feeds.view_all')}
          <span aria-hidden className="rtl:rotate-180 inline-block">→</span>
        </Link>
      )}
    </div>
  );
};

/** Drop-in replacement for FeaturedProductsSection. */
export const TonmartFeaturedProductsSection: React.FC<SectionComponentProps> = ({
  id,
  onQuickView,
}) => {
  const { t } = useTranslation(['theme']);
  const s = useThemeSettings(id);
  const limit = Number(s.product_limit) || 8;
  const { products, loading } = useFeaturedProducts(limit);
  const cols = Math.min(5, Math.max(2, Number(s.columns) || 4));

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
      <Header
        title={s.heading || t('theme.section.tonmart_feeds.featured_heading')}
        subtitle={s.subheading}
        viewAllHref={s.view_all_url || '/products'}
      />
      {loading ? (
        <div
          className="grid gap-8"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-xl" />
          ))}
        </div>
      ) : (
        <div
          className="grid gap-8"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {products.map((p: any) => (
            <TonmartProductCard key={p._id} product={p} onQuickView={onQuickView} />
          ))}
        </div>
      )}
    </section>
  );
};

/** Drop-in replacement for NewArrivalsSection. */
export const TonmartNewArrivalsSection: React.FC<SectionComponentProps> = ({
  id,
  onQuickView,
}) => {
  const { t } = useTranslation(['theme']);
  const s = useThemeSettings(id);
  const limit = Number(s.product_limit) || 8;
  const { products, loading } = useProducts({ sort: 'newest', limit });
  const cols = Math.min(5, Math.max(2, Number(s.columns) || 4));

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
      <Header
        title={s.heading || t('theme.section.tonmart_feeds.new_arrivals_heading')}
        subtitle={s.subheading}
        viewAllHref={s.view_all_url || '/products?sort=newest'}
      />
      {loading ? (
        <div
          className="grid gap-8"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-xl" />
          ))}
        </div>
      ) : (
        <div
          className="grid gap-8"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {products.map((p: any) => (
            <TonmartProductCard key={p._id} product={p} onQuickView={onQuickView} />
          ))}
        </div>
      )}
    </section>
  );
};

/** Generic product-grid override — some dashboard seeds use this slug. */
export const TonmartProductGridSection: React.FC<SectionComponentProps> = ({
  id,
  onQuickView,
}) => {
  const { t } = useTranslation(['theme']);
  const s = useThemeSettings(id);
  const limit = Number(s.product_limit) || 8;
  const sort = (s.sort as string) || 'newest';
  const { products, loading } = useProducts({ sort, limit });
  const cols = Math.min(5, Math.max(2, Number(s.columns) || 4));

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
      <Header
        title={s.heading || t('theme.section.tonmart_feeds.shop_products_heading')}
        subtitle={s.subheading}
        viewAllHref={s.view_all_url || '/products'}
      />
      {loading ? (
        <div
          className="grid gap-8"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-xl" />
          ))}
        </div>
      ) : (
        <div
          className="grid gap-8"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {products.map((p: any) => (
            <TonmartProductCard key={p._id} product={p} onQuickView={onQuickView} />
          ))}
        </div>
      )}
    </section>
  );
};
