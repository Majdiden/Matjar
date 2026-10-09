/**
 * Misk section registry — merged over the SDK defaults so the universal
 * sections (product-details, product-policies, rich-text…) stay available
 * alongside the theme's own.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DEFAULT_SECTION_REGISTRY, type SectionComponent, type SectionComponentProps } from '@matjar/theme-shared/components/sections';
import { useThemeSettings } from '@matjar/theme-shared/theme/ThemeProvider';
import { useFeaturedProducts, useProducts, useCategories } from '@matjar/theme-shared/hooks/useProducts';
import { useCollection } from '@matjar/theme-shared/hooks/useCollections';
import { Skeleton } from '@matjar/theme-shared/components/primitives/Skeleton';
import { MiskProductCard } from '../components/MiskProductCard';
import { Reveal } from '../lib/Reveal';
import { I, iconFor } from '../lib/icons';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { isStockImage, merchantImage, merchantText } from '@matjar/theme-shared/theme/heroContent';

// ─── helpers ──────────────────────────────────────────────────────

/** Section rhythm: the customizer value applies from `md`; phones clamp to
 *  40px (see .misk-section in index.css) so vertical rhythm stays even. */
const wrap = (s: Record<string, any>): React.CSSProperties => ({
  '--misk-pt': s.padding_top != null ? `${s.padding_top}px` : '72px',
  '--misk-pb': s.padding_bottom != null ? `${s.padding_bottom}px` : '72px',
  ...(s.background_color ? { background: s.background_color } : {}),
} as React.CSSProperties);

const blocksOf = (section: any): any[] => (Array.isArray(section?.blocks) ? section.blocks : []);

/**
 * Display-copy resolver. Merchant-entered text always wins; otherwise the
 * theme's own translations supply the copy, so a fresh install reads in the
 * shopper's language instead of hard-coded English. Keys are tried in order
 * and an empty result renders nothing at all.
 */
/** The keys of `s` that hold a non-empty value (blank simple-editor fields don't override). */
const filled = (s: Record<string, any>, keys: string[]) =>
  Object.fromEntries(keys.filter((k) => typeof s[k] === 'string' && s[k].trim()).map((k) => [k, s[k]]));

const copy = (t: (k: string, o?: any) => string, value: unknown, ...keys: string[]): string => {
  const v = typeof value === 'string' ? value.trim() : '';
  if (v) return v;
  for (const k of keys) {
    const out = t(k, { defaultValue: '' });
    if (out) return out;
  }
  return '';
};

const COLS: Record<string, string> = {
  '1': 'md:grid-cols-1', '2': 'md:grid-cols-2', '3': 'md:grid-cols-3',
  '4': 'md:grid-cols-4', '5': 'md:grid-cols-5', '6': 'md:grid-cols-6', '8': 'md:grid-cols-8',
};

const SectionHead: React.FC<{
  eyebrow?: string; heading?: string; sub?: string; rule?: boolean;
  align?: 'center' | 'start'; action?: React.ReactNode; tone?: 'dark' | 'light';
}> = ({ eyebrow, heading, sub, rule, align = 'center', action, tone = 'dark' }) => {
  if (!eyebrow && !heading && !sub && !action) return null;
  const centered = align === 'center';
  return (
    <Reveal className={`mb-10 flex flex-col gap-3 ${centered ? 'items-center text-center' : 'items-start sm:flex-row sm:items-end sm:justify-between'}`}>
      <div className={centered ? 'max-w-2xl' : ''}>
        {eyebrow && <p className={`misk-eyebrow ${tone === 'light' ? 'text-white/80' : 'text-gold-ink'}`}>{eyebrow}</p>}
        {heading && <h2 className={`font-display mt-2 text-3xl leading-tight sm:text-4xl ${tone === 'light' ? 'text-white' : 'text-ink'}`}>{heading}</h2>}
        {rule && heading && <span className={`mt-4 block h-px w-16 ${centered ? 'mx-auto' : ''} ${tone === 'light' ? 'bg-white/50' : 'bg-gold'}`} />}
        {sub && <p className={`mt-3 text-base ${tone === 'light' ? 'text-white/75' : 'text-muted'}`}>{sub}</p>}
      </div>
      {action}
    </Reveal>
  );
};

/**
 * Image with a visible fallback. A missing or broken source paints a sand
 * panel with a faint mark rather than nothing at all — an invisible fallback
 * reads as a layout bug to the merchant, who then can't tell a slow CDN from
 * a wrong URL they pasted.
 */
const Media: React.FC<{ src?: string; alt?: string; className?: string; eager?: boolean }> = ({ src, alt = '', className = '', eager }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className={`grid place-items-center bg-sand text-gold opacity-40 ${className}`} aria-hidden>
        <I.sparkle className="h-7 w-7" />
      </span>
    );
  }
  return <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} onError={() => setFailed(true)} className={className} />;
};

