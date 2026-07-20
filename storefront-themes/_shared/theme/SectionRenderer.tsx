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
import { useTheme, useTemplateSections } from './ThemeProvider';
import { DEFAULT_SECTION_REGISTRY, type SectionComponent } from '../components/sections';
import type { ThemeManifest } from '../types/theme';

/**
 * Preview mode = the storefront is embedded in the dashboard editor's
 * iframe, signalled by a `?preview=<token>` query param (mirrors the
 * detection in StoreContext). Only merchants see this; real shoppers
 * never carry the token.
 */
function isPreviewMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has('preview');
}

/**
 * MissingSectionPlaceholder — shown ONLY in preview mode (audit 1.7c) when
 * a section's type has no registry component (its type was removed from a
 * rebuilt manifest). Live shoppers still get the silent skip; merchants see
 * a labelled box in the editor iframe so the discrepancy is visible.
 */
const MissingSectionPlaceholder: React.FC<{ type: string }> = ({ type }) => (
  <div
    data-missing-section={type}
    style={{
      margin: '1rem auto',
      maxWidth: '640px',
      padding: '1rem 1.25rem',
      border: '1px dashed #f59e0b',
      borderRadius: '8px',
      background: '#fffbeb',
      color: '#92400e',
      font: '500 13px/1.5 system-ui, -apple-system, sans-serif',
      textAlign: 'center',
    }}
  >
    Section “{type}” is not supported by this theme and won’t appear on your live store.
  </div>
);

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
        if (!Component) {
          // Silent for shoppers; labelled placeholder in the editor preview.
          return isPreviewMode()
            ? <MissingSectionPlaceholder key={s.id} type={s.type} />
            : null;
        }
        // data-section-id anchors let the editor scroll the preview to a
        // section it just added/edited (SCROLL_TO_SECTION).
        return (
          <div key={s.id} data-section-id={s.id} className="scroll-mt-20">
            <Component id={s.id} section={s} onQuickView={onQuickView} />
          </div>
        );
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
        if (!Component) {
          return isPreviewMode()
            ? <MissingSectionPlaceholder key={s.id} type={s.type} />
            : null;
        }
        return (
          <div key={s.id} data-section-id={s.id} className="scroll-mt-20">
            <Component id={s.id} section={s} onQuickView={onQuickView} />
          </div>
        );
      })}
    </>
  );
};

export interface TemplateSectionsProps {
  /** Non-index template id: product / collection / cart / search / page. */
  template: string;
  registry?: Record<string, SectionComponent>;
  onQuickView?: (product: any) => void;
  /** Optional wrapper class for the rendered block. */
  className?: string;
}

/**
 * TemplateSections — renders the merchant-composed sections for a NON-index
 * template (search / page / collection / …). Unlike `MerchantSections`,
 * which reads the index-centric `getSections()`, this uses
 * `useTemplateSections(templateId)` so it reads the correct per-template
 * bucket (`sectionsByTemplate[templateId]`) that the dashboard editor and
 * `/store-info` populate. Drop it into a shared page so sections the merchant
 * adds to that template actually appear on the storefront (audit follow-up
 * from 1.3). Renders nothing when the merchant hasn't composed that template.
 */
export const TemplateSections: React.FC<TemplateSectionsProps> = ({
  template,
  registry = DEFAULT_SECTION_REGISTRY,
  onQuickView,
  className,
}) => {
  // useTemplateSections already filters to enabled instances and merges
  // manifest defaults; it returns [] when the bucket is empty.
  const sections = useTemplateSections(template);
  if (sections.length === 0) return null;

  return (
    <div className={className}>
      {sections.map((s) => {
        const Component = registry[s.type];
        if (!Component) {
          return isPreviewMode()
            ? <MissingSectionPlaceholder key={s.id} type={s.type} />
            : null;
        }
        return <Component key={s.id} id={s.id} section={s} onQuickView={onQuickView} />;
      })}
    </div>
  );
};
