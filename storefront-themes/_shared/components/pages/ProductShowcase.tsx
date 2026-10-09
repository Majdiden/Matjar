import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { storefrontApi } from '../../api/client';
import { localizeProducts } from '../../hooks/useProducts';
import { useLanguage } from '../../i18n/LanguageProvider';
import { useThemeCard } from '../../theme/ThemeCardProvider';
import { FG, BORDER, tint, usePageStyleTokens } from '../../theme/pageStyle';
import ProductCard from '../ProductCard';
import { PageContainer, SectionHeading } from './PageLayout';
import { PageIcon } from './PageIcon';

/** How many products the "What we sell" strip shows. */
export const SHOWCASE_LIMIT = 4;

/** Featured products, or the newest ones when none are featured. */
function useShowcaseProducts(limit: number): { products: any[]; loading: boolean } {
  const [raw, setRaw] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { lang } = useLanguage();

  useEffect(() => {
    let active = true;
    storefrontApi
      .getFeaturedProducts(limit)
      .then((res: any) => res?.data?.products || [])
      .catch(() => [])
      .then((featured: any[]) =>
        featured.length
          ? featured
          : storefrontApi
              .getProducts({ sort: 'newest', limit })
              .then((res: any) => res?.data?.products || [])
              .catch(() => []),
      )
      .then((list: any[]) => { if (active) setRaw(list.slice(0, limit)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [limit]);

  const products = useMemo(() => localizeProducts(raw, lang), [raw, lang]);
  return { products, loading };
}

/**
 * "What we sell": up to four of the store's products drawn with the theme's
 * own product card, and a link to the full catalogue. Hidden for a store
 * with no products yet.
 */
export const ProductShowcase: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useTranslation('generated');
  const tk = usePageStyleTokens();
  const themeCard = useThemeCard();
  const { products, loading } = useShowcaseProducts(SHOWCASE_LIMIT);

  if (!loading && !products.length) return null;

  return (
    <section className={className} aria-labelledby="page-showcase-title">
      <PageContainer wide>
        <SectionHeading id="page-showcase-title" eyebrow={t('pages.showcase.eyebrow')} title={t('pages.showcase.title')} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {loading
            ? Array.from({ length: SHOWCASE_LIMIT }, (_, i) => (
                <div key={i} aria-hidden="true" className="animate-pulse">
                  <div className="aspect-square" style={{ background: tint(8), borderRadius: tk.radius }} />
                  <div className="h-3 mt-3 w-3/4" style={{ background: tint(8), borderRadius: tk.radius }} />
                  <div className="h-3 mt-2 w-1/3" style={{ background: tint(8), borderRadius: tk.radius }} />
                </div>
              ))
            : products.map((p) => (
                <div key={p._id} className="min-w-0">
                  {themeCard ? themeCard(p) : <ProductCard product={p} />}
                </div>
              ))}
        </div>
        <div className="mt-6 sm:mt-8 flex justify-center">
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ ...tk.button, color: FG, border: `1px solid ${tk.style === 'bold' ? tint(40) : BORDER}` }}
          >
            <span>{t('pages.showcase.see_all')}</span>
            <PageIcon name="arrow" className="w-4 h-4" />
          </Link>
        </div>
      </PageContainer>
    </section>
  );
};

export default ProductShowcase;
