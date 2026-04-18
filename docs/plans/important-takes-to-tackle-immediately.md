Tenant isolation and permission hardening

The platform must prove that no tenant can read or mutate another tenant's
products, orders, customers, assets, themes, domains, discounts, or settings.
Shared-DB multitenancy means every query, aggregation, and write carries a
tenantId filter, and every reference stored on a document resolves back to
the owning tenant. A single missing filter is a data breach, not a bug.

Scope

1. Query-layer isolation
   Every repository read/write includes tenantId. No controller or service
   should bypass the repository layer to hit Mongoose directly. Aggregations,
   bulk updates, and $lookup stages are the highest-risk paths because a
   missing $match on tenantId silently leaks across tenants and leaves no
   stack trace.
2. Reference integrity
   When document A references document B (order → product, discount →
   collection, cart → variant), the reference must resolve within the same
   tenant. A tenant must not be able to submit another tenant's ObjectId and
   have the platform silently accept it — every ObjectId that arrives from
   a client needs an ownership check before it's trusted.
3. Permission boundaries
   admin / manager / staff / customer roles need explicit allow-lists per
   route. "Authenticated" is not a permission. Staff should not be able to
   issue refunds, change payout accounts, export customer PII, rotate API
   keys, or mutate billing unless the role explicitly allows it.
4. Asset isolation
   Uploaded files, themes, exports, invoices, and signed URLs must not be
   guessable or enumerable across tenants. Signed URLs should encode tenantId
   and expire; object-storage paths should be tenant-prefixed so a leaked
   path cannot be walked to another tenant's assets.
5. Auth token scope
   JWTs must bind userId to tenantId. A token issued for tenant A must be
   rejected on a request resolved to tenant B, even if the userId happens to
   exist on both. Storefront and dashboard tokens must be on different
   audiences — a storefront customer token should never authorize a
   dashboard mutation.
6. Tenant resolution trust
   The tenant must be resolved from a trusted signal (host header verified
   against the Domain registry, or the authenticated token), never from a
   client-supplied body field, query param, or header.

What To Audit

- Every repository function: does it accept and enforce tenantId?
- Every aggregation: does the first stage filter by tenantId?
- Every bulk update (updateMany, deleteMany): same.
- Every $lookup: does the pipeline filter the joined collection by tenantId?
- Every controller that accepts an ObjectId from the client: does it verify
  the referenced document belongs to the caller's tenant before using it?
- Every admin-only route: is there a role check, not just an auth check?
- Every storefront route: does it scope to the tenant resolved from the
  request host, never from request body?
- Every asset URL: is tenant binding cryptographic, or just obscure?
- Every webhook handler: does it resolve the tenant from the signed payload
  or provider metadata, not from a URL segment the caller can forge?

Specific Bugs To Look For

- Aggregation pipeline missing tenantId in $match.
- $lookup joining a collection without filtering the joined side by tenantId.
- populate({ path, match }) missing the tenantId match.
- Repository accepting tenantId from request body instead of req.tenant.
- Controller trusting a client-supplied productId/orderId/discountId without
  verifying ownership.
- Staff role able to hit admin-only routes.
- Public storefront routes accepting an "admin preview" token that elevates.
- Signed URL secret shared across tenants, or signed URLs without expiry.
- Webhook handlers resolving tenant from request body or URL, not from the
  webhook signature / provider metadata.
- Dashboard auth token accepted on storefront routes, or vice versa.
- Error messages that leak existence of another tenant's resource ("not
  found" vs "forbidden" distinguishability).

Acceptance Criteria

- Every repository function requires tenantId as a non-nullable parameter.
- Every aggregation has a verified tenantId filter in its first stage.
- Every role is covered by a permission matrix that is tested per sensitive
  route.
- A cross-tenant fuzz test exists: tenant B submits tenant A's ObjectIds to
  every mutating endpoint, and every attempt fails with a not-found or
  forbidden error — never a silent success, never a partial write.
- A cross-tenant read test exists: tenant B queries every list/detail
  endpoint and cannot see any of tenant A's data in the response, including
  aggregated/reported numbers.
- Auth tokens embed tenantId and audience, and are rejected cross-tenant
  and cross-audience.
