# Billing API contract (Phase A)

Backend for `docs/plans/platform-admin-operating-system.md` §2. Two plan families the merchant chooses between: **commission** (no fee, % of delivered sales via a commission policy) and **subscription** (fixed fee, no %). Commission is recognised when an order becomes **Delivered** and reversed proportionally on refund. Statements are monthly, per tenant, in the **store's currency**; collection is manual (operator records payments); `enforcement.onOverdue` defaults to `none`.

All platform routes live under `/api/platform/billing` (plans stay at `/api/platform/plans`) behind `platformAuthenticate`. Reads require scope `billing.read`, writes `billing.write`. Every write records a `PlatformAuditLog` row. The fee ledger and statements have **no update/delete routes**; corrections are new rows or status transitions.

Response envelope: `{ success, data }` (platform) / `{ success, responseObject }` (merchant). Errors: `{ success:false, message, errors? }` with 400 (validation), 403 (scope), 404, 409 (state conflicts).

## Models (admin DB)

- `SubscriptionPlan`: `key, name, description, family: commission|subscription|hybrid, pricing: { baseFee: {amount,currency,interval:month|year}, trialDays, commissionPolicyKey|null }, limits: { maxProducts, maxStaff, maxOrdersPerMonth, maxStorageMB, maxApiRequestsPerDay } (null = unlimited), entitlements: [featureKey], switching: { allowSelfService, minimumTermDays }, isActive, sortOrder`. A yearly price is `interval: "year"` (billed 1/12 per statement). Trials: subscription plans only (a commission plan with `trialDays > 0` is rejected) and granted **once per tenant, ever** (`tenant.billing.trialUsedAt`). Legacy `price/currency/interval` are kept in sync only when `pricing.baseFee` changes; unmigrated rows are seeded from `price` on first save (migration `009_plan_pricing_families` backfills the rest).
- `CommissionPolicy`: `key, name, isActive, basis: gmv|order_count, gmvScope, recognitionEvent, period: calendar_month|rolling_30d|lifetime, tierMode: marginal|bracket, tiers: [{ upTo|null, percent, fixedPerOrder }], perOrder: { minFee, maxFee }, periodCap, paymentMethods: "all"|[code], currency (thresholds/caps currency, SDG), rounding, precision`.
- `PricingOverride` (tenant scope): `baseFee?, commissionPolicyKey?, percentDelta?, feeHolidayUntil?, startsAt, endsAt, reason, createdBy, revokedAt`.
- `PlatformFeeEvent` (append-only): `tenantId, type: commission|reversal|adjustment|credit|subscription, orderId, orderNumber, paymentMethod, basisAmount/basisCurrency (store ccy), fxRateToPolicyCurrency|null, basisPolicyAmount, feePolicyAmount, feeAmount/feeCurrency (store ccy; negative for reversal/credit), policyKey, planKey, tierIndex, percentApplied, pricingSource: plan|override|default, occurredAt, periodKey (YYYY-MM), statementId, source: system|operator, reason, reversesEventId, metadata`. Unique: one `commission` row per order.
- `BillingStatement`: `tenantId, periodKey (unique per tenant), periodStart/End, currency, planKey, planFamily, lines: [{type: subscription|commission|adjustment|credit, description, amount, ref}], subtotal, credits, amountDue, amountPaid, balance, status: draft|issued|paid|partially_paid|overdue|waived|void, issuedAt, dueAt, paidAt, payments: [{amount, method: bankak|bank_transfer|cash|gateway|other, reference, note, recordedBy, recordedAt}], note`.
- `PlanChange`: `tenantId, fromPlan, toPlan, requestedBy: merchant|operator, requestedById, requestedAt, effectiveAt, appliedAt, claimedAt, status: scheduled|applying|applied|cancelled, reason`. `applying` is a transient claim (re-claimable after 15 min).
- Tenant: `billing: { trialUsedAt, trialEndsAt }` — stamped at signup or on the first assignment of a trial plan, never re-granted (migration `012_backfill_trials`).
- Settings (`platformconfigs._id:"billing"`): `{ defaultCommissionPolicyKey|null, defaultPlanKey (active plan; "trial"), statementDay (1–28; drives the period-close cron `0 2 <day> * *`, re-registered on change), dueDays (0–90), graceDays (0–180), enforcement: { onOverdue }, billingStartPeriod (YYYY-MM|null; set automatically on the first period run) }`.
- Platform FX table (`platformconfigs._id:"fx"`): `{ base: "SDG", rates: { CODE: multiplier vs base }, updatedAt }`. **The only FX source for platform pricing** — merchant `settings.currencies.rates` never influence tiers or base-fee conversion. A missing pair → `fxMissing` (tier 0 applied and flagged) for commission; for a base fee it blocks statement generation (see H4 below).

## Resolution ladder

