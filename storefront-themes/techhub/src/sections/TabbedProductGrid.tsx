/**
 * TabbedProductGrid — techhub-specific section.
 *
 * A product grid with inline tabs the shopper can click to switch between
 * curated feeds (Featured, New, Best Sellers, On Sale). Each tab hits the
 * appropriate products query so the grid updates without a page reload.
 *
 * Exposed as section type `tabbed-product-grid`.
 */
import React, { useState } from 'react';
import { useThemeSettings } from '@shared/theme/ThemeProvider';
import { useProducts, useFeaturedProducts } from '@shared/hooks/useProducts';
import { Skeleton } from '@shared/components/primitives/Skeleton';
import { ProductRail } from '@shared/components/commerce/ProductRail';
import { TonmartProductCard } from '../components/TonmartProductCard';
import type { SectionComponentProps } from '@shared/components/sections';
import { useTranslation } from 'react-i18next';

type TabKey = 'featured' | 'newest' | 'best-sellers' | 'on-sale';

const TAB_LABEL_KEYS: Record<TabKey, string> = {
  featured: 'theme.section.tabbed_products.tab_all',
  newest: 'theme.section.tabbed_products.tab_new',
  'best-sellers': 'theme.section.tabbed_products.tab_best_sellers',
  'on-sale': 'theme.section.tabbed_products.tab_on_sale',
};

export const TabbedProductGridSection: React.FC<SectionComponentProps> = ({ id, onQuickView }) => {
  const { t } = useTranslation(['theme']);
  const s = useThemeSettings(id);
  const limit = Math.max(4, Math.min(24, Number(s.product_limit) || 8));
  const columns = Number(s.columns) || 5;

  // Tabs are configurable via a CSV setting but fall back to the full set.
  const rawTabs: string[] = (s.tabs as string[] | undefined) ||
    (typeof s.tabs === 'string' ? (s.tabs as string).split(',').map((t: string) => t.trim()) : []);
  const tabs: TabKey[] = (rawTabs.length
    ? rawTabs
    : ['featured', 'newest', 'best-sellers', 'on-sale']
  ).filter((tab): tab is TabKey => tab in TAB_LABEL_KEYS);

  const [active, setActive] = useState<TabKey>(tabs[0] || 'featured');

  // Run all four queries unconditionally so hook count stays stable as the
  // user clicks between tabs — the unused results are just ignored.
  const featured = useFeaturedProducts(limit);
  const newest = useProducts({ sort: 'newest', limit });
  const bestSellers = useProducts({ sort: 'popular', limit });
  const onSale = useProducts({ onSale: 1, limit });

  const sources: Record<TabKey, { products: any[]; loading: boolean }> = {
    featured,
    newest,
    'best-sellers': bestSellers,
    'on-sale': onSale,
  };

  const current = sources[active];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h2
          className="text-xl md:text-2xl font-black uppercase tracking-wide"
          style={{ color: 'var(--color-foreground)' }}
        >
          {s.heading || t('theme.section.tabbed_products.title')}
        </h2>

        {/* Pill-tab switcher */}
        <div role="tablist" className="flex items-center gap-2 flex-wrap">
          {tabs.map((tab) => {
            const isActive = tab === active;
            return (
              <button
                key={tab}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(tab)}
                className="px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all"
                style={{
                  backgroundColor: isActive
                    ? 'color-mix(in srgb, var(--color-primary) 18%, transparent)'
                    : 'transparent',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-muted)',
                  border: `1px solid ${isActive ? 'color-mix(in srgb, var(--color-primary) 40%, transparent)' : 'var(--color-border)'}`,
                }}
              >
                {t(TAB_LABEL_KEYS[tab])}
              </button>
            );
          })}
        </div>
      </div>

      {current.loading ? (
        <div
          className="grid gap-6"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: limit }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : current.products.length === 0 ? (
        <div
          className="py-16 text-center rounded-2xl border"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
        >
          {t('theme.section.tabbed_products.empty')}
        </div>
      ) : (
        <ProductRail columns={Math.min(5, Math.max(2, columns)) as 2 | 3 | 4 | 5}>
          {current.products.slice(0, limit).map((p) => (
            <TonmartProductCard
              key={p._id}
              product={p}
              onQuickView={s.show_quick_view !== false ? onQuickView : undefined}
            />
          ))}
        </ProductRail>
      )}
    </section>
  );
};

export default TabbedProductGridSection;
