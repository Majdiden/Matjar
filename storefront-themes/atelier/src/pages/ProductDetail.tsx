import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProduct, productContentSections } from '@matjar/theme-shared/hooks/useProducts';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { useWishlist } from '@matjar/theme-shared/hooks/useWishlist';
import { useThemeSetting, useTemplateSections } from '@matjar/theme-shared/theme/ThemeProvider';
import { findVariant, type Variant, type VariantOption } from '@matjar/theme-shared/components/commerce/VariantPicker';
import { getPreorderState } from '@matjar/theme-shared/utils/preorder';
import { RatingStars } from '@matjar/theme-shared/components/commerce/RatingStars';
import { SocialShare } from '@matjar/theme-shared/components/marketing/SocialShare';
import ProductReviews from '@matjar/theme-shared/components/commerce/ProductReviews';
import ProductDescription from '@matjar/theme-shared/components/commerce/ProductDescription';
import { ProductProvider } from '@matjar/theme-shared/contexts/ProductContext';
import { contactApi } from '@matjar/theme-shared/api/client';
import { ATELIER_SECTION_REGISTRY } from '../sections';
import AtelierProductCard from '../components/AtelierProductCard';
import { useAtelierUI } from '../contexts/AtelierUI';
import { Icon, useCountdown, useOverlayA11y } from '../lib/motion';

const RECENT_KEY = 'atelier.recently_viewed';
const RECENT_MAX = 6;

function pushRecent(slug: string) {
  try {
    const cur: string[] = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    localStorage.setItem(RECENT_KEY, JSON.stringify([slug, ...cur.filter((s) => s !== slug)].slice(0, RECENT_MAX)));
  } catch { /* ignore */ }
}

const Stepper: React.FC<{ value: number; onChange: (n: number) => void; max?: number; small?: boolean }> = ({ value, onChange, max, small }) => (
  <div className={`inline-flex items-center rounded-full border border-[#e0e0e0] ${small ? 'h-10' : 'h-12'}`}>
    <button type="button" onClick={() => onChange(Math.max(1, value - 1))} className={`${small ? 'w-9' : 'w-11'} h-full text-lg text-[#6b6b6b] transition-colors hover:text-[#1c1c1c]`} aria-label="−">−</button>
    <input type="number" min={1} max={max} value={value} onChange={(e) => onChange(Math.max(1, Math.min(max || 999, Number(e.target.value) || 1)))} className={`${small ? 'w-10' : 'w-12'} bg-transparent text-center text-[14px] font-bold text-[#1c1c1c] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none`} aria-label="Quantity" />
    <button type="button" onClick={() => onChange(Math.min(max || 999, value + 1))} className={`${small ? 'w-9' : 'w-11'} h-full text-lg text-[#6b6b6b] transition-colors hover:text-[#1c1c1c]`} aria-label="+">+</button>
  </div>
);

/** Lightbox with the slide-through glyph animation on hover. */
const Lightbox: React.FC<{ images: string[]; index: number; onClose: () => void; onIndex: (i: number) => void }> = ({ images, index, onClose, onIndex }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useTranslation(['theme']);
  useOverlayA11y(true, onClose, ref);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') onIndex((index + 1) % images.length); if (e.key === 'ArrowLeft') onIndex((index - 1 + images.length) % images.length); };
    document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey);
  }, [index, images.length, onIndex]);
  return (
    <div ref={ref} className="fixed inset-0 z-[96] flex items-center justify-center bg-white" role="dialog" aria-modal="true" aria-label={t('theme.product_detail.gallery')} tabIndex={-1}>
      <img src={images[index]} alt="" className="max-h-[92vh] max-w-[92vw] object-contain transition-transform duration-[700ms] ease-[cubic-bezier(.645,.045,.355,1)]" />
      <button type="button" onClick={onClose} className="at-flip-close absolute top-5 end-5 flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#1c1c1c] shadow-[0_2px_10px_#0000001a] transition-transform duration-200 ease-in-out hover:scale-110" aria-label={t('theme.layout.close')}><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
      {images.length > 1 && (
        <>
          <button type="button" onClick={() => onIndex((index - 1 + images.length) % images.length)} className="at-flip-prev absolute start-5 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#1c1c1c] shadow-[0_2px_10px_#0000001a] transition-transform duration-200 ease-in-out hover:scale-110" aria-label={t('theme.section.hero.prev')}><svg className="h-5 w-5 rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 6l-6 6 6 6" /></svg></button>
          <button type="button" onClick={() => onIndex((index + 1) % images.length)} className="at-flip-next absolute end-5 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#1c1c1c] shadow-[0_2px_10px_#0000001a] transition-transform duration-200 ease-in-out hover:scale-110" aria-label={t('theme.section.hero.next')}><svg className="h-5 w-5 rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6" /></svg></button>
        </>
      )}
    </div>
  );
};

