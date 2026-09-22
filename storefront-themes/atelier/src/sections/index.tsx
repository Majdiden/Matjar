/**
 * Atelier section registry — merged over the shared defaults so the
 * universal product/page sections keep working.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DEFAULT_SECTION_REGISTRY, type SectionComponent, type SectionComponentProps } from '@matjar/theme-shared/components/sections';
import { useSectionBlocks, useThemeSettings } from '@matjar/theme-shared/theme/ThemeProvider';
import { useCategories, useFeaturedProducts, useProducts } from '@matjar/theme-shared/hooks/useProducts';
import { storefrontApi } from '@matjar/theme-shared/api/client';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { Skeleton } from '@matjar/theme-shared/components/primitives/Skeleton';
import AtelierProductCard from '../components/AtelierProductCard';
import { UspStrip } from '../components/chrome/Footer';
import { useAnnouncementMessages } from '../components/chrome/AnnouncementBar';
import { useAtelierUI } from '../contexts/AtelierUI';
import { BeforeAfter, CountUp, Icon, Marquee, Reveal, prefersReducedMotion } from '../lib/motion';
import manifest from '../theme.manifest';

/** Resolved blocks, falling back to the manifest definition's defaults when a store instance carries none. */
function useBlocks(id: string, section?: { type: string }) {
  const blocks = useSectionBlocks(id);
  if (blocks.length || !section) return blocks;
  const def = manifest.sections.find((d) => d.type === section.type);
  return (def?.defaultBlocks || []).map((b) => ({ id: b.id, type: b.type, settings: b.settings || {} }));
}

// ─── Helpers ──────────────────────────────────────────────────────

const Shell: React.FC<{ s: Record<string, any>; children: React.ReactNode; className?: string; full?: boolean; reveal?: boolean }> = ({ s, children, className = '', full, reveal = true }) => {
  const style: React.CSSProperties = {
    paddingTop: s.padding_top != null ? `${s.padding_top}px` : 'var(--at-section-pad, 30px)',
    paddingBottom: s.padding_bottom != null ? `${s.padding_bottom}px` : 'var(--at-section-pad, 30px)',
    backgroundColor: s.background_color || undefined,
  };
  const inner = full ? children : <div className={`mx-auto max-w-[1320px] px-4 sm:px-6 ${className}`}>{children}</div>;
  return <section style={style}>{reveal ? <Reveal>{inner}</Reveal> : inner}</section>;
};

/** Seeded default blocks carry no copy; translate by section type + index so
 *  the shipped demo content is bilingual. Merchant-entered text always wins. */
const useBlockT = () => { const st = useSoftT(); return (key: string, i: number, field: string, val: any) => (val || st(`theme.section.${key}.blocks.${i}.${field}`)); };

/** Translate, but treat a missing key (echoed back by i18next) as empty. */
const useSoftT = () => { const { t } = useTranslation(['theme']); return (k: string) => { const v = t(k, { defaultValue: '' }); return !v || v === k || v.startsWith('theme.') ? '' : v; }; };

const Heading: React.FC<{ s: Record<string, any>; fallbackKey: string; id?: string; align?: 'start' | 'center'; light?: boolean; className?: string }> = ({ s, fallbackKey, id, align = 'center', light, className = '' }) => {
  const st = useSoftT();
  // Instance key first (two instances can share one section type and need
  // different copy), then the section-type key.
  const k = (f: string) => (id ? st(`theme.section.${id}.${f}`) : '') || st(`theme.section.${fallbackKey}.${f}`);
  const eyebrow = s.eyebrow || k('eyebrow');
  const heading = s.heading || k('heading');
  const sub = s.subheading || k('subheading');
  if (!eyebrow && !heading && !sub) return null;
  return (
    <div className={`${align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'} ${className}`}>
      {eyebrow && <p className={`at-eyebrow ${light ? '!text-[color:var(--atelier-bronze)]' : ''}`}>{eyebrow}</p>}
      {heading && <h2 className={`mt-2 font-display text-[30px] font-medium leading-[1.15] sm:text-[38px] ${light ? 'text-white' : ''}`}>{heading}</h2>}
      {sub && <p className={`mt-3 text-[15px] leading-relaxed ${light ? 'text-white/85' : 'text-[#4a4a4a]'}`}>{sub}</p>}
    </div>
  );
};

