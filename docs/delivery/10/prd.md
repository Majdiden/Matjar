# PBI-10: Multi-currency storefront pricing

[View in Backlog](../backlog.md#user-content-10)

## Overview

Merchants can define markets (countries → currency, price adjustment) and FX rates in the dashboard, but only checkout uses them. Shoppers see every price in the store's base currency, and Stripe charges were created in the wrong currency.

## Problem Statement

- Stripe payment intents were created with `order.currency || "usd"`. Orders have no `currency` field, so every base-currency total (e.g. 10,000 SDG) was charged as the same number of US dollars. Amounts were also always scaled ×100, which is wrong for zero-decimal (JPY) and three-decimal (KWD, BHD, OMR, JOD) currencies.
- The storefront never detects the visitor's country, reads a legacy `Market` collection the dashboard no longer writes, and formats every price in the base currency.
- The storefront currency switcher calls an admin-only endpoint, so it never renders for shoppers.

## User Stories

- As a merchant, I want customers to be charged exactly the amount and currency my store priced the order in.
- As a merchant selling in several countries, I want customers to see prices in their market's currency from the first page they visit.

## Technical Approach

- Charge in the order's base currency (`order.baseCurrency`, falling back to `tenant.settings.currency`) using currency-aware minor-unit conversion (`utils/stripeAmount.js`).
- Later tasks: resolve the storefront market from `tenant.settings.markets` via `services/markets.js`, expose markets publicly, convert storefront prices, retire the legacy `Market` model.

## Acceptance Criteria

1. Stripe intents, captures, refunds and webhook amounts use the correct currency and minor units.
2. Storefront prices render in the visitor's market currency (later tasks).

## Related Tasks

[Task list](./tasks.md)
