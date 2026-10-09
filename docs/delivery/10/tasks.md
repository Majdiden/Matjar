# Tasks for PBI 10: Store design for first-time sellers

This document lists all tasks associated with PBI 10.

**Parent PBI**: [PBI 10: Store design for first-time sellers](./prd.md)

## Task Summary

| Task ID | Name | Status | Description |
| :------ | :--- | :----- | :---------- |
| 10-1 | [Forgiving store-link field + general share button](./10-1.md) | Review | Arabic store names → valid link; pasted store/social/example links understood and explained; social pages saved; native share sheet with fallback menu |
| 10-2 | [Store language from signup, Arabic by default](./10-2.md) | Review | New stores take the merchant's signup language (`ar`/`en`); Arabic when not sent. Drives order emails, seeded menus/payment methods and starter content |
| 10-3 | [Brand kit data model](./10-3.md) | Review | Additive `tenant.settings.brand` fields (tagline, coverImage, color, whatsapp, city, hours) with `{ ar, en? }` text; no defaults, so no backfill is needed |
| 10-4 | [Brand kit API](./10-4.md) | Review | `GET/PUT /api/store-profile` through repository → service → controller, zod validation, audit log |
| 10-5 | [Brand kit in the storefront](./10-5.md) | Review | Expose via `services/storefrontStoreInfo.js`; `useBrand()` hook in `@matjar/theme-shared`; `design.simpleMode` flag registered. Brand colour → primary token is left to 10-7 (no theme reads the brand kit yet) |
| 10-6 | [Manifest `level` / `bind` / niche presets](./10-6.md) | Review | `level` / `bind` on settings and sections, per-niche `presets` (new stores, behind `design.simpleMode`); helpers in `@matjar/theme-shared`; checked by `services/themeValidator.js` and at theme build; signup niche now stored |
| 10-7 | [Setting value resolution with brand bindings](./10-7.md) | Review | Override → brand → manifest default, resolved in the storefront ThemeProvider (live preview included); brand colour → primary token; `GET /theme-customization` reports `settingSources` / `brandValues`; unconfigured stores pinned unchanged |
| 10-8 | [Annotate themes (modern, starter first)](./10-8.md) | Review | All 17 themes + universal sections: at most 3 `basic` settings per section; hero tagline / cover photo, techhub hotline and linen opening hours bound to the brand kit |
| 10-9 | [About page from questions](./10-9.md) | Review | Answers stored on `Page`; plain-Arabic templates; optional English |
| 10-10 | [Contact page from the brand kit](./10-10.md) | Review | Theme-rendered system page: WhatsApp button, phone, city, hours, social links |
| 10-11 | [Policies from questions + trust badges](./10-11.md) | Review | Delivery/returns/payment answers → `settings.policies.*`; shared trust-badge component on product pages |
| 10-12 | ["متجري" (My store) hub + brand kit form](./10-12.md) | Review | Phone-first dashboard route behind `design.simpleMode` |
| 10-13 | [Homepage simple editor](./10-13.md) | Review | Phone preview + plain-words list of basic sections (show/hide, move up/down); tap → bottom sheet with basic settings (Arabic-first text, photo, colour, switch, options) and brand-kit hints; every change saves and goes live at once with Undo; offline-safe queue |
| 10-14 | [Arabic-first bilingual field](./10-14.md) | Review | Arabic input with "+ English (optional)"; used everywhere in simple mode |
| 10-15 | [Theme switch keeps brand kit and content](./10-15.md) | Review | Brand kit was already kept; each theme's customization is now kept aside on switch and restored (if still valid) on switching back; regression test |
| 10-16 | [Signup reorder (onboarding v2)](./10-16.md) | Review | Behind `onboarding.v2` (global; `?flow=v2` override); account → store name → what you sell → city + delivery areas → 3 looks with the store name; WhatsApp defaults to the account phone |
| 10-17 | ["First sale" checklist](./10-17.md) | Review | First product → payment → share (+ "Make it yours"); replaces the setup checklist under `onboarding.v2` per store; share/payments-review stamped via `/api/onboarding` |
| 10-18 | Merchant validation rounds | Proposed | 3–5 merchants after 10-1, after 10-13 and after 10-17; track product-in-24h, time-to-share and time-to-first-order |
| 10-19 | [Natural-Arabic copy pass on merchant-facing screens](./10-19.md) | Review | Rewrite literal or stiff Arabic in signup, home and setup screens per the PRD copy guideline |
| 10-20 | [Automatic product & category links](./10-20.md) | Review | Arabic names → readable transliterated slugs (one backend `utils/slugify.js`, parity-tested against the dashboard); rename keeps the link; explicit change of a published item's link leaves a 301; read-only link preview with "Edit link" in the product/category forms |
| 10-21 | [Quick add product (first sale, step 1)](./10-21.md) | Review | Photos, name, price and quantity (optional description) on one phone screen; published at once into an "Our products" category with a generated SKU and link; opened from the first-sale checklist and, in simple mode, every "Add product" button |
| 10-22 | [Scroll to the field with a validation error](./10-22.md) | Review | Merchants on phones tapped Save and nothing seemed to happen when a field further up or down was wrong |
| 10-23 | [Homepage editor: big live preview, tap to edit, top strip](./10-23.md) | Review | Feedback from the test store: the 'Saved' bar parked in the middle of the list, the preview was tiny, tapping the preview did nothing and typed text only showed after leaving the field |
| 10-24 | [Homepage = top strip, hero, new arrivals, featured (all themes)](./10-24.md) | Review | User request: every theme's homepage is a single top strip, the hero, newly added products and featured products; the hero button text must be editable from My Store |
| 10-25 | [Generated pages designed per theme](./10-25.md) | Review | About, Contact and generated policies were a title and plain text |
| 10-26 | [Latin digits for prices, numbers and dates](./10-26.md) | Review | Since stores default to Arabic, prices and dates showed Arabic-Indic digits even in the English dashboard |
| 10-27 | [Delivery prices from the shipping settings](./10-27.md) | Review | The delivery questions asked for a free-text price that could disagree with checkout |
| 10-28 | [Guided setup: open the current step, guide until done](./10-28.md) | Review | On login the dashboard opens the current essential step full-page (first product → logo, cover photo and tagline → delivery and returns policy → share) |
| 10-29 | [My store as the main menu entry](./10-29.md) | Review | "My store" leads the top menu section (above dashboard, analytics and wishlists), drawn one size up, tinted, with a second line, in the same style as the other rows; removed from the Storefront section |
| 10-30 | [My store fixes: store info, contact details, About follows the name](./10-30.md) | Review | Feedback from the test store: English fields read right to left, no Save button on site identity, contact page empty, About kept the old name, guide opened only the first step |
| 10-31 | [Generated policies in both languages](./10-31.md) | Review | Returns and delivery policies showed only in the store language |
| 10-32 | [Theme footers and heroes show only the store's content](./10-32.md) | Review | Footers mixed English and theme demo links; hero extras and slides showed theme demo copy and photos |
| 10-33 | [Theme switch carries the homepage words and photo](./10-33.md) | Review | Switching theme lost the hero title, button text, photo and top strip |
| 10-35 | [Platform admin quick search (Ctrl/Cmd+K)](./10-35.md) | Review | Platform owner wanted search to navigate quickly: pages, tabs and stores from the top bar or Ctrl/Cmd+K |
