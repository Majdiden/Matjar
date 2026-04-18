Current Overall Scan Findings

High severity:

- Customer users can mutate merchant/storefront configuration. routes/
  themeCustomization.js:27 only requires authenticate, so any authenticated
  customer can update theme settings, sections, custom CSS, publish/reset
  customization, etc. These should be isManager or isAdmin.
- Customer users can install/uninstall themes. routes/theme.js:40 authenticates,
  but routes/theme.js:43 and routes/theme.js:44 allow any logged-in user to
  install/uninstall tenant themes.
- Customer users can upload/delete store assets. routes/upload.js:27 only requires
  authentication, then product/category/logo/favicon/generic upload and delete
  routes are open to any tenant user. Avatar upload can stay user-level, but
  merchant assets should require isManager or narrower permissions.
- Storefront reviews are effectively broken because the route checks req.user.\_id,
  but auth middleware sets req.user.userId. See middlewares/auth.js:29 and routes/
  storefront.js:781. Authenticated customers will be treated as unauthenticated
  for review submission; the same \_id mismatch affects contact ticket user
  attachment at routes/storefront.js:749.
- Inventory settings endpoints use fields that do not exist on the Product schema.
  controllers/inventory.js:40, controllers/inventory.js:131, and controllers/
  inventory.js:140 use lowStockThreshold and trackInventory, but schemas/store/
  product.js:4 does not define them. Mongoose strict mode will ignore those
  updates, so the dashboard can appear to save inventory settings while nothing
  persists.

Medium severity:

- Storefront checkout quote underprices variant carts. Cart stores variantId,
  unitPrice, and variantOptions in schemas/store/cart.js:20, but quote building
  passes variant: item.variant || null at routes/storefront.js:605. There is no
  item.variant, so priceCheckout falls back to parent product price instead of
  variant price.
- Public /api/products routes can run without a tenant context. routes/
  product.js:23 uses optionalAuth, but the service assumes req.models exists at
  services/product.js:113. The storefront API has requireTenant, but the generic
  API product routes still need a tenant guard or explicit public behavior.
- Role model is inconsistent. schemas/store/user.js:35 allows only admin, manager,
  and customer, but routes/customer.js:13 and routes/review.js:14 authorize owner.
  This blocks intended access paths and makes enterprise permissions unclear.
- Access-token roles are not reloaded from the database. middlewares/auth.js:29
  trusts decoded.roles; it revalidates active status and tokenVersion, but not
  current roles. If a staff user is demoted and tokenVersion is not bumped, their
  old token keeps old privileges until expiry.
- Storefront password change does not bump tokenVersion. routes/storefront.js:557
  changes the password directly, unlike the centralized auth service that
  increments token version. Existing access tokens remain valid after customer
  password changes.

Reliability/build status:

- Backend tests pass, but coverage is very small: npm test runs only 3 checkout-
  pricing tests.
- Dashboard production build currently fails. Representative errors include
  unused/import issues at dashboard/src/components/layouts/DashboardLayout.tsx:28,
  missing NodeJS types at dashboard/src/components/SetupProgress.tsx:59, invalid
  component props at dashboard/src/pages/categories/Categories.tsx:312, product
  API/type mismatch at dashboard/src/pages/products/Products.tsx:71, and register
  payload mismatch at dashboard/src/pages/Register.tsx:114.

Confirmed improvements from the earlier report:

- Product delete bug is fixed in services/product.js:222.
- Legacy Inventory model is removed from model registration and scoped models.
- Upload deletion now uses tenant-scoped Asset rows instead of URL substring
  ownership checks.
- Checkout/order pricing, variant stock, preorder handling, order transactions,
  refresh-token storage, CSP, CORS production guard, and webhook raw-body ordering
  are materially improved from the first scan.
