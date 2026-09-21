import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProduct, productContentSections } from '@matjar/theme-shared/hooks/useProducts';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { useWishlist } from '@matjar/theme-shared/hooks/useWishlist';
import { useThemeSetting, useTemplateSections } from '@matjar/theme-shared/theme/ThemeProvider';
import { ProductProvider } from '@matjar/theme-shared/contexts/ProductContext';
import { ImageZoom } from '@matjar/theme-shared/components/commerce/ImageZoom';
import ProductReviews from '@matjar/theme-shared/components/commerce/ProductReviews';
import ProductDescription from '@matjar/theme-shared/components/commerce/ProductDescription';
import { RatingStars } from '@matjar/theme-shared/components/commerce/RatingStars';
import { ProductRail } from '@matjar/theme-shared/components/commerce/ProductRail';
import { getPreorderState } from '@matjar/theme-shared/utils/preorder';
import type { Variant } from '@matjar/theme-shared/components/commerce/VariantPicker';
import { LINEN_SECTION_REGISTRY } from '../sections';
import { LinenProductCard } from '../components/LinenProductCard';
import { PillVariantPicker } from '../components/PillVariantPicker';
import { Reveal } from '../lib/Reveal';
import { I } from '../lib/icons';

const PLACEHOLDER = 'https://placehold.co/900x900/ecdec1/0f0f0f?text=%20';

