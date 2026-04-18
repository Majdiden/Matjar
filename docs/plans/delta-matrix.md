> **Stale as of 2026-04-18** — references `middlewares/assetResolver.js` which no longer exists. Kept for historical context.

| Original Finding                                         | Status | Evidence      | Remaining Work |
| -------------------------------------------------------- | ------ | ------------- | -------------- |
| Refresh tokens were stateless and logout was ineffective | Fixed  | Refresh token |

model exists in schemas/store/refreshToken.js, rotation/revocation implemented in
services/auth.js, logout revokes family in controllers/auth.js | Add tests for
token reuse and family revocation |
| Auth middleware did not revalidate user state | Fixed | Active-user recheck
added in middlewares/auth.js | Consider token versioning for password-change
invalidation |
| Avatar upload used wrong auth field | Fixed | req.user.userId is used in
controllers/upload.js | None beyond tests |
| Missing mongoose import in upload controller | Fixed | Import present in
controllers/upload.js | None beyond tests |
| Generic upload preset selection was user-controlled | Fixed | Allowed presets
are now restricted in controllers/upload.js | Add tests for rejected invalid
presets |
| Upload validation trusted MIME type only | Not checked in latest pass | Not
rescanned deeply in this pass | Re-audit middlewares/upload.js for content
sniffing and SVG policy |
| Domain admin routes lacked admin authorization | Fixed | isAdmin applied in
routes/domain.js | None beyond tests |
| CSP was disabled globally | Fixed | Helmet CSP enabled in index.js | Tighten CSP
over time; remove unsafe-inline where possible |
| CORS used wildcard with credentials | Partial | Logic changed in index.js, but
config still defaults to _ in config/index.js and app now reflects request origin
when _ is set | Change config policy so production requires explicit origin
allowlist |
| Unknown storefront hosts could fall through and 500 | Fixed | requireTenant
added and used in routes/storefront.js | Consider similar protection for other
tenant-required route groups |
| Asset resolver silently fell back to default theme | Partial | Tenant-required
storefront routes are protected, but asset deletion/asset ownership still rely on
heuristics and theme fallback behavior was not fully re-audited | Re-audit
middlewares/assetResolver.js and middlewares/storefrontServe.js for explicit
fallback policy and observability |
| Theme/asset path resolution was not fully validated | Not checked in latest pass
| Not rescanned deeply in this pass | Re-verify theme slug validation and file-
serving constraints |
| Order creation/cancel used fake transactions | Partial | Session-aware stock
decrement/increment and order creation now exist in services/order.js,
repositories/order.js, repositories/product.js | Verify every repo write involved
in order/cancel path actually uses the session; add transactional tests |
| Stock decrement used read-modify-write | Fixed | Atomic findOneAndUpdate stock
guards now exist in repositories/product.js | Add concurrency tests |
| No authoritative pricing pipeline | Fixed | Centralized quote builder in
services/checkout.js, consumed in services/order.js, tests added in tests/unit/
checkout.test.js | Expand tests to tax/shipping/discount edge cases |
| Shipping/tax/discount services were disconnected from checkout | Fixed | Quote
builder now calls them from services/checkout.js | Keep them consistent with
settings/market evolution |
| Discount logic ignored applicability and per-user limits | Fixed |
validateDiscount() now checks product/category scope and per-user redemptions in
services/discount.js | Add stacking rules and broader promotion classes if needed
|
| Discount usage was not incremented atomically | Fixed | applyDiscount() added
and called during order placement in services/discount.js and services/order.js |
Add transaction tests under concurrency |
| Invalid discount codes were silently ignored at order placement | Fixed |
priceCheckout() now returns discountError and order placement rejects it in
services/checkout.js and services/order.js | None beyond tests |
| Storefront cart ignored variant pricing and stock | Fixed | Variant resolution,
price override, variant stock checks, and variant snapshots exist in controllers/
storefrontCart.js | Add tests for mixed variant and non-variant carts |
| Cart lines did not snapshot price | Fixed | unitPrice, lineTotal,
variantOptions, variantSku, isPreorder added to schemas/store/cart.js and
populated in controllers/storefrontCart.js | Add repricing policy if product
prices change after cart add |
| Variant pricing was lost from cart to order | Fixed | Order creation now
resolves variant and passes it through to quote/order lines in services/order.js |
Add test covering variant order placement |
| Order schema was too thin for fulfillment/preorder/history | Fixed | Order lines
now include variant/preorder/fulfilled state; fulfillments and history exist in
schemas/store/order.js | Build more service coverage/tests around new schema
features |
| Product update/delete used wrong param and missing awaits | Partial |
updateProduct() is now correct in services/product.js | deleteProduct() still
passes raw ID into repository expecting a filter object; fix services/product.js
or repositories/product.js |
| Product validator allowed missing category while schema required it | Not
checked in latest pass | Not rescanned in this pass | Re-verify validators/
product.validator.js against schemas/store/product.js |
| Inventory duplicated Product.stock and Inventory as two authorities | Partial |
Inventory controller now treats Product.stock as authoritative for dashboard reads
in controllers/inventory.js | Legacy Inventory collection/repo still exists and is
still synced secondarily; complete the transition or formalize separation |
| Inventory adjustment silently floored negatives | Partial | Controller now
rejects insufficient stock during adjustments in controllers/inventory.js | Legacy
repo behavior in repositories/inventory.js still has Math.max(0, ...); clean up
old path |
| Settings only supported flat shipping/tax | Fixed | Structured shipping/tax
support added in controllers/settings.js and schemas/tenant.js | Add validation
for shipping zones and tax states if used |
| Customer/admin model was too thin | Partial | Not deeply rescanned, but
enterprise primitives now exist elsewhere | Re-audit controllers/customer.js and
schemas/store/user.js for shopper-vs-staff separation |
| Store setup state was only in memory | Fixed | Persisted in tenant setupStatus
in schemas/tenant.js and services/storeSetup.js | Add retry/job orchestration if
setup becomes long-running |
| Asset deletion was arbitrary by URL | Partial | New tenant-path check added in
controllers/upload.js | Persist asset ownership metadata and authorize against
records, not URL substrings |
| Logging was noisy and unstructured | Partial | logger introduced in some places
like middlewares/auth.js and services/storeSetup.js | Remove remaining console.\*
calls and standardize logging everywhere |
| No audit log for sensitive actions | Partial | Audit log route/model now exist
in routes/index.js and schemas/store/auditLog.js | Verify sensitive mutations
actually emit audit records |
| No Markets model | Fixed | Market model and routes now exist in schemas/store/
market.js and routes/market.js | Integrate market selection into storefront
pricing/catalog flow if not already done |
| No B2B company/location/payment terms model | Fixed | Company model and routes
now exist in schemas/store/company.js and routes/company.js | Integrate company
pricing/terms into checkout and customer accounts |
| No generalized custom-data system | Fixed | Custom field model and routes exist
in schemas/store/customField.js and routes/customField.js | Add service-level
enforcement and resource-specific APIs if needed |
| No Flow-like automation engine | Not fixed | Event/webhook files exist, but scan
still shows placeholder behavior in services/webhookDispatcher.js | Build a real
event bus/workflow engine if this is still in scope |
| Domain/provider integrations were placeholders | Not fixed | Placeholder/TODO
remains in services/domainRegistration.js | Implement real provider integration or
mark feature as non-production |
| Test coverage was minimal/nonexistent | Partial | Real test command exists in
package.json, checkout unit tests exist in tests/unit/checkout.test.js | Expand
coverage to auth, order placement, inventory, tenant resolution, uploads |