- Tenant resolution never reads from a client-controlled request body field.

     A business-critical correctness pass means making the entire “cart → checkout →

order → payment/fulfillment/inventory” flow deterministic, auditable, and hard to
corrupt. The objective is not just “checkout works once.” It is: every price,
discount, tax, shipping fee, stock movement, and order state transition is
explainable, repeatable, and protected by tests.

This is the highest-value pass because it protects revenue, merchant trust,
customer trust, and future integrations.

Scope

1. Cart correctness
   Cart lines should always resolve to valid products/variants, valid prices,
   valid inventory state, valid currency/market, and valid quantity rules. The
   cart should not silently accept deleted products, inactive products,
   unavailable variants, negative quantities, invalid custom fields, stale prices,
   or tenant-mismatched data.
2. Checkout calculation correctness
   The platform needs one authoritative calculation pipeline for subtotal,
   discounts, shipping, tax, fees, rounding, total, and currency. The same logic
   should be used for cart preview, checkout, payment amount creation, and final
   order creation. If four different places calculate totals, they will drift.
3. Discount correctness
   Discounts need exact rules for eligibility, stacking, priority, usage limits,
   customer restrictions, product/category restrictions, minimum subtotal, date
   windows, market/currency applicability, and free-shipping interaction. The
   platform must reject invalid combinations consistently and explain why.
4. Shipping correctness
   Shipping needs deterministic rate selection and final price calculation. You
   need to define how shipping zones, methods, free shipping, market restrictions,
   address validation, weight/price thresholds, and provider rates interact.
5. Tax correctness
   Even if tax is simple now, the model should clearly define whether prices are
   tax-inclusive or tax-exclusive, what address determines tax, how rounding
   works, and whether tax applies before or after discounts/shipping.
6. Inventory correctness
   Inventory must distinguish “available”, “reserved”, “committed”, “fulfilled”,
   “cancelled”, and “returned.” Checkout should not oversell unless a merchant
   explicitly allows it. Order cancellation, payment failure, timeout, refund, and
   fulfillment should each move inventory predictably.
7. Order state correctness
   Orders should move through explicit states, not ad hoc booleans. You need legal
   transitions for order status, payment status, fulfillment status, cancellation,
   refunds, and returns. Invalid transitions should fail loudly.
8. Idempotency and concurrency
   Checkout/order creation must be idempotent. A double-click, network retry,
   webhook replay, or mobile refresh should not create duplicate orders, double-
   charge customers, double-apply discounts, or double-reserve inventory.
   The idempotency key should be bound to the checkout session and generated
   server-side when the session opens, not supplied per request. Client-
   generated per-request keys don't protect against double-click, and they
   give an attacker a trivial way to probe for collisions.
9. Refund and financial correctness
   Refunds must reverse payment, inventory, discount usage, and order state
   in a defined order. Partial refunds, refund-after-fulfillment, refunds
   crossing tax jurisdictions, and refunds of free-shipping orders all need
   explicit behavior. The financial ledger (gross, net, fees, refunds,
   payouts) must reconcile against the payment provider's numbers down to
   the cent — if it doesn't, merchants can't trust their revenue reporting
   and you can't defend a chargeback.
10. Audit log for state transitions
    Every order / payment / fulfillment / inventory state transition should
    write an immutable audit log entry: actor (user/system/webhook), reason,
    before state, after state, timestamp, request id. This is how support
    debugs "why did this happen", how merchants defend chargebacks, and how
    you prove correctness after an incident. No state transition should be
    silent.

Core Principle
Create a single checkout/order calculation engine.

Everything that needs totals should call the same service:

input:
tenantId
cartId or checkoutSessionId
customerId optional
shippingAddress
billingAddress
market/currency
discountCodes
selectedShippingRate
taxContext

output:
normalized line items
subtotal
discount breakdown
shipping breakdown
tax breakdown
total
warnings/errors
calculationVersion

Then order creation should persist a snapshot of that calculation. Orders should
not depend on live product/discount/tax/shipping records after creation, because
those records can change later.

What To Audit
For checkout/orders specifically, check these flows:

