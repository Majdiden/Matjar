# Misk (مسك) — Arabic-first fragrance theme

**Reference:** `aroda-store-newdemo.myshopify.com/pages/home-4` (Aroda — Perfume Store, EngoTheme).
We take its *layout language and micro-interactions*, not its code, copy or assets.

**Slug:** `misk` · **EN:** Misk · **AR:** مسك
**Categories:** perfume, fragrance, beauty, luxury, general

This is the third original theme after **Linen** (`26ac5de`) and **Atelier** (`26ac5de`), whose
post-ship fix cycle (`f40294d`) is the source of the "already-solved" list in §7. Everything in
§7 is a build-time requirement here, not a review finding.

---

## 1. What makes this theme different: Arabic first

Linen and Atelier were designed in English and translated. Misk is designed in Arabic and
*adapted* to English. Concretely:

| Decision | Arabic-first consequence |
| --- | --- |
| Type | **Amiri** (naskh) display + **Tajawal** body are the *primary* stack. Latin (Cormorant Garamond + Jost) is the fallback branch. |
| Type scale | The `html[lang='ar']` scale is the **base** scale; `html[lang='en']` carries the deltas (Linen does the reverse). |
| Copy | `theme.json` **ar** is authored first as native marketing copy; **en** is written from it. Never machine-shaped translation (cf. `e7016a2`). |
| Letter-spacing | No tracked-out uppercase eyebrows as the default — Arabic has no case and tracking harms naskh. Eyebrows are weight+colour, with `letter-spacing` applied only under `html[lang='en']`. |
| Layout review | RTL at 390px is the canonical screenshot. LTR/desktop are checked after. |
| Numerals | Latin digits (Sudanese commerce convention) — prices/counters stay `tabular-nums`. |

## 2. Design system

| Token | Value | Use |
| --- | --- | --- |
| `background` | `#FFFFFF` | page |
| `foreground` | `#14110E` | warm near-black ink |
| `primary` | `#14110E` | buttons, solid CTAs |
| `secondary` | `#A87333` | musk gold — links, accents, badges |
| `accent` | `#F4EFE7` | warm sand surface |
| `muted` | `#6E675E` | secondary text (4.9:1 on white) |
| `border` | `#E6DFD4` | hairlines |
| `error` | `#C2281F` | sale ribbon / errors |
| `success` | `#2E7D53` | in-stock, success |
| `--misk-midnight` | `#191528` | hero band |
| `--misk-grove` | `#33361F` | concept-collage band |

`designTokens`: soft elevation ramp, `durationBase 320ms`, `easeEmphasized cubic-bezier(.2,.8,.2,1)`,
`hoverLift translateY(-4px)`, `radius.base 10px` (collection cards 14px, product cards square),
`sectionGap 72px`. All read from CSS vars — **no hardcoded brand hex in components**.

## 3. Home (templates.index) — the home-4 stack

| # | Section type | Reference | Notes |
| --- | --- | --- | --- |
| 1 | `misk-hero` | banner-v12 | Split hero on a midnight band: framed image + caption. Crossfade slides, synced progress, staggered caption, Ken-Burns. RTL mirrors the split. |
| 2 | `misk-notes` | collection-v1 | "Shop by notes" — cut-out note icons linking to categories. Desktop 8-up row; **phones get a 3-per-view scroll-snap rail**, not the reference's 1-per-view carousel. |
| 3 | `misk-scent-cards` | banner-v9 | Text block + 3 image cards with centred pill labels, hover zoom + pill lift. |
| 4 | `misk-concept` | banner-v5 | Grove band: eyebrow + heading + body beside a 1-tall + 2×2 asymmetric collage, parallax-lite reveal. |
| 5 | `misk-product-grid` | product-v1 | Flash-sale grid. Corner **sale ribbon**, centred title/price. 4-up desktop, **2-up phones** (reference ships 1-up). |
| 6 | `misk-countdown` | banner-countdown-v1 | Full-bleed image band, inverse colours, merchant-dated countdown. Hidden when no date is set — never a fake timer. |

**Library-only sections** (available in the customizer, not in the default stack):
`misk-usp-strip`, `misk-split-banner`, `misk-category-tiles`, `misk-stories`, `misk-testimonials`,
`misk-marquee`.

