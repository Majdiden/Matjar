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
| 10-6 | Manifest `level` / `bind` / niche presets | Proposed | Schema + `defineSection` + `services/themeValidator.js` support; no change for stores without brand data |
| 10-7 | Setting value resolution with brand bindings | Proposed | Override → brand → manifest default in `services/themeCustomization.js`, with tests that unconfigured stores render unchanged |
| 10-8 | Annotate themes (modern, starter first) | Proposed | At most about 3 `basic` settings per section, `bind`s for hero/footer/contact, then the remaining themes |
| 10-9 | About page from questions | Proposed | Answers stored on `Page`; plain-Arabic templates; optional English |
| 10-10 | Contact page from the brand kit | Proposed | Theme-rendered system page: WhatsApp button, phone, city, hours, social links |
| 10-11 | Policies from questions + trust badges | Proposed | Delivery/returns/payment answers → `settings.policies.*`; shared trust-badge component on product pages |
| 10-12 | "متجري" (My store) hub + brand kit form | Proposed | Phone-first dashboard route behind `design.simpleMode` |
| 10-13 | Homepage simple editor | Proposed | Phone preview, tap a section → bottom sheet with basic settings, show/hide/move, save-and-publish with undo |
| 10-14 | Arabic-first bilingual field | Proposed | Arabic input with "+ English (optional)"; used everywhere in simple mode |
| 10-15 | Theme switch keeps brand kit and content | Proposed | Verification + regression test |
| 10-16 | Signup reorder (onboarding v2) | Proposed | Behind `onboarding.v2`; store-name preview on theme cards |
| 10-17 | "First sale" checklist | Proposed | First product → payment → share; replaces the current setup checklist |
| 10-18 | Merchant validation rounds | Proposed | 3–5 merchants after 10-1, after 10-13 and after 10-17; track product-in-24h, time-to-share and time-to-first-order |
| 10-19 | Natural-Arabic copy pass on merchant-facing screens | Proposed | Rewrite literal or stiff Arabic in signup, home and setup screens per the PRD copy guideline |