/** Internal paths route client-side; anything with a scheme opens out. */
const Cta: React.FC<{ to?: string; className?: string; children: React.ReactNode }> = ({ to, className, children }) =>
  /^https?:\/\//i.test(to || '')
    ? <a href={to} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>
    : <Link to={to || '/products'} className={className}>{children}</Link>;

// ─── 1. Hero ──────────────────────────────────────────────────────

const HeroSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const s = useThemeSettings(id);
  const { t } = useTranslation(['theme']);
  const storeName = useStore().store?.name || '';
  // Once the merchant has their own photo, extra slides still carrying a
  // theme stock photo are dropped; slides they filled themselves stay.
  const hasOwnPhoto = !!merchantImage(s.image);
  const slides = blocksOf(section)
    .filter((b) => b.type === 'slide')
    .filter((b, i) => !hasOwnPhoto || i === 0 || !isStockImage(b.settings?.image));
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const interval = Number(s.autoplay_interval) || 6000;
  const autoplay = s.autoplay !== false && slides.length > 1;
  const go = useCallback((n: number) => setIdx((i) => (n + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    if (!autoplay || paused) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id2 = window.setTimeout(() => go(idx + 1), interval);
    return () => window.clearTimeout(id2);
  }, [autoplay, paused, idx, interval, go]);
  useEffect(() => { if (idx >= slides.length) setIdx(0); }, [idx, slides.length]);

  if (!slides.length) return null;

  const imageStart = (s.layout || 'image_start') === 'image_start';
  const height = s.section_height === 'full' ? 'md:min-h-[100svh]' : s.section_height === 'medium' ? 'md:min-h-[520px]' : 'md:min-h-[660px]';
  const radius = s.image_radius != null ? `${s.image_radius}px` : '10px';
  const pauseOnHover = s.pause_on_hover !== false;

  return (
    <section
      className={`relative overflow-hidden ${height}`}
      style={{ background: s.band_color || 'var(--misk-midnight, #191528)', '--misk-hero-duration': `${interval}ms` } as React.CSSProperties}
      aria-roledescription="carousel"
      aria-label={storeName || undefined}
      onMouseEnter={() => pauseOnHover && setPaused(true)}
      onMouseLeave={() => pauseOnHover && setPaused(false)}
    >
      <div className={`relative mx-auto grid max-w-[1320px] ${height}`}>
        {slides.map((slide, i) => {
          // The section-level (My Store) settings override the first slide.
          const b = i === 0 ? { ...(slide.settings || {}), ...filled(s, ['heading', 'subheading', 'image', 'cta_text']) } : slide.settings || {};
          const active = i === idx;
          // Merchant copy only: extras (eyebrow, short line) show when typed,
          // the title falls back to the store name.
          const heading = merchantText(b.heading) || storeName;
          const sub = merchantText(b.subheading);
          const eyebrow = merchantText(b.eyebrow);
          const cta = copy(t, b.cta_text, 'theme.hero.cta');
          return (
            <div
              key={slide.id || i}
              aria-hidden={!active}
              className={`grid items-center gap-8 px-4 pb-24 pt-12 sm:px-6 md:grid-cols-2 md:gap-14 md:pb-28 md:pt-16 ${height} ${active ? 'relative z-10 opacity-100' : 'pointer-events-none absolute inset-0 z-0 opacity-0'} transition-opacity duration-700`}
            >
              <div className={`overflow-hidden ${imageStart ? 'md:order-1' : 'md:order-2'}`} style={{ borderRadius: radius }}>
                <Media
                  src={b.image}
                  alt=""
                  eager={i === 0}
                  className={`aspect-[4/5] w-full object-cover ${active && s.zoom_effect !== false ? 'misk-kenburns' : ''}`}
                />
              </div>
              <div
                key={active ? `on-${i}` : `off-${i}`}
                className={`misk-caption flex flex-col items-center gap-4 text-center md:items-start md:text-start ${imageStart ? 'md:order-2' : 'md:order-1'}`}
              >
                {eyebrow && <p className="misk-eyebrow text-white/75">{eyebrow}</p>}
                {heading && <h1 className="font-display text-3xl leading-tight text-white sm:text-5xl md:text-6xl">{heading}</h1>}
                {sub && <p className="max-w-md text-base text-white/80">{sub}</p>}
                {cta && <Cta to={b.cta_url} className="misk-btn misk-btn-light mt-2">{cta}</Cta>}
              </div>
            </div>
          );
        })}
      </div>

      {slides.length > 1 && (
        <div className="absolute inset-x-0 bottom-6 z-20 mx-auto flex max-w-[1320px] items-center justify-center gap-4 px-4 sm:px-6 md:justify-start">
          {s.show_arrows !== false && (
            <div className="flex gap-2">
              <button type="button" onClick={() => go(idx - 1)} aria-label={t('theme.hero.prev')} className="grid h-11 w-11 place-items-center rounded-full border border-white/35 text-white transition-colors duration-300 hover:bg-white hover:text-ink">
                <I.chevronLeft className="h-5 w-5 rtl:-scale-x-100" />
              </button>
              <button type="button" onClick={() => go(idx + 1)} aria-label={t('theme.hero.next')} className="grid h-11 w-11 place-items-center rounded-full border border-white/35 text-white transition-colors duration-300 hover:bg-white hover:text-ink">
                <I.chevronRight className="h-5 w-5 rtl:-scale-x-100" />
              </button>
            </div>
          )}
          {s.show_progress !== false && (
            <div className="h-px w-24 overflow-hidden bg-white/25 sm:w-40">
              <span key={idx} className="misk-progress block h-full w-full bg-white" />
            </div>
          )}
          {s.show_counter !== false && (
            <p className="misk-num text-xs text-white/75" aria-live="polite">
              {t('theme.hero.slide_label', { current: idx + 1, total: slides.length })}
            </p>
          )}
        </div>
      )}
    </section>
  );
};

