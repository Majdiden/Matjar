import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { MISK_SECTION_REGISTRY } from '../sections';
import { MiskProductCard } from '../components/MiskProductCard';
import { MiskVariantPicker } from '../components/MiskVariantPicker';
import { Reveal } from '../lib/Reveal';
import { useStoredState } from '../lib/hooks';
import { I } from '../lib/icons';

const PLACEHOLDER = 'https://placehold.co/900x900/f4efe7/14110e?text=%20';
const RECENT_KEY = 'misk.recently_viewed';
const RECENT_MAX = 8;

const Panel: React.FC<{ title: string; open: boolean; onToggle: () => void; children: React.ReactNode }> = ({ title, open, onToggle, children }) => (
  <div className="border-t border-line">
    <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-[56px] w-full items-center justify-between py-4 text-start">
      <span className="font-display text-lg text-ink">{title}</span>
      <span className={`grid h-7 w-7 place-items-center text-muted transition-transform duration-300 ${open ? 'rotate-45' : ''}`}><I.plus className="h-4 w-4" /></span>
    </button>
    <div className={`grid transition-[grid-template-rows] duration-300 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
      <div className="overflow-hidden"><div className="pb-5 text-sm text-muted">{children}</div></div>
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
  const productSections = useTemplateSections('product');

  // ── settings ──
  const galleryLayout = useThemeSetting<string>('gallery_layout') || 'thumbs-below';
  const pickerStyle = (useThemeSetting<string>('variant_picker_style') || 'buttons') as any;
  const infoStyle = useThemeSetting<string>('product_info_style') || 'accordion';
  const showSave = useThemeSetting<boolean>('show_save_badge') !== false;
  const showSticky = useThemeSetting<boolean>('show_sticky_add_to_cart') !== false;
  const showBuyNow = useThemeSetting<boolean>('show_buy_now') !== false;
  const showNotes = useThemeSetting<boolean>('show_delivery_note') !== false;
  const deliveryNote = (useThemeSetting<string>('delivery_note') || '').trim() || t('theme.product.delivery_note');
  const returnsNote = (useThemeSetting<string>('returns_note') || '').trim() || t('theme.product.returns_note');
  const showRelated = useThemeSetting<boolean>('show_related') !== false;
  const showRecent = useThemeSetting<boolean>('show_recently_viewed') !== false;

  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [buying, setBuying] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [activeVariant, setActiveVariant] = useState<Variant | null>(null);
  const [openKey, setOpenKey] = useState<string | null>('description');
  const [tab, setTab] = useState('description');
  const [copied, setCopied] = useState(false);
  const [stickyOn, setStickyOn] = useState(false);
  const [recent, setRecent] = useStoredState<any[]>(RECENT_KEY, []);
  const buyRef = useRef<HTMLDivElement>(null);
  const onVariant = useCallback((v: Variant | null) => setActiveVariant(v), []);

  useEffect(() => { setImgIdx(0); setQty(1); setSelection({}); setOpenKey('description'); setTab('description'); }, [slug]);

  useEffect(() => {
    if (!activeVariant?.image || !product?.images) return;
    const i = product.images.findIndex((s: string) => s === activeVariant.image);
    if (i >= 0) setImgIdx(i);
  }, [activeVariant?.image, product?.images]);

  // The sticky bar appears only once the real add-to-cart has scrolled away.
  useEffect(() => {
    const el = buyRef.current;
    if (!el || !showSticky || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setStickyOn(!e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [showSticky, product?._id]);

  // Recently viewed is per-browser only; nothing is sent anywhere.
  useEffect(() => {
    if (!product?._id) return;
    setRecent((list) => {
      const entry = { _id: product._id, name: product.name, slug: product.slug, price: product.price, compareAtPrice: product.compareAtPrice, images: product.images };
      return [entry, ...(list || []).filter((p) => p && p._id !== product._id)].slice(0, RECENT_MAX);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?._id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1320px] px-4 py-16 sm:px-6">
        <div className="grid animate-pulse gap-12 md:grid-cols-2">
          <div className="aspect-square bg-sand" />
          <div className="space-y-4"><div className="h-10 w-3/4 bg-sand" /><div className="h-6 w-1/4 bg-sand" /><div className="h-40 bg-sand" /></div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-32 text-center">
        <h1 className="font-display text-4xl text-ink">{t('theme.product.not_found_heading')}</h1>
        <p className="mt-3 text-muted">{t('theme.product.not_found_body')}</p>
        <Link to="/products" className="misk-btn misk-btn-solid mt-8">{t('theme.product.back_to_shop')}</Link>
      </div>
    );
  }

  const images: string[] = product.images?.length ? product.images : [PLACEHOLDER];
  const price = activeVariant?.price ?? product.price ?? 0;
  const compareAt = activeVariant?.compareAtPrice ?? product.compareAtPrice ?? 0;
  const onSale = compareAt > price;
  const savePct = onSale ? Math.round(((compareAt - price) / compareAt) * 100) : 0;
  const inStock = (activeVariant?.stock ?? product.stock ?? 0) > 0;
  const hasOptions = Array.isArray(product.options) && product.options.length > 0;
  const needsSelection = hasOptions && !activeVariant;
  const pre = getPreorderState(product as any, activeVariant as any, { price, requiresSelection: needsSelection, adding });
  const isPreorder = pre.mode === 'preorder';
  const canAdd = (inStock || !!pre.config) && !adding && !buying && !needsSelection && !pre.ctaDisabled;
  const wishlisted = wishlist.includes(product._id);
  const contentSections = productContentSections(product, i18n.language);
  const policies: any = (store as any)?.policies || {};
  const shippingPolicy = policies.delivery || policies.shipping || policies.returns || null;
  const recentList = (recent || []).filter((p) => p && p._id !== product._id);

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
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { /* the share sheet was dismissed, or the clipboard is blocked */ }
  };

  const ctaLabel = isPreorder
    ? (adding ? t('theme.product.reserving') : t('theme.product.preorder'))
    : (pre.mode === 'soldOut' || (!inStock && !pre.config)) ? t('theme.product.sold_out')
    : adding ? t('theme.product.adding') : t('theme.product.add_to_cart');

  // ── gallery ──
  const thumbsAtStart = galleryLayout === 'thumbs-start';
  const stacked = galleryLayout === 'stacked';
  const sliderDots = galleryLayout === 'slider-dots';

  const thumbs = images.length > 1 && (thumbsAtStart || galleryLayout === 'thumbs-below') ? (
    <div className={`flex gap-2 ${thumbsAtStart ? 'flex-row md:flex-col' : 'flex-row'} ${thumbsAtStart ? '' : 'mt-3'} overflow-x-auto pb-1 [scrollbar-width:none]`}>
      {images.map((src, i) => (
        <button
          key={i}
          type="button"
          onClick={() => setImgIdx(i)}
          aria-label={t('theme.product.gallery_image', { index: i + 1, total: images.length })}
          aria-pressed={i === imgIdx}
          className={`h-20 w-20 shrink-0 overflow-hidden rounded-[var(--radius-sm,6px)] border-2 transition-all duration-300 ${i === imgIdx ? 'border-gold-ink opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`}
        >
          <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
        </button>
      ))}
    </div>
  ) : null;

  const mainImage = (
    <div className="relative aspect-square overflow-hidden rounded-[var(--radius-sm,6px)] bg-sand">
      <ImageZoom src={images[imgIdx] || images[0]} alt={product.name} fit="cover" className="h-full w-full" />
      {/* Phones only: on desktop the same badge sits beside the price, a few
          centimetres away, and showing both reads as a duplicate. */}
      {onSale && showSave && (
        <span className="misk-num absolute start-4 top-4 rounded-full bg-sale px-3 py-1 text-xs font-bold text-white md:hidden">
          {t('theme.product.save', { percent: savePct })}
        </span>
      )}
      {images.length > 1 && !stacked && (
        <>
          <button type="button" onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)} className="absolute start-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-[var(--shadow-sm)] transition-colors hover:bg-ink hover:text-white" aria-label={t('theme.hero.prev')}>
            <I.chevronLeft className="h-5 w-5 rtl:-scale-x-100" />
          </button>
          <button type="button" onClick={() => setImgIdx((i) => (i + 1) % images.length)} className="absolute end-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-[var(--shadow-sm)] transition-colors hover:bg-ink hover:text-white" aria-label={t('theme.hero.next')}>
            <I.chevronRight className="h-5 w-5 rtl:-scale-x-100" />
          </button>
        </>
      )}
    </div>
  );

  const gallery = stacked ? (
    <div className="space-y-3">
      {images.map((src, i) => (
        <div key={i} className="aspect-square overflow-hidden rounded-[var(--radius-sm,6px)] bg-sand">
          <img src={src} alt={i === 0 ? product.name : ''} loading={i === 0 ? 'eager' : 'lazy'} className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  ) : (
    <div className={thumbsAtStart ? 'flex flex-col-reverse gap-3 md:flex-row' : ''}>
      {thumbsAtStart && <div className="md:w-24 md:shrink-0">{thumbs}</div>}
      <div className="min-w-0 flex-1">
        {mainImage}
        {!thumbsAtStart && thumbs}
        {sliderDots && images.length > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            {images.map((_, i) => (
              <button key={i} type="button" onClick={() => setImgIdx(i)} aria-label={t('theme.product.gallery_image', { index: i + 1, total: images.length })} aria-pressed={i === imgIdx} className={`h-2.5 rounded-full transition-all duration-300 ${i === imgIdx ? 'w-6 bg-ink' : 'w-2.5 bg-line'}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ── info panels ──
  const panels = [
    { key: 'description', title: t('theme.product.description'), body: <ProductDescription product={product} /> },
    ...contentSections.map((cs) => ({ key: cs.key, title: cs.title, body: <p className="whitespace-pre-line">{cs.body}</p> })),
    ...(shippingPolicy ? [{ key: 'shipping', title: t('theme.product.shipping_returns'), body: <div className="prose prose-sm max-w-none text-muted" dangerouslySetInnerHTML={{ __html: shippingPolicy.body }} /> }] : []),
  ];

  return (
    <div>
      <div className="mx-auto max-w-[1320px] px-4 pt-6 sm:px-6">
        <nav className="misk-eyebrow text-muted" aria-label="breadcrumb">
          <Link to="/" className="hover:text-ink">{t('theme.nav.home')}</Link>
          <span className="mx-2" aria-hidden>·</span>
          <Link to="/products" className="hover:text-ink">{t('theme.product.breadcrumb_all')}</Link>
          <span className="mx-2" aria-hidden>·</span>
          <span className="text-ink">{product.name}</span>
        </nav>
      </div>

      <div className="mx-auto max-w-[1320px] px-4 py-8 sm:px-6 md:py-12">
        <div className="grid gap-10 md:grid-cols-2 md:gap-14 lg:grid-cols-[1.1fr_1fr]">
          <div className={stacked ? '' : 'md:sticky md:top-28 md:self-start'}>{gallery}</div>

          <div className={stacked ? 'md:sticky md:top-28 md:self-start' : ''}>
            {(product.category as any)?.name && <p className="misk-eyebrow text-gold-ink">{(product.category as any).name}</p>}
            <h1 className="font-display mt-2 text-3xl leading-tight text-ink sm:text-4xl">{product.name}</h1>

            {(product.reviewCount ?? 0) > 0 && (
              <div className="mt-3"><RatingStars rating={(product as any).averageRating || product.rating || 0} reviewCount={product.reviewCount} showCount /></div>
            )}

            <p className="misk-num mt-4 flex flex-wrap items-baseline gap-3 text-2xl text-ink">
              <span className={onSale ? 'font-bold' : ''}>{formatPrice(pre.effectivePrice ?? price)}</span>
              {onSale && <s className="text-lg text-muted">{formatPrice(compareAt)}</s>}
              {onSale && showSave && <span className="rounded-full bg-sale px-3 py-1 text-xs font-bold text-white">{t('theme.product.save', { percent: savePct })}</span>}
            </p>

            {product.shortDescription && <p className="mt-4 border-t border-line pt-4 text-muted">{product.shortDescription}</p>}

            {hasOptions && (
              <div className="mt-8">
                <MiskVariantPicker
                  options={product.options as any}
                  variants={(product.variants || []) as any}
                  selection={selection}
                  onSelectionChange={setSelection}
                  onVariantChange={onVariant}
                  style={pickerStyle}
                />
              </div>
            )}

            <div className="mt-6 text-sm">
              {isPreorder ? (
                <p className="flex items-center gap-2 text-gold-ink">
                  <span className="h-2 w-2 rounded-full bg-gold" />
                  {t('theme.product.preorder_note')}
                  {pre.shipByLabel ? ` · ${pre.shipByLabel}` : ''}
                  {pre.lowRemaining && pre.remaining !== null ? ` · ${t('theme.product.only_left', { count: pre.remaining })}` : ''}
                </p>
              ) : inStock ? (
                <p className="flex items-center gap-2 text-[color:var(--color-success)]"><I.check className="h-4 w-4" />{t('theme.product.in_stock')}</p>
              ) : (
                <p className="text-[color:var(--color-error)]">{t('theme.product.out_of_stock')}</p>
              )}
            </div>

            <div ref={buyRef} className="mt-6 flex flex-wrap gap-3">
              <div className="flex h-14 items-center rounded-full border border-line">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-full w-12 place-items-center rounded-full text-ink hover:bg-sand" aria-label={t('theme.product.decrease')}><I.minus className="h-4 w-4" /></button>
                <input inputMode="numeric" aria-label={t('theme.product.quantity')} value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value, 10) || 1))} className="misk-num h-full w-12 bg-transparent text-center text-ink outline-none" />
                <button type="button" onClick={() => setQty((q) => q + 1)} className="grid h-full w-12 place-items-center rounded-full text-ink hover:bg-sand" aria-label={t('theme.product.increase')}><I.plus className="h-4 w-4" /></button>
              </div>
              <button type="button" onClick={add} disabled={!canAdd} className="misk-btn misk-btn-outline h-14 min-w-[200px] flex-1">{ctaLabel}</button>
            </div>

            {showBuyNow && <button type="button" onClick={buyNow} disabled={!canAdd} className="misk-btn misk-btn-solid mt-3 h-14 w-full">{buying ? t('theme.product.adding') : t('theme.product.buy_now')}</button>}

            <button
              type="button"
              onClick={() => wishlist.toggle(product._id, { _id: product._id, name: product.name, slug: product.slug, price: product.price, images: product.images } as any)}
              aria-pressed={wishlisted}
              className={`misk-btn mt-3 h-14 w-full ${wishlisted ? 'misk-btn-gold' : 'misk-btn-outline'}`}
            >
              <I.heart className="h-4 w-4" fill={wishlisted ? 'currentColor' : 'none'} />
              {wishlisted ? t('theme.product.wishlisted') : t('theme.product.add_to_wishlist')}
            </button>

            {showNotes && (
              <ul className="mt-8 space-y-3 text-sm text-muted">
                <li className="flex items-start gap-3"><I.truck className="mt-0.5 h-5 w-5 shrink-0 text-gold-ink" />{deliveryNote}</li>
                <li className="flex items-start gap-3"><I.return className="mt-0.5 h-5 w-5 shrink-0 text-gold-ink" />{returnsNote}</li>
              </ul>
            )}

            <div className="mt-8">
              {infoStyle === 'tabs' ? (
                <>
                  <div className="flex flex-wrap gap-1 border-b border-line" role="tablist">
                    {panels.map((p) => (
                      <button key={p.key} type="button" role="tab" aria-selected={tab === p.key} onClick={() => setTab(p.key)} className={`min-h-[48px] border-b-2 px-4 text-sm transition-colors ${tab === p.key ? 'border-ink font-bold text-ink' : 'border-transparent text-muted hover:text-ink'}`}>
                        {p.title}
                      </button>
                    ))}
                  </div>
                  <div className="pt-5 text-sm text-muted" role="tabpanel">{panels.find((p) => p.key === tab)?.body}</div>
                </>
              ) : (
                panels.map((p) => (
                  <Panel key={p.key} title={p.title} open={openKey === p.key} onToggle={() => setOpenKey(openKey === p.key ? null : p.key)}>{p.body}</Panel>
                ))
              )}
              <div className="border-t border-line pt-4">
                <button type="button" onClick={share} className="inline-flex min-h-[44px] items-center gap-2 text-sm text-ink transition-colors hover:text-gold-ink">
                  <I.sparkle className="h-4 w-4" /> {copied ? t('theme.product.link_copied') : t('theme.product.share')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {productSections.length > 0 && (
          <ProductProvider product={product} activeVariant={activeVariant as any}>
            <div className="mt-16">
              {productSections.map((s) => { const C = MISK_SECTION_REGISTRY[s.type]; return C ? <C key={s.id} id={s.id} section={s} /> : null; })}
            </div>
          </ProductProvider>
        )}

        <Reveal className="mt-16 border-t border-line pt-12">
          <ProductReviews product={product} reviews={reviews || []} ratingDistribution={ratingDistribution} accentColor="var(--color-primary)" />
        </Reveal>

        {showRelated && relatedProducts?.length > 0 && (
          <Reveal className="mt-20">
            <div className="mb-8 text-center">
              <p className="misk-eyebrow text-gold-ink">{t('theme.product.related_eyebrow')}</p>
              <h2 className="font-display mt-2 text-3xl text-ink">{t('theme.product.related')}</h2>
            </div>
            <ProductRail columns={4}>{relatedProducts.slice(0, 4).map((p: any) => <MiskProductCard key={p._id} product={p} />)}</ProductRail>
          </Reveal>
        )}

        {showRecent && recentList.length > 0 && (
          <Reveal className="mt-20">
            <div className="mb-8 text-center">
              <h2 className="font-display text-3xl text-ink">{t('theme.product.recently_viewed')}</h2>
            </div>
            <ProductRail columns={4}>{recentList.slice(0, 4).map((p: any) => <MiskProductCard key={p._id} product={p} showRating={false} />)}</ProductRail>
          </Reveal>
        )}
      </div>

      {/* Sticky add-to-cart — appears once the real button scrolls out of view.
          It clears the floating bottom-nav pill on phones. */}
      {showSticky && (
        <div
          className={`fixed inset-x-0 z-[80] border-t border-line bg-white/95 backdrop-blur transition-transform duration-300 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-0 ${stickyOn ? 'translate-y-0' : 'translate-y-[150%]'}`}
          aria-hidden={!stickyOn}
        >
          <div className="mx-auto flex max-w-[1320px] items-center gap-4 px-4 py-3 sm:px-6">
            <img src={images[0]} alt="" className="hidden h-12 w-12 rounded-[var(--radius-sm,6px)] object-cover sm:block" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-base text-ink">{product.name}</p>
              <p className="misk-num text-sm text-muted">{formatPrice(pre.effectivePrice ?? price)}</p>
            </div>
            <button type="button" onClick={add} disabled={!canAdd} tabIndex={stickyOn ? 0 : -1} className="misk-btn misk-btn-solid h-12 min-h-0 shrink-0 px-6">{ctaLabel}</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetail;