const Thumb: React.FC<{ src: string; active: boolean; onClick: () => void; className?: string }> = ({ src, active, onClick, className = '' }) => (
  <button type="button" onClick={onClick} aria-current={active} className={`group/th block shrink-0 overflow-hidden rounded-[var(--atelier-radius-thumb)] border-2 transition-[opacity,border-color] duration-300 ease-linear ${active ? 'border-[color:var(--atelier-bronze)] opacity-100' : 'border-transparent opacity-50 hover:opacity-90'} ${className}`}>
    <img src={src} alt="" className="h-full w-full object-cover transition-transform duration-300 ease-linear group-hover/th:scale-110" />
  </button>
);

const Gallery: React.FC<{ images: string[]; layout: string; index: number; setIndex: (i: number) => void; onOpen: (i: number) => void }> = ({ images, layout, index, setIndex, onOpen }) => {
  const main = images[index] || images[0];
  const zoomCursor = { cursor: 'zoom-in' } as const;
  if (layout === 'image-grid') {
    return <div className="grid grid-cols-2 gap-3">{images.map((src, i) => <button key={i} type="button" data-position={i} onClick={() => onOpen(i)} className="block overflow-hidden rounded-[var(--atelier-radius-card)] bg-[color:var(--color-accent)]" style={zoomCursor}><img src={src} alt="" className="aspect-[4/5] w-full object-cover" /></button>)}</div>;
  }
  if (layout === 'image-scroll') {
    return <div className="space-y-3">{images.map((src, i) => <button key={i} type="button" data-position={i} onClick={() => onOpen(i)} className="block w-full overflow-hidden rounded-[var(--atelier-radius-card)] bg-[color:var(--color-accent)]" style={zoomCursor}><img src={src} alt="" className="w-full object-cover" /></button>)}</div>;
  }
  const mainEl = (
    <div className="group/main relative overflow-hidden rounded-[var(--atelier-radius-card)] bg-[color:var(--color-accent)]">
      <button type="button" onClick={() => onOpen(index)} className="block w-full" style={zoomCursor}><img key={main} src={main} alt="" className="aspect-[4/5] w-full object-cover" style={{ animation: 'at-fade-in .5s ease-out' }} /></button>
      {(layout === 'slider-arrows' || layout === 'slider-dots') && images.length > 1 && (
        <>
          <button type="button" onClick={() => setIndex((index - 1 + images.length) % images.length)} className="absolute start-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#1c1c1c] shadow-[3px_3px_7px_#0000001a] opacity-0 transition-opacity duration-300 group-hover/main:opacity-100 focus:opacity-100" aria-label="Previous"><svg className="h-5 w-5 rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 6l-6 6 6 6" /></svg></button>
          <button type="button" onClick={() => setIndex((index + 1) % images.length)} className="absolute end-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#1c1c1c] shadow-[3px_3px_7px_#0000001a] opacity-0 transition-opacity duration-300 group-hover/main:opacity-100 focus:opacity-100" aria-label="Next"><svg className="h-5 w-5 rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6" /></svg></button>
        </>
      )}
      {layout === 'slider-dots' && images.length > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">{images.map((_, i) => <button key={i} type="button" onClick={() => setIndex(i)} aria-label={`${i + 1}`} className={`h-2 rounded-full transition-all duration-300 ${i === index ? 'w-6 bg-[#1c1c1c]' : 'w-2 bg-white/80'}`} />)}</div>
      )}
    </div>
  );
  if (layout.startsWith('slider')) return mainEl;
  if (layout === 'thumbs-start' || layout === 'thumbs-end') {
    return (
      <div className={`flex gap-3 ${layout === 'thumbs-end' ? 'flex-row-reverse' : ''}`}>
        <div className="flex w-[72px] shrink-0 flex-col gap-2 at-hide-scrollbar max-h-[560px] overflow-y-auto">{images.map((src, i) => <Thumb key={i} src={src} active={i === index} onClick={() => setIndex(i)} className="aspect-[4/5]" />)}</div>
        <div className="min-w-0 flex-1">{mainEl}</div>
      </div>
    );
  }
  if (layout === 'thumb-grid') {
    return <div>{mainEl}<div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6">{images.map((src, i) => <Thumb key={i} src={src} active={i === index} onClick={() => setIndex(i)} className="aspect-square" />)}</div></div>;
  }
  return <div>{mainEl}{images.length > 1 && <div className="at-hide-scrollbar mt-3 flex gap-2 overflow-x-auto">{images.map((src, i) => <Thumb key={i} src={src} active={i === index} onClick={() => setIndex(i)} className="h-[88px] w-[72px]" />)}</div>}</div>;
};

