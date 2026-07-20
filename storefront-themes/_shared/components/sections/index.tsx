/**
 * Universal section components.
 *
 * These render section instances declared in `themeCustomization.sections`
 * (whether seeded by the theme manifest or added by the merchant in the
 * dashboard). Each component reads its settings from the merged section
 * settings via `useThemeSettings(instance.id)`.
 *
 * Themes can override any of these by passing a custom registry to
 * <SectionRenderer />, but by default every theme inherits the full set so
 * that adding a section in the dashboard always renders something.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useThemeSettings, useSectionBlocks } from '../../theme/ThemeProvider';
import { useFeaturedProducts, useProducts, useCategories } from '../../hooks/useProducts';
import { ProductCard } from '../commerce/ProductCard';
import { Carousel } from '../primitives/Carousel';
import { Skeleton } from '../primitives/Skeleton';
import type { SectionInstance } from '../../types/theme';
import { CategoryShowcase } from './CategoryShowcase';

/**
 * Per-section appearance overrides (from the shared APPEARANCE_SETTINGS).
 * Returns an inline style applying merchant-set background/text colour and
 * top/bottom padding. Empty/undefined values inherit the theme (no override),
 * so a section with no appearance settings renders exactly as before. Inline
 * padding wins over the component's Tailwind `py-*`.
 */
export function appearanceStyle(s: Record<string, any>): React.CSSProperties {
  const style: React.CSSProperties = {};
  if (s.background_color) style.backgroundColor = s.background_color;
  if (s.text_color) style.color = s.text_color;
  if (s.padding_top !== undefined && s.padding_top !== '' && s.padding_top !== null) {
    style.paddingTop = typeof s.padding_top === 'number' ? `${s.padding_top}px` : String(s.padding_top);
  }
  if (s.padding_bottom !== undefined && s.padding_bottom !== '' && s.padding_bottom !== null) {
    style.paddingBottom = typeof s.padding_bottom === 'number' ? `${s.padding_bottom}px` : String(s.padding_bottom);
  }
  return style;
}

export interface SectionComponentProps {
  /** Section instance id from themeCustomization.sections */
  id: string;
  /**
   * The full section instance as declared in the manifest or persisted on
   * the tenant's themeCustomization. Components that need blocks (e.g.
   * features strip, promo banner grid, slideshow) read them from
   * `section.blocks`. Scalar settings still come from `useThemeSettings(id)`
   * so tenant overrides are merged in. Undefined for sections rendered
   * outside a SectionRenderer (e.g. direct imports), so always guard.
   */
  section?: SectionInstance;
  /** Optional callback for QuickView, wired by the host page */
  onQuickView?: (product: any) => void;
}

// ─── Hero ────────────────────────────────────────────────────────