const Cta: React.FC<{ s: Record<string, any>; fallbackKey?: string; id?: string; variant?: string; className?: string }> = ({ s, fallbackKey, id, variant = 'at-btn-dark', className = '' }) => {
  const st = useSoftT();
  const text = s.cta_text || (id ? st(`theme.section.${id}.cta`) : '') || (fallbackKey ? st(`theme.section.${fallbackKey}.cta`) : '');
  if (!text) return null;
  return <Link to={s.cta_url || '/products'} className={`at-btn ${variant} ${className}`}>{text}</Link>;
};

const IconItem: React.FC<{ icon: string; title: string; text?: string; center?: boolean }> = ({ icon, title, text, center = true }) => (
  <div className={`${center ? 'text-center' : ''}`}>
    <span className={`inline-flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--color-accent)] text-[color:var(--atelier-bronze-ink)]`}><Icon name={icon} className="h-7 w-7" /></span>
    <h3 className="mt-4 text-[16px] font-extrabold">{title}</h3>
    {text && <p className="mt-1.5 text-[14px] leading-relaxed text-[#4a4a4a]">{text}</p>}
  </div>
);

// ─── 1. Fade slideshow ────────────────────────────────────────────

const HeroSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const s = useThemeSettings(id);
  const blocks = useBlocks(id, section);
  const { t } = useTranslation(['theme']);
  const bt = useBlockT();
  const slides = blocks.length ? blocks : [{ id: 'fallback', type: 'slide', settings: {} }];
  const [idx, setIdx] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [hover, setHover] = useState(false);
  const interval = Number(s.autoplay_interval || 4000);
  const autoplay = s.autoplay !== false && slides.length > 1 && !(s.pause_on_hover && hover);
  const reduced = prefersReducedMotion();
  const go = (n: number) => { setIdx(((n % slides.length) + slides.length) % slides.length); setCycle((c) => c + 1); };
  useEffect(() => {
    if (!autoplay) return;
    const t0 = setInterval(() => go(idx + 1), interval);
    return () => clearInterval(t0);
  }, [autoplay, interval, idx, slides.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const h = s.section_height === 'full' ? 'h-[100svh]' : s.section_height === 'medium' ? 'h-[70vh] min-h-[480px]' : 'h-[90vh] min-h-[560px]';
  const overlay = Number(s.overlay_opacity ?? 35) / 100;
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return (
    <section className={`relative w-full overflow-hidden bg-[#1c1c1c] ${h}`} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} aria-roledescription="carousel">
      {slides.map((sl, i) => {
        const active = i === idx;
        const st = sl.settings || {};
        const eyebrow = bt('hero', i, 'eyebrow', st.eyebrow);
        const heading = bt('hero', i, 'heading', st.heading);
        const cta = st.cta_text || t('theme.section.hero.cta');
        return (
          <div key={sl.id} className={`absolute inset-0 transition-opacity duration-[600ms] ease-hero ${active ? 'opacity-100' : 'opacity-0'}`} aria-hidden={!active} {...(!active ? { inert: '' as any } : {})} aria-roledescription="slide" aria-label={`${i + 1} / ${slides.length}`}>
            {st.image && (
              <img key={`${sl.id}-${active ? cycle : 'idle'}`} src={st.image} alt="" className="absolute inset-0 h-full w-full object-cover will-change-transform" style={active && !reduced ? { animation: `at-kenburns ${interval}ms linear forwards` } : undefined} />
            )}
            <div className="absolute inset-0" style={{ background: `linear-gradient(to top, rgba(0,0,0,${Math.min(0.8, overlay + 0.2)}) 0%, rgba(0,0,0,${overlay}) 45%, rgba(0,0,0,${overlay * 0.6}) 100%)` }} />
            <div className={`relative mx-auto flex h-full max-w-[1320px] flex-col justify-center px-6 pt-24 sm:px-10 ${s.align === 'center' ? 'items-center text-center' : 'items-start'}`}>
              {active && (
                <div key={cycle} className="max-w-2xl">
                  {eyebrow && <p className="at-eyebrow !text-[color:var(--atelier-bronze)] opacity-0" style={{ animation: 'at-caption .6s ease-out forwards', animationDelay: '0ms' }}>{eyebrow}</p>}
                  {heading && <h1 className="mt-4 font-display text-[40px] font-medium leading-[1.05] text-white opacity-0 sm:text-[56px] lg:text-[72px]" style={{ animation: 'at-caption .6s ease-out forwards', animationDelay: '120ms' }}>{heading}</h1>}
                  {cta && <div className="mt-8 opacity-0" style={{ animation: 'at-caption .6s ease-out forwards', animationDelay: '240ms' }}><Link to={st.cta_url || '/products'} className="at-btn at-btn-light">{cta}</Link></div>}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {/* Controls */}
      <div className="absolute inset-x-0 bottom-0 z-10">
        <div className="mx-auto flex max-w-[1320px] items-end justify-between px-6 pb-8 sm:px-10">
          {s.show_counter !== false && slides.length > 1 && (
            <p className="font-display text-white/90" aria-live="polite"><span className="text-2xl">{pad2(idx + 1)}</span><span className="mx-2 text-white/50">/</span><span className="text-sm text-white/60">{pad2(slides.length)}</span></p>
          )}
          {s.show_arrows !== false && slides.length > 1 && (
            <div className="flex gap-2">
              <button type="button" onClick={() => go(idx - 1)} className="at-flip-prev flex h-12 w-12 items-center justify-center rounded-full border border-white/40 text-white transition-colors duration-300 hover:bg-white hover:text-[#1c1c1c]" aria-label={t('theme.section.hero.prev')}><svg className="h-5 w-5 rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M15 6l-6 6 6 6" /></svg></button>
              <button type="button" onClick={() => go(idx + 1)} className="at-flip-next flex h-12 w-12 items-center justify-center rounded-full border border-white/40 text-white transition-colors duration-300 hover:bg-white hover:text-[#1c1c1c]" aria-label={t('theme.section.hero.next')}><svg className="h-5 w-5 rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 6l6 6-6 6" /></svg></button>
            </div>
          )}
        </div>
        {autoplay && !reduced && (
          <div className="h-[3px] w-full bg-white/20"><div key={cycle} className="h-full bg-white" style={{ animation: `at-progress ${interval}ms linear forwards` }} /></div>
        )}
      </div>
    </section>
  );
};

// ─── 2. Marquee ───────────────────────────────────────────────────

const MarqueeSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const s = useThemeSettings(id);
  const blocks = useBlocks(id, section);
  const bt = useBlockT();
  const global = useAnnouncementMessages();
  const fromBlocks = blocks.map((b, i) => bt('marquee', i, 'text', b.settings.text)).filter(Boolean);
  const items = (fromBlocks.length ? fromBlocks : global) as string[];
  if (!items.length) return null;
  return (
    <Shell s={s} full reveal={false}>
      <Marquee items={items} duration={Number(s.speed || 10)} itemClassName={`text-[13px] font-extrabold tracking-[0.16em] ${s.uppercase_headings !== false ? 'uppercase' : ''}`} className="py-1" />
      <style>{`[data-section-id="${id}"] .at-marquee { color: ${s.text_color || '#1c1c1c'}; }`}</style>
    </Shell>
  );
};

// ─── 3/13. Icon row ───────────────────────────────────────────────

const IconRowSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const s = useThemeSettings(id);
  const blocks = useBlocks(id, section);
  const bt = useBlockT();
  return (
    <Shell s={s}>
      <Heading s={s} id={id} fallbackKey="icon_row" />
      <Cta s={s} id={id} className="mt-6 mx-auto flex w-fit" />
      <div className="mt-12 grid grid-cols-2 gap-8 lg:grid-cols-4">
        {blocks.map((b, i) => <Reveal key={b.id} delay={i * 80}><IconItem icon={b.settings.icon || 'leaf'} title={bt('icon_row', i, 'title', b.settings.title)} text={bt('icon_row', i, 'text', b.settings.text)} /></Reveal>)}
      </div>
    </Shell>
  );
};

// ─── 4. Feature grid ──────────────────────────────────────────────

const FeatureGridSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const s = useThemeSettings(id);
  const blocks = useBlocks(id, section);
  const bt = useBlockT();
  return (
    <Shell s={s}>
      <Heading s={s} id={id} fallbackKey="feature_grid" />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {blocks.map((b, i) => (
          <Reveal key={b.id} delay={i * 80}>
            <div className="group/f h-full rounded-[var(--atelier-radius-card)] border border-[#e5e5e5] p-6 transition-[transform,box-shadow] duration-300 ease-linear hover:-translate-y-1 hover:shadow-[4px_4px_8px_#0000001a]">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--color-accent)] text-[color:var(--atelier-bronze-ink)] transition-colors duration-300 group-hover/f:bg-[#1c1c1c] group-hover/f:text-white"><Icon name={b.settings.icon || 'leaf'} className="h-6 w-6" /></span>
              <h3 className="mt-4 text-[17px] font-extrabold">{bt('feature_grid', i, 'title', b.settings.title)}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[#4a4a4a]">{bt('feature_grid', i, 'text', b.settings.text)}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Shell>
  );
};

// ─── 5. Image band ────────────────────────────────────────────────

const ImageBandSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const s = useThemeSettings(id);
  const blocks = useBlocks(id, section).filter((b) => b.settings.image);
  const cols = Number(s.columns || 6);
  if (!blocks.length) return null;
  return (
    <Shell s={s} full>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(cols, blocks.length)}, minmax(0,1fr))` }}>
        {blocks.map((b) => {
          const img = <img src={b.settings.image} alt="" loading="lazy" className="aspect-square w-full object-cover transition-transform duration-[450ms] ease-linear hover:scale-105" />;
          return <div key={b.id} className="overflow-hidden">{b.settings.link ? <Link to={b.settings.link}>{img}</Link> : img}</div>;
        })}
      </div>
    </Shell>
  );
};

// ─── 6. Category tiles ────────────────────────────────────────────

const CategoryTilesSection: React.FC<SectionComponentProps> = ({ id }) => {
  const s = useThemeSettings(id);
  const { t } = useTranslation(['theme']);
  const { categories, loading } = useCategories();
  const list = categories.slice(0, Number(s.max_categories || 6));
  return (
    <Shell s={s}>
      <Heading s={s} id={id} fallbackKey="category_tiles" />
      <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3">
        {loading && list.length === 0 && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[4/5] rounded-[var(--atelier-radius-card)]" />)}
        {list.map((c: any, i: number) => (
          <Reveal key={c._id} delay={i * 60}>
            <Link to={`/categories/${c.slug}`} className="group/tile relative block aspect-[4/5] overflow-hidden rounded-[var(--atelier-radius-card)] bg-[color:var(--color-accent)]">
              {c.image ? <img src={c.image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-[450ms] ease-linear group-hover/tile:scale-110" /> : <span className="flex h-full items-center justify-center font-display text-4xl text-[#1c1c1c]/30">{c.name?.[0]}</span>}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-5 pt-14">
                <span className="block font-display text-[22px] text-white">{c.name}</span>
                {s.show_product_count !== false && typeof c.productCount === 'number' && <span className="text-[12px] font-semibold uppercase tracking-wider text-white/80">{t('theme.section.category_tiles.count', { count: c.productCount })}</span>}
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </Shell>
  );
};

// ─── 7/12. Product grid ───────────────────────────────────────────

function useSourcedProducts(source: string, limit: number) {
  const featured = useFeaturedProducts(source === 'featured' ? limit : 0);
  const sort = source === 'popular' ? 'popular' : 'newest';
  const listed = useProducts(source === 'featured' ? undefined : { sort, limit: source === 'sale' ? Math.max(limit * 4, 24) : limit });
  if (source === 'featured') return { products: featured.products.slice(0, limit), loading: featured.loading };
  const all = listed.products;
  const products = source === 'sale' ? all.filter((p: any) => p.compareAtPrice && p.compareAtPrice > p.price).slice(0, limit) : all.slice(0, limit);
  return { products, loading: listed.loading };
}

const ProductGridSection: React.FC<SectionComponentProps> = ({ id, onQuickView }) => {
  const s = useThemeSettings(id);
  const { t } = useTranslation(['theme']);
  const limit = Number(s.product_limit || 8);
  const { products, loading } = useSourcedProducts(String(s.product_source || 'newest'), limit);
  const cols = String(s.columns || '4') === '3' ? 'lg:grid-cols-3' : 'lg:grid-cols-4';
  if (!loading && products.length === 0) return null;
  return (
    <Shell s={s}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Heading s={s} id={id} fallbackKey="product_grid" align="start" />
        {s.show_view_all !== false && <Link to={s.view_all_url || '/products'} className="at-underline-anim shrink-0 text-[12px] font-extrabold uppercase tracking-[0.16em] at-link-hover">{t('theme.section.product_grid.view_all')}</Link>}
      </div>
      {/* Phones: a horizontal snap rail of large (72vw) cards. From md: the grid. */}
      <div className="at-rail-wrap mt-8 md:hidden" style={{ ['--at-rail-bg' as any]: s.background_color || '#fff' }}>
        <div className="at-rail" role="list">
          {loading && products.length === 0 && Array.from({ length: 3 }).map((_, i) => <div key={i} role="listitem"><Skeleton className="aspect-[4/5] rounded-[var(--atelier-radius-card)]" /><Skeleton className="mt-3 h-4 w-3/4" /></div>)}
          {products.map((p: any) => <div key={p._id} role="listitem"><AtelierProductCard product={p} onQuickView={onQuickView} /></div>)}
        </div>
      </div>
      <div className={`mt-10 hidden gap-x-5 gap-y-10 md:grid md:grid-cols-3 ${cols}`}>
        {loading && products.length === 0 && Array.from({ length: limit }).map((_, i) => <div key={i}><Skeleton className="aspect-[4/5] rounded-[var(--atelier-radius-card)]" /><Skeleton className="mt-3 h-4 w-3/4" /></div>)}
        {products.map((p: any, i: number) => <Reveal key={p._id} delay={(i % 4) * 70}><AtelierProductCard product={p} onQuickView={onQuickView} /></Reveal>)}
      </div>
    </Shell>
  );
};

// ─── 8. Split banner ──────────────────────────────────────────────

const SplitBannerSection: React.FC<SectionComponentProps> = ({ id }) => {
  const s = useThemeSettings(id);
  const imageEnd = s.layout === 'image_end';
  return (
    <Shell s={s}>
      <div className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
        <div className={`overflow-hidden rounded-[var(--atelier-radius-card)] ${imageEnd ? 'md:order-2' : ''}`}>
          {s.image && <img src={s.image} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform duration-[700ms] ease-linear hover:scale-105" />}
        </div>
        <div>
          <Heading s={s} id={id} fallbackKey="split_banner" align="start" />
          <Cta s={s} id={id} fallbackKey="split_banner" className="mt-7" />
        </div>
      </div>
    </Shell>
  );
};

// ─── 9. Video block ───────────────────────────────────────────────

function embedUrl(url: string): { kind: 'iframe' | 'video'; src: string } | null {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&rel=0` };
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vm[1]}?autoplay=1` };
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) return { kind: 'video', src: url };
  return null;
}

const VideoBlockSection: React.FC<SectionComponentProps> = ({ id }) => {
  const s = useThemeSettings(id);
  const { t } = useTranslation(['theme']);
  const [playing, setPlaying] = useState(false);
  const embed = embedUrl(String(s.video_url || ''));
  return (
    <Shell s={s} full>
      <div className="relative mx-auto aspect-[16/9] max-h-[640px] w-full overflow-hidden bg-[#1c1c1c] md:mx-6 md:w-auto md:rounded-[var(--atelier-radius-card)] xl:mx-auto xl:max-w-[1320px]">
        {playing && embed ? (
          embed.kind === 'iframe'
            ? <iframe src={embed.src} title={s.heading || 'video'} className="absolute inset-0 h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
            : <video src={embed.src} className="absolute inset-0 h-full w-full object-cover" controls autoPlay playsInline />
        ) : (
          <>
            {s.image && <img src={s.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/20" />
            <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
              {embed && (
                <button type="button" onClick={() => setPlaying(true)} className="group/play flex items-center gap-4 text-white" aria-label={t('theme.section.video.play')}>
                  <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white text-[#1c1c1c] transition-transform duration-300 group-hover/play:scale-110">
                    <span className="absolute inset-0 animate-ping rounded-full bg-white/40" aria-hidden />
                    <svg className="relative ms-1 h-7 w-7" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                  </span>
                  <span className="text-[12px] font-bold uppercase tracking-[0.18em]">{t('theme.section.video.play')}</span>
                </button>
              )}
              <p className="at-eyebrow mt-8 !text-[color:var(--atelier-bronze)]">{s.eyebrow || t('theme.section.video.eyebrow')}</p>
              <h2 className="mt-2 max-w-3xl font-display text-[32px] font-medium leading-tight text-white sm:text-[46px]">{s.heading || t('theme.section.video.heading')}</h2>
              <Cta s={s} id={id} fallbackKey="video" variant="at-btn-light" className="mt-7" />
            </div>
          </>
        )}
      </div>
    </Shell>
  );
};

// ─── 10. Promo banner ─────────────────────────────────────────────

const DealsBannerSection: React.FC<SectionComponentProps> = ({ id }) => {
  const s = useThemeSettings(id);
  const overlay = Number(s.overlay_opacity ?? 30) / 100;
  return (
    <Shell s={s} full>
      <div className="relative flex items-center justify-center overflow-hidden bg-[#1c1c1c] px-6 text-center" style={{ minHeight: `${s.min_height || 420}px` }}>
        {s.background_image && <img src={s.background_image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${overlay})` }} />
        <div className="relative py-16">
          <Heading s={s} fallbackKey="deals" light />
          <Cta s={s} fallbackKey="deals" variant="at-btn-light" className="mt-7" />
        </div>
      </div>
    </Shell>
  );
};