`resolveEffectivePricing(tenant)` → `{ planKey, planName, family, baseFee, trialEndsAt, inTrial, policy, policyKey, percentDelta, feeHolidayUntil, inFeeHoliday, chargesCommission, chargesBaseFee, source: { baseFee: plan|override, commission: plan|override|default|none }, overrideIds, policyFallback }`. **All active** tenant overrides are merged per field (newest non-null value wins), so a fee holiday and a negotiated policy on separate override rows both apply. If a plan/override points at an inactive or missing policy, the platform default policy is used instead and the ledger logs an error (`policyFallback: { wanted, used }`) — commission is never silently waived.

FX: tier thresholds/caps are in the policy currency; conversion uses `fxMultiplier(platformFxTable, storeCcy, policyCcy)` (see the FX table above). Orders with a zero basis (fully refunded before delivery, free orders) are skipped (`{ skipped: "zero-basis" }`) — no minimum fee or fixed component is ever charged on a zero order.

## Platform endpoints

Settings
- `GET /settings` → settings object.
- `PUT /settings` body: any subset of the settings fields → settings. `defaultCommissionPolicyKey` must reference an active policy.

Platform FX
- `GET /fx` → `{ base, rates, updatedAt }`.
- `PUT /fx` body `{ base?, rates: { CODE: positiveNumber } }` (≤ 200 codes; `base` defaults to the stored base) → table. Audited as `billing.fx.update`.

Commission policies
- `GET /policies` → `[policy]`.
- `POST /policies` body: policy fields (`key`, `name`, `tiers` required). Tiers: ascending `upTo`, last `upTo: null`, `0 ≤ percent ≤ 100`. → 201 policy.
- `PATCH /policies/:id` body: partial (key immutable) → policy. Setting `isActive: false` is refused (409) while the policy is referenced by an active plan, an active override, or the platform default — same rule as delete.
- `DELETE /policies/:id` → 409 while referenced by any plan, an active override, or the platform default.
- `POST /policies/preview` (read scope; validated) body: `{ policy: key|{tiers,…}, periodBasisSoFar?, periodFeeSoFar?, orderAmount, fxRateToPolicyCurrency?|null, percentDelta? }` → `{ feeAmount, tierIndex, percentApplied, basisPolicyAmount, feePolicyAmount, fxMissing, capped, breakdown: [{tier, amount, percent}] }`.

Statements (cross-tenant)
- `GET /statements?status=&tenantId=&periodKey=&page=&limit=` → `{ rows (tenantId populated {name,slug,email}), total, page, pages }`.
- `GET /statements/:id` → statement.
- `POST /statements/:id/issue` (draft → issued; issued with amountDue 0 → paid) → statement. Stamps ledger rows with `statementId`.
- `POST /statements/:id/payments` body `{ amount>0, method, reference?, note? }` → statement (partially_paid | paid). Rejects amounts above the balance.
- `POST /statements/:id/waive` body `{ reason }` (issued/partially_paid/overdue → waived).
- `POST /statements/:id/void` body `{ reason }` (any unpaid, no recorded payments → void; ledger rows released).
- `POST /run-period` body `{ periodKey? }` (default: previous month) → `{ periodKey, planChangesApplied, tenants, generated, issued, skippedEmpty, overdue, errors }`. Only a **closed** period (≤ previous month) at or after `billingStartPeriod` is accepted (400 otherwise). Tenants with nothing to bill get **no** statement (`skippedEmpty`); a tenant created after the period end is never charged a base fee for it; a ledger row in a different currency than the store currency (`settings.currencies.base || settings.currency`) fails that tenant with 422 into `errors[]`. Plan-change failures are collected into `errors[]` (stage `plan-change`) and never abort the run. Order of operations: statements for the period are generated **and issued first** (priced on the plan in effect at the period end, via PlanChange history keyed on `effectiveAt`), **then** due plan changes are applied, then overdue flags. Statements with no lines are left as empty drafts (`skippedEmpty`). A tenant whose base fee cannot be converted lands in `errors[]` and gets no statement. Same routine as the monthly cron (`billing` queue, `0 2 1 * *`); the cron run is audited as a system `billing.period.run` and every applied change as `plan.change.apply`.

Per tenant
- `GET /tenants/:tenantId/effective` → `{ pricing, currentPeriod: { periodKey, gmv, commission, adjustments, credits, currency, count }, overrides: [..20], planChanges: [..10] }`.
- `POST /tenants/:tenantId/overrides` body `{ baseFee?, commissionPolicyKey?, percentDelta?, feeHolidayUntil?, startsAt?, endsAt?, reason }` (at least one pricing field; `endsAt > startsAt`; a fee holiday is bounded by its own date) → 201 override. Multiple active overrides merge per field.
- `POST /tenants/:tenantId/overrides/:id/revoke` body `{ reason }` → override.
- `GET /tenants/:tenantId/ledger?periodKey=&page=&limit(≤100)=` → `{ rows, total, page, pages }`.
- `POST /tenants/:tenantId/adjustments` body `{ amount (≠0; negative = credit), reason, periodKey? }` → 201 fee event, always in the store currency. 409 when that period already has an issued statement (post to the current period instead).
- `GET /tenants/:tenantId/statements` → `{ rows, total, ... }`.
- `POST /tenants/:tenantId/statements/generate` body `{ periodKey, force? }` → `{ statement|null, created, regenerated, empty? }` (`empty: true` when nothing to bill; nothing persisted). Rules: none → draft created; `draft` → rebuilt; `void` → reset to draft (payments cleared) and rebuilt; `issued`/`overdue` + `force` → lines recomputed, status kept, balance recomputed; `paid`/`partially_paid`/`waived` → 409 with `force`, returned unchanged without.
- `POST /tenants/:tenantId/plan-change` body `{ toPlan, effectiveAt?: immediately|next_period (default next_period), reason? }` → `{ change, tenant|null, applied }`. A newer scheduled change supersedes the previous one.
- `POST /tenants/:tenantId/plan-change/cancel` → `{ cancelled }`.

