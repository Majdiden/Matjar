# PBI-10: Store design for first-time sellers (simple mode, brand kit, guided onboarding)

[View in Backlog](../backlog.md#user-content-10)

## Overview

Matjar targets Sudanese merchants, most of whom sell through a Facebook page and WhatsApp from a mid-range Android phone. The current theme editor is a Shopify-style tool (sections, blocks, page templates, draft/publish, custom CSS, bilingual field pairs) and is blocked on phones. This PBI puts a simple, phone-first path in front of it: the merchant gives us facts about their business once (the **brand kit**), and every storefront page is built from those facts plus the theme. The full editor stays available as "advanced options".

## Problem Statement

Evidence from real signups and market research:

- Two of the first registered merchants pasted their **Facebook page URL** into the store-link (subdomain) field. After it was explained with the example `https://store-name.matjar.to`, they pasted the example verbatim. Their mental model of "my store's address" is their Facebook page.
- A store name typed in Arabic produced an **empty** store link (the slug was Latin-only), and pasted URLs were mangled by the input filter.
- The theme editor refuses to open on phones ("Theme editing needs a bigger screen"), and most of the market reaches the dashboard by phone (DataReportal Digital 2026: about 29% internet penetration, mobile-dominant).
- A single hero section exposes 16 settings, and every text setting needs separate English and Arabic inputs.
- Connectivity is intermittent (nationwide shutdowns in 2025), so long sessions and draft/publish workflows lose work.

## User Stories

- As a first-time merchant, I want my store link created for me (even from an Arabic store name), and my pasted Facebook page understood, so I can finish signup without knowing what a subdomain is.
- As a merchant, I want to share my store link to any app on my phone so customers can find it.
- As a merchant, I want to fill in my store's details once (logo, colour, cover photo, WhatsApp, delivery areas) and have every page of my site use them.
- As a merchant, I want to change my homepage text and photos by tapping them on a phone-sized preview, with no design vocabulary.
- As a merchant, I want my About, Contact and policy pages written for me from a few questions.
- As a merchant, I want to write in Arabic only, with English always optional.
- As an experienced merchant, I still want the full editor.

## Technical Approach

Three layers, owned by different people:

| Layer | Owner | Storage |
|---|---|---|
| Theme (layout, section designs) | Platform | `storefront-themes/*` manifests |
| Brand kit (facts about the business) | Merchant, filled in once | `tenant.settings.*` (independent of the active theme) |
| Page content (section text/images) | Generated from brand kit + theme defaults, optionally edited | existing theme customization + `Page` |

- **Value resolution** for a theme setting: merchant override → brand-kit binding → manifest default. An untouched store looks finished, not like a demo.
- **Manifest extensions** (`storefront-themes/_shared/types/theme.ts`):
  - `level: 'basic' | 'advanced'` on settings and sections. The simple editor renders only `basic` ones.
  - `bind: 'brand.<field>'` sets a default that comes from the brand kit.
  - Per-niche homepage presets.
- **Simple editor**: a phone-first "متجري" (My store) hub. Tapping a section opens a bottom sheet with its basic settings; show/hide and move up/down. Saving publishes immediately with Undo; versions are recorded in the background. Draft/publish stays in the advanced editor.
- **Generated pages**: About and policies come from short questionnaires (answers stored so the text can be regenerated). Contact is rendered from the brand kit.
- **Language**: Arabic-first. English is always optional; missing English falls back to Arabic; the storefront language switch appears only once English content exists.

### Copy guideline (all Arabic UI text in this PBI)

Arabic copy is written the way a Sudanese merchant speaks: short, friendly, close to everyday Sudanese Arabic. It is never a literal translation of the English. Examples: "ده عنوان متجرك في الإنترنت", "تمام — الرابط ده بقى حقّك", "بنشوف الرابط ده فاضي ولا لا…". English copy is plain and avoids jargon (no "subdomain", "section", "template").

### Rollout and testing (no separate staging environment yet)

1. **Local first.** Unit + e2e tests (`npm test`, in-memory Mongo replica set + local Redis), dashboard `tsc -b` and lint, `scripts/check-i18n.mjs`, and a headless-Chrome pass at 390px in Arabic and English.
2. **Prod behind per-tenant flags.** Each feature ships OFF globally and is enabled only for the operator's test store via the existing per-tenant overrides in `services/featureFlags.js`. Flags: `design.simpleMode` (brand kit, hub, simple editor) and `onboarding.v2` (new signup order). Signup runs before a tenant exists, so `onboarding.v2` is global and testable on prod via a register-URL override.
3. **Additive-only data changes.** New fields are optional, have fallbacks, and are never renamed or removed during rollout. Migrations only fill new fields and are idempotent. Take a database snapshot before any deploy that includes a migration.
4. **Theme changes must not change unconfigured stores.** New manifest fields render exactly as today when a store has no brand-kit data; this is pinned by tests and spot-checked on real stores after each deploy.
5. **Small deploys**, about one task each, so a regression maps to one change and one revert.
6. Test store → one or two friendly merchants → everyone.

10-1 is low risk and benefits everyone, so it ships without a flag.

## UX/UI Considerations

- Every surface works at 360–430px in RTL and LTR, with no horizontal scroll.
- No design vocabulary in simple mode: sections, blocks, templates, CSS and publish never appear.
- Plain-words feedback whenever we reinterpret input ("That's your Facebook page link — we've saved it…").
- Tolerates weak connections: autosave per field, small images, no lost work on a dropped connection.

## Acceptance Criteria

1. Signup produces a valid store link from Arabic store names, understands pasted store/Facebook/Instagram/TikTok/WhatsApp/website links and our copied example, keeps recognised social pages, and explains each case in plain words (10-1).
2. Sharing the store link uses the device's share sheet where available, with a WhatsApp/Facebook/Telegram/copy fallback (10-1).
3. A merchant with only a phone can set logo, colour, cover photo, tagline, WhatsApp and delivery areas, and see them on every page of their storefront.
4. Switching theme keeps the brand kit and page content.
5. The homepage can be edited on a phone by tapping, with at most about 3 settings per section in simple mode.
6. About, Contact and Delivery/Returns pages exist and are filled for every store without free-text editing.
7. Stores without brand-kit data render exactly as before on every theme.
8. Every feature beyond 10-1 is behind a flag and verified on the operator's test store before wider rollout.

## Dependencies

- Per-tenant feature-flag overrides (`services/featureFlags.js`, platform-admin Features panel): already in place.
- PBI 9 responsive patterns (bottom sheets, DataList, 390px audit).

## Open Questions

- Facebook-page import (logo/cover) needs Meta API access; deferred.
- AI-written About/product copy: provider and cost; deferred to after validation.

## Related Tasks

See [tasks.md](./tasks.md).