1. Cart item added.
2. Cart quantity changed.
3. Discount code applied.
4. Shipping address selected.
5. Shipping method selected.
6. Taxes calculated.
7. Checkout total finalized.
8. Payment intent/session created.
9. Order created.
10. Inventory reserved or committed.
11. Payment succeeds.
12. Payment fails.
13. Order cancelled.
14. Order partially refunded.
15. Order fulfilled.
16. Order returned.
17. Webhook replay happens.
18. Customer retries checkout.
19. Merchant edits product price mid-checkout.
20. Merchant disables a discount mid-checkout.
21. Inventory drops between cart and order creation.

Each one needs expected behavior.

Specific Bugs To Look For
These are the classes of bugs I would actively search for:

- Discount applies to inactive products.
- Expired discount still works.
- Discount usage limit increments even if checkout fails.
- Discount usage limit does not increment after successful order.
- Same code can be applied twice.
- Stackable and non-stackable discounts combine incorrectly.
- Free shipping discount removes the wrong shipping method.
- Percentage discount applies to shipping when it should only apply to items.
- Tax is calculated on pre-discount subtotal when jurisdiction expects post-
  discount.
- Tax is calculated before shipping is finalized.
- Order total differs from payment amount.
- Cart total differs from order total.
- Rounding differs between line-level and order-level totals.
- Out-of-stock variant can be ordered.
- Two simultaneous checkouts can oversell the same SKU.
- Payment retry creates duplicate order.
- Webhook replay changes payment/order state twice.
- Cancelled order does not release inventory.
- Failed payment leaves inventory permanently reserved.
- Refunded order does not update financial state correctly.
- Tenant A discount/product/shipping method can be referenced by Tenant B.
- Currency mismatch between cart, payment, and order.
- Product price changes after checkout alter an existing order.

Data Model Expectations
Orders should store immutable snapshots:

order.items[]
productId
variantId
sku
title
variantTitle
quantity
unitPrice
compareAtPrice
currency
taxClass
fulfillmentRequired
inventoryTracked
originalProductSnapshot

order.pricing
subtotal
itemDiscountTotal
shippingSubtotal
shippingDiscountTotal
taxTotal
total
currency
roundingAdjustment
calculationVersion

order.discounts[]
discountId
code
type
amount
appliesTo
allocationMethod
lineAllocations[]

order.shipping
methodId
name
carrier
price
discountedPrice
addressSnapshot

order.taxLines[]
jurisdiction
rate
taxableAmount
amount
includedInPrice

order.inventoryReservations[]
reservationId
sku/variantId
quantity
status

order.state
orderStatus
paymentStatus
fulfillmentStatus
cancellationStatus

The important thing: the order should be understandable years later even if the
merchant deletes a product, changes a tax rule, renames a shipping method, or
removes a discount.

State Machines
You need explicit legal transitions.

Order status:

draft → pending_payment
pending_payment → confirmed
pending_payment → cancelled
confirmed → processing
processing → partially_fulfilled
processing → fulfilled
partially_fulfilled → fulfilled
confirmed/processing → cancelled
fulfilled → returned/partially_returned

Payment status:

unpaid → authorized
authorized → paid
authorized → voided
unpaid → failed
paid → partially_refunded
paid → refunded
paid → disputed

Fulfillment status:

unfulfilled → in_progress
in_progress → partially_fulfilled
in_progress → fulfilled
partially_fulfilled → fulfilled
fulfilled → delivered
fulfilled → returned/partially_returned

Inventory reservation:

none → reserved
reserved → committed
reserved → released
committed → fulfilled
committed → returned

Every transition should be enforced by code. No endpoint should freely set
statuses.

Test Strategy
I would not rely only on broad E2E tests. Use layered tests.

1. Pure calculation unit tests
   These test pricing without DB/network. Fast and exhaustive.

   Examples:
   - one item, no discount, no tax, no shipping
   - percentage item discount
   - fixed amount discount
   - discount capped at subtotal
   - stackable discounts
   - non-stackable discounts
   - free shipping
   - tax-inclusive prices
   - tax-exclusive prices
   - rounding edge cases

