You are using the newer React theme system, so .matjar should be treated as
deprecated legacy. The active theming architecture is now: React theme bundles in
storefront-themes/\*, shared runtime in storefront-themes/\_shared, backend theme/
customization services, dashboard visual editor, published/draft snapshots, and a
backend manifest registry.

Overall verdict: the foundation is good, but the system is not enterprise-grade
yet. The biggest risk is not visual quality. The biggest risk is that
customization truth is split across frontend manifests, backend manifests,
dashboard assumptions, and publish validation.

What Is Strong

The React theme model is the right direction. Themes define sections, settings,
templates, home variants, and universal sections. The shared ThemeProvider merges
manifest defaults with tenant customization and renders merchant-added sections
through SectionRenderer.

The published/draft split is also correct. Live storefronts read
themeCustomization.published, not the working draft, which is essential for
reliability.

The theme serving middleware is safer now than before. It validates slugs,
contains filesystem access, and serves built React theme bundles by active theme.

The dashboard visual editor has the right shape: manifest-driven section editing,
section add/delete/reorder, preview iframe, publish, reset, and version history.

High Severity Issues

- Published snapshots can still contain invalid section setting keys. The publish
  path claims to strip unknown keys, but the backend test proves unknown keys can
  still publish. This breaks the trust boundary between editor data and live
  storefront rendering. Relevant code: services/themeCustomization.js:451,
  services/themeCustomization.js:466, services/themeCustomization.js:572.
- Preview tokens are generated but not consumed by the storefront. The backend
  generates /?preview=<token>, but /storefront/store-info always returns the
  published snapshot. That means the editor preview is not a true draft preview.
  Relevant code: services/themeCustomization.js:376, routes/storefront.js:261,
  dashboard/src/components/theme-editor/PreviewFrame.tsx:62.
- Reset can erase the live published snapshot. resetCustomizationRepo replaces the
  whole themeCustomization object without preserving published. Since storefronts
  serve only published, reset can unintentionally alter or remove live storefront
  customization. Relevant code: repositories/themeCustomization.js:107,
  repositories/themeCustomization.js:113, routes/storefront.js:261.
- Theme fallback can mix one React app with another theme’s customization. If
  active theme build is missing, storefrontServe falls back to modern, but /
  storefront/store-info can still return the tenant’s original active theme and
  published customization. That creates broken or silently missing sections.
  Relevant code: middlewares/storefrontServe.js:65, middlewares/
  storefrontServe.js:72, routes/storefront.js:255.
- Uninstall can clear the active storefront incorrectly. uninstallThemeService
  does not verify that the requested theme is actually the tenant’s installed
  theme before clearing activeTheme and decrementing install counts. Relevant
  code: services/theme.js:166, services/theme.js:171, services/theme.js:187.

Customizability Gaps

The biggest customizability issue is manifest drift. Frontend themes define
theme.manifest.ts, but the backend uses a separate hand-coded
themeManifestRegistry.js. The comment says every setting and section must be
identical, but this will not scale. As soon as you add more themes, third-party
themes, theme versions, or enterprise-specific sections, this becomes a source of
broken editors and broken publishes.

The second issue is validation depth. Current validation mostly checks structure,
not meaning. Enterprise customizability needs validation for setting type, enum
values, min/max range, URL/image fields, color format, block limits, section
limits, template placement, and theme version compatibility.

The third issue is custom CSS reliance. Custom CSS is useful, but it should be an
advanced escape hatch. The primary model should be structured design tokens,
global theme settings, section settings, reusable blocks, templates, presets, and
app/integration blocks.

The fourth issue is section availability. The section library still comes from a
legacy global section list rather than the active React theme manifest plus
universal sections. That weakens customizability because the editor may offer
sections that do not match the active theme.

Medium Severity Issues

- Custom CSS is under-sanitized and injected directly. Only "<script" and
  "javascript:" are blocked. There is no size cap or policy for @import, remote
  URLs, overlays, expensive selectors, or CSS defacement. Relevant code: services/
  themeCustomization.js:354, storefront-themes/\_shared/contexts/
  StoreContext.tsx:86.