**Deliberately not ported:** the reference's newsletter footer block and its newsletter /
sale-notification popups ("Someone in California just bought…"). Newsletters were removed
platform-wide in `0952d3a`/`550ba98`, and fabricated social proof is off-limits. The footer's
fourth column becomes a **contact / WhatsApp** block instead — the right call for Sudan anyway.

## 4. Chrome & pages

- **Layout**: utility bar (phone + email + language), sticky reveal-on-scroll-up header, mega menu
  with promo panel, search overlay with predictive results, drill-down mobile drawer, footer
  (contact · shop links · centred wordmark + social · WhatsApp block), shared `MobileBottomNav`.
- **PLP** (`Products`, `CategoryPage`, `CollectionPage`): full-bleed banner with title + breadcrumb
  + circular category chips, sidebar/drawer filters (placement is a setting), grid/list toggle,
  sort, load-more or numbered pagination.
- **PDP**: breadcrumb, sticky gallery (layout is a setting), title, rating, price + `SAVE %` badge,
  short description, qty stepper + add-to-cart, buy-now, delivery/returns rows, tabs/accordion,
  related rail, recently viewed. Renders `product-details` + `product-policies`.
- **CartPage**, **quick view**, **cart drawer** via shared components with the theme card.

## 5. Pages created at install

`installThemeService` currently seeds **no** CMS pages. Add an idempotent
`ensureEssentialPages(tenantId, { language })` step that creates, in **both** locales, only when
the slug is missing, flagged `isDemo: true` and editable at Dashboard → Pages:

`about` · `contact` · `faq`

It never touches a page the merchant already has, and never overwrites content. Policies
(privacy/returns/delivery/COD) already live on `tenant.settings.policies` and are untouched.

## 6. Customizer coverage ("every bit customisable")

- Every section in `manifest.sections` with a labelled setting for **every** visual decision it
  makes: copy, imagery, source, limits, columns, alignment, heights, overlay, padding, background.
- Theme-level settings for all chrome: utility bar, announcement, header behaviour, mega menu,
  search, PLP layout/filters/pagination/columns, PDP gallery/variant-picker/tabs/sticky-bar,
  footer columns, contact/WhatsApp.
- Every `type`, `setting.id`, `block.type` and `select` option gets an **en + ar** label in
  `dashboard/src/i18n/locales/{en,ar}/themes.json`. A section is not done until its labels exist.
- **All display-copy defaults are `''`** (§7.2).

## 7. Already-solved list — built in from commit `f40294d`, not rediscovered

1. **Bottom nav vs overlays** — every theme overlay declares `role="dialog"` + `aria-modal="true"`
   so the shared `MobileBottomNav` auto-hides; the page reserves space for it.
2. **Empty copy defaults** — manifest display-copy defaults are `''`; sections fall back to
   `theme.json` via the `copy(t, value, …keys)` resolver. Non-empty defaults persist as real
   setting values at install and permanently bypass i18n.
3. **`renderCard`** is passed to `createThemeApp` so collections, search and wishlist render the
   theme's own card.
4. **CollectionPage loads collections**, not categories.
5. **Mobile**: 16px gutters, consistent section rhythm, **0 horizontal overflow at 390px in both
   directions**, home grids become scroll-snap rails, 44px minimum targets.
6. **Drawer menu**: "Home" is prepended only when the merchant menu has no link to `/`.
7. **`LanguageSwitcher`** is a real 40px pill, present in the mobile drawer, scoped so it cannot
   stretch the utility bar or inherit white-on-white.
8. **Contrast audited** in idle / hover / focus / disabled — target 0 failures (cf. `5c706dc`).
9. **Wishlist buttons wired** on every card and the PDP (cf. `444d835`).
10. **Footer links resolve to real routes** (cf. `5ba7095`); payment badges reflect enabled methods.
11. **Quick view** keeps page margins + safe-area padding, no duplicate discount badge.
12. **Reduced motion + keyboard**: every animation respects `prefers-reduced-motion`; mega menu,
    drawers and overlays are Escape-closable and focus-trapped.