export const HeroSection: React.FC<SectionComponentProps> = ({ id }) => {
  const { t } = useTranslation('common');
  const s = useThemeSettings(id);
  return (
    <section
      className="relative py-24 md:py-36"
      style={{
        background: s.background_image
          ? `url(${s.background_image}) center/cover`
          : `linear-gradient(135deg, var(--color-primary, #2563eb) 0%, var(--color-secondary, #1e40af) 100%)`,
      }}
    >
      {s.background_image && s.overlay_opacity > 0 && (
        <div className="absolute inset-0 bg-black" style={{ opacity: s.overlay_opacity / 100 }} />
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center text-white relative z-10">
        {s.badge_text && (
          <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-sm font-medium mb-4 backdrop-blur-sm">
            {s.badge_text}
          </span>
        )}
        <h1 className="text-4xl md:text-6xl font-bold mb-4 leading-tight">
          {s.heading || t('section.hero.heading')}
        </h1>
        {s.subheading && <p className="text-lg md:text-xl opacity-90 mb-8 max-w-2xl mx-auto">{s.subheading}</p>}
        <div className="flex gap-3 justify-center flex-wrap">
          {s.primary_button_text && (
            <Link
              to={s.primary_button_url || '/products'}
              className="inline-block bg-white text-gray-900 font-semibold px-8 py-3.5 rounded-lg hover:bg-gray-100 transition shadow-lg"
            >
              {s.primary_button_text}
            </Link>
          )}
          {s.secondary_button_text && (
            <Link
              to={s.secondary_button_url || '/categories'}
              className="inline-block border-2 border-white/40 text-white font-semibold px-8 py-3.5 rounded-lg hover:bg-white/10 transition"
            >
              {s.secondary_button_text}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
};

// ─── Banner (promo strip) ────────────────────────────────────────

export const BannerSection: React.FC<SectionComponentProps> = ({ id }) => {
  const { t } = useTranslation('common');
  const s = useThemeSettings(id);
  return (
    <section
      className="py-3 px-4 text-center text-sm font-medium"
      style={{
        backgroundColor: s.background_color || 'var(--color-primary, #2563eb)',
        color: s.text_color || '#ffffff',
      }}
    >
      <span>{s.message || t('section.banner.default_message')}</span>
      {s.link_url && s.link_text && (
        <Link to={s.link_url} className="ms-2 underline hover:no-underline">
          {s.link_text}
        </Link>
      )}
    </section>
  );
};

// ─── Rich Text ───────────────────────────────────────────────────

export const RichTextSection: React.FC<SectionComponentProps> = ({ id }) => {
  const s = useThemeSettings(id);
  return (
    <section className="px-4 sm:px-6 py-16" style={appearanceStyle(s)}>
      <div className="max-w-3xl mx-auto text-center">
      {s.heading && <h2 className="text-3xl font-bold mb-3">{s.heading}</h2>}
      {s.subheading && <p className="text-lg text-gray-600 mb-4">{s.subheading}</p>}
      {/* Rich-text body (audit 6.8.1). Server-sanitized HTML (customization
          write path, same allowlist as CMS pages); plain-text values from
          before the type switch render unchanged as text nodes. */}
      {s.body && (
        <div
          className="prose mx-auto text-gray-700 [&_a]:underline [&_ul]:list-disc [&_ul]:ps-6 [&_ol]:list-decimal [&_ol]:ps-6"
          dangerouslySetInnerHTML={{ __html: s.body }}
        />
      )}
      {s.button_text && (
        <Link
          to={s.button_url || '#'}
          className="inline-block mt-6 px-6 py-3 rounded-lg text-white font-medium hover:opacity-90"
          style={{ backgroundColor: 'var(--color-primary, #2563eb)' }}
        >
          {s.button_text}
        </Link>
      )}
      </div>
    </section>
  );
};

// ─── Image with Text ─────────────────────────────────────────────

export const ImageWithTextSection: React.FC<SectionComponentProps> = ({ id }) => {
  const { t } = useTranslation('common');
  const s = useThemeSettings(id);
  const reverse = s.layout === 'image-right';
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16" style={appearanceStyle(s)}>
      <div className={`grid md:grid-cols-2 gap-8 items-center ${reverse ? 'md:[direction:rtl]' : ''}`}>
        <div className="aspect-[4/3] bg-gray-100 rounded-2xl overflow-hidden">
          {s.image && <img src={s.image} alt={s.heading || ''} className="w-full h-full object-cover" />}
        </div>
        <div className={reverse ? 'md:[direction:ltr]' : ''}>
          {s.eyebrow && <span className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--color-primary)' }}>{s.eyebrow}</span>}
          <h2 className="text-3xl md:text-4xl font-bold mt-2 mb-3">
            {s.heading || t('section.image_with_text.heading')}
          </h2>
          {s.body && <p className="text-gray-600 leading-relaxed mb-6">{s.body}</p>}
          {s.button_text && (
            <Link
              to={s.button_url || '#'}
              className="inline-block px-6 py-3 rounded-lg text-white font-medium hover:opacity-90"
              style={{ backgroundColor: 'var(--color-primary, #2563eb)' }}
            >
              {s.button_text}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
};

// ─── Gallery ─────────────────────────────────────────────────────

export const GallerySection: React.FC<SectionComponentProps> = ({ id }) => {
  const s = useThemeSettings(id);
  const blocks = useSectionBlocks(id);
  const cols = Number(s.columns) || 3;
  // Images come from editable BLOCKS; the legacy `images` JSON setting (which
  // the dashboard could never edit) remains as a fallback for old data.
  const images: Array<{ src: string; alt?: string; link?: string }> = blocks.length
    ? blocks
        .filter((b) => b.type === 'image' && b.settings?.image)
        .map((b) => ({ src: b.settings.image, alt: b.settings.alt, link: b.settings.link }))
    : (Array.isArray(s.images) ? s.images : []).map((src: string) => ({ src }));
  if (images.length === 0) return null;
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16" style={appearanceStyle(s)}>
      {s.heading && <h2 className="text-3xl font-bold text-center mb-10">{s.heading}</h2>}
      <div className={`grid grid-cols-2 md:grid-cols-${cols} gap-3`}>
        {images.map((img, i) => {
          const tile = (
            <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
              <img src={img.src} alt={img.alt || ''} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
            </div>
          );
          return img.link ? (
            <Link key={i} to={img.link}>{tile}</Link>
          ) : (
            <React.Fragment key={i}>{tile}</React.Fragment>
          );
        })}
      </div>
    </section>
  );
};

// ─── Features (icon + text grid) ─────────────────────────────────

export const FeaturesSection: React.FC<SectionComponentProps> = ({ id }) => {
  const s = useThemeSettings(id);
  const blocks = useSectionBlocks(id);
  // Feature entries come from editable BLOCKS (with placeholder defaults so a
  // freshly added section renders); legacy `features` JSON setting kept as a
  // fallback for old data.
  const features: Array<{ icon?: string; title: string; description: string }> = blocks.length
    ? blocks
        .filter((b) => b.type === 'feature' && (b.settings?.title || b.settings?.description))
        .map((b) => ({ icon: b.settings.icon, title: b.settings.title, description: b.settings.description }))
    : Array.isArray(s.features) ? s.features : [];
  if (features.length === 0) return null;
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16" style={appearanceStyle(s)}>
      {s.heading && <h2 className="text-3xl font-bold text-center mb-10">{s.heading}</h2>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {features.map((f, i) => (
          <div key={i} className="text-center p-6">
            {f.icon && <div className="text-4xl mb-3">{f.icon}</div>}
            <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
            <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

// ─── Video Embed ─────────────────────────────────────────────────

export const VideoSection: React.FC<SectionComponentProps> = ({ id }) => {
  const s = useThemeSettings(id);
  if (!s.video_url) return null;
  // Convert YouTube/Vimeo URLs to embed format
  const embedUrl = (() => {
    const url = String(s.video_url);
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
    if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
    const vm = url.match(/vimeo\.com\/(\d+)/);
    if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
    return url;
  })();
  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16" style={appearanceStyle(s)}>
      {s.heading && <h2 className="text-3xl font-bold text-center mb-8">{s.heading}</h2>}
      <div className="aspect-video bg-black rounded-2xl overflow-hidden">
        <iframe
          src={embedUrl}
          title={s.heading || 'Video'}
          className="w-full h-full"
          frameBorder={0}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </section>
  );
};

// ─── Testimonials ────────────────────────────────────────────────

export const TestimonialsSection: React.FC<SectionComponentProps> = ({ id }) => {
  const s = useThemeSettings(id);
  const blocks = useSectionBlocks(id);
  // Quotes come from editable BLOCKS (with placeholder defaults so a freshly
  // added section renders); legacy `testimonials` JSON setting kept as a
  // fallback for old data.
  const items: Array<{ quote: string; author: string; role?: string; avatar?: string }> = blocks.length
    ? blocks
        .filter((b) => b.type === 'testimonial' && b.settings?.quote)
        .map((b) => ({ quote: b.settings.quote, author: b.settings.author, role: b.settings.role, avatar: b.settings.avatar }))
    : Array.isArray(s.testimonials) ? s.testimonials : [];
  if (items.length === 0) return null;
  return (
    <section className="bg-gray-50 py-16" style={appearanceStyle(s)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {s.heading && <h2 className="text-3xl font-bold text-center mb-10">{s.heading}</h2>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map((t, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl shadow-sm">
              <div className="text-3xl text-gray-300 mb-2">&ldquo;</div>
              <p className="text-gray-700 leading-relaxed mb-4">{t.quote}</p>
              <div className="flex items-center gap-3">
                {t.avatar && <img src={t.avatar} alt={t.author} className="w-10 h-10 rounded-full object-cover" />}
                <div>
                  <p className="font-semibold text-sm">{t.author}</p>
                  {t.role && <p className="text-xs text-gray-500">{t.role}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Newsletter ──────────────────────────────────────────────────

export const NewsletterSection: React.FC<SectionComponentProps> = ({ id }) => {
  const { t } = useTranslation('common');
  const s = useThemeSettings(id);
  return (
    <section
      className="py-20"
      style={{
        background: s.use_gradient !== false
          ? `linear-gradient(135deg, var(--color-primary, #2563eb) 0%, var(--color-secondary, #1e40af) 100%)`
          : s.background_color || 'var(--color-primary, #2563eb)',
      }}
    >
      <div className="max-w-2xl mx-auto px-4 text-center text-white">
        <h2 className="text-3xl font-bold mb-2">{s.heading || t('section.newsletter.heading')}</h2>
        {s.subheading && <p className="opacity-90 mb-8">{s.subheading}</p>}
        <form className="flex gap-2 max-w-md mx-auto" onSubmit={(e) => e.preventDefault()}>
          <input
            type="email"
            placeholder={s.placeholder || t('storefront.enter_your_email')}
            className="flex-1 px-4 py-3.5 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-white/50"
          />
          <button
            type="submit"
            className="px-6 py-3.5 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg font-medium transition border border-white/30"
          >
            {s.button_text || t('section.newsletter.subscribe')}
          </button>
        </form>
        {s.disclaimer && <p className="text-xs opacity-60 mt-3">{s.disclaimer}</p>}
      </div>
    </section>
  );
};

// ─── Brands (logo strip) ─────────────────────────────────────────

export const BrandsSection: React.FC<SectionComponentProps> = ({ id }) => {
  const s = useThemeSettings(id);
  const logos: string[] = Array.isArray(s.logos) ? s.logos : [];
  if (logos.length === 0) return null;
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
      {s.heading && <p className="text-center text-sm uppercase tracking-wide text-gray-500 mb-6">{s.heading}</p>}
      <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 opacity-70">
        {logos.map((src, i) => (
          <img key={i} src={src} alt="" className="h-10 grayscale hover:grayscale-0 transition" />
        ))}
      </div>
    </section>
  );
};

// ─── Spacer ──────────────────────────────────────────────────────

export const SpacerSection: React.FC<SectionComponentProps> = ({ id }) => {
  const s = useThemeSettings(id);
  return <div style={{ height: `${Number(s.height) || 40}px` }} />;
};

// ─── Featured Products ───────────────────────────────────────────

export const FeaturedProductsSection: React.FC<SectionComponentProps> = ({ id, onQuickView }) => {
  const { t } = useTranslation('common');
  const s = useThemeSettings(id);
  const limit = Number(s.product_limit) || 8;
  const { products, loading } = useFeaturedProducts(limit);
  const cols = s.columns || '4';

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold">{s.heading || t('section.featured_products.heading')}</h2>
          {s.subheading && <p className="text-gray-500 mt-1">{s.subheading}</p>}
        </div>
        <Link
          to={s.view_all_url || '/products'}
          className="text-sm font-medium hover:underline"
          style={{ color: 'var(--color-primary, #2563eb)' }}
        >
          {t('section.featured_products.view_all')} →
        </Link>
      </div>
      {loading ? (
        <Skeleton.ProductGrid count={parseInt(cols) || 4} />
      ) : (
        <div className={`grid grid-cols-2 md:grid-cols-${cols} gap-4 md:gap-6`}>
          {products.map((p: any) => (
            <ProductCard key={p._id} product={p} onQuickView={onQuickView}>
              <ProductCard.Image showBadge showQuickView={!!onQuickView && s.show_quick_view !== false} />
              <ProductCard.Body>
                <ProductCard.Title />
                {s.show_rating !== false && <ProductCard.Rating />}
                <div className="flex items-center justify-between mt-2">
                  <ProductCard.Price showCompareAt />
                  {s.show_add_to_cart !== false && <ProductCard.Actions />}
                </div>
              </ProductCard.Body>
            </ProductCard>
          ))}
        </div>
      )}
    </section>
  );
};

// ─── New Arrivals ────────────────────────────────────────────────

export const NewArrivalsSection: React.FC<SectionComponentProps> = ({ id, onQuickView }) => {
  const { t } = useTranslation('common');
  const s = useThemeSettings(id);
  const limit = Number(s.product_limit) || 8;
  const { products, loading } = useProducts({ sort: 'newest', limit });

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold">{s.heading || t('section.new_arrivals.heading')}</h2>
          {s.subheading && <p className="text-gray-500 mt-1">{s.subheading}</p>}
        </div>
        <Link
          to={s.view_all_url || '/products?sort=newest'}
          className="text-sm font-medium hover:underline"
          style={{ color: 'var(--color-primary, #2563eb)' }}
        >
          {t('section.new_arrivals.see_more')} →
        </Link>
      </div>
      {loading ? (
        <Skeleton.ProductGrid count={4} />
      ) : (
        <Carousel slidesPerView={4} gap={16} showArrows showDots={false} loop autoPlay={s.autoplay ? 5000 : undefined}>
          {products.map((p: any) => (
            <ProductCard key={p._id} product={p} onQuickView={onQuickView}>
              <ProductCard.Image showBadge showQuickView={!!onQuickView} />
              <ProductCard.Body>
                <ProductCard.Title />
                <ProductCard.Price />
                {s.show_add_to_cart !== false && (
                  <ProductCard.Actions addToCartText={t('section.new_arrivals.add_to_cart')} />
                )}
              </ProductCard.Body>
            </ProductCard>
          ))}
        </Carousel>
      )}
    </section>
  );
};

// ─── Categories Grid ─────────────────────────────────────────────

export const CategoriesSection: React.FC<SectionComponentProps> = ({ id }) => {
  const { t } = useTranslation('common');
  const s = useThemeSettings(id);
  const { categories } = useCategories();
  if (!categories || categories.length === 0) return null;
  // Delegates to the shared premium showcase (editorial image tiles, mobile
  // snap rail, desktop bento) so merchant-added category sections match the
  // curated homepage treatment. Appearance overrides still apply.
  return (
    <CategoryShowcase
      categories={categories}
      heading={s.heading || t('section.categories.heading')}
      subheading={s.subheading}
      maxCategories={Number(s.max_categories) || 6}
      showCount={s.show_product_count !== false}
      countLabel={(count: number) => t('section.categories.items_count', { count })}
      style={appearanceStyle(s)}
    />
  );
};

// ─── Trust Badges ────────────────────────────────────────────────

export const TrustBadgesSection: React.FC<SectionComponentProps> = ({ id }) => {
  const { t } = useTranslation('common');
  const s = useThemeSettings(id);
  const badges = Array.isArray(s.badges) && s.badges.length > 0
    ? s.badges
    : [
        {
          title: t('section.trust.free_shipping_title'),
          description: t('section.trust.free_shipping_desc'),
        },
        {
          title: t('section.trust.secure_payment_title'),
          description: t('section.trust.secure_payment_desc'),
        },
        {
          title: t('section.trust.easy_returns_title'),
          description: t('section.trust.easy_returns_desc'),
        },
      ];
  return (
    <section style={{ backgroundColor: s.background_color || '#f9fafb' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {badges.map((b: any, i: number) => (
            <div key={i} className="flex items-center gap-4 p-5 bg-white rounded-xl shadow-sm">
              <div className="text-2xl">{b.icon || '✓'}</div>
              <div>
                <h3 className="font-semibold">{b.title}</h3>
                <p className="text-sm text-gray-500">{b.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Registry ────────────────────────────────────────────────────

export type SectionComponent = React.FC<SectionComponentProps>;

export const DEFAULT_SECTION_REGISTRY: Record<string, SectionComponent> = {
  hero: HeroSection,
  banner: BannerSection,
  'rich-text': RichTextSection,
  'image-with-text': ImageWithTextSection,
  gallery: GallerySection,
  features: FeaturesSection,
  video: VideoSection,
  testimonials: TestimonialsSection,
  newsletter: NewsletterSection,
  brands: BrandsSection,
  spacer: SpacerSection,
  'featured-products': FeaturedProductsSection,
  'new-arrivals': NewArrivalsSection,
  categories: CategoriesSection,
  'trust-badges': TrustBadgesSection,
};
