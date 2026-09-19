# Platform Admin → Operating System of Matjar: gap analysis and roadmap

Source: `archive/platform-owner-admin-permanent-architecture.md` (the "permanent architecture" doc). Baseline: the platform admin as of 2026-09-19 (Tenants, Tenant detail with Orders/Payments/Exports/Failed webhooks tabs, Plans, Features, Phone countries, Queues; consent impersonation; async exports; lifecycle suspend/delete/purge).

Context that shapes priorities: Sudanese merchants, mostly cash on delivery and manual bank/wallet transfers, operator works from a phone, no card-billing provider in the loop yet. So "billing" means the platform *records and reconciles* what merchants owe; it does not (yet) charge cards.

---

## 1. Where we stand against the doc

Legend: ✅ exists · 🟡 partial · ❌ missing. Priority is Matjar's, not the doc's.

| Doc section | State | What exists / what is missing | Priority |
|---|---|---|---|
| 3 Overview | 🟡 | Tenants page has 6 status tiles. No commerce/revenue/operational tiles, no alert list. | P0 |
| 4 Stores | 🟡 | List, search, status filter, detail with KPIs, orders/payments/exports/webhooks tabs, lifecycle actions, seed. Missing: filter by plan/country/last activity/health; store status model is `subscriptionStatus` + flags rather than an explicit lifecycle; no Owner/Staff/Usage/Configuration/Activity/Errors tabs; no internal notes. | P0 |
| 5 Tenant isolation | ✅ | Scoped models + tenant scope plugin; platform routes are the only cross-tenant path. | — |
| 6–7 Platform users | 🟡 | `TenantUser.platformAdmin` + `platformScopes`; created only via CLI script. No UI, no invite, no suspend, no MFA, no session list. | P0 |
| 8 Store users | ❌ | Staff/roles live in tenant collections; nothing in the admin surfaces them. | P0 |
| 9 Invitations | 🟡 | `StaffInvite` (tenant) exists. No platform-staff invitations, no cross-tenant invitation view. | P1 |
| 10 Access programs | ❌ | Feature flags are global only. No program entity, no memberships, no per-store/program overrides. | P1 |
| 11–16 Commerce | 🟡 | Orders tab per tenant (raw JSON detail). No cross-store orders/products/inventory/customers search, no order timeline view, no inventory events. | P1 (orders P0) |
| 17–20 Payments & billing | 🟡 | Payments tab per tenant (merchant payments only). No platform billing at all (no subscriptions ledger, invoices, fee ledger). Refunds exist merchant-side only. | **P0 (billing)** |
| 21 Plans | 🟡 | Catalog with price/interval/2 limits/feature list. No annual price, trial days, order/storage/API limits, transaction fee, entitlement→feature mapping. | **P0** |
| 22 Usage & limits | 🟡 | `tenant.limits`/`tenant.usage` fields exist but nothing enforces or displays them. | P1 |
| 23–24 Feature management | 🟡 | Registry + global overrides. No plan entitlement layer, no program/store overrides, no override audit. | P1 |
| 25–29 Storefront | 🟡 | Domain registry with SSL states; theme catalog with status/statistics/version. Not surfaced in the admin. No storefront health probe. | P1 |
| 30 Global configuration | 🟡 | Feature flags + phone countries in `platformconfigs`. Currencies/countries/order states are code constants. | P2 |
| 31 Integrations | ❌ | Providers (email, storage, SSL, payment) exist as code; no status page. | P1 |
| 33 Activity | ❌ | `AuditLog` per tenant only; no human-readable activity feed. | P1 |
| 34 Audit log | 🟡 | Tenant `AuditLog` (impersonation writes to it). **Platform actions only `logger.warn`** — suspend/purge/plan change/flag change/seed are not persisted anywhere. | **P0** |
| 35 Impersonation | ✅ | Consent grants, banner, code fallback, audit rows. Missing read-only mode and re-auth. | P2 |
| 36 Feedback | 🟡 | `SupportTicket` (tenant-scoped, customer→merchant). No merchant→platform feedback, no cross-tenant view. | P1 |
| 37 Incidents | ❌ | — | P2 |
| 38 System health | 🟡 | Queue stats only. No API/DB/Redis/email/storage checks. | P1 |
| 39–41 Jobs / webhooks / errors | 🟡 | Failed-job list + retry; failed webhooks per tenant. No cross-tenant webhook inspector, no error aggregation (Sentry exists externally). | P1 |
| 42 Analytics | ❌ | Merchant analytics service exists per tenant; nothing platform-wide. | P1 |
| 43–44 Lifecycle & onboarding | 🟡 | Setup steps recorded; no explicit state machine, no onboarding checklist view. | P1 |
| 45 Configuration inspector | ❌ | Highest-value support screen in the doc; nothing yet. | P1 |
| 46 Exports & privacy | 🟡 | Async tenant export with audited download. No customer-scoped export/privacy ops. | P2 |
| 47 Dangerous actions | ✅ | Reason + type-to-confirm on suspend/purge. Missing re-auth. | P2 |
| 48–49 Roles & security | 🟡 | Scopes exist (6). No named roles, no MFA, no session revocation, 20-min idle logout exists. | P0 (roles), P1 (MFA/sessions) |

