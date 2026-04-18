> **Stale as of 2026-04-18** — references `middlewares/assetResolver.js` which no longer exists. Kept for historical context.

Expanded File-By-File Plan

Entry, Routing, Middleware

- index.js: Mount Stripe webhook before JSON parsing; fix CORS so credentials: true never pairs with \*; restore CSP with explicit allowances; add
  request IDs; harden production logging; review trust proxy; avoid broad cross-origin asset policy unless required.
- server/route.config.js: Register webhook outside the generic /api parser path; define explicit behavior for unknown storefront hosts; separate
  public storefront resolution from authenticated API flows more clearly.
- server/express.config.js: Either remove as unused or make it the single source of Express bootstrap config to avoid drift.
- middlewares/auth.js: Normalize req.user shape; revalidate user existence/status; revalidate tenant status; optionally bind token subject to
  current credential version; support revocable refresh/session model.
- middlewares/authorize.js: Expand from broad roles to granular permissions/scopes; prepare for platform-admin vs tenant-admin separation; add audit
  context for sensitive actions.
- middlewares/tenantContext.js: Stop letting unresolved storefront requests fall into handlers that require req.models; return controlled store-not-
  found responses; standardize domain resolution logic with tenant statics; define exceptions explicitly.
- middlewares/errorHandler.js: Add request correlation IDs; structure production logs; add integration/provider error mapping; avoid leaking stack
  traces outside dev.
- middlewares/upload.js: Add stronger file validation than MIME type; review SVG policy; align field names with actual routes; add content sniffing;
  ensure upload size/count settings are sane per endpoint.
- middlewares/assetResolver.js: Validate theme slug resolution; avoid unsafe/default asset fallback behavior; cache tenant/theme lookups; make
  fallback explicit and observable.
- middlewares/storefrontServe.js: Review tenant fallback behavior, theme file serving security, cache headers, and unknown route behavior.
- config/index.js: Replace permissive/unsafe defaults; add explicit config validation for CORS, session, Stripe webhook, Cloudinary, encryption
  keys; separate required-by-env variables.
- config/redis.js: Review reconnect behavior, failure handling, health checks, and session dependency degradation strategy.
- utils/connectionManager.js: Add observability, connection state metrics, and worker-safe shutdown behavior.
- utils/misc.js: Add token versioning support, secure defaults, and avoid noisy auth logging in normal failure cases.
- utils/scopedModel.js: Verify tenant scoping cannot be bypassed; document exactly which models are scoped and how.
- utils/tenantScope.js: Audit query middleware for completeness on reads, writes, aggregates, and edge cases.
- utils/initDbConnection.js: Confirm all schema registration order and plugin application are deterministic.

Auth and Session Lifecycle

- services/auth.js: Replace stateless refresh with stored, revocable, rotating refresh tokens; check user active state and tenant status on refresh;
  invalidate on password change or explicit logout.
- controllers/auth.js: Make logout actually revoke tokens/sessions; consider secure cookie delivery for refresh; include richer current-user payload
  if dashboard depends on it.
- routes/auth.js: Add route-level protections and possibly stricter rate limiting for refresh/logout as well.
- validators/auth.validator.js: Confirm domain/login inputs match actual auth flow; validate stronger password and tenant registration semantics.

Payments

- routes/payment.js: Remount webhook safely; ensure webhook bypasses auth and body parser conflicts; validate refund/create-intent request
  structure.
- controllers/payment.js: Add idempotency for webhook processing; validate order state before paid/refunded transitions; handle duplicate or out-of-
  order events; ensure payment records are unique per provider event.
- services/payment.js: Stop using order totals unless they come from authoritative checkout pricing; add idempotency keys; support authorize/
  capture/refund/partial refund/void semantics cleanly.
- services/payment/PaymentFactory.js: Decide whether this abstraction is real or remove it; if kept, route all payment flows through it
  consistently.
- services/payment/StripeProvider.js: Replace all stub behavior; remove fake webhook verification; implement real intent/capture/refund/status flows
  or quarantine as non-production.
- services/payment/PayPalProvider.js: Same as StripeProvider; do not advertise support while returning mock payloads.
- services/payment/PaymentProvider.js: Ensure the abstract contract covers the real lifecycle you need, including asynchronous states and
  idempotency.