// ─── 11. Stats ────────────────────────────────────────────────────

const StatsSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const s = useThemeSettings(id);
  const blocks = useBlocks(id, section);
  const bt = useBlockT();
  return (
    <Shell s={s}>
      <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-center">
        <div>
          <Heading s={s} fallbackKey="stats" align="start" />
          <Cta s={s} fallbackKey="stats" className="mt-7" />
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3">
          {blocks.map((b, i) => (
            <div key={b.id}>
              <p className="font-display text-[40px] font-medium leading-none sm:text-[52px]">
                <CountUp value={String(b.settings.value ?? '0')} /><span className="text-[color:var(--atelier-bronze-ink)]">{b.settings.suffix}</span>
              </p>
              <p className="mt-2 text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#4a4a4a]">{bt('stats', i, 'label', b.settings.label)}</p>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
};

// ─── 14. Lookbook ─────────────────────────────────────────────────

function useProductByHandle(handle: string) {
  const [p, setP] = useState<any>(null);
  useEffect(() => {
    let live = true;
    if (!handle) { setP(null); return; }
    storefrontApi.getProduct(handle).then((r: any) => { if (live) setP(r?.data?.product || r?.data || null); }).catch(() => { if (live) setP(null); });
    return () => { live = false; };
  }, [handle]);
  return p;
}

const Hotspot: React.FC<{ x: number; y: number; handle: string; onLoaded: (p: any) => void }> = ({ x, y, handle, onLoaded }) => {
  const product = useProductByHandle(handle);
  const { formatPrice } = useStore();
  const { addAndConfirm } = useAtelierUI();
  const { t } = useTranslation(['theme']);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (product) onLoaded(product); }, [product]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!product) return null;
  const flip = x > 60; // near the end edge → open towards the start
  const needsOptions = !!product.hasVariants || (product.options || []).length > 0;
  return (
    <div className="absolute" style={{ left: `${x}%`, top: `${y}%` }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={product.name} className="relative -ms-3 -mt-3 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#1c1c1c] shadow-[0_2px_10px_#0000001a] transition-transform duration-300 hover:scale-110">
        <span className="absolute inset-0 animate-ping rounded-full bg-white/60" aria-hidden />
        <svg className="relative h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14" /></svg>
      </button>
      <div
        hidden={!open}
        className={`at-hotspot-pop top-1/2 -translate-y-1/2 rounded-[var(--atelier-radius-card)] bg-white p-3 shadow-[0_10px_30px_#00000026] ${flip ? 'end-full me-3' : 'start-full ms-3'}`}
      >
        <Link to={`/products/${product.slug}`} className="flex gap-3">
          <span className="block h-16 w-14 shrink-0 overflow-hidden rounded-[4px] bg-[color:var(--color-accent)]">{product.images?.[0] && <img src={product.images[0]} alt="" className="h-full w-full object-cover" />}</span>
          <span className="min-w-0"><span className="block truncate text-[13px] font-semibold">{product.name}</span><span className="block text-[13px] font-extrabold">{formatPrice(product.price)}</span></span>
        </Link>
        {needsOptions
          ? <Link to={`/products/${product.slug}`} className="at-btn at-btn-dark mt-3 w-full !py-2 text-[12px]">{t('theme.card.select_options')}</Link>
          : <button type="button" onClick={() => addAndConfirm({ productId: product._id, name: product.name, image: product.images?.[0] })} className="at-btn at-btn-dark mt-3 w-full !py-2 text-[12px]">{t('theme.card.add_to_cart')}</button>}
      </div>
    </div>
  );
};

const LookbookSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const s = useThemeSettings(id);
  const configured = useBlocks(id, section).filter((b) => b.settings.product);
  // Fresh installs have no hotspots picked yet: fall back to three featured
  // products at fixed positions so the section is never an empty image.
  const { products: fallbackProducts } = useFeaturedProducts(configured.length ? 0 : 3);
  const FALLBACK_POS = [[28, 38], [58, 62], [76, 30]];
  const blocks = configured.length
    ? configured
    : (fallbackProducts || []).slice(0, 3).map((p: any, i: number) => ({ id: `auto-${p.slug}`, settings: { x: FALLBACK_POS[i][0], y: FALLBACK_POS[i][1], product: p.slug } }));
  const { t } = useTranslation(['theme']);
  const { addAndConfirm } = useAtelierUI();
  const loaded = useRef<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const addAll = async () => {
    const list = Object.values(loaded.current).filter((p: any) => !p.hasVariants && !(p.options || []).length && (p.stock ?? 0) > 0);
    if (!list.length) return;
    setBusy(true);
    try { for (const p of list) await addAndConfirm({ productId: p._id, name: p.name, image: p.images?.[0] }); } finally { setBusy(false); }
  };
  return (
    <Shell s={s}>
      <Heading s={s} id={id} fallbackKey="lookbook" />
      <div className="relative mx-auto mt-10 max-w-4xl overflow-visible rounded-[var(--atelier-radius-card)]">
        {s.image && <img src={s.image} alt="" loading="lazy" className="aspect-[16/10] w-full rounded-[var(--atelier-radius-card)] object-cover" />}
        {blocks.map((b) => <Hotspot key={b.id} x={Number(b.settings.x)} y={Number(b.settings.y)} handle={String(b.settings.product)} onLoaded={(p) => { loaded.current[p._id] = p; }} />)}
      </div>
      {blocks.length === 0 && <p className="mt-6 text-center text-sm text-[#6b6b6b]">{t('theme.section.lookbook.empty')}</p>}
      {s.show_add_all !== false && blocks.length > 0 && (
        <div className="mt-8 text-center"><button type="button" onClick={addAll} disabled={busy} className="at-btn at-btn-dark">{busy ? <span className="at-spinner" /> : t('theme.section.lookbook.add_all')}</button></div>
      )}
    </Shell>
  );
};

// ─── 15. USP strip ────────────────────────────────────────────────

const UspStripSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const s = useThemeSettings(id);
  const blocks = useBlocks(id, section);
  const bt = useBlockT();
  const items = blocks.map((b, i) => ({ icon: b.settings.icon || 'check', title: bt('usp', i, 'title', b.settings.title), text: bt('usp', i, 'text', b.settings.text) })).filter((b) => b.title);
  if (!items.length) return null;
  return <Shell s={s} full><UspStrip items={items} /></Shell>;
};