const Accordion: React.FC<{ title: string; open: boolean; onToggle: () => void; children: React.ReactNode }> = ({ title, open, onToggle, children }) => (
  <div className="border-t border-line">
    <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between py-4 text-start">
      <span className="font-heading text-lg text-ink">{title}</span>
      <span className={`grid h-7 w-7 place-items-center text-dune transition-transform duration-300 ${open ? 'rotate-45' : ''}`}><I.plus className="h-4 w-4" /></span>
    </button>
    <div className={`grid transition-[grid-template-rows] duration-300 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
      <div className="overflow-hidden"><div className="pb-5 text-[0.95rem] text-dune">{children}</div></div>
    </div>
  </div>
);

const ProductDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { product, reviews, relatedProducts, ratingDistribution, loading, error } = useProduct(slug!);
  const { store, formatPrice } = useStore();
  const { addItem, openCart } = useCart();
  const wishlist = useWishlist();
  const { t, i18n } = useTranslation(['theme']);
  const banner = useThemeSetting<string>('pdp_banner_image');
  const productSections = useTemplateSections('product');

  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [buying, setBuying] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [activeVariant, setActiveVariant] = useState<Variant | null>(null);
  const [openKey, setOpenKey] = useState<string | null>('description');
  const [copied, setCopied] = useState(false);
  const onVariant = useCallback((v: Variant | null) => setActiveVariant(v), []);

  useEffect(() => { setImgIdx(0); setQty(1); setSelection({}); setOpenKey('description'); }, [slug]);
  useEffect(() => {
    if (!activeVariant?.image || !product?.images) return;
    const i = product.images.findIndex((s: string) => s === activeVariant.image);
    if (i >= 0) setImgIdx(i);
  }, [activeVariant?.image, product?.images]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6">
        <div className="grid animate-pulse gap-12 md:grid-cols-2"><div className="aspect-square bg-sand" /><div className="space-y-4"><div className="h-10 w-3/4 bg-sand" /><div className="h-6 w-1/4 bg-sand" /><div className="h-40 bg-sand" /></div></div>
      </div>
    );
  }
  if (error || !product) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-32 text-center">
        <h1 className="font-heading text-4xl text-ink">{t('theme.product_detail.not_found_heading')}</h1>
        <p className="mt-3 text-dune">{t('theme.product_detail.not_found_body')}</p>
        <Link to="/products" className="linen-btn linen-btn-solid mt-8">{t('theme.product_detail.back_to_shop')}</Link>
      </div>
    );
  }

  const images: string[] = product.images?.length ? product.images : [PLACEHOLDER];
  const price = activeVariant?.price ?? product.price ?? 0;
  const compareAt = activeVariant?.compareAtPrice ?? product.compareAtPrice ?? 0;
  const onSale = compareAt > price;
  const inStock = (activeVariant?.stock ?? product.stock ?? 0) > 0;
  const hasOptions = Array.isArray(product.options) && product.options.length > 0;
  const needsSelection = hasOptions && !activeVariant;
  const pre = getPreorderState(product as any, activeVariant as any, { price, requiresSelection: needsSelection, adding });
  const isPreorder = pre.mode === 'preorder';
  const canAdd = (inStock || !!pre.config) && !adding && !buying && !needsSelection && !pre.ctaDisabled;
  const wishlisted = wishlist.includes(product._id);
  const contentSections = productContentSections(product, i18n.language);
  const policies = store?.policies || {};
  const shippingPolicy = policies.delivery || policies.shipping || policies.returns || null;

  const add = async () => {
    if (!canAdd) return;
    setAdding(true);
    try { await addItem(product._id, qty, activeVariant?._id); openCart?.(); } finally { setAdding(false); }
  };
  const buyNow = async () => {
    if (!canAdd) return;
    setBuying(true);
    try { await addItem(product._id, qty, activeVariant?._id); navigate('/checkout'); } finally { setBuying(false); }
  };
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title: product.name, url }); return; }
      await navigator.clipboard.writeText(url);
      setCopied(true); window.setTimeout(() => setCopied(false), 1800);
    } catch {}
  };
  const ctaLabel = isPreorder ? (adding ? t('theme.product_detail.reserving') : t('theme.product_detail.preorder')) : pre.mode === 'soldOut' || !inStock && !pre.config ? t('theme.product_detail.sold_out') : adding ? t('theme.product_detail.adding') : t('theme.product_detail.add_to_cart');

  return (
    <div>
      <div className="relative flex min-h-[200px] items-center justify-center overflow-hidden bg-ink sm:min-h-[260px]">
        {banner && <img src={banner} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative w-full px-4 py-12 text-center text-cream">
          <p className="linen-eyebrow text-white/85"><Link to="/" className="hover:text-cream">{t('theme.nav.home')}</Link> <span className="mx-2">•</span> <Link to="/products" className="hover:text-cream">{t('theme.nav.all_products')}</Link></p>
          <h1 className="font-heading mt-3 text-3xl sm:text-5xl">{product.name}</h1>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 md:py-16">
        <div className="grid gap-10 md:grid-cols-2 md:gap-14 lg:grid-cols-[1.1fr_1fr]">
          {/* Gallery */}
          <div className="md:sticky md:top-24 md:self-start">
            <div className="relative aspect-square overflow-hidden bg-tint-strong">
              <ImageZoom src={images[imgIdx] || images[0]} alt={product.name} fit="cover" className="h-full w-full" />
              {onSale && <span className="absolute start-4 top-4 rounded-full bg-ink px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-cream">−{Math.round(((compareAt - price) / compareAt) * 100)}%</span>}
              {images.length > 1 && (
                <>
                  <button type="button" onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)} className="absolute start-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-cream text-ink transition-colors hover:bg-bronze hover:text-cream" aria-label={t('theme.section.hero.prev')}><I.chevronLeft className="h-5 w-5 rtl:-scale-x-100" /></button>
                  <button type="button" onClick={() => setImgIdx((i) => (i + 1) % images.length)} className="absolute end-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-cream text-ink transition-colors hover:bg-bronze hover:text-cream" aria-label={t('theme.section.hero.next')}><I.chevronRight className="h-5 w-5 rtl:-scale-x-100" /></button>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                {images.map((src, i) => (
                  <button key={i} type="button" onClick={() => setImgIdx(i)} aria-label={`${i + 1}`} aria-pressed={i === imgIdx} className={`h-20 w-20 shrink-0 overflow-hidden border transition-all duration-300 ${i === imgIdx ? 'border-bronze opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                    <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <p className="linen-eyebrow text-clay">{product.category?.name || ''}</p>
            <h2 className="font-heading mt-2 text-3xl leading-tight text-ink sm:text-4xl">{product.name}</h2>
            {(product.reviewCount ?? 0) > 0 && <div className="mt-3"><RatingStars rating={product.averageRating || product.rating || 0} reviewCount={product.reviewCount} showCount /></div>}
            <p className="mt-4 text-2xl text-ink">
              {onSale && <s className="me-3 text-lg text-dune">{formatPrice(compareAt)}</s>}
              <span className={onSale ? 'font-bold text-clay' : ''}>{formatPrice(pre.effectivePrice ?? price)}</span>
            </p>
            {product.shortDescription && <p className="mt-4 text-dune">{product.shortDescription}</p>}

            {hasOptions && (
              <div className="mt-8">
                <PillVariantPicker options={product.options} variants={product.variants || []} selection={selection} onSelectionChange={setSelection} onVariantChange={onVariant} />
              </div>
            )}

            <div className="mt-6 text-sm">
              {isPreorder ? (
                <p className="flex items-center gap-2 text-clay"><span className="h-2 w-2 rounded-full bg-bronze" />{t('theme.product_detail.preorder_note')}{pre.shipByLabel ? ` · ${pre.shipByLabel}` : ''}{pre.lowRemaining && pre.remaining !== null ? ` · ${t('theme.product_detail.only_left', { count: pre.remaining })}` : ''}</p>
              ) : inStock ? (
                <p className="flex items-center gap-2 text-[color:var(--color-success)]"><I.check className="h-4 w-4" />{t('theme.product_detail.in_stock')}</p>
              ) : (
                <p className="text-[color:var(--color-error)]">{t('theme.product_detail.sold_out')}</p>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <div className="flex h-14 items-center border border-line">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-full w-12 place-items-center text-ink hover:bg-sand" aria-label={t('theme.product_detail.decrease')}><I.minus className="h-4 w-4" /></button>
                <input aria-label={t('theme.product_detail.quantity')} value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))} className="h-full w-12 bg-transparent text-center text-ink outline-none" />
                <button type="button" onClick={() => setQty((q) => q + 1)} className="grid h-full w-12 place-items-center text-ink hover:bg-sand" aria-label={t('theme.product_detail.increase')}><I.plus className="h-4 w-4" /></button>
              </div>
              <button type="button" onClick={add} disabled={!canAdd} className="linen-btn linen-btn-solid h-14 flex-1">{ctaLabel}</button>
            </div>
            <button type="button" onClick={() => wishlist.toggle(product._id, { _id: product._id, name: product.name, slug: product.slug, price: product.price, images: product.images })} aria-pressed={wishlisted} className={`linen-btn mt-3 h-14 w-full ${wishlisted ? 'linen-btn-dark' : 'linen-btn-outline'}`}>
              <I.heart className="h-4 w-4" fill={wishlisted ? 'currentColor' : 'none'} /> {wishlisted ? t('theme.product_detail.wishlisted') : t('theme.product_detail.add_to_wishlist')}
            </button>
            <button type="button" onClick={buyNow} disabled={!canAdd} className="linen-btn linen-btn-dark mt-3 h-14 w-full">{buying ? t('theme.product_detail.adding') : t('theme.product_detail.buy_now')}</button>

            <div className="mt-8">
              <Accordion title={t('theme.product_detail.description')} open={openKey === 'description'} onToggle={() => setOpenKey(openKey === 'description' ? null : 'description')}>
                <ProductDescription product={product} />
              </Accordion>
              {contentSections.map((cs) => (
                <Accordion key={cs.key} title={cs.title} open={openKey === cs.key} onToggle={() => setOpenKey(openKey === cs.key ? null : cs.key)}>
                  <p className="whitespace-pre-line">{cs.body}</p>
                </Accordion>
              ))}
              {shippingPolicy && (
                <Accordion title={t('theme.product_detail.shipping_returns')} open={openKey === 'shipping'} onToggle={() => setOpenKey(openKey === 'shipping' ? null : 'shipping')}>
                  <div className="prose prose-sm max-w-none text-dune" dangerouslySetInnerHTML={{ __html: shippingPolicy.body }} />
                </Accordion>
              )}
              <div className="border-t border-line pt-4">
                <button type="button" onClick={share} className="inline-flex items-center gap-2 text-sm text-ink transition-colors hover:text-clay"><I.share className="h-4 w-4" /> {copied ? t('theme.product_detail.link_copied') : t('theme.product_detail.share')}</button>
              </div>
            </div>
          </div>
        </div>

        {productSections.length > 0 && (
          <ProductProvider product={product} activeVariant={activeVariant}>
            <div className="mt-16">
              {productSections.map((s) => { const C = LINEN_SECTION_REGISTRY[s.type]; return C ? <C key={s.id} id={s.id} section={s} /> : null; })}
            </div>
          </ProductProvider>
        )}

        <Reveal className="mt-16 border-t border-line pt-12">
          <ProductReviews product={product} reviews={reviews || []} ratingDistribution={ratingDistribution} accentColor="var(--color-primary)" />
        </Reveal>

        {relatedProducts?.length > 0 && (
          <Reveal className="mt-20">
            <div className="mb-8 text-center">
              <p className="linen-eyebrow text-clay">{t('theme.product_detail.related_eyebrow')}</p>
              <h2 className="font-heading mt-2 text-3xl text-ink">{t('theme.product_detail.related')}</h2>
            </div>
            <ProductRail columns={4}>{relatedProducts.slice(0, 4).map((p: any) => <LinenProductCard key={p._id} product={p} />)}</ProductRail>
          </Reveal>
        )}
      </div>
    </div>
  );
};

export default ProductDetail;