- Available sections come from legacy section logic. getAvailableSections uses
  getAllSectionTypes() instead of the active manifest. Relevant code: controllers/
  themeCustomization.js:21, controllers/themeCustomization.js:365, dashboard/src/
  components/theme-editor/SectionLibrary.tsx:41.
- Opening the editor can mutate draft state. GET /theme-customization can seed
  sections and mark isDraft: true. Reads should not create draft changes unless
  explicitly intended. Relevant code: services/themeCustomization.js:170,
  services/themeCustomization.js:177, repositories/themeCustomization.js:40.
- Rollback is documented as admin-only but only manager-gated. The route comment
  and actual authorization do not match. Relevant code: routes/
  themeCustomization.js:34, routes/themeCustomization.js:67, routes/
  themeCustomization.js:72.
- Theme path cache can cache missing builds. A theme that was missing at first
  lookup remains cached as unavailable until clearThemeCache() runs. Relevant
  code: middlewares/storefrontServe.js:21, middlewares/storefrontServe.js:47.
- Install/default install are not in version history. Published version
  increments, but no ThemeCustomizationVersion audit row is created for initial
  install or default install. Relevant code: services/theme.js:143, services/
  theme.js:225.
- Concurrent publishes can race. Next version is computed by reading latest
  version then creating a new row, with no transaction or retry. Relevant code:
  services/themeCustomization.js:555, services/themeCustomization.js:601.
- PostMessage preview updates do not validate origin. Preview messages are
  accepted without checking event.origin or source. Relevant code: storefront-
  themes/\_shared/theme/ThemeProvider.tsx:95, storefront-themes/\_shared/contexts/
  StoreContext.tsx:63.

Lower Severity / Cleanup

Generated dist folders and node_modules exist under many theme directories. If
dist is required for deployment, document that clearly. node_modules should not
live under source-controlled theme folders.

The active Theme schema still contains .matjar template defaults and legacy
storage assumptions. Since React themes are now the active model, these fields
should be deprecated or separated to avoid future confusion. Relevant code:
schemas/store/theme.js:153, schemas/store/theme.js:257.

Recommended Target Model

The best long-term model is:

1. React theme owns the manifest.
2. Build process emits a JSON manifest artifact.
3. Backend loads that JSON, not a hand-written duplicate.
4. Dashboard renders controls from that same manifest.
5. Publish validates against that same manifest.
6. Storefront renders published customization using the matching theme bundle.
7. Preview token returns draft customization through the same storefront API path.
8. Version history captures install, publish, reset, rollback, and theme switch
   events.

Priority Roadmap

1. Fix publish validation/sanitization so invalid section settings cannot go live.
2. Implement true preview-token draft rendering.
3. Fix reset so it resets draft only and preserves live published state unless
   explicitly published.
4. Make manifest JSON the single source of truth.
5. Replace legacy available-section logic with active manifest plus universal
   sections.
6. Harden custom CSS and add a design-token-first customization model.
7. Fix theme fallback/customization mismatch.
8. Guard uninstall against mismatched theme IDs.
9. Add admin-only rollback or update the product rule.
10. Clean theme repo hygiene and fully deprecate .matjar schema fields.

Acceptance Criteria

- Publishing a draft with unknown section setting keys fails or strips them
  consistently, and the existing failing theme-versioning test passes.
- /?preview=<token> causes /storefront/store-info to return draft customization
  only for valid unexpired tokens.
- Reset does not remove themeCustomization.published; live storefront remains
  unchanged until publish.
- Dashboard available sections are derived from the active theme manifest plus
  universal sections.
- Backend and frontend use one manifest source, or CI fails when they drift.
- Custom CSS has a documented policy, size cap, validation tests, and restricted
  risky constructs.
- Missing theme builds do not cause a mismatch between served React bundle and
  returned customization.
- Theme uninstall only affects the tenant when the requested theme matches the
  installed theme.
- Install, publish, reset, rollback, and theme switch are all represented in
  version history.
- Dashboard build, all React theme builds, and theming/versioning tests pass.