Structural takeaway: the admin is a **support console**; the doc wants an **operating system**. The three foundations that unlock everything else are (1) a platform-level audit/activity ledger, (2) platform users with roles, and (3) billing (plans → fees → statements). Everything in the "Commerce", "Storefront" and "Analytics" domains is mostly read-only projection over data that already exists and can follow.

---

## 2. Pricing model: two plan families the merchant chooses between

The platform offers two kinds of plan side by side, and the merchant picks one:

| Family | Merchant pays | Admin controls |
|---|---|---|
| **Commission** ("pay as you sell") | No monthly fee. A percentage of delivered sales, e.g. 5% up to 500k SDG/month, 3.5% above. | The tier table (percentages + thresholds), tier mode, period window, per-order min/max, caps, per-store/program overrides. |
| **Subscription** ("flat monthly") | A fixed amount per month or year, e.g. 50 USD/month. No percentage. | The amount, currency, interval, trial days, limits. |

A merchant can switch families (e.g. start on commission, move to subscription once volume makes the flat fee cheaper). The catalog may hold several plans of each family (Commission Basic / Commission Plus, Subscription Starter / Pro) differing in limits and entitlements. Hybrid plans (fee + percentage) are representable by the same model but are not offered at launch.

### 2.1 Principles

- **Nothing is hard-coded.** Every number the operator may want to change (base fee, percentage, tiers, thresholds, what counts as revenue, when a fee is recognised, grace periods) is data in the admin DB with a code default.
- **Layered resolution**, same ladder the doc uses for features: platform default → plan → access program → store override → effective. Every layer is auditable.
- **Record first, enforce later.** Fees accrue into a ledger and monthly statements from day one; whether a past-due statement blocks the store is a switch that starts OFF.
- **Cash economy aware.** Commission is recognised on the event that means "the merchant got the money", which for COD is delivery, not order placement. Refunds and cancellations reverse fees.

### 2.2 Domain model (admin DB)

```text
SubscriptionPlan (extend existing)
  key, name, description, isActive, sortOrder
  family: 'commission' | 'subscription' | 'hybrid'   // what the merchant is choosing; validated against pricing below
  pricing:
    baseFee: { amount, currency, interval: month|year }   // 0 for commission plans
    annualFee?: { amount, currency }          // optional yearly price (subscription plans)
    trialDays: number                          // subscription plans only; 0 = none
    commissionPolicyKey: string | null         // required for commission plans, null for subscription plans
  switching:
    allowSelfService: boolean                  // merchant may change plan from the dashboard
    effectiveAt: 'immediately' | 'next_period' // when a switch takes effect (default next_period)
    minimumTermDays: number                    // 0 = none
  limits: { maxProducts, maxStaff, maxOrdersPerMonth, maxStorageMB, maxApiRequestsPerDay }  // null = unlimited
  entitlements: [featureKey]                   // plan → feature layer (see §3)

CommissionPolicy (new)                         // "rate card"; reusable across plans/overrides
  key, name, isActive
  basis: 'gmv' | 'order_count'                 // what the tiers are measured against
  gmvScope: 'paid' | 'delivered' | 'placed'    // which orders count toward GMV
  recognitionEvent: 'paid' | 'delivered'       // when a fee event is written
  period: 'calendar_month' | 'rolling_30d' | 'lifetime'   // tier lookup window
  tierMode: 'marginal' | 'bracket'             // marginal = progressive brackets; bracket = whole-period rate
  tiers: [ { upTo: number|null, percent: number, fixedPerOrder?: number } ]   // ordered, last upTo=null
  perOrder: { minFee?: number, maxFee?: number }
  periodCap?: number                           // never charge more than this per period
  paymentMethods: 'all' | [methodCode]         // e.g. exclude COD if ever needed
  currency: 'SDG'                              // fee currency; store totals converted with tenant FX rates
  rounding: 'nearest' | 'up' | 'down', precision: 0

PricingOverride (new)                          // negotiated or promotional deviations
  scope: 'tenant' | 'program', scopeId
  baseFee?: {...}, commissionPolicyKey?: string, commissionTiers?: [...] (inline), percentDelta?: number
  feeHoliday?: { until: Date }                 // 0% commission until date
  startsAt, endsAt, reason, createdBy, createdAt

PlatformFeeEvent (new, append-only ledger)
  tenantId, orderId, orderNumber, type: 'commission' | 'reversal' | 'adjustment' | 'subscription'
  basisAmount, basisCurrency, fxRate, feeAmount, feeCurrency
  policyKey, tierIndex, percentApplied, recognitionEvent, occurredAt, periodKey (YYYY-MM)
  source: 'system' | 'operator', createdBy?, reason?

BillingStatement (new)
  tenantId, periodKey, currency
  lines: [ { type, description, amount, ref } ]   // subscription, commission total, adjustments, credits
  subtotal, credits, amountDue, amountPaid, balance
  status: 'draft' | 'issued' | 'paid' | 'partially_paid' | 'overdue' | 'waived' | 'void'
  issuedAt, dueAt, paidAt, payments: [ { amount, method: 'bankak'|'bank_transfer'|'cash'|'other', reference, recordedBy, at } ]

BillingSettings (platformconfigs._id:"billing")
  defaultCommissionPolicyKey, statementDay (1), dueDays (7), graceDays (14)
  enforcement: { onOverdue: 'none' | 'warn' | 'read_only' | 'suspend' }   // starts 'none'
  taxOnFees?: { percent, label }
```