2. Service integration tests
   These use MongoMemoryServer and real schemas/services.

   Examples:
   - create order from cart
   - reject out-of-stock checkout
   - reserve inventory on order creation
   - release reservation on payment failure
   - commit inventory on payment success
   - increment discount usage only after successful order
   - prevent cross-tenant product/discount/shipping access

3. Concurrency tests
   These simulate two checkouts hitting the same stock at the same time.

   Example:
   - SKU has quantity 1.
   - Two checkout requests submit simultaneously.
   - Exactly one succeeds.
   - Inventory never goes negative.
   - Failed checkout has clear error.

4. Idempotency tests
   These simulate duplicate requests and webhook retries.

   Examples:
   - same checkout idempotency key returns the same order
   - same payment webhook processed twice does not duplicate state changes
   - same fulfillment webhook processed twice does not duplicate shipments

5. API contract tests
   These assert response shapes and error semantics.

   Examples:
   - invalid discount returns structured reason
   - no shipping method returns actionable error
   - tax calculation failure blocks order or falls back according to product rule
   - payment amount exactly equals order total

6. Cross-tenant isolation tests
   These seed two tenants and verify that every read/write endpoint rejects
   cross-tenant access. Run as a parameterized sweep over the full route
   table, not as hand-picked spot checks.

   Examples:
   - tenant B cannot fetch tenant A's orders, products, customers, discounts,
     carts, themes, or settings
   - tenant B cannot mutate tenant A's resources by submitting tenant A's
     ObjectIds to any endpoint
   - tenant B's list/report/aggregation endpoints never surface tenant A rows
   - staff of tenant A cannot hit admin-only routes of tenant A
   - a storefront token cannot authorize a dashboard mutation
   - a dashboard token from tenant A is rejected by any request resolved to
     tenant B

Acceptance Criteria
A good pass is done when these are true:

- There is one authoritative calculation service for cart/checkout/order totals.
- Order creation persists immutable pricing, discount, shipping, tax, and product
  snapshots.
- Payment amount and order total are always generated from the same calculation
  result.
- Discount rules are deterministic and covered by unit/integration tests.
- Free-shipping and stackability behavior are explicitly defined and tested.
- Shipping rate selection is validated before order creation.
- Tax calculation has documented inclusive/exclusive behavior and rounding rules.
- Inventory cannot go negative unless overselling is explicitly enabled.
- Order creation is idempotent.
- Payment and fulfillment webhook processing is idempotent.
- Discount usage limits update only after the correct business event.
- Failed/cancelled checkouts release inventory reservations.
- Cross-tenant references are rejected, and the cross-tenant fuzz test
  passes on every mutating route.
- Every repository enforces tenantId as a required, non-nullable argument.
- Illegal state transitions are rejected.
- Every order / payment / fulfillment / inventory state transition writes
  an audit log entry.
- Refund flows (full, partial, post-fulfillment, free-shipping, multi-
  jurisdiction) are deterministic and covered by tests.
- The financial ledger reconciles against the payment provider to the cent.
- Checkout/order tests cover normal, edge, failure, retry, and concurrent flows.
- Running the relevant tests is reliable and quiet, without unrelated background
  setup errors.

1. Map current tenantId enforcement across repositories, aggregations,
   $lookup stages, and controllers that accept client ObjectIds.
2. Build the cross-tenant fuzz harness and run it against every route —
   this surfaces the isolation gaps before any refactor begins.
3. Map current checkout/order/discount/shipping/tax/inventory code paths.
4. Define the canonical calculation contract.
5. Write tests for expected behavior before changing logic.
6. Consolidate total calculation into one service.
7. Add immutable order snapshots.
8. Add server-issued, session-bound idempotency keys to checkout/order
   creation.
9. Add inventory reservation semantics.
10. Add state transition guards, each writing an audit log entry.
11. Add webhook idempotency + signature-based tenant resolution.
12. Add refund and financial ledger correctness with provider reconciliation.
13. Run the full commerce + isolation test suite and fix failures.

If you want the most pragmatic starting point: run the cross-tenant fuzz
harness first (it's the one thing whose failure mode is a breach, not a
bug), then begin the commerce pass with checkout total calculation and
order snapshot correctness. That ordering protects you against the
highest-severity class of failure while the bigger refactor lands.
