/**
 * Section metadata — maps a section type to a Lucide icon, display name,
 * and visual area (header / page body / footer). Used by the editor's
 * left rail (SectionTree) and right rail (SectionLibraryPanel).
 *
 * Falls back gracefully for unknown types.
 */
import {
  LayoutPanelTop,
  LayoutTemplate,
  Image as ImageIcon,
  Star,
  FolderTree,
  Sparkles,
  Mail,
  Tag,
  PackageSearch,
  Quote,
  Megaphone,
  Video,
  Grid3x3,
  Type,
  Newspaper,
  ShieldCheck,
  Rss,
  Layers,
  Square,
  type LucideIcon,
} from 'lucide-react';

export type SectionArea = 'header' | 'page' | 'footer';

export interface SectionMeta {
  icon: LucideIcon;
  name: string;
  category: string;
  area: SectionArea;
  description?: string;
}

const META: Record<string, SectionMeta> = {
  // Header / footer
  header: { icon: LayoutPanelTop, name: 'Header', category: 'layout', area: 'header' },
  'announcement-bar': { icon: Megaphone, name: 'Announcement Bar', category: 'layout', area: 'header' },
  footer: { icon: LayoutPanelTop, name: 'Footer', category: 'layout', area: 'footer' },

  // Hero / banners
  hero: { icon: LayoutTemplate, name: 'Hero Banner', category: 'content', area: 'page' },
  banner: { icon: ImageIcon, name: 'Promo Banner', category: 'content', area: 'page' },
  slideshow: { icon: ImageIcon, name: 'Slideshow', category: 'content', area: 'page' },
  'image-banner': { icon: ImageIcon, name: 'Image Banner', category: 'content', area: 'page' },

  // Commerce
  'featured-products': { icon: Star, name: 'Featured Products', category: 'commerce', area: 'page' },
  'best-sellers': { icon: Star, name: 'Best Sellers', category: 'commerce', area: 'page' },
  'new-arrivals': { icon: Sparkles, name: 'New Arrivals', category: 'commerce', area: 'page' },
  'product-grid': { icon: Grid3x3, name: 'Product Grid', category: 'commerce', area: 'page' },
  'top-rated-carousel': { icon: Star, name: 'Top Rated', category: 'commerce', area: 'page' },
  categories: { icon: FolderTree, name: 'Categories', category: 'commerce', area: 'page' },
  'collection-list': { icon: Layers, name: 'Collection List', category: 'commerce', area: 'page' },
  'product-recommendations': { icon: PackageSearch, name: 'You May Also Like', category: 'commerce', area: 'page' },

  // Marketing / engagement
  newsletter: { icon: Mail, name: 'Newsletter', category: 'marketing', area: 'page' },
  'newsletter-cta': { icon: Mail, name: 'Newsletter Signup', category: 'marketing', area: 'page' },
  testimonials: { icon: Quote, name: 'Testimonials', category: 'marketing', area: 'page' },
  brands: { icon: Tag, name: 'Brand Logos', category: 'marketing', area: 'page' },
  features: { icon: Sparkles, name: 'Feature Highlights', category: 'marketing', area: 'page' },
  'tech-features': { icon: ShieldCheck, name: 'Feature Badges', category: 'marketing', area: 'page' },

  // Media
  video: { icon: Video, name: 'Video', category: 'media', area: 'page' },
  'image-gallery': { icon: ImageIcon, name: 'Image Gallery', category: 'media', area: 'page' },

  // Content
  'text-block': { icon: Type, name: 'Text Block', category: 'content', area: 'page' },
  'rich-text': { icon: Newspaper, name: 'Rich Text', category: 'content', area: 'page' },
  blog: { icon: Rss, name: 'Blog Posts', category: 'content', area: 'page' },
};

export const FALLBACK_META: SectionMeta = {
  icon: Square,
  name: 'Section',
  category: 'content',
  area: 'page',
};

export function getSectionMeta(type: string): SectionMeta {
  if (META[type]) return META[type];
  // Title-case from kebab-case as a friendly fallback
  const niceName = type
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  return { ...FALLBACK_META, name: niceName };
}

export const SECTION_CATEGORIES: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'content', label: 'Content' },
  { id: 'commerce', label: 'Commerce' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'media', label: 'Media' },
  { id: 'layout', label: 'Layout' },
];