/** Variant pickers: pill buttons (default), dropdown, image or colour swatches, with the selected value echoed in the label. */
const Pickers: React.FC<{ options: VariantOption[]; variants: Variant[]; selection: Record<string, string>; onChange: (s: Record<string, string>) => void; style: string }> = ({ options, variants, selection, onChange, style }) => {
  const { t } = useTranslation(['theme']);
  const available = (axis: string, value: string) => variants.some((v) => v.optionValues.some((ov) => ov.name === axis && ov.value === value) && v.stock > 0 && Object.entries(selection).every(([n, val]) => n === axis || v.optionValues.some((ov) => ov.name === n && ov.value === val)));
  const imageFor = (axis: string, value: string) => variants.find((v) => v.optionValues.some((ov) => ov.name === axis && ov.value === value) && v.image)?.image;
  const isColor = (axis: string) => /colou?r|لون/i.test(axis);
  return (
    <div className="space-y-5">
      {options.map((opt) => {
        const sel = selection[opt.name];
        const set = (v: string) => onChange({ ...selection, [opt.name]: v });
        return (
          <fieldset key={opt.name}>
            <legend className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.14em]">{opt.name}: <span className="text-[color:var(--atelier-bronze-ink)]">{sel || ''}</span></legend>
            {style === 'dropdown' ? (
              <select value={sel || ''} onChange={(e) => set(e.target.value)} className="at-select w-full max-w-xs">
                <option value="">{t('theme.product_detail.choose', { name: opt.name })}</option>
                {opt.values.map((v) => <option key={v} value={v}>{v}{!available(opt.name, v) ? ` - ${t('theme.card.sold_out')}` : ''}</option>)}
              </select>
            ) : (
              <div className="flex flex-wrap gap-2">
                {opt.values.map((v) => {
                  const ok = available(opt.name, v);
                  const on = sel === v;
                  const swatchImg = style === 'image-swatch' ? imageFor(opt.name, v) : null;
                  if (swatchImg) {
                    return <button key={v} type="button" onClick={() => set(v)} aria-pressed={on} title={v} className={`h-14 w-12 overflow-hidden rounded-[4px] border-2 transition-[border-color,opacity] duration-150 ease-linear ${on ? 'border-[#1c1c1c]' : 'border-transparent hover:border-[#8f8f8f]'} ${ok ? '' : 'opacity-40'}`}><img src={swatchImg} alt={v} className="h-full w-full object-cover" /></button>;
                  }
                  if (style === 'color-swatch' && isColor(opt.name)) {
                    return <button key={v} type="button" onClick={() => set(v)} aria-pressed={on} title={v} aria-label={v} className={`relative h-9 w-9 rounded-full border border-[#e5e5e5] transition-shadow duration-150 ease-linear ${on ? 'shadow-[0_0_0_2px_#fff,0_0_0_3px_#000]' : 'hover:shadow-[0_0_0_2px_#fff,0_0_0_3px_#8f8f8f]'} ${ok ? '' : 'opacity-40'}`} style={{ background: v.toLowerCase().replace(/\s+/g, '') }}>{!ok && <span className="absolute inset-0 rotate-45 border-t border-[#1c1c1c] top-1/2" aria-hidden />}</button>;
                  }
                  return <button key={v} type="button" onClick={() => set(v)} aria-pressed={on} className={`rounded-full border px-4 py-2 text-[12px] font-bold uppercase transition-colors duration-150 ease-linear ${on ? 'border-[#1c1c1c] bg-[#1c1c1c] text-white' : ok ? 'border-[#c8c8c8] text-[#1c1c1c] hover:border-[#1c1c1c]' : 'border-dashed border-[#c8c8c8] text-[#8f8f8f] line-through'}`}>{v}</button>;
                })}
              </div>
            )}
          </fieldset>
        );
      })}
    </div>
  );
};

const ProductDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { product, reviews, relatedProducts, ratingDistribution, loading, error } = useProduct(slug!);
  const { store, formatPrice } = useStore();
  const { addItem } = useCart();
  const { addAndConfirm } = useAtelierUI();
  const wishlist = useWishlist();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation(['theme']);
  const layout = String(useThemeSetting<string>('gallery_layout') || 'thumbs-below');
  const pickerStyle = String(useThemeSetting<string>('variant_picker_style') || 'buttons');
  const infoStyle = String(useThemeSetting<string>('product_info_style') || 'tabs');
  const stickyEnabled = useThemeSetting<boolean>('show_sticky_add_to_cart') !== false;
  const showCountdown = !!useThemeSetting<boolean>('show_countdown');
  const countdownEnd = useThemeSetting<string>('countdown_end');
  const repeatDaily = !!useThemeSetting<boolean>('countdown_repeat_daily');
  const showInventory = !!useThemeSetting<boolean>('show_inventory_bar');
  const inventoryStart = Number(useThemeSetting<number>('inventory_start') || 50);
  const benefits = [useThemeSetting<string>('benefit_1'), useThemeSetting<string>('benefit_2'), useThemeSetting<string>('benefit_3')].filter(Boolean) as string[];
  const shippingNote = useThemeSetting<string>('shipping_note');

  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [tab, setTab] = useState('description');
  const [accOpen, setAccOpen] = useState<string | null>('description');
  const [share, setShare] = useState(false);
  const [ask, setAsk] = useState(false);
  const [sticky, setSticky] = useState(false);
  const [recent, setRecent] = useState<any[]>([]);
  const stickyRef = useRef<HTMLDivElement>(null);
  const shareRef = useRef<HTMLDivElement>(null);
  const askRef = useRef<HTMLDivElement>(null);
  useOverlayA11y(share, () => setShare(false), shareRef);
  useOverlayA11y(ask, () => setAsk(false), askRef);
  const productSections = useTemplateSections('product');
  const countdown = useCountdown(showCountdown ? countdownEnd : undefined, repeatDaily);

  const options: VariantOption[] = useMemo(() => (Array.isArray(product?.options) ? product.options : []), [product]);
  const variants: Variant[] = useMemo(() => (Array.isArray(product?.variants) ? product.variants : []), [product]);
  const activeVariant = useMemo(() => findVariant(variants, selection, options), [variants, selection, options]);
  const needsSelection = options.length > 0 && !activeVariant;

  useEffect(() => { setSelection({}); setImgIdx(0); setQty(1); window.scrollTo({ top: 0 }); }, [slug]);
  useEffect(() => { if (product?.slug) { pushRecent(product.slug); } }, [product?.slug]);
  useEffect(() => {
    if (!activeVariant?.image || !product?.images) return;
    const i = product.images.findIndex((s: string) => s === activeVariant.image);
    if (i >= 0) {
      setImgIdx(i);
      if (window.innerWidth > 991 && (layout === 'image-grid' || layout === 'image-scroll')) {
        setTimeout(() => document.querySelector<HTMLElement>(`[data-position="${i}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
      }
    }
  }, [activeVariant?.image, product?.images, layout]);
  useEffect(() => {
    if (!stickyEnabled) return;
    const on = () => setSticky(window.scrollY > window.innerHeight && window.innerWidth >= 992);
    on(); window.addEventListener('scroll', on, { passive: true }); window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); };
  }, [stickyEnabled]);
  useEffect(() => {
    if (!sticky || !stickyRef.current) { document.body.style.paddingBottom = ''; return; }
    document.body.style.paddingBottom = `${stickyRef.current.offsetHeight}px`;
    return () => { document.body.style.paddingBottom = ''; };
  }, [sticky]);
  useEffect(() => {
    let live = true;
    try {
      const slugs: string[] = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').filter((s: string) => s !== slug).slice(0, RECENT_MAX);
      Promise.all(slugs.map((s) => import('@matjar/theme-shared/api/client').then((m) => m.storefrontApi.getProduct(s)).then((r: any) => r?.data?.product || r?.data).catch(() => null))).then((list) => { if (live) setRecent(list.filter(Boolean)); });
    } catch { /* ignore */ }
    return () => { live = false; };
  }, [slug]);

  if (loading) {
    return <div className="mx-auto max-w-[1320px] px-6 py-20"><div className="grid animate-pulse gap-12 md:grid-cols-2"><div className="aspect-[4/5] rounded-[var(--atelier-radius-card)] bg-[#f2f2f2]" /><div className="space-y-4"><div className="h-10 w-3/4 rounded bg-[#f2f2f2]" /><div className="h-40 rounded bg-[#f2f2f2]" /></div></div></div>;
  }
  if (error || !product) {
    return <div className="mx-auto max-w-3xl px-6 py-32 text-center"><h1 className="font-display text-4xl">{t('theme.product_detail.not_found_heading')}</h1><p className="mt-3 text-[#6b6b6b]">{t('theme.product_detail.not_found_body')}</p><Link to="/products" className="at-btn at-btn-dark mt-8">{t('theme.product_detail.back_to_shop')}</Link></div>;
  }

  const images: string[] = product.images?.length ? product.images : ['https://placehold.co/800x1000/f5f1eb/1c1c1c?text=%20'];
  const price = activeVariant?.price ?? product.price ?? 0;
  const compareAt = activeVariant?.compareAtPrice ?? product.compareAtPrice ?? 0;
  const pre = getPreorderState(product as any, activeVariant as any, { price, requiresSelection: needsSelection, adding });
  const effectivePrice = pre.effectivePrice;
  const onSale = compareAt > effectivePrice;
  const pct = onSale ? Math.round(((compareAt - effectivePrice) / compareAt) * 100) : 0;
  const stock = activeVariant?.stock ?? product.stock ?? 0;
  const inStock = stock > 0 || pre.mode === 'preorder';
  const canAdd = inStock && !adding && !needsSelection && !pre.ctaDisabled;
  const wishlisted = wishlist.includes(product._id);
  const contentSections = productContentSections(product, i18n.language);
  const cat = typeof product.category === 'object' ? product.category : null;
  const policies = store?.policies || {};
  const ctaLabel = pre.mode === 'preorder' ? t('theme.product_detail.preorder') : t('theme.product_detail.add_to_bag');
  const sold = Math.max(0, inventoryStart - stock);
  const soldPct = Math.min(100, Math.round((sold / inventoryStart) * 100));

  const handleAdd = async () => {
    if (!canAdd) return;
    setAdding(true);
    try { await addAndConfirm({ productId: product._id, variantId: activeVariant?._id, name: product.name, image: images[0], quantity: qty }); } finally { setAdding(false); }
  };
  const buyNow = async () => {
    if (!canAdd) return;
    setAdding(true);
    try { await addItem(product._id, qty, activeVariant?._id); navigate('/checkout'); } finally { setAdding(false); }
  };

  const panels: { key: string; label: string; body: React.ReactNode }[] = [
    { key: 'description', label: t('theme.product_detail.tab_description'), body: <ProductDescription product={product} /> },
    ...(policies.delivery ? [{ key: 'delivery', label: policies.delivery.title || t('theme.product_detail.tab_delivery'), body: <div className="prose max-w-none text-[14px] leading-[1.75]" dangerouslySetInnerHTML={{ __html: policies.delivery.body }} /> }] : []),
    ...(policies.returns ? [{ key: 'returns', label: policies.returns.title || t('theme.product_detail.tab_returns'), body: <div className="prose max-w-none text-[14px] leading-[1.75]" dangerouslySetInnerHTML={{ __html: policies.returns.body }} /> }] : []),
    ...contentSections.map((s) => ({ key: s.key, label: s.title, body: <p className="whitespace-pre-line text-[14px] leading-[1.75]">{s.body}</p> })),
  ];

  const info = (
    <div>
      <h1 className="font-display text-[34px] font-medium leading-tight sm:text-[40px]">{product.name}</h1>
      {(product.reviewCount || 0) > 0 && (
        <div className="mt-2 flex items-center gap-3 text-[12px]"><RatingStars rating={product.averageRating || 0} size="sm" /><span className="text-[#6b6b6b]">({product.reviewCount})</span><a href="#reviews" className="font-extrabold uppercase tracking-wider at-link-hover">{t('theme.product_detail.view_reviews')}</a></div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-[24px] font-extrabold">{formatPrice(effectivePrice)}</span>
        {onSale && <s className="text-[16px] text-[#6b6b6b]">{formatPrice(compareAt)}</s>}
        {onSale && <span className="rounded-full bg-[color:var(--atelier-sale)] px-2.5 py-1 text-[11px] font-extrabold text-white">-{pct}%</span>}
      </div>
      <p className="mt-3 flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-wider">
        <span className="text-[#6b6b6b]">{t('theme.product_detail.available')}</span>
        {inStock ? <span className="flex items-center gap-1 text-[color:var(--atelier-success)]"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>{pre.mode === 'preorder' ? t('theme.card.preorder') : t('theme.card.in_stock')}</span> : <span className="text-[#8f8f8f]">{t('theme.card.sold_out')}</span>}
      </p>
      {product.shortDescription && <p className="mt-4 text-[15px] leading-[1.7] text-[#4a4a4a]">{product.shortDescription}</p>}
      <dl className="mt-4 space-y-1 text-[12px]">
        {(activeVariant?.sku || product.sku) && <div className="flex gap-2"><dt className="font-extrabold uppercase tracking-wider text-[#6b6b6b]">{t('theme.product_detail.sku')}</dt><dd>{activeVariant?.sku || product.sku}</dd></div>}
        {Array.isArray(product.tags) && product.tags.length > 0 && <div className="flex gap-2"><dt className="font-extrabold uppercase tracking-wider text-[#6b6b6b]">{t('theme.product_detail.tags')}</dt><dd className="flex flex-wrap gap-1">{product.tags.map((tg: string) => <Link key={tg} to={`/search?q=${encodeURIComponent(tg)}`} className="at-link-hover">{tg}</Link>).reduce((acc: React.ReactNode[], el, i) => (i ? [...acc, <span key={`s${i}`}>,</span>, el] : [el]), [])}</dd></div>}
        {cat?.name && <div className="flex gap-2"><dt className="font-extrabold uppercase tracking-wider text-[#6b6b6b]">{t('theme.product_detail.category')}</dt><dd><Link to={`/categories/${cat.slug}`} className="at-link-hover">{cat.name}</Link></dd></div>}
      </dl>

      {showCountdown && countdown && onSale && (
        <div className="mt-6 rounded-[var(--atelier-radius-card)] border border-[#f4c7a9] bg-[#ffebde] p-4 text-[#d11f1f]">
          <p className="font-display text-[16px]">{t('theme.product_detail.flash_sale')}</p>
          <p className="text-[12px] font-extrabold uppercase tracking-wider">{t('theme.product_detail.ends_in')}</p>
          <div className="mt-2 flex gap-2">
            {[[countdown.d, t('theme.product_detail.days')], [countdown.h, t('theme.product_detail.hours')], [countdown.m, t('theme.product_detail.minutes')], [countdown.s, t('theme.product_detail.seconds')]].map(([v, l], i) => (
              <div key={String(l)} className="text-center"><span className={`block min-w-[44px] rounded-[4px] px-2 text-[12px] font-extrabold leading-[36px] ${i === 3 ? 'bg-[#d11f1f] text-white' : 'bg-white text-[#d11f1f]'}`}>{String(v).padStart(2, '0')}</span><span className="text-[10px] font-bold uppercase">{l}</span></div>
            ))}
          </div>
          {showInventory && stock > 0 && (
            <div className="mt-3"><p className="text-[12px] font-bold">{t('theme.product_detail.sold_pct', { pct: soldPct, count: stock })}</p><div className="mt-1 h-2 rounded-full bg-white"><div className="h-full rounded-full bg-[#d11f1f] transition-[width] duration-700 ease-out" style={{ width: `${soldPct}%` }} /></div></div>
          )}
        </div>
      )}

      {options.length > 0 && <div className="mt-6"><Pickers options={options} variants={variants} selection={selection} onChange={setSelection} style={pickerStyle} /></div>}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="text-[12px] font-extrabold uppercase tracking-wider text-[#6b6b6b]">{t('theme.product_detail.quantity')}</span>
        <Stepper value={qty} onChange={setQty} max={pre.mode === 'preorder' ? undefined : stock || 1} />
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button type="button" onClick={handleAdd} disabled={!canAdd} className="at-btn at-btn-dark h-14 flex-1 text-[13px] uppercase tracking-wider">{adding && <span className="at-spinner" />}{needsSelection ? t('theme.product_detail.select_options') : !inStock ? t('theme.card.sold_out') : ctaLabel}</button>
        <button type="button" onClick={() => wishlist.toggle(product._id, { _id: product._id, name: product.name, slug: product.slug, price: product.price, images: product.images })} aria-pressed={wishlisted} aria-label={t('theme.card.add_to_wishlist')} className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border transition-colors duration-300 ${wishlisted ? 'border-[color:var(--atelier-bronze-ink)] bg-[color:var(--atelier-bronze-ink)] text-white' : 'border-[#ededed] bg-[#ededed] text-[#222] hover:border-[color:var(--atelier-bronze-ink)] hover:bg-[color:var(--atelier-bronze-ink)] hover:text-white'}`}>
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8"><path d="M12 21s-8-5-8-11a4 4 0 018-1 4 4 0 018 1c0 6-8 11-8 11z" /></svg>
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[12px] font-extrabold uppercase tracking-wider">
        <button type="button" onClick={() => setShare(true)} className="flex items-center gap-1.5 at-link-hover"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8h16v-8M12 3v13M8 7l4-4 4 4" /></svg>{t('theme.product_detail.share')}</button>
        <button type="button" onClick={() => setAsk(true)} className="flex items-center gap-1.5 at-link-hover"><svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 3.5M12 17h.01" /></svg>{t('theme.product_detail.ask')}</button>
        <Link to="/pages/faqs" className="flex items-center gap-1.5 at-link-hover">{t('theme.product_detail.faq')}</Link>
      </div>

      {benefits.length > 0 && (
        <div className="mt-8 rounded-[var(--atelier-radius-card)] bg-[color:var(--color-accent)] p-5">
          <p className="font-display text-[18px]">{t('theme.product_detail.benefits_title')}</p>
          <ul className="mt-3 space-y-2">{benefits.map((b, i) => <li key={i} className="flex items-center gap-3 text-[14px]"><Icon name={['truck', 'return', 'headset'][i] || 'check'} className="h-5 w-5 text-[color:var(--atelier-bronze-ink)]" />{b}</li>)}</ul>
        </div>
      )}
      {shippingNote && <p className="mt-4 text-[13px] text-[#4a4a4a]">{shippingNote}</p>}
    </div>
  );

  return (
    <div>
      <div className="mx-auto max-w-[1320px] px-4 pt-6 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6b6b6b]"><Link to="/" className="at-link-hover">{t('theme.layout.nav.home')}</Link><span className="mx-2">•</span><span className="text-[#1c1c1c]">{product.name}</span></nav>
        <div className={`mt-6 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14 ${layout === 'image-scroll' ? 'lg:items-start' : ''}`}>
          <div>
            <Gallery images={images} layout={layout} index={imgIdx} setIndex={setImgIdx} onOpen={setLightbox} />
          </div>
          <div className={layout === 'image-scroll' ? 'lg:sticky lg:top-24' : ''}>{info}</div>
        </div>

        {/* Tabs / accordion */}
        {panels.length > 0 && (
          <div className="mt-16 border border-[#e5e5e5] rounded-[var(--atelier-radius-card)] overflow-hidden">
            {infoStyle === 'accordion' ? (
              panels.map((p) => (
                <div key={p.key} className="border-b border-[#e5e5e5] last:border-0">
                  <button type="button" onClick={() => setAccOpen((o) => (o === p.key ? null : p.key))} aria-expanded={accOpen === p.key} className="flex w-full items-center justify-between px-5 py-4 text-start font-display text-[20px] transition-colors duration-300 hover:text-[color:var(--atelier-bronze-ink)]">{p.label}<span className="text-2xl leading-none">{accOpen === p.key ? '−' : '+'}</span></button>
                  {accOpen === p.key && <div className="px-5 pb-6">{p.body}</div>}
                </div>
              ))
            ) : (
              <>
                <div className="at-hide-scrollbar flex gap-8 overflow-x-auto border-b border-[#e5e5e5] px-5" role="tablist">
                  {panels.map((p) => <button key={p.key} role="tab" aria-selected={tab === p.key} onClick={() => setTab(p.key)} className={`whitespace-nowrap border-b-2 py-4 font-display text-[20px] leading-none transition-colors duration-300 sm:text-[24px] ${tab === p.key ? 'border-[color:var(--atelier-bronze-ink)] text-[color:var(--atelier-bronze-ink)]' : 'border-transparent hover:text-[color:var(--atelier-bronze-ink)]'}`}>{p.label}</button>)}
                </div>
                <div className="p-5 sm:p-8" role="tabpanel">{(panels.find((p) => p.key === tab) || panels[0]).body}</div>
              </>
            )}
          </div>
        )}

        <div id="reviews" className="mt-16"><ProductReviews product={product} reviews={reviews} ratingDistribution={ratingDistribution} accentColor="var(--atelier-bronze-ink)" /></div>

        {productSections.length > 0 && (
          <ProductProvider product={product} activeVariant={activeVariant as any}>
            <div className="mt-8">{productSections.map((s) => { const C = ATELIER_SECTION_REGISTRY[s.type]; return C ? <C key={s.id} id={s.id} section={s} /> : null; })}</div>
          </ProductProvider>
        )}

        {relatedProducts?.length > 0 && (
          <section className="mt-16"><h2 className="font-display text-[30px]">{t('theme.product_detail.related')}</h2><div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">{relatedProducts.slice(0, 8).map((p: any) => <AtelierProductCard key={p._id} product={p} />)}</div></section>
        )}
        {recent.length > 0 && (
          <section className="mt-16 pb-16"><h2 className="font-display text-[30px]">{t('theme.product_detail.recently_viewed')}</h2><div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4 lg:grid-cols-6">{recent.map((p: any) => <AtelierProductCard key={p._id} product={p} />)}</div></section>
        )}
      </div>

      {/* Sticky add-to-cart (desktop) */}
      {stickyEnabled && (
        <div ref={stickyRef} className={`fixed inset-x-0 bottom-0 z-[70] hidden bg-white shadow-[0_0_10px_#0000001a] transition-[transform,opacity] duration-300 lg:block ${sticky ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`} aria-hidden={!sticky}>
          <div className="mx-auto flex max-w-[1320px] items-center gap-4 px-6 py-3">
            <img src={images[imgIdx]} alt="" className="h-14 w-12 rounded-[4px] object-cover" />
            <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold">{product.name}</p><p className="text-[14px] font-extrabold">{formatPrice(effectivePrice)} {onSale && <s className="ms-1 text-[12px] font-normal text-[#6b6b6b]">{formatPrice(compareAt)}</s>}</p></div>
            {options.length > 0 && (
              <select value={activeVariant?._id || ''} onChange={(e) => { const v = variants.find((x) => x._id === e.target.value); if (v) setSelection(Object.fromEntries(v.optionValues.map((ov) => [ov.name, ov.value]))); }} className="at-select h-12 max-w-[220px] rounded-[5px] border-[#dbdbdb] text-[10px] font-semibold uppercase">
                <option value="">{t('theme.product_detail.select_options')}</option>
                {variants.map((v) => <option key={v._id} value={v._id} disabled={v.stock <= 0}>{v.optionValues.map((ov) => ov.value).join(' / ')}{v.stock <= 0 ? ` - ${t('theme.card.sold_out')}` : ''}</option>)}
              </select>
            )}
            <Stepper value={qty} onChange={setQty} max={pre.mode === 'preorder' ? undefined : stock || 1} small />
            <button type="button" onClick={handleAdd} disabled={!canAdd} className="at-btn at-btn-dark text-[12px] uppercase tracking-wider">{ctaLabel}</button>
            <button type="button" onClick={buyNow} disabled={!canAdd} className="at-btn at-btn-outline text-[12px] uppercase tracking-wider">{t('theme.product_detail.buy_now')}</button>
          </div>
        </div>
      )}

      {lightbox != null && <Lightbox images={images} index={lightbox} onClose={() => setLightbox(null)} onIndex={setLightbox} />}

      {/* Share modal */}
      <div className={`fixed inset-0 z-[95] flex items-center justify-center p-4 transition-opacity duration-300 ${share ? 'visible opacity-100' : 'invisible opacity-0'}`} aria-hidden={!share}>
        <div className="absolute inset-0 bg-black/50" onClick={() => setShare(false)} />
        <div ref={shareRef} role="dialog" aria-modal="true" aria-label={t('theme.product_detail.share')} tabIndex={-1} className="relative w-full max-w-md rounded-[var(--atelier-radius-card)] bg-white p-6 shadow-2xl">
          <h2 className="font-display text-2xl">{t('theme.product_detail.share_title')}</h2>
          <div className="mt-5"><SocialShare url={typeof window !== 'undefined' ? window.location.href : ''} title={product.name} platforms={['facebook', 'twitter', 'pinterest', 'whatsapp', 'copy']} variant="buttons" /></div>
          <button type="button" onClick={() => setShare(false)} className="at-btn at-btn-outline mt-5 w-full">{t('theme.layout.close')}</button>
        </div>
      </div>

      {/* Ask a question */}
      <div className={`fixed inset-0 z-[95] flex items-center justify-center p-4 transition-opacity duration-300 ${ask ? 'visible opacity-100' : 'invisible opacity-0'}`} aria-hidden={!ask}>
        <div className="absolute inset-0 bg-black/50" onClick={() => setAsk(false)} />
        <div ref={askRef} role="dialog" aria-modal="true" aria-label={t('theme.product_detail.ask')} tabIndex={-1} className="relative w-full max-w-lg rounded-[var(--atelier-radius-card)] bg-white p-6 shadow-2xl">
          <AskForm productName={product.name} onDone={() => setAsk(false)} />
        </div>
      </div>
    </div>
  );
};

const AskForm: React.FC<{ productName: string; onDone: () => void }> = ({ productName, onDone }) => {
  const { t } = useTranslation(['theme']);
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false); const [sent, setSent] = useState(false); const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await contactApi.send({ name, email, subject: `${t('theme.product_detail.ask')}: ${productName}`, message }); setSent(true); }
    catch (ex: any) { setErr(ex?.message || t('theme.product_detail.ask_error')); }
    finally { setBusy(false); }
  };
  if (sent) return <div className="text-center"><p className="font-display text-2xl">{t('theme.product_detail.ask_sent')}</p><button type="button" onClick={onDone} className="at-btn at-btn-dark mt-6">{t('theme.layout.close')}</button></div>;
  return (
    <form onSubmit={submit} className="space-y-3">
      <h2 className="font-display text-2xl">{t('theme.product_detail.ask_title')}</h2>
      <p className="text-[13px] text-[#6b6b6b]">{t('theme.product_detail.ask_help')}</p>
      <input required value={name} onChange={(e) => setName(e.target.value)} placeholder={t('theme.product_detail.ask_name')} className="at-input" />
      <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('theme.product_detail.ask_email')} className="at-input" dir="ltr" />
      <textarea required value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t('theme.product_detail.ask_message')} rows={5} className="at-input rounded-[16px]" />
      {err && <p className="text-[12px] font-semibold text-[color:var(--atelier-sale)]">{err}</p>}
      <div className="flex gap-2"><button type="button" onClick={onDone} className="at-btn at-btn-outline flex-1">{t('theme.layout.close')}</button><button type="submit" disabled={busy} className="at-btn at-btn-dark flex-1">{busy ? <span className="at-spinner" /> : t('theme.product_detail.ask_submit')}</button></div>
    </form>
  );
};

export default ProductDetail;