`tenant.subscriptionPlan` stays the plan pointer; add `tenant.billing = { status, currentPeriodStart, trialEndsAt, nextStatementAt, balance }` as a denormalised summary for list filters and tiles.

### 2.3 How a fee is computed (worked example)

Policy "standard": basis gmv, scope delivered, recognition delivered, period calendar_month, marginal tiers `[ {upTo: 500000, 5%}, {upTo: 2000000, 3.5%}, {upTo: null, 2%} ]`, minFee 50 SDG.

1. Order #1042 (18,000 SDG, COD) is marked **Delivered** on 14 Sept.
2. The order service emits `order.delivered` (the existing events module) → billing listener loads the tenant's effective policy (override → program → plan → default).
3. Period GMV so far this month = 490,000. Marginal: 10,000 at 5% + 8,000 at 3.5% = 780 SDG (min 50 satisfied).
4. `PlatformFeeEvent { type: commission, feeAmount: 780, tierIndex: 0→1, periodKey: 2026-09 }` is appended; `tenant.billing.balance` is bumped.
5. On 1 Oct the statement job sums September: subscription 4,900 + commission 21,340 − credits 0 = 26,240 due by 8 Oct. Operator records a Bankak payment when it arrives; overdue after grace does whatever `enforcement.onOverdue` says (nothing, for now).
6. If #1042 is later refunded, a `reversal` event of −780 is appended in the period the refund happens (not retroactively editing September).

"Variable percentage" therefore has four independent dials the operator can turn without code: the tier table, the tier mode, the period window, and per-store/program overrides (including time-boxed fee holidays). Volume-based pricing is just a tier table; flat pricing is a single tier.

### 2.3b Switching between families

- A plan change is recorded as `PlanChange { tenantId, fromPlan, toPlan, requestedBy: merchant|operator, requestedAt, effectiveAt, reason }` and appended to the audit ledger.
- Default: the switch takes effect at the **next statement period**, so one period is never billed under two models. The operator can force "immediately" from the tenant page.
- Commission → subscription: commission events stop at the effective date; the first subscription charge appears on the next statement.
- Subscription → commission: no refund of the current period; commission starts accruing on orders delivered after the effective date.
- The merchant dashboard's Subscription page (already feature-flagged as `billing.subscription`) becomes the chooser: shows both families with an estimate based on the store's last 30 days of delivered sales ("on Commission you would have paid X; on Subscription Y").

### 2.4 Admin UI additions

- **Plans page**: base fee + annual fee + trial days; limits grid; entitlement checklist from the feature registry; commission policy picker. **Commission policies** sub-page with the tier editor and a live calculator ("at 1,250,000 SDG this month the fee is …").
- **Tenant detail → Billing tab**: effective pricing with its source (plan / program / override), current period GMV and accrued commission, statements table with record-payment / waive / issue-credit, override editor (reason required, audited).
- **Overview**: MRR (sum of active base fees), commission accrued this month, GMV this month, overdue balances, trials ending this week.
- **Merchant dashboard (later)**: Billing page showing the same statement, read-only, with the platform's bank details for payment.