- schemas/store/payment.js: Add authorization/capture/refund/dispute/reconciliation fields; add uniqueness guarantees; persist gateway response
  snapshots and failure codes.

Orders, Checkout, Pricing

- services/order.js: Redesign entirely around a priced checkout snapshot; use real Mongo transactions; make stock reservation/decrement atomic;
  persist line-level financial artifacts; support guest checkout, partial refunds, fulfillment-aware status transitions.
- controllers/order.js: Keep thin, but align with new order flows such as place/cancel/refund/fulfill/reprice validation.
- routes/order.js: Validate all order mutation payloads; add missing flows if enterprise target includes fulfillment/refunds.
- repositories/order.js: Add session-aware methods and dedicated operations for state transitions, not just generic updates.
- schemas/store/order.js: Expand to include immutable line totals, tax lines, discount applications, shipping quote snapshot, currency/rounding
  context, fulfillment status, returns/refunds metadata, external refs, audit timestamps.
- services/shipping.js: Move into a unified pricing pipeline; support zones, service methods, carrier rules, weight/price thresholds, market-
  specific behavior.
- services/tax.js: Move into the same pricing pipeline; support inclusive/exclusive tax, tax classes, jurisdictions, persisted breakdowns.
- services/discount.js: Rebuild around actual cart lines, customer, market, and redemption state; enforce applicability and per-user/usage limits
  atomically.
- controllers/discount.js: Stop accepting detached cartTotal as truth; bind validation to current cart/checkout state.
- routes/discount.js: Keep merchant CRUD; move shopper-facing discount application into checkout/cart flows.
- schemas/discount.js: Extend for stackability, discount classes, customer segments, markets, channels, start/end windows, buy-X-get-Y, shipping
  discounts, and redemption events.

Cart

- controllers/storefrontCart.js: Make cart lines variant-aware; snapshot unit prices; support guest-to-user merge; add coupon/shipping/tax
  estimation hooks; stop using current product price as the only source of truth.
- routes/storefrontCart.js: Add routes for apply/remove discount, estimate shipping, and maybe merge carts if required.
- schemas/store/cart.js: Add line-level pricing snapshots, variant details, discount allocations, tax class, merchandising metadata, and maybe buyer
  context.
- services/cart.js: Rewrite or remove; current logic is unreliable and should not remain in a production code path.
- controllers/cart.js: If legacy cart path stays, align with rewritten service contracts and remove console logging.
- repositories/cart.js: Add explicit line mutation methods and session-aware operations; avoid generic updateOne as your primary cart API.

Catalog and Product Model

- schemas/store/product.js: Redesign variants as first-class sellable units; add option values, per-variant media, per-variant price/SKU/barcode/
  weight/availability/tax class.
- services/product.js: Fix req.path.id, add missing awaits, separate CRUD from catalog business logic, and add deterministic update/delete
  semantics.
- controllers/product.js: Remove debug logs and standardize error handling.
- routes/product.js: Revisit public/admin separation once product variants, merchandising, and market/catalog visibility exist.
- repositories/product.js: Add atomic inventory-related update methods separate from catalog updates; support variant queries and scoped
  availability lookups.
- validators/product.validator.js: Align with schema; make category required if persistence requires it; validate slugs, variants, SKU uniqueness
  assumptions, optional SEO fields, and numeric normalization.

Inventory and Fulfillment

- controllers/inventory.js: Stop manually syncing Inventory and Product.stock; decide on one source of truth; add explicit reserve/release/adjust/
  transfer semantics.
- routes/inventory.js: Expand from generic update/adjust into operationally meaningful inventory actions.
- repositories/inventory.js: Add atomic reserve/release/adjust methods; stop silently flooring negative stock without surfacing business errors.
- schemas/store/inventory.js: If this remains authoritative, extend for location, reserved, available, incoming, reorder point, stock ledger/event
  history.
- schemas/store/order.js: Add fulfillment-specific fields if enterprise target includes shipment lifecycle, partial fulfillment, and returns.
- repositories/order.js: Add fulfillment-aware transitions and location allocation support later.

Customers, Accounts, Users

- controllers/customer.js: Separate storefront customers from internal tenant users if that distinction matters; add customer status, tags,
  addresses, LTV summaries, support visibility.