Plans (`/api/platform/plans`, read `billing.read`, write `tenant.lifecycle` — unchanged routes)
- `GET /plans` (each row carries `tenantCount`), `POST /plans`, `PATCH /plans/:id`, `DELETE /plans/:id` accept `family`, `pricing.*`, `limits.*`, `entitlements`, `switching.*` (legacy `price/currency/interval` still accepted). Family rules enforced: commission ⇒ policy + fee 0 + no trial; subscription ⇒ no policy; hybrid ⇒ policy + fee > 0 (created inactive by default). Delete is blocked while tenants or scheduled changes reference the plan.
- `PATCH /tenants/:tenantId/plan` `{ plan }` — immediate change routed through the plan-change service (audited as `plan.change`).

Audit actions written: `billing.fx.update, billing.settings.update, billing.policy.create|update|delete, billing.override.create|revoke, billing.adjustment.create, billing.statement.generate|issue|record_payment|waive|void, billing.period.run, plan.create|update|delete, plan.change, plan.change.cancel`.

## Merchant endpoints (`/api/billing`, tenant-scoped, `authenticate`)

- `GET /summary` (settings.read) → `responseObject: { plan: {key,name,family}, pricing: { baseFee, chargesBaseFee, chargesCommission, commission: {currency, tierMode, period, tiers, percentDelta}|null, trialEndsAt, feeHolidayUntil }, currentPeriod: {periodKey, gmv, commission, adjustments, credits, currency, count}, recent30d: {gmv, orders}, statements (issued only; drafts hidden): [{id, periodKey, currency, status, amountDue, amountPaid, balance, issuedAt, dueAt, lines: [{type, amount, description}]}], scheduledChange: {toPlan, effectiveAt, status, requestedBy, cancellable}|null, nextPeriodStartsAt, minimumTermEndsAt|null, availablePlans: [{ key, name, family, basePrice, baseCurrency, interval, trialDays, commission: {tiers…}|null, selfService, current, minimumTermDays, nextPeriodStartsAt, availableAfter|null, estimate: { monthlyBase, estimatedCommission, fxMissing } }], dueDays }`. Adjustment/credit lines carry merchant-facing descriptions (operator reasons stay internal); no source/override internals are exposed.
- `POST /plan-change` (settings.write) body `{ toPlan }` → 201 `responseObject: change`. Always `next_period`; rejects inactive plans, plans with `switching.allowSelfService=false`, the current plan, switches before the current plan's `minimumTermDays`, and (409) any request while an operator-scheduled change is pending — a merchant can never displace an operator's change.
- `POST /plan-change/cancel` (settings.write) → cancels the tenant's own **merchant-requested** scheduled change; 404 when none, 403 when the pending change was scheduled by an operator. Audited in the tenant audit log.

Public `GET /api/plans` now returns `family`, `trialDays`, `commission: { tiers… }|null`, `selfService` per plan.

## Signup plan

`POST /api/auth/register` may send `subscriptionPlan`, but only an **active** plan with `switching.allowSelfService !== false` is honoured; anything else (unknown, inactive, operator-only, omitted) falls back to billing settings `defaultPlanKey` with a warning log. A trial plan stamps `billing.trialUsedAt/trialEndsAt` at creation.

## Events

`order.delivered` (emitted by `updateOrderStatusService` on the Delivered transition) → `recognizeDelivered` writes one `commission` row (fee 0 during a fee holiday; skipped when the plan carries no commission or the payment method is excluded; duplicate-key on replay → skipped). `order.refunded` (emitted by the refund controller) → `reverseForRefund` writes a `reversal` proportional to `refundAmount / basisAmount`; both the reversed fee and the reversed basis are capped at what remains on the order, so repeated partial refunds stack correctly and never over-reverse (migration `011_fee_event_reversal_index` drops the obsolete one-reversal-per-order index). Listeners are registered when `routes/platform/billing.js` loads (API process).

## Not done / simplified

- Base fee is charged in full for the period when the plan was in effect at period end (no proration for mid-month starts).
- `gmvScope`/`recognitionEvent` values other than `delivered` are stored but only `delivered` is wired (no `paid` event yet).
- Access-program overrides (Phase B) are modelled in `PricingOverride.scope` but not resolved.
- Enforcement modes other than `none` are stored, not enforced (Phase B: subscription gate reads `enforcement.onOverdue`).
- Estimates in the merchant summary approximate the tiers by running the average delivered order size `orders` times.
