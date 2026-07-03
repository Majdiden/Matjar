/**
 * Section metadata — maps a section type to a Lucide icon, display name,
 * and visual area (header / page body / footer). Used by the editor's
 * left rail (Canvas) and the section library.
 *
 * Since 1.4 the theme manifest is the primary source: SectionDefinition
 * can declare `icon` (lucide name) and `category`; this module only
 * provides the icon-name → component map and a static fallback for
 * legacy manifests that predate those fields.
 */
import {
  LayoutPanelTop,
  LayoutTemplate,
  Image as ImageIcon,
  Images,
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
  Users,
  Zap,
  Instagram,
  PanelLeft,
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

/**
 * Lucide icon components addressable by the string names theme manifests
 * declare (`SectionDefinition.icon`). A curated subset — importing the
 * whole lucide barrel by name would defeat tree-shaking. Unknown names
 * fall back to the static META entry, then to a generic square.
 */
export const ICON_MAP: Record<string, LucideIcon> = {
  LayoutPanelTop,
  LayoutTemplate,
  Image: ImageIcon,
  Images,
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
  Users,
  Zap,
  Instagram,
  PanelLeft,
};

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

/**
 * Manifest-declared metadata for a section type — the subset of
 * SectionDefinition the meta resolver cares about. Everything optional
 * so callers can pass whatever the API/manifest returned.
 */
export interface ManifestSectionMeta {
  name?: string;
  icon?: string | null;
  category?: string | null;
  target?: string | null;
}

/**
 * Resolve editor metadata for a section type, preferring the theme
 * manifest's declaration (name / icon / category / target) and falling
 * back to the static META record, then to the generic fallback.
 */
export function resolveSectionMeta(type: string, def?: ManifestSectionMeta | null): SectionMeta {
  const base = getSectionMeta(type);
  if (!def) return base;
  const icon = (def.icon && ICON_MAP[def.icon]) || base.icon;
  const area: SectionArea =
    def.target === 'header' ? 'header' : def.target === 'footer' ? 'footer' : base.area;
  return {
    ...base,
    icon,
    name: def.name || base.name,
    category: def.category || base.category,
    area,
  };
}

export const SECTION_CATEGORIES: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'content', label: 'Content' },
  { id: 'commerce', label: 'Commerce' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'media', label: 'Media' },
  { id: 'layout', label: 'Layout' },
];