// ─── 16. Testimonials ─────────────────────────────────────────────

const TestimonialsSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const s = useThemeSettings(id);
  const bt = useBlockT();
  const blocks = useBlocks(id, section).filter((b, i) => bt('testimonials', i, 'quote', b.settings.quote));
  const { t } = useTranslation(['theme']);
  const track = useRef<HTMLDivElement>(null);
  const scrollBy = (dir: 1 | -1) => {
    const el = track.current; if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-card]');
    const rtl = document.documentElement.dir === 'rtl';
    el.scrollBy({ left: (card ? card.offsetWidth + 24 : 320) * dir * (rtl ? -1 : 1), behavior: 'smooth' });
  };
  if (!blocks.length) return null;
  return (
    <Shell s={s}>
      <div className="flex items-end justify-between gap-6">
        <Heading s={s} fallbackKey="testimonials" align="start" />
        <div className="hidden shrink-0 gap-2 sm:flex">
          <button type="button" onClick={() => scrollBy(-1)} className="at-flip-prev flex h-11 w-11 items-center justify-center rounded-full border border-[#e5e5e5] text-[#1c1c1c] transition-colors duration-300 hover:bg-[#1c1c1c] hover:text-white" aria-label={t('theme.section.hero.prev')}><svg className="h-4 w-4 rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 6l-6 6 6 6" /></svg></button>
          <button type="button" onClick={() => scrollBy(1)} className="at-flip-next flex h-11 w-11 items-center justify-center rounded-full border border-[#e5e5e5] text-[#1c1c1c] transition-colors duration-300 hover:bg-[#1c1c1c] hover:text-white" aria-label={t('theme.section.hero.next')}><svg className="h-4 w-4 rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6" /></svg></button>
        </div>
      </div>
      <div ref={track} className="at-hide-scrollbar mt-10 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth">
        {blocks.map((b, i) => (
          <figure key={b.id} data-card className="w-[85%] shrink-0 snap-start rounded-[var(--atelier-radius-card)] bg-[color:var(--color-accent)] p-7 sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]">
            <svg className="h-8 w-8 text-[color:var(--atelier-bronze)]" viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h4v4H8a2 2 0 00-2 2v2H4v-4a4 4 0 013-4zm9 0h4v4h-3a2 2 0 00-2 2v2h-2v-4a4 4 0 013-4z" /></svg>
            <blockquote className="mt-4 text-[15px] leading-relaxed text-[#2a2a2a]">{bt('testimonials', i, 'quote', b.settings.quote)}</blockquote>
            <figcaption className="mt-5 text-[13px]"><span className="font-extrabold">{bt('testimonials', i, 'name', b.settings.name)}</span>{bt('testimonials', i, 'role', b.settings.role) && <span className="text-[#6b6b6b]"> · {bt('testimonials', i, 'role', b.settings.role)}</span>}</figcaption>
          </figure>
        ))}
      </div>
    </Shell>
  );
};

