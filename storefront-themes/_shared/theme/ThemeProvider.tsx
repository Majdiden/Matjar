import React, { createContext, useContext, useMemo, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { ThemeManifest, MergedThemeSettings, SectionInstance, ThemeColors, ThemeTypography, ThemeDesignTokens } from '../types/theme';
import { useStore } from '../contexts/StoreContext';

/**
 * Premium platform defaults for the design-system tokens. A theme that
 * ships nothing still gets a tasteful, production-grade depth/motion/radius
 * ramp — the opposite of the old flat look. Themes override individual keys
 * via `manifest.designTokens` (see ThemeDesignTokens) and merchants can tune
 * radius live through the `border_radius` customizer setting.
 *
 * Shadows use a soft two-layer recipe (ambient + key light) tuned on a
 * near-neutral slate so cards lift without looking grey/dirty on white.
 */
export const DEFAULT_DESIGN_TOKENS: Required<
  Pick<ThemeDesignTokens, 'elevation' | 'motion' | 'radius' | 'sectionGap'>
> = {
  elevation: {
    xs: '0 1px 2px rgba(15, 23, 42, 0.06)',
    sm: '0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)',
    md: '0 4px 12px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.05)',
    lg: '0 12px 28px rgba(15, 23, 42, 0.12), 0 4px 10px rgba(15, 23, 42, 0.06)',
    xl: '0 24px 56px rgba(15, 23, 42, 0.18), 0 8px 20px rgba(15, 23, 42, 0.08)',
  },
  motion: {
    durationFast: '150ms',
    durationBase: '250ms',
    durationSlow: '400ms',
    easeStandard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeEmphasized: 'cubic-bezier(0.2, 0, 0, 1)',
    easeEntrance: 'cubic-bezier(0.16, 1, 0.3, 1)',
    hoverLift: 'translateY(-4px)',
  },
  radius: {
    sm: '6px',
    base: '12px',
    lg: '20px',
    pill: '9999px',
  },
  sectionGap: '5rem',
};

/**
 * Resolve the active design tokens: platform defaults < theme manifest
 * overrides < live `border_radius` customizer value. Returns a flat list
 * of `--token: value` declarations ready to drop into the :root rule.
 */
function buildDesignTokenVars(
  manifest: ThemeManifest,
  borderRadius: number | undefined,
): string[] {
  const t = manifest.designTokens || {};
  const elevation = { ...DEFAULT_DESIGN_TOKENS.elevation, ...(t.elevation || {}) };
  const motion = { ...DEFAULT_DESIGN_TOKENS.motion, ...(t.motion || {}) };
  const radius = { ...DEFAULT_DESIGN_TOKENS.radius, ...(t.radius || {}) };
  const sectionGap = t.sectionGap || DEFAULT_DESIGN_TOKENS.sectionGap;

  // The customizer's numeric `border_radius` (px) wins for the base radius
  // and proportionally re-derives sm/lg so the whole scale tracks together.
  let baseRadius = radius.base;
  let smRadius = radius.sm;
  let lgRadius = radius.lg;
  if (typeof borderRadius === 'number' && !Number.isNaN(borderRadius)) {
    baseRadius = `${borderRadius}px`;
    smRadius = `${Math.max(0, Math.round(borderRadius * 0.5))}px`;
    lgRadius = `${Math.round(borderRadius * 1.6)}px`;
  }

  return [
    `  --shadow-xs: ${elevation.xs};`,
    `  --shadow-sm: ${elevation.sm};`,
    `  --shadow-md: ${elevation.md};`,
    `  --shadow-lg: ${elevation.lg};`,
    `  --shadow-xl: ${elevation.xl};`,
    `  --duration-fast: ${motion.durationFast};`,
    `  --duration-base: ${motion.durationBase};`,
    `  --duration-slow: ${motion.durationSlow};`,
    `  --ease-standard: ${motion.easeStandard};`,
    `  --ease-emphasized: ${motion.easeEmphasized};`,
    `  --ease-entrance: ${motion.easeEntrance};`,
    `  --hover-lift: ${motion.hoverLift};`,
    `  --radius-sm: ${smRadius};`,
    `  --radius: ${baseRadius};`,
    `  --radius-lg: ${lgRadius};`,
    `  --radius-pill: ${radius.pill};`,
    `  --section-gap: ${sectionGap};`,
  ];
}

interface ThemeContextValue {
  manifest: ThemeManifest;
  settings: MergedThemeSettings;
  /** Get the ordered section instances for a given template */
  getSections: (template: keyof ThemeManifest['templates']) => SectionInstance[];
  /**
   * Raw per-template section list as persisted on the tenant doc.
   * Keys are the backend allow-list (index, product, collection,
   * cart, search, page). Prefer `useTemplateSections(templateId)`
   * which applies the same manifest/tenant merge as the home page.
   */
  sectionsByTemplate: Record<string, any[]>;
  /** Get merged settings for a specific section instance */
  getSectionSettings: (sectionId: string) => Record<string, any>;
  /** Get resolved blocks for a specific section instance (tenant overrides > template > section.defaultBlocks) */
  getSectionBlocks: (sectionId: string) => Array<{ id: string; type: string; settings: Record<string, any> }>;
  /** Check if a section is enabled (defaults to true if no override) */
  isSectionEnabled: (sectionId: string) => boolean;
  colors: ThemeColors;
  typography: ThemeTypography;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

/**
 * Shortcut hook: get merged settings for a specific section by its instance ID.
 */
export function useThemeSettings(sectionId: string): Record<string, any> {
  const { getSectionSettings } = useTheme();
  return getSectionSettings(sectionId);
}

/**
 * Shortcut hook: read a single theme-level setting value (from manifest.settings
 * defaults or tenant overrides). Returns `undefined` when the key is unknown.
 */
export function useThemeSetting<T = any>(key: string): T | undefined {
  const { settings } = useTheme();
  return settings.global?.[key] as T | undefined;
}

/**
 * Shortcut hook: read a single merged global layout setting — e.g.
 * `useLayoutSetting('headerStyle')` / `useLayoutSetting('footerStyle')`.
 * Values come from the reactive merged settings (manifest defaults +
 * tenant overrides + live editor SETTINGS_UPDATE messages), so variants
 * that key off these re-render live in the visual editor preview.
 */
export function useLayoutSetting<K extends keyof MergedThemeSettings['layout']>(
  key: K,
): MergedThemeSettings['layout'][K] {
  const { settings } = useTheme();
  return settings.layout?.[key];
}

/**
 * Shortcut hook: current color mode ("light" | "dark").
 */
export function useColorMode(): 'light' | 'dark' {
  return useTheme().settings.colorMode;
}

/**
 * Check if a section is enabled (not disabled by the store owner in the dashboard).
 */
export function useSectionEnabled(sectionId: string): boolean {
  const { isSectionEnabled } = useTheme();
  return isSectionEnabled(sectionId);
}

/**
 * Hook: resolve the section list for a given template id with the
 * same manifest/tenant merging logic the home template uses.
 *
 * Order of preference for a template's raw list:
 *   1. tenant `sectionsByTemplate[templateId]` when it exists and
 *      has entries.
 *   2. tenant flat `sections` array when asking for "index".
 *   3. manifest-declared template defaults.
 *
 * The returned instances are filtered through `isSectionEnabled`
 * and their settings are merged with manifest defaults, exactly
 * like the existing `getSections(template)` path.
 */
export function useTemplateSections(templateId: string): SectionInstance[] {
  const { manifest, sectionsByTemplate, settings } = useTheme();

  // Raw list for the requested template (tenant bucket wins; else
  // manifest default). No fallback to the home bucket — empty means
  // the merchant hasn't composed a layout yet.
  const raw: any[] = (() => {
    const tenantList = sectionsByTemplate?.[templateId];
    if (Array.isArray(tenantList) && tenantList.length > 0) return tenantList;
    const tplKey = templateId as keyof ThemeManifest['templates'];
    const manifestList = manifest.templates?.[tplKey] || [];
    return manifestList;
  })();

  // Build section-type default settings map once per manifest.
  const sectionDefaults: Record<string, Record<string, any>> = {};
  for (const section of manifest.sections) {
    const defaults: Record<string, any> = {};
    // Guard: a malformed section (settings missing or not an array) must
    // never throw and white-screen the whole storefront.
    for (const setting of (Array.isArray(section.settings) ? section.settings : [])) {
      if ('default' in setting && (setting as any).default !== undefined) {
        defaults[setting.id] = (setting as any).default;
      }
    }
    sectionDefaults[section.type] = defaults;
  }

  return raw
    .filter((s: any) => s && s.id && s.type)
    // Visibility is carried on the instance itself (disabled/enabled). We do
    // NOT run `isSectionEnabled(s.id)` here: that helper resolves ids against
    // the flat INDEX bucket, so a section living in a non-index template
    // (search/collection/page/product) is never in that list and would be
    // wrongly dropped. The instance-level flags above are the source of truth
    // for per-template visibility.
    .filter((s: any) => s.disabled !== true && s.enabled !== false)
    .map((s: any): SectionInstance => {
      const typeDefs = sectionDefaults[s.type] || {};
      // Section-specific merged settings from the context may have
      // been resolved in `merged.sections` if this instance id was
      // seen under index; otherwise fall back to per-type defaults
      // layered with the stored settings.
      const merged =
        (settings.sections && settings.sections[s.id]) ||
        { ...typeDefs, ...(s.settings || {}) };
      return {
        id: s.id,
        type: s.type,
        settings: merged,
        blocks: s.blocks,
        disabled: false,
      } as SectionInstance;
    });
}

/**
 * Shortcut hook: resolve the blocks (sub-items) configured for a section
 * instance. Returns an array of `{ id, type, settings }`, where settings
 * are merged against the section's block-definition defaults so hardcoded
 * fallbacks in the page aren't required.
 *
 * Resolution precedence:
 *   1. Tenant override (`store.themeCustomization.sections[].blocks`) for
 *      the given section id, if present.
 *   2. The template instance's own `blocks` array from the manifest.
 *   3. The section definition's `defaultBlocks`.
 */
export function useSectionBlocks(sectionId: string): Array<{ id: string; type: string; settings: Record<string, any> }> {
  const { getSectionBlocks } = useTheme();
  return getSectionBlocks(sectionId);
}

interface ThemeProviderProps {
  manifest: ThemeManifest;
  children: ReactNode;
}

/**
 * ThemeProvider merges the theme manifest's defaults with tenant-level
 * overrides from the store's themeCustomization. Wrap your entire app.
 *
 * @example
 * ```tsx
 * import manifest from './theme.manifest';
 * <ThemeProvider manifest={manifest}>
 *   <App />
 * </ThemeProvider>
 * ```
 */
/**
 * Messages the dashboard editor can send via postMessage to apply live changes.
 */
interface ThemeUpdateMessage {
  type: 'THEME_UPDATE' | 'SECTION_UPDATE' | 'SECTION_TOGGLE' | 'SECTION_REORDER' | 'SETTINGS_UPDATE';
  settings?: any;
  sectionId?: string;
  enabled?: boolean;
  sectionIds?: string[];
  category?: string;
}

export function ThemeProvider({ manifest, children }: ThemeProviderProps) {
  const { store } = useStore();
  const baseOverrides = store?.themeCustomization;

  // Live preview overrides from dashboard postMessage
  const [liveOverrides, setLiveOverrides] = useState<any>(null);

  // Listen for postMessage from dashboard editor iframe parent.
  //
  // Origin check rules:
  //   1. event.source MUST be window.parent. We only consume messages
  //      from the iframe's direct parent (the dashboard). Any other
  //      window — popup, sibling iframe, opener — is rejected.
  //   2. event.origin MUST be in the allowlist. Same-origin is always
  //      trusted. A tenant running on a custom domain gets messages
  //      from the dashboard origin, which we derive at build time
  //      via VITE_DASHBOARD_ORIGIN so a third-party site can't send
  //      fake preview updates to the storefront.
  //
  // Without these checks, any page the shopper has open in another
  // tab could postMessage into this frame and mutate the preview
  // state — a low-impact exploit (no data read) but still noise we
  // want to cut out.
  useEffect(() => {
    const dashboardOrigin =
      (import.meta as any).env?.VITE_DASHBOARD_ORIGIN || window.location.origin;
    const allowedOrigins = new Set([window.location.origin, dashboardOrigin]);

    const handleMessage = (event: MessageEvent<ThemeUpdateMessage>) => {
      if (event.source !== window.parent) return;
      if (!allowedOrigins.has(event.origin)) return;
      const { data } = event;
      if (!data || typeof data !== 'object' || !data.type) return;

      switch (data.type) {
        case 'THEME_UPDATE':
        case 'SETTINGS_UPDATE':
          // Full settings replacement
          setLiveOverrides((prev: any) => ({
            ...prev,
            settings: { ...(prev?.settings || {}), ...data.settings },
          }));
          break;
        case 'SECTION_UPDATE':
          // Update a single section's settings
          setLiveOverrides((prev: any) => {
            const sections = [...(prev?.sections || baseOverrides?.sections || [])];
            const idx = sections.findIndex((s: any) => s.id === data.sectionId);
            if (idx >= 0) {
              sections[idx] = { ...sections[idx], settings: { ...sections[idx].settings, ...data.settings } };
            }
            return { ...prev, sections };
          });
          break;
        case 'SECTION_TOGGLE':
          setLiveOverrides((prev: any) => {
            const sections = [...(prev?.sections || baseOverrides?.sections || [])];
            const idx = sections.findIndex((s: any) => s.id === data.sectionId);
            if (idx >= 0) {
              // Write BOTH polarity fields: `disabled` is the SDK field,
              // but persisted sections may still carry the legacy
              // `enabled` flag which the render filters also honour —
              // leaving a stale `enabled: false` would keep a live
              // re-enabled section hidden.
              sections[idx] = { ...sections[idx], disabled: !data.enabled, enabled: data.enabled };
            }
            return { ...prev, sections };
          });
          break;
        case 'SCROLL_TO_SECTION': {
          // Editor asked us to reveal a section it just added/edited. The node
          // carries data-section-id; it may render a frame later (just added),
          // so retry briefly before giving up.
          const sid = (data as any).sectionId;
          if (sid) {
            let tries = 0;
            const tryScroll = () => {
              const el = document.querySelector(`[data-section-id="${sid}"]`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              } else if (tries++ < 40) {
                window.setTimeout(tryScroll, 100);
              }
            };
            tryScroll();
          }
          break;
        }
        case 'SECTION_REORDER':
          setLiveOverrides((prev: any) => {
            const existingSections = prev?.sections || baseOverrides?.sections || [];
            const sectionMap = new Map(existingSections.map((s: any) => [s.id, s]));
            // Rewrite `order` to the new index — persisted sections carry
            // their old `order` values and getSections() sorts by that
            // field, which would silently undo the live reorder.
            const reordered = (data.sectionIds || [])
              .map((id: string, i: number) => {
                const s = sectionMap.get(id);
                return s ? { ...(s as any), order: i } : null;
              })
              .filter(Boolean);
            return { ...prev, sections: reordered };
          });
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [baseOverrides]);

  // Merge: base overrides + live overrides (live takes precedence).
  // Spread the whole settings bags first so loose top-level keys AND the
  // `theme` bucket (manifest-level globals such as home_variant /
  // color_mode) survive the merge — re-spreading only colors/typography/
  // layout used to silently drop live theme-setting changes.
  const overrides = useMemo(() => {
    if (!liveOverrides) return baseOverrides;
    return {
      ...baseOverrides,
      settings: {
        ...(baseOverrides?.settings || {}),
        ...(liveOverrides?.settings || {}),
        colors: { ...(baseOverrides?.settings?.colors || {}), ...(liveOverrides?.settings?.colors || {}) },
        typography: { ...(baseOverrides?.settings?.typography || {}), ...(liveOverrides?.settings?.typography || {}) },
        layout: { ...(baseOverrides?.settings?.layout || {}), ...(liveOverrides?.settings?.layout || {}) },
        theme: { ...(baseOverrides?.settings?.theme || {}), ...(liveOverrides?.settings?.theme || {}) },
      },
      sections: liveOverrides.sections || baseOverrides?.sections,
      // Live section edits (reorder/toggle/update) arrive as the flat
      // `sections` array, but rendering reads the canonical
      // `sectionsByTemplate.index` bucket (useTemplateSections). Mirror the live
      // flat list into the index bucket so those edits reflect in the editor
      // preview WITHOUT a publish — otherwise a store that has a populated
      // sectionsByTemplate never updates live. Only the index template is
      // edited live; other templates keep their base buckets.
      sectionsByTemplate: liveOverrides.sections
        ? { ...(baseOverrides?.sectionsByTemplate || {}), index: liveOverrides.sections }
        : baseOverrides?.sectionsByTemplate,
    };
  }, [baseOverrides, liveOverrides]);

  const merged = useMemo<MergedThemeSettings>(() => {
    // Theme-level settings: manifest defaults, then tenant overrides.
    // Tenant overrides can either sit under `overrides.settings.theme`
    // (explicit bucket) or as loose top-level keys on `overrides.settings`
    // alongside colors/typography/layout — both are accepted.
    const globalDefaults: Record<string, any> = {};
    for (const setting of manifest.settings || []) {
      if ('default' in setting && (setting as any).default !== undefined) {
        globalDefaults[setting.id] = (setting as any).default;
      }
    }
    const overrideSettings: Record<string, any> = (overrides?.settings as any) || {};
    const { colors: _oc, typography: _ot, layout: _ol, theme: _ot2, ...looseOverrides } = overrideSettings;
    const global: Record<string, any> = {
      ...globalDefaults,
      ...looseOverrides,
      ...((overrideSettings as any).theme || {}),
    };

    // Resolve color mode. Defaults to light unless the theme setting flips it.
    const colorMode: 'light' | 'dark' = global.color_mode === 'dark' ? 'dark' : 'light';

    // Start with the light palette, then layer the dark overrides when in
    // dark mode so themes can ship just the keys that differ.
    const lightColors: ThemeColors = {
      ...manifest.colors,
      ...(overrides?.settings?.colors as Partial<ThemeColors>),
    };
    const colors: ThemeColors =
      colorMode === 'dark'
        ? { ...lightColors, ...(manifest.colorsDark || {}) }
        : lightColors;

    const typography: ThemeTypography = {
      ...manifest.typography,
      ...(overrides?.settings?.typography as Partial<ThemeTypography>),
    };

    const layout = {
      maxWidth: '1280px',
      headerStyle: 'standard' as const,
      footerStyle: 'standard' as const,
      ...manifest.layout,
      ...(overrides?.settings?.layout as any),
    };

    // Build per-section settings by merging section definition defaults
    // with template instance settings, then with tenant overrides
    const sectionDefaults: Record<string, Record<string, any>> = {};
    for (const section of manifest.sections) {
      const defaults: Record<string, any> = {};
      for (const setting of (Array.isArray(section.settings) ? section.settings : [])) {
        if ('default' in setting && setting.default !== undefined) {
          defaults[setting.id] = setting.default;
        }
      }
      sectionDefaults[section.type] = defaults;
    }

    // Merge template instance settings — cover both regular templates and
    // all home variants so variant-only section ids still pick up defaults.
    const sectionSettings: Record<string, Record<string, any>> = {};
    const allTemplates = [
      ...Object.values(manifest.templates).flat(),
      ...Object.values(manifest.homeVariants || {}).flat(),
    ];
    for (const instance of allTemplates) {
      if (!instance) continue;
      const typeDefs = sectionDefaults[instance.type] || {};
      sectionSettings[instance.id] = { ...typeDefs, ...instance.settings };
    }

    // Apply tenant overrides. Two cases:
    //   1. Override id matches a template instance id  → merge in place.
    //      (Used when the merchant edits a section that ships with the
    //      theme — e.g. changes the hero subtitle.)
    //   2. Override id doesn't match a template id     → create a fresh
    //      entry keyed by the override id, seeded with the section type's
    //      defaults. This is the path for sections the merchant ADDED via
    //      the dashboard (UUID-style ids like "hero-cd32c761") which would
    //      otherwise be silently dropped.
    if (overrides?.sections) {
      for (const override of overrides.sections) {
        if (!override?.id) continue;
        if (sectionSettings[override.id]) {
          sectionSettings[override.id] = { ...sectionSettings[override.id], ...override.settings };
        } else if (override.type) {
          const typeDefs = sectionDefaults[override.type] || {};
          sectionSettings[override.id] = { ...typeDefs, ...(override.settings || {}) };
        }
      }
    }

    // Same treatment for the per-template section buckets (search /
    // collection / page / product / …). Section components resolve their
    // own settings by id via `useThemeSettings(id)` → `merged.sections[id]`,
    // so a section that lives ONLY in a non-index bucket (never in the flat
    // `overrides.sections` index list) would otherwise resolve to empty
    // settings and render blank. Fold every template bucket's instances in
    // here so they render with their authored settings on their own page.
    const byTpl = (overrides as any)?.sectionsByTemplate;
    if (byTpl && typeof byTpl === 'object') {
      for (const list of Object.values(byTpl)) {
        if (!Array.isArray(list)) continue;
        for (const inst of list as any[]) {
          if (!inst?.id) continue;
          if (sectionSettings[inst.id]) {
            sectionSettings[inst.id] = { ...sectionSettings[inst.id], ...(inst.settings || {}) };
          } else if (inst.type) {
            const typeDefs = sectionDefaults[inst.type] || {};
            sectionSettings[inst.id] = { ...typeDefs, ...(inst.settings || {}) };
          }
        }
      }
    }

    return { colors, typography, layout, sections: sectionSettings, global, colorMode };
  }, [manifest, overrides]);

  // Inject CSS custom properties via a <style> tag on :root.
  // When the theme ships a dark palette we emit BOTH palettes — the base
  // :root rule holds the active mode's colors (so legacy selectors keep
  // working) and `[data-color-mode="dark"]` holds the dark override so
  // components deep in the tree can opt into either palette without a
  // full re-render.
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const lightColors: ThemeColors = {
      ...manifest.colors,
      ...(overrides?.settings?.colors as Partial<ThemeColors>),
    };
    const darkColors: ThemeColors = {
      ...lightColors,
      ...(manifest.colorsDark || {}),
    };

    const colorVars = (palette: ThemeColors) =>
      Object.entries(palette)
        .map(([key, value]) => `  --color-${key}: ${value};`)
        .join('\n');

    const typoVars: string[] = [];
    if (merged.typography.fontFamily) typoVars.push(`  --font-family: ${merged.typography.fontFamily};`);
    if (merged.typography.headingFontFamily) {
      typoVars.push(`  --font-family-heading: ${merged.typography.headingFontFamily};`);
    } else if (merged.typography.fontFamily) {
      typoVars.push(`  --font-family-heading: ${merged.typography.fontFamily};`);
    }
    if (merged.typography.baseFontSize) typoVars.push(`  --font-size-base: ${merged.typography.baseFontSize};`);
    if (merged.typography.lineHeight) typoVars.push(`  --line-height: ${merged.typography.lineHeight};`);
    if (merged.layout.maxWidth) typoVars.push(`  --layout-max-width: ${merged.layout.maxWidth};`);

    const activeVars = colorVars(merged.colorMode === 'dark' ? darkColors : lightColors);
    const darkScopedVars = colorVars(darkColors);
    const lightScopedVars = colorVars(lightColors);

    // Design-system tokens (elevation / motion / radius / rhythm). The
    // customizer's `border_radius` global setting, when present, re-derives
    // the radius scale so live edits flow through one source of truth.
    const tokenVars = buildDesignTokenVars(
      manifest,
      typeof merged.global?.border_radius === 'number' ? merged.global.border_radius : undefined,
    ).join('\n');

    const css = `:root {\n${activeVars}\n${typoVars.join('\n')}\n${tokenVars}\n}\n` +
      `[data-color-mode="dark"] {\n${darkScopedVars}\n}\n` +
      `[data-color-mode="light"] {\n${lightScopedVars}\n}\n` +
      // `overflow-x: clip` is a global safety net against accidental
      // horizontal scroll on mobile (off-screen decorations, full-bleed
      // rows, RTL drawers). Unlike `overflow: hidden` it does NOT create a
      // scroll container, so sticky headers / the fixed bottom nav still work.
      // Clip horizontal overflow at BOTH html and body so an accidental
      // full-bleed row / off-screen decoration / wide rail can never make
      // the whole page scroll sideways on mobile. `clip` (not `hidden`)
      // keeps sticky headers + the fixed bottom nav working. No `100vw`
      // (it includes the scrollbar width and can itself cause overflow).
      `html {\n  overflow-x: clip;\n}\n` +
      `body {\n  font-family: var(--font-family, system-ui, sans-serif);\n  font-size: var(--font-size-base, 16px);\n  line-height: var(--line-height, 1.5);\n  color: var(--color-foreground, #111);\n  background-color: var(--color-background, #fff);\n  overflow-x: clip;\n  max-width: 100%;\n}\n` +
      `h1, h2, h3, h4, h5, h6 {\n  font-family: var(--font-family-heading, var(--font-family, system-ui, sans-serif));\n}`;

    const id = 'theme-css-variables';
    let style = document.getElementById(id) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      document.head.appendChild(style);
    }
    style.textContent = css;

    // Reflect the active mode on <html> so components can scope dark
    // tailwind classes or `[data-color-mode="dark"]` selectors.
    document.documentElement.setAttribute('data-color-mode', merged.colorMode);

    return () => {
      style?.remove();
      document.documentElement.removeAttribute('data-color-mode');
    };
  }, [manifest, overrides, merged.colors, merged.typography, merged.layout, merged.colorMode]);

  const getSections = (template: keyof ThemeManifest['templates']): SectionInstance[] => {
    // Allow themes to expose multiple homepage layouts. When a theme setting
    // named `home_variant` points at a known variant, that ordered list
    // replaces the default `templates.index`. Unknown keys silently fall
    // back to the default so a stale setting can't blank the homepage.
    let templateSections: SectionInstance[];
    if (template === 'index' && manifest.homeVariants) {
      const variantKey = merged.global?.home_variant;
      templateSections =
        (variantKey && manifest.homeVariants[variantKey]) ||
        manifest.templates.index ||
        [];
    } else {
      templateSections = manifest.templates[template] || [];
    }

    // If tenant has any section overrides, treat that list as the
    // authoritative ordered list of sections to render — this is the
    // state the merchant sees in the dashboard editor, and it's what
    // `publishCustomization` snapshots into `published.sections`. Any
    // override-only section (one the merchant added, with a UUID-ish
    // id not present in the manifest template) would otherwise be
    // silently dropped here. Sections the merchant never touched
    // remain in the template but are still surfaced via the overrides
    // array because `addSectionService` / the dashboard seed it with
    // the manifest defaults on first edit.
    if (overrides?.sections && overrides.sections.length > 0) {
      const templateMap = new Map(templateSections.map((s) => [s.id, s]));
      // Stable sort by `order` (falls back to stored array order for
      // ties), so reordering in the dashboard is honored.
      const orderedOverrides = [...overrides.sections]
        .map((s, i) => ({ s, i }))
        .sort((a, b) => {
          const ao = Number(a.s.order ?? a.i);
          const bo = Number(b.s.order ?? b.i);
          return ao - bo || a.i - b.i;
        })
        .map((x) => x.s);

      return orderedOverrides
        .filter((o: any) => o?.id && o.disabled !== true && o.enabled !== false)
        .map((o: any): SectionInstance => {
          const template = templateMap.get(o.id);
          return {
            id: o.id,
            type: o.type || template?.type,
            settings: merged.sections[o.id] || o.settings || template?.settings || {},
            blocks: o.blocks || template?.blocks,
            disabled: false,
          } as SectionInstance;
        })
        // Drop any entry missing a resolvable type — SectionRenderer
        // would silently skip it anyway, but this keeps the array clean.
        .filter((s) => !!s.type);
    }

    return templateSections.filter(s => !s.disabled);
  };

  const getSectionSettings = (sectionId: string): Record<string, any> => {
    return merged.sections[sectionId] || {};
  };

  const getSectionBlocks = (
    sectionId: string,
  ): Array<{ id: string; type: string; settings: Record<string, any> }> => {
    // Find the section type by walking every place a section instance can
    // live (all templates + home variants). Needed so we can layer the
    // block-definition defaults under the instance blocks.
    const allInstances: SectionInstance[] = [
      ...Object.values(manifest.templates).flat(),
      ...Object.values(manifest.homeVariants || {}).flat(),
    ].filter(Boolean) as SectionInstance[];
    const tenantSections: any[] = (overrides?.sections as any[]) || [];

    const templateInstance = allInstances.find((s) => s.id === sectionId);
    const tenantInstance = tenantSections.find((s: any) => s?.id === sectionId);
    const sectionType = tenantInstance?.type || templateInstance?.type;
    if (!sectionType) return [];

    const sectionDef = manifest.sections.find((s) => s.type === sectionType);

    // Per-block-type defaults, keyed by block `type`.
    const blockDefaults: Record<string, Record<string, any>> = {};
    for (const blockDef of sectionDef?.blocks || []) {
      const defs: Record<string, any> = {};
      for (const setting of blockDef.settings || []) {
        if ('default' in setting && (setting as any).default !== undefined) {
          defs[setting.id] = (setting as any).default;
        }
      }
      blockDefaults[blockDef.type] = defs;
    }

    // Pick whichever block array is active, using the precedence above.
    const rawBlocks: any[] =
      (tenantInstance?.blocks as any[]) ||
      (templateInstance?.blocks as any[]) ||
      (sectionDef?.defaultBlocks as any[]) ||
      [];

    return rawBlocks
      .filter((b) => b && b.type)
      .map((b, i) => ({
        id: b.id || `${sectionId}-block-${i}`,
        type: b.type,
        settings: { ...(blockDefaults[b.type] || {}), ...(b.settings || {}) },
      }));
  };

  const isSectionEnabled = useCallback((sectionId: string): boolean => {
    const list = overrides?.sections;
    // No customization yet → the manifest's default sections are all visible.
    if (!Array.isArray(list) || list.length === 0) return true;
    // Match by id OR type: a theme's hard-coded section (e.g. Home calls
    // useSectionEnabled('categories')) is keyed by the manifest TYPE, but a
    // seeded/published section instance may carry a generated id. Matching
    // either avoids wrongly treating a present section as "deleted" (which
    // hides it) just because its instance id isn't the literal type string.
    const section = list.find((s: any) => s.id === sectionId || s.type === sectionId);
    // The merchant HAS a customized section list (the dashboard seeds it with
    // the manifest defaults on first edit). If a hard-coded section is NOT in
    // that list, the merchant DELETED it in the editor — so it must hide.
    // Previously this returned `true`, which made deleting a theme-hardcoded
    // section (e.g. elegance's editorial banner) impossible — it always
    // reappeared. Honor the explicit `enabled` flag when present.
    if (!section) return false;
    return section.enabled !== false;
  }, [overrides]);

  // Normalise the per-template bucket from the overrides, falling
  // back to the flat `sections` array under "index" so legacy
  // tenants surface the same data under the new key.
  const sectionsByTemplate: Record<string, any[]> = useMemo(() => {
    const src: any =
      (overrides as any)?.sectionsByTemplate && typeof (overrides as any).sectionsByTemplate === 'object'
        ? { ...(overrides as any).sectionsByTemplate }
        : {};
    if (
      (!Array.isArray(src.index) || src.index.length === 0) &&
      Array.isArray((overrides as any)?.sections) &&
      (overrides as any).sections.length > 0
    ) {
      src.index = (overrides as any).sections;
    }
    return src;
  }, [overrides]);

  const value: ThemeContextValue = {
    manifest,
    settings: merged,
    getSections,
    sectionsByTemplate,
    getSectionSettings,
    getSectionBlocks,
    isSectionEnabled,
    colors: merged.colors,
    typography: merged.typography,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