- routes/customer.js: Keep admin-only merchant views, but plan dedicated customer-account APIs for self-service.
- services/user.js: Audit for tenant-safe user operations, customer/staff separation, and role lifecycle.
- repositories/user.js: Ensure query helpers distinguish staff vs shopper use cases if needed.
- schemas/store/user.js: Expand for addresses, preferences, consent, account status, segmentation, maybe company/buyer membership if B2B is a goal.
- routes/user.js: Revisit whether these are admin user management routes, customer profile routes, or both; split if necessary.

Uploads and Assets

- controllers/upload.js: Import mongoose; fix req.user.id mismatch; validate asset ownership on delete; restrict allowed presets; remove debug
  logging.
- routes/upload.js: Add authorization granularity if some uploads are merchant-only and others are customer-only.
- services/upload.js: Persist asset ownership/tenant metadata; validate deletions against stored records; avoid URL-only delete authority.
- config/cloudinary.js: Review preset safety, folder naming, and deletion constraints.

Tenant, Settings, Domains, Plans

- schemas/tenant.js: Expand carefully for markets, B2B companies, encrypted provider credentials, richer tax/shipping/payment settings, capability
  flags, plan enforcement, audit state.
- controllers/settings.js: Stop flattening shipping/tax to one rate each; use validated structured updates matching the target tenant model.
- routes/settings.js: Add validation schemas for settings updates; consider splitting branding, localization, shipping, tax, and payments into
  separate endpoints.
- routes/domain.js: Add missing admin authorization to platform-admin routes now.
- controllers/domain.js: Remove mixed tenant-identification fallbacks and debug logs; rely on authenticated tenant context consistently.
- services/domain.js: Audit domain verification, uniqueness, SSL state transitions, and custom-domain entitlement by plan.
- services/domainRegistration.js: Move long-running registration/verification to durable jobs if this is real production behavior.
- services/tenant.js: Enforce plan limits, safer provisioning, and consistent tenant initialization.
- repositories/tenant.js: Add query helpers for plan, capability, and market lookups if platform complexity grows.

Store Setup, Durability, Operations

- services/storeSetup.js: Move status out of memory into durable storage/jobs; add retries, observability, support visibility, and multi-instance
  safety.
- services/dataSeed.js: Make seeding idempotent and safe across reruns.
- services/theme.js: Audit install/activation flows for tenant safety and durability.
- services/themeCustomization.js: Review draft/publish workflow consistency and preview token safety.
- services/themeManifestRegistry.js: Validate manifests strictly to prevent theme/runtime breakage.
  Analytics and Reporting

- controllers/analytics.js: Audit whether analytics are based on correct order/payment states and not optimistic assumptions.
- services/analytics.js: Ensure metrics derive from authoritative financial/order states after checkout redesign.
- schemas/store/analytics.js: Review whether precomputed analytics need backfill/rebuild jobs and tenant-safe aggregation.

Reviews, Wishlist, Misc Commerce

- routes/review.js: Review whether authorization is too broad or too restrictive for storefront review submission/moderation.
- controllers/review.js: Ensure review approval and aggregation update product ratings consistently.
- schemas/store/review.js: Verify it supports moderation state, verified purchase, and abuse controls if needed.
- routes/wishlist.js: Fine as secondary feature, but verify tenant-safe behavior and shopper identity consistency.
- controllers/wishlist.js: Review consistency with auth user shape.

Enterprise Gap Workstreams Not Yet Represented Well in Files

- schemas/tenant.js: Add Markets as first-class entities if Shopify-level comparison matters.
- schemas/tenant.js: Add B2B company, company location, buyer role, catalog, and payment-term structures if enterprise B2B is in scope.
- schemas/store/product.js: Add a metafield/metaobject-like extensibility layer or connect products to a generalized custom-data system.
- services: Introduce an event/workflow engine if you want Flow-like automation; this does not yet exist as a concrete file set.
- schemas/store/order.js: Add fulfillment-order, return, and shipment models if you want Shopify-like logistics depth; those appear effectively
  absent today.

Immediate Bug List To Patch First

- services/product.js: Fix update/delete ID bugs and missing awaits.
- controllers/upload.js: Import mongoose; fix req.user.id; enforce delete ownership.
- index.js: Fix webhook body parsing and CORS/CSP configuration.
- routes/domain.js: Add missing admin checks.
- services/order.js: Replace fake transaction boundaries with real session-bound writes.