// ─── 2. Shop by notes ─────────────────────────────────────────────

const NotesSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const s = useThemeSettings(id);
  const { t } = useTranslation(['theme']);
  const { categories } = useCategories();
  const max = Number(s.max_items) || 8;
  const fromBlocks = blocksOf(section).filter((b) => b.type === 'note');

  const items = useMemo(() => {
    if (s.source === 'categories') {
      return categories.slice(0, max).map((c: any) => ({
        key: c._id, image: c.image || c.imageUrl, title: c.name, url: `/categories/${c.slug}`,
      }));
    }
    return fromBlocks.slice(0, max).map((b, i) => ({
      key: b.id || i,
      image: b.settings?.image,
      title: copy(t, b.settings?.title, `theme.notes.items.${i + 1}`),
      url: b.settings?.link_url || '/products',
    }));
  }, [s.source, categories, fromBlocks, max, t]);

  if (!items.length) return null;

  const shape = s.image_shape || 'free';
  const frame =
    shape === 'circle' ? 'aspect-square overflow-hidden rounded-full bg-sand'
    : shape === 'rounded' ? 'aspect-square overflow-hidden rounded-[var(--radius-lg,18px)] bg-sand'
    : 'aspect-square';

  return (
    <section className="misk-section" style={wrap(s)}>
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6">
        <SectionHead
          heading={copy(t, s.heading, 'theme.notes.heading')}
          sub={copy(t, s.subheading, 'theme.notes.sub')}
        />
        {/* Phones get a 3-per-view swipe rail — the reference ships a
            one-per-view carousel here, which spends a whole screen on one tile. */}
        <ul className={`misk-rail misk-snap misk-snap-3 md:mx-0 md:grid md:gap-x-6 md:gap-y-8 md:overflow-visible md:p-0 ${COLS[String(s.columns || '8')] || 'md:grid-cols-8'}`}>
          {items.map((it, i) => (
            <li key={it.key} className="md:w-auto">
              <Reveal delay={(i % 4) as 0 | 1 | 2 | 3}>
                <Link to={it.url} className="group flex flex-col items-center gap-3 text-center">
                  <span className={`misk-zoom block w-full ${frame}`}>
                    <Media src={it.image} className="h-full w-full object-contain" />
                  </span>
                  {it.title && <span className="font-display text-base text-ink transition-colors duration-300 group-hover:text-gold-ink">{it.title}</span>}
                </Link>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

// ─── 3. Collection cards ──────────────────────────────────────────

const ScentCardsSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const s = useThemeSettings(id);
  const { t } = useTranslation(['theme']);
  const cards = blocksOf(section).filter((b) => b.type === 'card');
  if (!cards.length) return null;

  const layout = s.layout || 'text_start';
  const above = layout === 'text_above';
  const aspect = s.aspect === 'portrait' ? 'aspect-[3/4]' : s.aspect === 'landscape' ? 'aspect-[4/3]' : 'aspect-square';
  const radius = s.card_radius != null ? `${s.card_radius}px` : '14px';

  const eyebrow = copy(t, s.eyebrow, 'theme.scent_cards.eyebrow');
  const heading = copy(t, s.heading, 'theme.scent_cards.heading');
  const sub = copy(t, s.subheading, 'theme.scent_cards.sub');
  const cta = copy(t, s.cta_text, 'theme.scent_cards.cta');

  const intro = (
    <Reveal className={`flex flex-col gap-4 ${above ? 'items-center text-center' : 'items-start text-start'}`}>
      {eyebrow && <p className="misk-eyebrow text-gold-ink">{eyebrow}</p>}
      {heading && <h2 className="font-display text-4xl leading-tight text-ink sm:text-5xl">{heading}</h2>}
      {sub && <p className="max-w-sm text-base text-muted">{sub}</p>}
      {cta && <Cta to={s.cta_url} className="misk-btn misk-btn-outline mt-2">{cta}</Cta>}
    </Reveal>
  );

  const grid = (
    <ul className="misk-rail misk-snap md:mx-0 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:p-0">
      {cards.map((b, i) => {
        const c = b.settings || {};
        const title = copy(t, c.title, `theme.scent_cards.items.${i + 1}`);
        return (
          <li key={b.id || i}>
            <Reveal delay={(i % 4) as 0 | 1 | 2 | 3}>
              <Link to={c.link_url || '/products'} className="group relative block overflow-hidden" style={{ borderRadius: radius }}>
                <span className={`misk-zoom block ${aspect} bg-sand`}>
                  <Media src={c.image} className="h-full w-full object-cover" />
                </span>
                {title && (
                  /* Solid ink, not a tint. The label sits over whatever photo
                     the merchant uploads, so its legibility cannot depend on
                     how bright that photo happens to be. (`bg-ink/75` would
                     not have worked anyway — these palette colours are bare
                     `var()`s and Tailwind drops the alpha modifier silently.) */
                  <span className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-full bg-ink px-5 py-3 text-center font-display text-lg text-white shadow-[var(--shadow-md)] transition-transform duration-300 group-hover:-translate-y-[calc(50%+6px)]">
                    {title}
                  </span>
                )}
              </Link>
            </Reveal>
          </li>
        );
      })}
    </ul>
  );

  return (
    <section className="misk-section" style={wrap(s)}>
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6">
        {above ? (
          <div className="flex flex-col gap-10">{intro}{grid}</div>
        ) : (
          <div className={`grid items-center gap-10 ${layout === 'text_end' ? 'md:grid-cols-[minmax(0,1fr)_minmax(0,320px)]' : 'md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]'}`}>
            <div className={layout === 'text_end' ? 'md:order-2' : 'md:order-1'}>{intro}</div>
            <div className={layout === 'text_end' ? 'md:order-1' : 'md:order-2'}>{grid}</div>
          </div>
        )}
      </div>
    </section>
  );
};

// ─── 4. Concept collage ───────────────────────────────────────────

const ConceptSection: React.FC<SectionComponentProps> = ({ id }) => {
  const s = useThemeSettings(id);
  const { t } = useTranslation(['theme']);
  const textStart = (s.layout || 'text_start') === 'text_start';
  const color = s.text_color || '#ffffff';
  const body = copy(t, s.body, 'theme.concept.body');
  const eyebrow = copy(t, s.eyebrow, 'theme.concept.eyebrow');
  const heading = copy(t, s.heading, 'theme.concept.heading');
  const cta = copy(t, s.cta_text, 'theme.concept.cta');

  return (
    <section className="misk-section overflow-hidden" style={{ ...wrap(s), color }}>
      <div className="mx-auto grid max-w-[1320px] items-center gap-10 px-4 sm:px-6 md:grid-cols-2 md:gap-16">
        <div className={`flex flex-col gap-5 ${textStart ? 'md:order-1' : 'md:order-2'}`}>
          <Reveal>
            {eyebrow && <p className="misk-eyebrow opacity-75">{eyebrow}</p>}
            {heading && <h2 className="font-display mt-2 text-3xl leading-tight sm:text-5xl">{heading}</h2>}
          </Reveal>
          {body && (
            <Reveal delay={1}>
              {/* Rich text is sanitized server-side on the customization write path. */}
              <div className="max-w-prose text-base opacity-85 [&_a]:underline [&_p+p]:mt-4" dangerouslySetInnerHTML={{ __html: body }} />
            </Reveal>
          )}
          {cta && (
            <Reveal delay={2}>
              <Cta to={s.cta_url} className="misk-btn misk-btn-outline-light mt-2">{cta}</Cta>
            </Reveal>
          )}
        </div>

        {/* Asymmetric collage: one tall frame beside two stacked pairs. Phones
            drop to two columns so the tall frame still reads as the anchor. */}
        <div className={`grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 ${textStart ? 'md:order-2' : 'md:order-1'}`}>
          <Reveal className="row-span-2">
            <Media src={s.image_main} className="h-full min-h-[280px] w-full rounded-[var(--radius-sm,6px)] object-cover sm:min-h-[460px]" />
          </Reveal>
          <Reveal delay={1}><Media src={s.image_2} className="aspect-[4/3] w-full rounded-[var(--radius-sm,6px)] object-cover" /></Reveal>
          <Reveal delay={2}><Media src={s.image_3} className="aspect-[4/3] w-full rounded-[var(--radius-sm,6px)] object-cover" /></Reveal>
          <Reveal delay={3}><Media src={s.image_4} className="aspect-[4/3] w-full rounded-[var(--radius-sm,6px)] object-cover" /></Reveal>
          <Reveal delay={4}><Media src={s.image_5} className="aspect-[4/3] w-full rounded-[var(--radius-sm,6px)] object-cover" /></Reveal>
        </div>
      </div>
    </section>
  );
};

// ─── 5. Product grid ──────────────────────────────────────────────

/** The storefront API exposes no "on sale" filter, so that source over-fetches
 *  and narrows client-side rather than silently falling back to newest. */
const useGridProducts = (source: string, limit: number, collectionHandle?: string) => {
  const wantSale = source === 'sale';
  const featured = useFeaturedProducts(source === 'featured' ? limit : 1);
  const listed = useProducts(
    source === 'featured' || collectionHandle
      ? { limit: 1 }
      : { limit: wantSale ? Math.min(limit * 4, 48) : limit, sort: source === 'popular' ? 'popular' : 'newest' }
  );
  const coll = useCollection(collectionHandle || '', { limit });

  if (collectionHandle) return { products: coll.products || [], loading: coll.loading };
  if (source === 'featured') return { products: featured.products, loading: featured.loading };
  const products = wantSale
    ? (listed.products || []).filter((p: any) => Number(p.compareAtPrice) > Number(p.price))
    : listed.products;
  return { products, loading: listed.loading };
};

const ProductGridSection: React.FC<SectionComponentProps> = ({ id, onQuickView }) => {
  const s = useThemeSettings(id);
  const { t } = useTranslation(['theme']);
  const limit = Number(s.product_limit) || 12;
  const source = s.product_source || 'newest';
  const { products, loading } = useGridProducts(source, limit, s.collection || undefined);

  if (!loading && !products.length) return null;

  const cols = COLS[String(s.columns || '4')] || 'md:grid-cols-4';
  const mobile = s.mobile_layout || 'grid-2';
  const rail = mobile === 'rail';
  const base = rail
    ? 'misk-rail misk-snap md:mx-0 md:grid md:overflow-visible md:p-0'
    : `grid ${mobile === 'grid-1' ? 'grid-cols-1' : 'grid-cols-2'}`;
  const viewAll = copy(t, s.view_all_text, 'theme.product_grid.view_all');
  const align: 'center' | 'start' = s.align === 'start' ? 'start' : 'center';

  return (
    <section className="misk-section" style={wrap(s)}>
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6">
        <SectionHead
          eyebrow={copy(t, s.eyebrow, `theme.product_grid.by_source.${source}.eyebrow`, 'theme.product_grid.eyebrow')}
          heading={copy(t, s.heading, `theme.product_grid.by_source.${source}.heading`, 'theme.product_grid.heading')}
          sub={copy(t, s.subheading, `theme.product_grid.by_source.${source}.sub`, 'theme.product_grid.sub')}
          rule={s.show_rule !== false}
          align={align}
          action={s.show_view_all !== false && viewAll && align === 'start' ? (
            <Cta to={s.view_all_url} className="misk-eyebrow inline-flex items-center gap-2 border-b border-ink pb-1 text-ink transition-colors duration-300 hover:border-gold-ink hover:text-gold-ink">
              {viewAll} <I.arrowRight className="h-4 w-4 rtl:-scale-x-100" />
            </Cta>
          ) : null}
        />

        <div className={`${base} gap-x-4 gap-y-8 sm:gap-x-6 sm:gap-y-10 ${cols}`}>
          {loading
            ? Array.from({ length: Math.min(limit, 8) }).map((_, i) => (
                <div key={i}><Skeleton className="aspect-square" /><Skeleton className="mt-4 h-5 w-3/4" /><Skeleton className="mt-2 h-4 w-1/3" /></div>
              ))
            : products.slice(0, limit).map((p: any, i: number) => (
                <Reveal key={p._id} delay={(i % 4) as 0 | 1 | 2 | 3}>
                  <MiskProductCard product={p} onQuickView={onQuickView} />
                </Reveal>
              ))}
        </div>

        {s.show_view_all !== false && viewAll && align === 'center' && (
          <div className="mt-10 text-center">
            <Cta to={s.view_all_url} className="misk-btn misk-btn-outline">{viewAll}</Cta>
          </div>
        )}
      </div>
    </section>
  );
};

// ─── 6. Countdown banner ──────────────────────────────────────────

/** Resolves the merchant's date to a timestamp. Daily repeat rolls forward to
 *  the next occurrence; an empty or unparseable value yields null and the
 *  section renders nothing — this theme never invents a deadline. */
export function resolveDeadline(raw: string, repeatDaily: boolean): number | null {
  const v = String(raw || '').trim();
  if (!v) return null;
  const ms = Date.parse(/T/.test(v) ? v : `${v}T23:59:59`);
  if (Number.isNaN(ms)) return null;
  if (!repeatDaily) return ms;
  const now = Date.now();
  if (ms > now) return ms;
  const day = 86400000;
  return ms + Math.ceil((now - ms) / day) * day;
}

const CountdownSection: React.FC<SectionComponentProps> = ({ id }) => {
  const s = useThemeSettings(id);
  const { t } = useTranslation(['theme']);
  const deadline = useMemo(() => resolveDeadline(s.end_at, s.repeat_daily === true), [s.end_at, s.repeat_daily]);
  const [left, setLeft] = useState<number>(() => (deadline ? deadline - Date.now() : 0));

  useEffect(() => {
    if (!deadline) return;
    setLeft(deadline - Date.now());
    const id2 = window.setInterval(() => setLeft(deadline - Date.now()), 1000);
    return () => window.clearInterval(id2);
  }, [deadline]);

  if (!deadline) return null;
  const done = left <= 0;
  if (done && s.hide_when_expired !== false) return null;

  const total = Math.max(0, left);
  const parts = [
    { v: Math.floor(total / 86400000), label: t('theme.countdown.days') },
    { v: Math.floor((total / 3600000) % 24), label: t('theme.countdown.hours') },
    { v: Math.floor((total / 60000) % 60), label: t('theme.countdown.minutes') },
    { v: Math.floor((total / 1000) % 60), label: t('theme.countdown.seconds') },
  ];
  const color = s.text_color || '#ffffff';
  const overlay = Number(s.overlay_opacity ?? 45) / 100;
  const eyebrow = copy(t, s.eyebrow, 'theme.countdown.eyebrow');
  const heading = copy(t, s.heading, 'theme.countdown.heading');
  const cta = copy(t, s.cta_text, 'theme.countdown.cta');

  return (
    <section className="misk-section relative overflow-hidden" style={wrap(s)}>
      <div className="absolute inset-0" aria-hidden>
        <Media src={s.background_image} className="h-full w-full object-cover" />
        <span className="absolute inset-0 bg-black" style={{ opacity: overlay }} />
      </div>
      <div
        className="relative mx-auto flex max-w-[1320px] flex-col items-center justify-between gap-8 px-4 py-14 text-center sm:px-6 md:flex-row md:text-start"
        style={{ minHeight: `${Number(s.min_height) || 320}px`, color }}
      >
        <div className="flex flex-col gap-3">
          {eyebrow && <p className="misk-eyebrow opacity-85">{eyebrow}</p>}
          {heading && <h2 className="font-display max-w-xl text-2xl leading-tight sm:text-4xl">{heading}</h2>}
          {cta && <Cta to={s.cta_url} className="misk-eyebrow mt-2 inline-flex self-center border-b-2 border-current pb-1 md:self-start">{cta}</Cta>}
        </div>

        {done ? (
          <p className="font-display text-2xl">{t('theme.countdown.ended')}</p>
        ) : (
          <ul className="flex items-center gap-5 sm:gap-8">
            {parts.map((p) => (
              <li key={p.label} className="text-center">
                <span className="misk-num block text-3xl font-bold sm:text-5xl">{String(p.v).padStart(2, '0')}</span>
                <span className="mt-1 block text-xs opacity-80">{p.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

// ─── 7. Promise strip ─────────────────────────────────────────────

const UspStripSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const s = useThemeSettings(id);
  const { t } = useTranslation(['theme']);
  const items = blocksOf(section).filter((b) => b.type === 'item');
  if (!items.length) return null;
  const divide = s.show_dividers !== false;

  return (
    <section className="misk-section" style={wrap(s)}>
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6">
        <ul className={`grid grid-cols-1 gap-6 sm:grid-cols-2 ${COLS[String(s.columns || '4')] || 'md:grid-cols-4'} ${divide ? 'md:divide-x md:divide-line rtl:md:divide-x-reverse' : ''}`}>
          {items.map((b, i) => {
            const c = b.settings || {};
            const Icon = iconFor(c.icon);
            return (
              <li key={b.id || i} className={divide ? 'md:px-6 md:first:ps-0 md:last:pe-0' : ''}>
                <Reveal delay={(i % 4) as 0 | 1 | 2 | 3} className="flex items-start gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-line text-gold-ink"><Icon className="h-6 w-6" /></span>
                  <span>
                    <span className="block font-display text-lg text-ink">{copy(t, c.title, `theme.usp.items.${i + 1}.title`)}</span>
                    <span className="mt-1 block text-sm text-muted">{copy(t, c.text, `theme.usp.items.${i + 1}.text`)}</span>
                  </span>
                </Reveal>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};

// ─── 8. Split banner ──────────────────────────────────────────────

const SplitBannerSection: React.FC<SectionComponentProps> = ({ id }) => {
  const s = useThemeSettings(id);
  const { t } = useTranslation(['theme']);
  const imageStart = (s.layout || 'image_start') === 'image_start';
  const radius = s.image_radius != null ? `${s.image_radius}px` : '10px';
  const eyebrow = copy(t, s.eyebrow, 'theme.split.eyebrow');
  const heading = copy(t, s.heading, 'theme.split.heading');
  const sub = copy(t, s.subheading, 'theme.split.sub');
  const cta = copy(t, s.cta_text, 'theme.split.cta');

  return (
    <section className="misk-section" style={wrap(s)}>
      <div className="mx-auto grid max-w-[1320px] items-center gap-10 px-4 sm:px-6 md:grid-cols-2 md:gap-14">
        <Reveal className={imageStart ? 'md:order-1' : 'md:order-2'}>
          <Media src={s.image} className="aspect-[4/3] w-full object-cover" />
        </Reveal>
        <Reveal delay={1} className={`flex flex-col items-start gap-4 ${imageStart ? 'md:order-2' : 'md:order-1'}`}>
          {eyebrow && <p className="misk-eyebrow text-gold-ink">{eyebrow}</p>}
          {heading && <h2 className="font-display text-3xl leading-tight text-ink sm:text-4xl">{heading}</h2>}
          {sub && <p className="max-w-md text-base text-muted">{sub}</p>}
          {cta && <Cta to={s.cta_url} className="misk-btn misk-btn-solid mt-2">{cta}</Cta>}
        </Reveal>
      </div>
    </section>
  );
};

// ─── 9. Category tiles ────────────────────────────────────────────

const CategoryTilesSection: React.FC<SectionComponentProps> = ({ id }) => {
  const s = useThemeSettings(id);
  const { t } = useTranslation(['theme']);
  const { categories, loading } = useCategories();
  const max = Number(s.max_categories) || 6;
  const list = categories.slice(0, max);
  if (!loading && !list.length) return null;
  const radius = s.card_radius != null ? `${s.card_radius}px` : '14px';

  return (
    <section className="misk-section" style={wrap(s)}>
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6">
        <SectionHead
          eyebrow={copy(t, s.eyebrow, 'theme.categories.eyebrow')}
          heading={copy(t, s.heading, 'theme.categories.heading')}
          sub={copy(t, s.subheading, 'theme.categories.sub')}
          align={s.align === 'start' ? 'start' : 'center'}
        />
        <ul className={`grid grid-cols-2 gap-4 sm:gap-5 ${COLS[String(s.columns || '3')] || 'md:grid-cols-3'}`}>
          {list.map((c: any, i: number) => (
            <li key={c._id}>
              <Reveal delay={(i % 4) as 0 | 1 | 2 | 3}>
                <Link to={`/categories/${c.slug}`} className="group relative block overflow-hidden" style={{ borderRadius: radius }}>
                  <span className="misk-zoom block aspect-[4/3] bg-sand">
                    <Media src={c.image || c.imageUrl} className="h-full w-full object-cover" />
                  </span>
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4 text-center">
                    <span className="block font-display text-lg text-white">{c.name}</span>
                    {s.show_product_count !== false && typeof c.productCount === 'number' && (
                      <span className="misk-num mt-0.5 block text-xs text-white/80">{t('theme.categories.count', { count: c.productCount })}</span>
                    )}
                  </span>
                </Link>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

// ─── 10. Testimonials ─────────────────────────────────────────────

const TestimonialsSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const s = useThemeSettings(id);
  const { t } = useTranslation(['theme']);
  const quotes = blocksOf(section).filter((b) => b.type === 'quote');
  if (!quotes.length) return null;

  return (
    <section className="misk-section" style={wrap(s)}>
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6">
        <SectionHead
          eyebrow={copy(t, s.eyebrow, 'theme.testimonials.eyebrow')}
          heading={copy(t, s.heading, 'theme.testimonials.heading')}
          sub={copy(t, s.subheading, 'theme.testimonials.sub')}
          align={s.align === 'start' ? 'start' : 'center'}
        />
        <ul className="misk-rail misk-snap md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:p-0">
          {quotes.map((b, i) => {
            const c = b.settings || {};
            const quote = copy(t, c.quote, `theme.testimonials.items.${i + 1}.quote`);
            if (!quote) return null;
            return (
              <li key={b.id || i}>
                <Reveal delay={(i % 4) as 0 | 1 | 2 | 3}>
                  <figure className="flex h-full flex-col gap-4 rounded-[var(--radius-lg,18px)] border border-line bg-white p-6">
                    <I.quote className="h-6 w-6 text-gold" />
                    <blockquote className="flex-1 text-base text-ink">{quote}</blockquote>
                    <figcaption className="text-sm">
                      <span className="block font-bold text-ink">{copy(t, c.name, `theme.testimonials.items.${i + 1}.name`)}</span>
                      <span className="block text-muted">{copy(t, c.role, `theme.testimonials.items.${i + 1}.role`)}</span>
                    </figcaption>
                  </figure>
                </Reveal>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};

// ─── 11. Stories ──────────────────────────────────────────────────

const StoriesSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const s = useThemeSettings(id);
  const { t } = useTranslation(['theme']);
  const posts = blocksOf(section).filter((b) => b.type === 'post');
  if (!posts.length) return null;
  const cta = copy(t, s.cta_text, 'theme.stories.cta');

  return (
    <section className="misk-section" style={wrap(s)}>
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6">
        <SectionHead
          eyebrow={copy(t, s.eyebrow, 'theme.stories.eyebrow')}
          heading={copy(t, s.heading, 'theme.stories.heading')}
          align={s.align === 'start' ? 'start' : 'center'}
          action={cta ? (
            <Cta to={s.cta_url} className="misk-eyebrow inline-flex items-center gap-2 border-b border-ink pb-1 text-ink transition-colors duration-300 hover:border-gold-ink hover:text-gold-ink">
              {cta} <I.arrowRight className="h-4 w-4 rtl:-scale-x-100" />
            </Cta>
          ) : null}
        />
        <ul className="misk-rail misk-snap md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:p-0">
          {posts.map((b, i) => {
            const c = b.settings || {};
            const title = copy(t, c.title, `theme.stories.items.${i + 1}.title`);
            return (
              <li key={b.id || i}>
                <Reveal delay={(i % 4) as 0 | 1 | 2 | 3}>
                  <Link to={c.link_url || '/pages/about'} className="group block">
                    <span className="misk-zoom block aspect-[4/3] overflow-hidden rounded-[var(--radius-lg,18px)] bg-sand">
                      <Media src={c.image} className="h-full w-full object-cover" />
                    </span>
                    {c.date && <span className="misk-num mt-4 block text-xs text-muted">{c.date}</span>}
                    {title && <span className="mt-1 block font-display text-xl text-ink transition-colors duration-300 group-hover:text-gold-ink">{title}</span>}
                    <span className="mt-2 block text-sm text-muted">{copy(t, c.excerpt, `theme.stories.items.${i + 1}.excerpt`)}</span>
                    <span className="misk-eyebrow mt-3 inline-flex items-center gap-2 text-gold-ink">
                      {t('theme.stories.read')} <I.arrowRight className="h-4 w-4 rtl:-scale-x-100" />
                    </span>
                  </Link>
                </Reveal>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};

// ─── 12. Ticker ───────────────────────────────────────────────────

const SEPARATORS: Record<string, string> = { diamond: '◆', dot: '•', slash: '/', none: '' };

const MarqueeSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const s = useThemeSettings(id);
  const { t } = useTranslation(['theme']);
  const messages = blocksOf(section)
    .filter((b) => b.type === 'message')
    .map((b, i) => copy(t, b.settings?.text, `theme.marquee.${i + 1}`))
    .filter(Boolean);
  if (!messages.length) return null;

  const sep = SEPARATORS[s.separator || 'diamond'] ?? '◆';
  // Duplicated once so the -50% keyframe loops seamlessly.
  const run = [...messages, ...messages];

  return (
    <section className="misk-marquee misk-section overflow-hidden" style={{ ...wrap(s), color: s.text_color || undefined }} aria-label={messages.join(' · ')}>
      <div className="misk-marquee-track" style={{ '--misk-marquee-duration': `${Number(s.speed) || 34}s` } as React.CSSProperties} aria-hidden>
        {run.map((m, i) => (
          <span key={i} className="flex items-center whitespace-nowrap px-6 font-display text-lg sm:text-2xl">
            {m}{sep && <span className="ms-6 text-gold">{sep}</span>}
          </span>
        ))}
      </div>
    </section>
  );
};

// ─── registry ─────────────────────────────────────────────────────

export const MISK_SECTION_REGISTRY: Record<string, SectionComponent> = {
  ...DEFAULT_SECTION_REGISTRY,
  'misk-hero': HeroSection,
  'misk-notes': NotesSection,
  'misk-scent-cards': ScentCardsSection,
  'misk-concept': ConceptSection,
  'misk-product-grid': ProductGridSection,
  'misk-countdown': CountdownSection,
  'misk-usp-strip': UspStripSection,
  'misk-split-banner': SplitBannerSection,
  'misk-category-tiles': CategoryTilesSection,
  'misk-testimonials': TestimonialsSection,
  'misk-stories': StoriesSection,
  'misk-marquee': MarqueeSection,
};
