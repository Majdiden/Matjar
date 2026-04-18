/**
 * Theme editor types — local mirrors of the storefront theme SDK shapes.
 *
 * Theme manifests (sections, blocks, settings) are authored by theme
 * developers and can declare arbitrary per-section/per-block setting
 * schemas. At the dashboard layer the values behind those keys genuinely
 * are dynamic, so `Record<string, unknown>` is the right type — we don't
 * know the field names at compile time.
 *
 * Kept in lockstep with `storefront-themes/_shared/types/theme.ts`.
 * Duplicated here because the dashboard TS project's `include` is
 * scoped to `src/`; we can't reach outside it without changing the
 * tsconfig, which is out of scope for this lint pass.
 */
export type SectionSettingType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'range'
  | 'checkbox'
  | 'select'
  | 'color'
  | 'image'
  | 'url'
  | 'collection'
  | 'product'
  | string;

export interface SectionSettingOption {
  value: string;
  label: string;
}

/**
 * Loose shape — covers every setting variant from the theme SDK
 * (text/range/select/color/…). Specific per-type fields (min/max,
 * options, default, placeholder, unit, step) are declared optional so
 * a single control renderer can switch on `type` at runtime.
 */
export interface SectionSetting {
  id: string;
  type: SectionSettingType;
  label: string;
  info?: string;
  default?: unknown;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: SectionSettingOption[];
}

export interface BlockDefinition {
  type: string;
  name: string;
  limit?: number;
  settings: SectionSetting[];
}

export interface BlockInstance {
  id: string;
  type: string;
  settings: Record<string, unknown>;
}

export interface SectionDefinition {
  type: string;
  name: string;
  description?: string;
  target?: 'header' | 'footer' | 'body';
  limit?: number;
  settings: SectionSetting[];
  blocks?: BlockDefinition[];
}

/**
 * Server-side representation of a section instance in a draft
 * customization. Mirrors the dashboard API response — the storefront
 * SDK's `SectionInstance` uses `disabled`, the dashboard uses `enabled`.
 */
export interface SectionInstance {
  id: string;
  type: string;
  enabled: boolean;
  order: number;
  layout?: string;
  settings: Record<string, unknown>;
  blocks?: BlockInstance[];
  elements?: Array<{
    id: string;
    type: string;
    order: number;
    content: unknown;
    styles: Record<string, string>;
  }>;
}

/** Shape returned by GET /theme-customization/manifest-schema/:slug. */
export interface ManifestSchema {
  name?: string;
  global: SectionSetting[];
  colors: Record<string, string>;
  typography: Record<string, string>;
  sections: SectionDefinition[];
  templates: Record<string, SectionInstance[]>;
}

/** Row returned by GET /theme-customization/versions. */
export interface ThemeVersionEntry {
  version: number;
  source?: string;
  label?: string;
  themeSlug?: string;
  publishedAt?: string;
}
