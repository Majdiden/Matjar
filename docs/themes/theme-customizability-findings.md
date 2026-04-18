Theme Customizability Last Check

The platform has a strong foundation: React themes load manifests, storefronts are wrapped in ThemeProvider,
sections can be added/reordered/duplicated/toggled, publish/preview/rollback exists, custom CSS is sanitized,
and the theme E2E safety/versioning suite passes. But merchants still cannot “fully customize store appearance”
yet. The remaining gaps are mostly UI wiring, global settings validation/persistence, and non-homepage theme
coverage.

Findings

1. High: Global theme settings and custom CSS are not mounted in the current visual editor UI.
   dashboard/src/pages/themes/VisualEditor.tsx:318 renders the top bar, section tree, preview, and selected-
   section editor only. I found ManifestGlobalSettings, CustomCSSEditor, and Sidebar, but rg found no active
   usage of <ManifestGlobalSettings>, <CustomCSSEditor>, or the theme-editor <Sidebar>. This means merchants
   can edit sections, but not reliably edit colors, typography, layout, theme-level settings, or custom CSS
   from the primary editor route.
   Acceptance criteria: editor exposes Sections, Theme Settings, and Custom CSS panels; merchants can change
   color/typography/layout/theme settings; changes persist through API; preview updates; publish makes them
   live; reset restores defaults.
2. High: Manifest-level global settings are supported in the React runtime but blocked by backend persistence.
   storefront-themes/\_shared/theme/ThemeProvider.tsx:182 supports manifest settings and loose/theme override
   keys, but services/themeCustomization.js:261 only allows colors, typography, and layout. repositories/
   themeCustomization.js:19 only writes those three buckets. So theme authors can declare global settings, but
   merchants cannot persist them cleanly.
   Acceptance criteria: add a theme or global settings bucket to tenant draft/published/version snapshots;
   backend accepts only manifest-declared keys; dashboard can edit them; storefront receives and applies them.
3. High: Global setting values are not strictly validated before being injected into CSS variables.
   services/themeValidator.js:373 validates sections only, not global settings. storefront-themes/\_shared/
   theme/ThemeProvider.tsx:296 writes color values directly into CSS variable declarations. Custom CSS has a
   strong policy in services/cssPolicy.js:118, but colors/typography/layout do not get equivalent CSS-safe
   validation.
   Acceptance criteria: global colors accept only safe color formats; typography uses approved font stacks or
   strict CSS-safe patterns; layout values are unit-validated/clamped; publish rejects invalid global settings;
   tests cover malicious CSS-like values.
4. High: Full-store appearance customization is incomplete because many product/category/cart/detail pages
   still hardcode visual design.
   Example: storefront-themes/beauxe/src/pages/Products.tsx:17 defines hardcoded NAVY/PINK, storefront-themes/
   beauxe/src/pages/Products.tsx:102 hardcodes page background, and storefront-themes/beauxe/src/pages/
   Products.tsx:110 hardcodes Playfair Display. storefront-themes/beauxe/src/pages/ProductDetail.tsx:28 repeats
   the same pattern. This limits customization to home sections and CSS escape hatches.
   Acceptance criteria: every storefront page consumes theme CSS variables or manifest settings for brand
   colors, typography, radius, spacing, buttons, backgrounds, badges, cards, and forms; no hardcoded brand
   colors/fonts except fallback defaults.
5. Medium: The visual editor is home-page only.
   dashboard/src/pages/themes/VisualEditor.tsx:64 defines only Home page. The runtime can render templates
   generically, but merchants cannot customize product page, collection page, cart, checkout-adjacent pages,
   search, or static pages through the editor.
   Acceptance criteria: page selector includes home, product, collection/category, products listing, cart,
   search, content pages; manifest templates map to those pages; each template can have separate sections/
   settings.
6. Medium: Hybrid themes reduce “full customization” unless every curated hardcoded section is setting-driven.
   storefront-themes/modern/src/pages/Home.tsx:15 declares hardcoded section IDs and storefront-themes/modern/
   src/pages/Home.tsx:309 renders only merchant-added extra sections after the curated layout. This is
   acceptable for branded themes, but only if every curated block exposes enough settings.
   Acceptance criteria: each hardcoded curated section has manifest controls for content, visibility, spacing,
   layout variant, colors, media, product source/count, buttons, and responsive behavior.
7. Medium: Developer-facing theme extensibility is close, but the contract needs enforcement tests.
   services/themeManifestRegistry.js:24 loads built dist/manifest.json, and storefront-themes/\_shared/theme/
   SectionRenderer.tsx:17 renders from a registry. Good. But there should be automated checks that every
   section type in every manifest has a matching renderer and every setting type has a dashboard control.
   Acceptance criteria: CI test loads all manifests; verifies section renderer coverage; verifies supported
   setting controls; fails on unknown section types, missing defaults, invalid template references, and
   unsupported dashboard controls.