13. **RTL**: logical properties only (`ms-/me-/ps-/pe-/text-start/text-end`); marquee, progress
    bars, rail masks and carousels reverse direction.
14. **Contract test** — `tests/unit/theme-manifest-contract.test.js` must stay green (`bd45e55`).

## 8. Verification (done before hand-off)

- `bash scripts/build-themes.sh` — all 18 themes build + validate.
- `npm run test:unit` — no new failures vs. the known baseline.
- Headless Chrome sweep: home / PLP / PDP / cart / search / wishlist × {ar, en} × {390, 1440}:
  horizontal-overflow check, console-error check, contrast audit in every interactive state.
- Customizer sweep: every section appears with labelled settings in both languages, every index
  instance persists on publish.

---

## 9. Build log — what actually shipped

Built and verified 2026-10-09. All of §7 was in place from the first commit;
the defects below were found by the audits during the build, not after it.

### Found and fixed during the build

| # | Defect | Why it mattered |
| --- | --- | --- |
| 1 | **Branded product photography in every default.** The first image set was Chanel, Prada, Versace, Miu Miu and Armani bottles, plus off-subject stock (a dentist, a piano, an armchair, a pair of shoes). | Shipping a third party's trademark into every merchant's storefront. Replaced with a contact-sheet-reviewed, unbranded set, and the fragrance-note tiles became **original SVG illustrations** — no brand risk, crisp at tile size, ~4 KB each. |
| 2 | **`.misk-snap { display:flex }` sat after `@tailwind utilities`**, outranking `md:grid` on the same element. | Every home grid silently stayed a phone rail at desktop width. Scoped to `@media (max-width: 767px)`. |
| 3 | **`bg-ink/75`, `bg-sand/60`, `text-gold/40` never compiled.** These palette colours are bare `var()`s, and Tailwind drops the alpha modifier without warning. | The collection-card label was white text on a photo with **no background at all** — the one contrast failure the audit caught. Fixed, and the constraint is now documented in `tailwind.config.js`. |
| 4 | **RTL sale ribbon geometry was hand-derived** and clipped its own label; it also shared the corner with the wishlist/quick-view rail, which is always visible on touch. | Moved to the inline-start corner and mirrored with `scaleX(-1)` so both directions are provably identical. |
| 5 | **RTL price spacing collapsed.** `ms-2` between two prices is swallowed when they merge into one bidi run. | Replaced with flex + `gap`, which is immune to bidi reordering. |
| 6 | **An invisible broken-image fallback** (sand on white) read as a layout bug rather than a missing image. | `Media` now paints a sand panel with a mark. |
| 7 | **`installThemeService` early-returns** when the tenant is already on that theme — which is the case on a brand-new store, because signup assigns the theme first. | About/Contact/FAQ were never created on exactly the stores that needed them. The early-return path now ensures pages too. Verified on a torn-down and re-seeded store. |
| 8 | Duplicate "Save %" badge on desktop PDP; note tile 4 was labelled "Citrus" while showing orange blossom. | Polish. |

### Verification

- `bash scripts/build-themes.sh` → **18/18 themes build + validate**.
- `npm run test:unit` → **476 pass, 0 fail** (theme-manifest-contract included).
- Headless Chrome, **mock backend and the real seeded store**, home / PLP / PDP
  / cart / wishlist × {ar, en} × {390, 1440} = 20 combinations each:
  **0 horizontal overflow, 0 console errors, 0 raw i18n keys, direction
  correct everywhere.**
- Contrast sweep over the same surfaces in **idle / hover / focus-visible**
  (pseudo-states forced via CDP): **0 failures** against WCAG AA.
- Customizer: every section type, setting id, block type and select option in
  the manifest has an **en + ar** label — verified programmatically against
  `dist/manifest.json`, 0 missing in either language.
- Theme install on a fresh store creates **about / contact / faq × {en, ar}**,
  published and editable at Dashboard → Pages; the demo seeder then correctly
  creates none.

### Known, not fixed (pre-existing, outside this theme)

- The PDP category eyebrow renders the category's **English** name in Arabic.
  The embedded `product.category` in the storefront payload is not localised,
  unlike the standalone category endpoint. Shared-layer issue; affects every
  theme, so it belongs in its own change.
