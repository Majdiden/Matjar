/**
 * SectionRenderer — renders section instances declared by the merged theme
 * customization (manifest defaults overlaid with tenant overrides) for a
 * given template.
 *
 * Two modes:
 *
 *   <SectionRenderer template="index" />
 *     Renders ALL sections for the template in order. Use this when a theme
 *     wants to be fully data-driven (no hardcoded JSX).
 *
 *   <MerchantSections template="index" excludeIds={['hero','featured-products']} />
 *     Renders only sections whose ids are NOT in the excludeIds list.
 *     Use this in themes that hardcode the curated layout but want to
 *     surface additional sections the merchant added in the dashboard.
 *
 * Both look up the section type in DEFAULT_SECTION_REGISTRY (passed as
 * `registry` prop to override). Unknown types render nothing.
 */
import React from 'react';
import { useTheme } from './ThemeProvider';
import { DEFAULT_SECTION_REGISTRY, type SectionComponent } from '../components/sections';
import type { ThemeManifest } from '../types/theme';

export interface SectionRendererProps {
  template: keyof ThemeManifest['templates'];
  registry?: Record<string, SectionComponent>;
  /** Optional QuickView callback wired through to product sections */
  onQuickView?: (product: any) => void;
}

export const SectionRenderer: React.FC<SectionRendererProps> = ({
  template,
  registry = DEFAULT_SECTION_REGISTRY,
  onQuickView,
}) => {
  const { getSections, isSectionEnabled } = useTheme();
  const sections = getSections(template);

  return (
    <>
      {sections.map((s) => {
        if (!isSectionEnabled(s.id)) return null;
        const Component = registry[s.type];
        if (!Component) return null;
        return <Component key={s.id} id={s.id} section={s} onQuickView={onQuickView} />;
      })}
    </>
  );
};

export interface MerchantSectionsProps extends SectionRendererProps {
  /** Section IDs to skip — typically the ids the host theme hardcodes itself */
  excludeIds?: string[];
}

/**
 * MerchantSections — renders only "extra" sections the merchant added in the
 * dashboard (sections not in the excludeIds list). Drop this near the bottom
 * of a hardcoded theme Home page so newly-added sections become visible
 * without rewriting the entire theme.
 */
export const MerchantSections: React.FC<MerchantSectionsProps> = ({
  template,
  excludeIds = [],
  registry = DEFAULT_SECTION_REGISTRY,
  onQuickView,
}) => {
  const { getSections, isSectionEnabled } = useTheme();
  const sections = getSections(template);
  const exclude = new Set<string>(excludeIds);

  return (
    <>
      {sections.map((s) => {
        if (exclude.has(s.id)) return null;
        if (!isSectionEnabled(s.id)) return null;
        const Component = registry[s.type];
        if (!Component) return null;
        return <Component key={s.id} id={s.id} section={s} onQuickView={onQuickView} />;
      })}
    </>
  );
};