// ─── 17. Before / after ───────────────────────────────────────────

const BeforeAfterSection: React.FC<SectionComponentProps> = ({ id }) => {
  const s = useThemeSettings(id);
  const { t } = useTranslation(['theme']);
  return (
    <Shell s={s}>
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <Heading s={s} fallbackKey="before_after" align="start" />
          <Cta s={s} fallbackKey="before_after" className="mt-7" />
        </div>
        {s.image_1 && s.image_2 && (
          <BeforeAfter before={s.image_1} after={s.image_2} beforeLabel={s.label_1 || t('theme.section.before_after.before')} afterLabel={s.label_2 || t('theme.section.before_after.after')} className="aspect-[4/3]" />
        )}
      </div>
    </Shell>
  );
};

// ─── 18. Stories ──────────────────────────────────────────────────

const StoriesSection: React.FC<SectionComponentProps> = ({ id, section }) => {
  const s = useThemeSettings(id);
  const bt = useBlockT();
  const blocks = useBlocks(id, section).filter((b, i) => bt('stories', i, 'title', b.settings.title));
  const { t, i18n } = useTranslation(['theme']);
  if (!blocks.length) return null;
  const fmt = (d: string) => { const dt = d ? new Date(d) : null; return dt && !Number.isNaN(dt.getTime()) ? dt.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric', year: 'numeric' }) : d; };
  return (
    <Shell s={s}>
      <Heading s={s} fallbackKey="stories" />
      <div className="at-hide-scrollbar mt-10 flex snap-x gap-6 overflow-x-auto md:grid md:grid-cols-3 md:overflow-visible">
        {blocks.map((b, i) => (
          <Reveal key={b.id} delay={i * 80} className="w-[80%] shrink-0 snap-start md:w-auto">
            <article className="group/post">
              <Link to={b.settings.link_url || '#'} className="block overflow-hidden rounded-[var(--atelier-radius-card)] bg-[color:var(--color-accent)]">
                {b.settings.image && <img src={b.settings.image} alt="" loading="lazy" className="aspect-[3/2] w-full object-cover transition-transform duration-500 ease-linear group-hover/post:scale-105" />}
              </Link>
              {b.settings.date && <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-[#6b6b6b]">{fmt(b.settings.date)}</p>}
              <h3 className="mt-2 font-display text-[22px] leading-snug"><Link to={b.settings.link_url || '#'} className="at-link-hover">{bt('stories', i, 'title', b.settings.title)}</Link></h3>
              {bt('stories', i, 'excerpt', b.settings.excerpt) && <p className="mt-2 line-clamp-3 text-[14px] text-[#4a4a4a]">{bt('stories', i, 'excerpt', b.settings.excerpt)}</p>}
              <Link to={b.settings.link_url || '#'} className="at-underline-anim mt-3 inline-block text-[12px] font-extrabold uppercase tracking-[0.16em] at-link-hover">{t('theme.section.stories.read_more')}</Link>
            </article>
          </Reveal>
        ))}
      </div>
    </Shell>
  );
};

// ─── Registry ─────────────────────────────────────────────────────

export const ATELIER_SECTION_REGISTRY: Record<string, SectionComponent> = {
  ...DEFAULT_SECTION_REGISTRY,
  'atelier-hero': HeroSection,
  'atelier-marquee': MarqueeSection,
  'atelier-icon-row': IconRowSection,
  'atelier-feature-grid': FeatureGridSection,
  'atelier-image-band': ImageBandSection,
  'atelier-category-tiles': CategoryTilesSection,
  'atelier-product-grid': ProductGridSection,
  'atelier-split-banner': SplitBannerSection,
  'atelier-video-block': VideoBlockSection,
  'atelier-deals-banner': DealsBannerSection,
  'atelier-stats': StatsSection,
  'atelier-lookbook': LookbookSection,
  'atelier-usp-strip': UspStripSection,
  'atelier-testimonials': TestimonialsSection,
  'atelier-before-after': BeforeAfterSection,
  'atelier-stories': StoriesSection,
};
