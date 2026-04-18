/**
 * Theme SDK — Theme Manifest & Section Types
 *
 * These types define the contract between themes and the platform.
 * Theme developers use defineTheme() and defineSection() helpers
 * which produce objects conforming to these types.
 */

// ─── Section System ──────────────────────────────────────────────

export interface SectionSettingBase {
  id: string;
  label: string;
  /** Help text shown below the setting in the editor */
  info?: string;
}

export interface TextSetting extends SectionSettingBase {
  type: 'text';
  default?: string;
  placeholder?: string;
}

export interface TextareaSetting extends SectionSettingBase {
  type: 'textarea';
  default?: string;
}

export interface NumberSetting extends SectionSettingBase {
  type: 'number';
  default?: number;
  min?: number;
  max?: number;
  step?: number;
}

export interface RangeSetting extends SectionSettingBase {
  type: 'range';
  default?: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}

export interface CheckboxSetting extends SectionSettingBase {
  type: 'checkbox';
  default?: boolean;
}

export interface SelectSetting extends SectionSettingBase {
  type: 'select';
  default?: string;
  options: Array<{ value: string; label: string }>;
}

export interface ColorSetting extends SectionSettingBase {
  type: 'color';
  default?: string;
}

export interface ImageSetting extends SectionSettingBase {
  type: 'image';
  default?: string;
}

export interface UrlSetting extends SectionSettingBase {
  type: 'url';
  default?: string;
}

export interface CollectionSetting extends SectionSettingBase {
  type: 'collection';
  default?: string;
}

export interface ProductSetting extends SectionSettingBase {
  type: 'product';
  default?: string;
}

export type SectionSetting =
  | TextSetting
  | TextareaSetting
  | NumberSetting
  | RangeSetting
  | CheckboxSetting
  | SelectSetting
  | ColorSetting
  | ImageSetting
  | UrlSetting
  | CollectionSetting
  | ProductSetting;

// ─── Block System ────────────────────────────────────────────────

export interface BlockDefinition {
  type: string;
  name: string;
  limit?: number;
  settings: SectionSetting[];
}

export interface BlockInstance {
  id: string;
  type: string;
  settings: Record<string, any>;
}

// ─── Section Definition ──────────────────────────────────────────

export interface SectionDefinition {
  /** Unique identifier for this section type */
  type: string;
  /** Display name in theme editor */
  name: string;
  /** Section description */
  description?: string;
  /** Where this section can be placed */
  target?: 'header' | 'footer' | 'body';
  /** Max instances of this section per page */
  limit?: number;
  /** Configurable settings for this section */
  settings: SectionSetting[];
  /** Block types this section supports */
  blocks?: BlockDefinition[];
  /** Default block instances */
  defaultBlocks?: BlockInstance[];
  /** Presets — pre-configured instances of this section */
  presets?: Array<{
    name: string;
    settings?: Record<string, any>;
    blocks?: BlockInstance[];
  }>;
}

// ─── Section Instance (runtime) ──────────────────────────────────

export interface SectionInstance {
  id: string;
  type: string;
  /** Disabled sections are skipped during render */
  disabled?: boolean;
  settings: Record<string, any>;
  blocks?: BlockInstance[];
}

// ─── Theme Manifest ──────────────────────────────────────────────

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
  muted: string;
  border: string;
  error: string;
  success: string;
}

export interface ThemeTypography {
  fontFamily: string;
  headingFontFamily?: string;
  baseFontSize?: string;
  lineHeight?: string;
}

export interface ThemeManifest {
  /** Unique slug (kebab-case) */
  slug: string;
  /** Display name */
  name: string;
  /** Version (semver) */
  version: string;
  /** Theme description */
  description: string;
  /** Author info */
  author: {
    name: string;
    email?: string;
    website?: string;
  };
  /** Categories this theme is best suited for */
  categories: string[];
  /** Default color palette (light mode) */
  colors: ThemeColors;
  /**
   * Optional dark-mode palette override. Any keys provided here replace
   * their light-mode counterparts when `data-color-mode="dark"` is set on
   * the root. Unset keys fall back to the light palette. Themes that want
   * to support dark mode should expose a `color_mode` theme-level setting
   * and ship both palettes.
   */
  colorsDark?: Partial<ThemeColors>;
  /** Default typography */
  typography: ThemeTypography;
  /** Layout settings */
  layout?: {
    maxWidth?: string;
    headerStyle?: 'standard' | 'centered' | 'minimal';
    footerStyle?: 'standard' | 'minimal' | 'expanded';
  };
  /** Theme-level settings (exposed in theme editor) */
  settings?: SectionSetting[];
  /** Section definitions this theme supports */
  sections: SectionDefinition[];
  /** Default page templates — ordered list of section instances */
  templates: {
    index: SectionInstance[];
    product?: SectionInstance[];
    collection?: SectionInstance[];
    cart?: SectionInstance[];
    search?: SectionInstance[];
    page?: SectionInstance[];
  };
  /**
   * Alternative home layouts the merchant can pick between. Keyed by a
   * variant id (e.g. "showcase", "mega", "editorial"). When a theme-level
   * setting named `home_variant` is set to one of these keys, the matching
   * section list replaces `templates.index` at render time. `templates.index`
   * is still used as the fallback when no variant is selected or the key
   * is unknown.
   */
  homeVariants?: Record<string, SectionInstance[]>;
}

// ─── Merged Settings (runtime) ───────────────────────────────────

/** Settings after merging theme defaults with tenant overrides */
export interface MergedThemeSettings {
  colors: ThemeColors;
  typography: ThemeTypography;
  layout: NonNullable<ThemeManifest['layout']>;
  /** Per-section merged settings, keyed by section instance id */
  sections: Record<string, Record<string, any>>;
  /** Merged theme-level settings (manifest defaults + tenant overrides) */
  global: Record<string, any>;
  /** Resolved color mode — "light" or "dark" */
  colorMode: 'light' | 'dark';
}