### 2.5 Order of work

1. Schemas + policy resolver + fee calculator as a pure function with unit tests (tier maths, marginal vs bracket, caps, rounding, FX).
2. Fee-event listener on the order status events; backfill script (optional, per tenant, dry-run) for historical delivered orders.
3. Statement job (BullMQ, monthly) + manual "generate now".
4. Platform admin: Plans/Policies editor, Tenant billing tab, Overview tiles.
5. Enforcement switch and merchant-facing billing page.

---

## 3. Everything else, in phases

### Phase A — Foundation (P0)

1. **Platform audit ledger** (`platform_audit_logs`, admin DB, append-only): every platform route mutation writes `{actorId, actorEmail, action, resourceType, resourceId, tenantId, reason, before, after, ip, userAgent, requestId}`. Retrofit suspend/unsuspend/delete/purge/plan change/flags/phone countries/seed/impersonation. Admin page **Security → Audit log** with filters and a per-tenant Activity tab.
2. **Platform users & roles**: named roles (Owner, Admin, Operations, Support, Finance, Developer) mapping to scope sets; invite by email (platform-staff invitation type), suspend/reactivate, force password reset, list sessions/revoke (platform tokens get a `tokenVersion` like merchant users). Page **Users → Platform users**.
3. **Store users**: read-only staff list per tenant (roles, last login, status) with revoke access / resend invite. Page inside Tenant detail.
4. **Explicit store lifecycle**: `tenant.lifecycle = { state: pending|onboarding|active|suspended|closed|archived, reason, changedAt, changedBy }`, transitions in `tenantLifecycle.js`, `closed` replaces "schedule deletion" as the normal path, purge stays highly restricted. Filters and tiles keyed on it.
5. **Billing** (§2).
6. **Overview page** with the four tile groups from the doc plus an alert list computed from failed jobs, failed webhooks, SSL errors, overdue statements, stuck setups.

### Phase B — Operations (P1)

7. **Access programs** + **feature override layers** (plan entitlements → program → store), with the **Configuration inspector** on tenant detail showing default/plan/program/store/effective for every flag and limit.
8. **Usage & limits**: nightly usage roll-up per tenant (products, staff, orders this month, storage, API calls from the request logger) shown against effective limits; soft enforcement switches.
9. **Cross-store commerce search**: orders (with a proper timeline view built from `order.history`), products, customers (tenant-picked), inventory events.
10. **Storefront**: domains list with SSL/DNS state and retry actions; theme catalog page (publish/deprecate, stores per theme/version); storefront health probe job (HEAD the homepage, product page, cart) with results on tenant detail.
11. **System health**: API/DB/Redis/queue/email/storage checks endpoint; integrations page (provider, env, configured?, last success, last error); cross-tenant webhook inspector.
12. **Feedback**: merchant→platform feedback model + admin queue; surface existing support tickets cross-tenant.
13. **Activity feed** rendered from the audit ledger + tenant AuditLog with human-readable templates.
14. **MFA + session management** for platform staff.

### Phase C — Scale (P2)

15. Platform analytics (growth, activation, churn, plan distribution, GMV/revenue series), usage analytics, cohort views.
16. Incidents model, read-only impersonation, re-auth for destructive actions, customer privacy operations, bulk tenant operations, global configuration registry for currencies/countries/order states.

---

## 4. Decisions (confirmed 2026-09-19)

1. **Commission recognition: on delivered.** Fee events are written when an order reaches Delivered; refunds/cancellations append reversals.
2. **Per-store currency.** Fees are computed and statements issued in the store's own currency. Tier thresholds are defined in the policy currency (SDG) and converted with the store's FX table only to look up the tier; the resulting percentage is applied to the store-currency amount.
3. **Two plan families, merchant's choice:** commission plans (percentage of delivered sales, no fee) and subscription plans (fixed monthly/yearly fee, no percentage). Switching allowed, effective next period by default. Hybrid stays possible in the model but is not offered.
4. **Trials** apply to subscription plans only (free days before the first fee). Commission plans need no trial. Fee holidays remain available as per-store or program overrides on commission plans. All payment methods (COD, manual transfer, gateways) count toward commission.
5. **Collection and enforcement:** how merchants pay the platform is decided later (likely one of the integrated payment methods). At launch: monthly statements are generated and tracked, payments are recorded manually by the operator, and `enforcement.onOverdue` is `none`.
