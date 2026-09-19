# PBI-9: Mobile-first operator & merchant experience (seed control, phone identity, responsive admin surfaces)

[View in Backlog](../backlog.md#user-content-9)

## Overview

Sudanese merchants (and the platform operator) run Matjar mostly from a phone. This PBI makes both admin surfaces usable on a ~390px screen, captures a merchant phone number as part of the account identity (Sudan dial code by default, more countries opened by the operator), and turns the signup-time sample-content seed into an operator-controlled feature instead of an always-on side effect.

## Problem Statement

- Every new store was auto-seeded with demo products/categories/collections/pages. Merchants who already know what they sell had to delete it; the operator had no switch.
- Registration and the merchant profile captured no phone number, although WhatsApp/phone is the primary support and order-contact channel in the target market.
- The platform-admin console was desktop-only (fixed sidebar, wide tables, fixed-width modals); the operator uses it from a phone.
- Several merchant-dashboard pages still overflowed or were awkward at phone widths despite the existing bottom-nav / card-table groundwork.

## User Stories

- As the platform operator, I want to decide whether new stores get starter content, and seed a specific store on demand, so that onboarding matches each merchant.
- As a merchant, I want to give my phone number at signup and edit it later so the platform and my customers can reach me.
- As the platform operator, I want to choose which phone country codes merchants can pick (Sudan by default) so signup stays relevant to the markets we serve.
- As the platform operator, I want the admin console to work on my phone.
- As a merchant, I want every dashboard page to work on my phone.

## Technical Approach

- **Seed control**: new registry flag `onboarding.starterContent` (default OFF) consumed by `services/storeSetup.js`; the seeding block is extracted into `seedStarterContent()` and exposed to operators via `POST /api/platform/tenants/:id/seed-starter-content`. Default payment methods and the header menu are NOT gated (system defaults a store needs to function).
- **Phone**: `config/phoneCountries.js` catalog + `services/phoneCountries.js` (operator overrides in `platformconfigs._id:"phoneCountries"`, 30s cache, fail-safe to Sudan) + pure `utils/phone.js` (E.164 normalisation, Arabic-Indic digits, trunk-0). Stored on Tenant (owner), TenantUser (directory) and the tenant-scoped User. Public `GET /api/auth/phone-countries`; `PUT /api/auth/me` for profile edits; platform `GET/PUT /api/platform/phone-countries`.
- **Platform admin**: mobile header + drawer + bottom tab bar, `DataList` (table on md+, cards on mobile), bottom-sheet modals, new "Phone countries" page, seed action + phone on tenant pages.
- **Merchant dashboard**: `PhoneInput` component, phone field on the signup account step, new Settings → Account tab, and page-by-page responsive fixes driven by a headless-Chrome overflow audit at 390px (EN + AR).

## Conditions of Satisfaction

1. Registering a store with the flag OFF creates no demo catalog; the setup step records "skipped — disabled by platform feature flag"; toggling the flag ON restores the previous behaviour; the operator can seed a store from its tenant page.
2. Registration requires a phone in the dashboard, normalises it to E.164 against the selected enabled country (Sudan default) and rejects invalid numbers with a 400 before any write; the phone appears on the tenant, directory and user records and can be edited from Settings → Account.
3. The operator can enable/disable/add countries and change the default from the platform admin; the public endpoint only ever exposes enabled countries and never an empty list.
4. Platform admin and merchant dashboard render without horizontal page scroll at 360–430px in both LTR and RTL, with all actions reachable.
5. Unit tests cover phone normalisation and the flag contract; the signup e2e covers phone persistence, rejection and the public countries endpoint.
