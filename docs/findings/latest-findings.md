1. Domain Read/Utility Routes Are Still Customer-Accessible
   Current state: domain mutations are now protected with isManager, but some sensitive domain reads/utilities are
   only behind authenticate.

Affected routes:

- routes/domain.js:61
- routes/domain.js:68
- routes/domain.js:147

Current behavior:

router.use(authenticate);

router.get("/info", getDomainInfo);
router.get("/verification-instructions", getVerificationInstructions);
router.get("/dns-check", checkDNSPropagation);

Problem:
Any authenticated user for the tenant, including a storefront customer, can access merchant domain
configuration. That can expose custom domain state, DNS verification instructions, verification record values,
SSL/DNS state, primary domain settings, and internal provisioning status.

Why this matters:
Domain configuration is store administration. Customers should never see it. Verification instructions are
especially sensitive operational data, even if TXT records are technically public after publication.

Recommended fix:
Gate all protected domain routes with merchant role middleware. Minimum should be isManager; stricter policy
would be isAdmin for mutations and isManager for reads.

Pragmatic patch:

router.get("/info", isManager, getDomainInfo);
router.get("/verification-instructions", isManager, getVerificationInstructions);

router.patch("/subdomain", isManager, updateSubdomain);
router.post("/custom", isManager, addCustomDomain);
router.post("/custom/verify", isManager, verifyCustomDomain);
router.delete("/custom", isManager, removeCustomDomain);
router.post("/custom/ssl", isManager, enableSSL);
router.patch("/primary", isManager, setPrimaryDomain);

router.get("/dns-check", isManager, checkDNSPropagation);

Better enterprise policy:

- domains.read: admin, manager
- domains.write: admin only, or admin + manager if you want managers to own storefront ops
- domains.verify: admin, manager
- domains.primary: admin only if changing canonical storefront host is considered high-risk

If you keep the current role model:

import { isAdmin, isManager } from "../middlewares/authorize.js";

router.get("/info", isManager, getDomainInfo);
router.get("/verification-instructions", isManager, getVerificationInstructions);
router.get("/dns-check", isManager, checkDNSPropagation);

router.patch("/subdomain", isManager, updateSubdomain);
router.post("/custom", isManager, addCustomDomain);
router.post("/custom/verify", isManager, verifyCustomDomain);
router.delete("/custom", isManager, removeCustomDomain);
router.post("/custom/ssl", isManager, enableSSL);
router.patch("/primary", isManager, setPrimaryDomain);

If you move to named permissions:

router.get("/info", requirePermission("domains.read"), getDomainInfo);
router.get("/verification-instructions", requirePermission("domains.read"), getVerificationInstructions);
router.get("/dns-check", requirePermission("domains.read"), checkDNSPropagation);

router.patch("/subdomain", requirePermission("domains.write"), updateSubdomain);
router.post("/custom", requirePermission("domains.write"), addCustomDomain);
router.post("/custom/verify", requirePermission("domains.write"), verifyCustomDomain);
router.delete("/custom", requirePermission("domains.write"), removeCustomDomain);
router.post("/custom/ssl", requirePermission("domains.write"), enableSSL);
router.patch("/primary", requirePermission("domains.write"), setPrimaryDomain);

Required tests:

- Customer token gets 403 on GET /api/domains/info.
- Customer token gets 403 on GET /api/domains/verification-instructions.
- Customer token gets 403 on GET /api/domains/dns-check.
- Customer token gets 403 on every domain mutation route.
- Manager token succeeds on allowed domain routes.
- Anonymous user gets 401 on protected domain routes.
- Public availability checks still work anonymously:
  - GET /api/domains/check-subdomain
  - GET /api/domains/check-custom-domain

Acceptance criteria:

- No customer role can read or mutate domain configuration.
- Public domain availability endpoints remain public.
- Domain route policy is documented as admin-only or manager-allowed.
- Tests cover anonymous, customer, manager, and admin behavior.

2. Document-Level Populate Still Bypasses Tenant-Scoped Populate Guard
   Current state: query-level populate is improved. The scoped model wrapper now intercepts calls like:

req.models.Product.find(...).populate("category")

That is good because it can inject:

match: { tenantId: currentTenantId }

Affected wrapper:

- utils/scopedModel.js:77

Remaining problem:
Some code uses document-level populate:

await cart.populate("items.product");
await order.populate("user", "name email");

These calls happen on an already-returned Mongoose document. They do not go through the scoped model query
wrapper, so your automatic populate guard does not run.

Affected examples:

- controllers/storefrontCart.js:213
- controllers/storefrontCart.js:343
- controllers/storefrontCart.js:412
- services/order.js:1020
- services/order.js:1192

Why this matters:
If a cart/order/review document ever contains a cross-tenant ObjectId because of import corruption, migration
bugs, manual DB edits, or a missed ownership check, doc.populate() can load the referenced record from another
tenant.

This is a reference-integrity issue. Tenant isolation is not only about root document queries. It also requires
every referenced document to belong to the same tenant.

Recommended fix option A: replace document populates with scoped re-query.
Instead of:

await cart.populate("items.product");

Use:

const cart = await req.models.Cart.findById(cart.\_id)
.populate("items.product");

Because this goes through req.models.Cart.findById(), your query populate wrapper can inject tenant matching.

For cart updates:

await cart.save();

const populatedCart = await req.models.Cart.findById(cart.\_id)
.populate("items.product");

return populatedCart;

Recommended fix option B: explicit populate match.
If you keep document populate, add explicit tenant matching:

await cart.populate({
path: "items.product",
match: { tenantId: req.tenantId },
});

For order user populate:

await order.populate({
path: "user",
select: "name email",
match: { tenantId: order.tenantId },
});

Recommended fix option C: add a helper.
Create a helper so developers do not forget the match:

export function tenantPopulate(path, tenantId, select = undefined, extra = {}) {
return {
path,
...(select ? { select } : {}),
...extra,
match: {
...(extra.match || {}),
tenantId,
},
};
}

Usage:

await cart.populate(tenantPopulate("items.product", req.tenantId));
await order.populate(tenantPopulate("user", order.tenantId, "name email"));

Recommended fix option D: avoid populate for critical flows.
For checkout/order creation, explicit scoped lookups are safer than populate:

const product = await req.models.Product.findById(productId);
if (!product) throw new APIError("Product not found", 404);

This is best for checkout, inventory, payments, fulfillment, and order state transitions.

Required tests:

- Seed Tenant A cart with a Tenant B product ObjectId by direct DB write.
- Fetch Tenant A cart.
- Assert Tenant B product is not populated or request fails safely.
- Seed Tenant A order with a Tenant B user/product reference.
- Fetch Tenant A order.
- Assert Tenant B user/product is not populated.
- Add tests for query-level populate and document-level populate separately.
- Add a regression test that fails if doc.populate("items.product") is reintroduced without tenant match.

Acceptance criteria:

- No tenant-owned populate happens without tenant matching.
- Document-level populates are eliminated or explicitly tenant-matched.
- Cross-tenant referenced ObjectIds do not leak referenced documents.
- Tests cover corrupted reference scenarios.

3. Protected API Host/Token Mismatch Policy Is Still Ambiguous
   Current state:

- Public host-bound routes now behave better because optionalAuth does not overwrite host-resolved tenant
  context.
- Strict authenticated routes still derive tenant context from the JWT tenant, not the Host header.

Relevant files:

- server/route.config.js:10
- middlewares/auth.js:29
- middlewares/auth.js:80

Current behavior:
Request:

Host: bravo.localhost
Authorization: Bearer token_for_alpha
GET /api/products

Depending on middleware order, authenticated dashboard/API routes can end up scoped to Alpha from the token
instead of Bravo from the host.

This is not necessarily a data leak because Tenant B data is not returned. But it is ambiguous product
behavior.

Two valid policies exist.

Policy A: token-scoped dashboard APIs.
This means the token decides the tenant. Host is just transport. If token is Alpha, request sees Alpha, even on
Bravo host.

Pros:

- Simpler API client behavior.
- Dashboard can call one API domain without relying on store host.
- Strong data isolation if token scoping is correct.

Cons:

- Host mismatch can confuse debugging.
- A user on the wrong tenant domain may still operate on the token tenant.
- Does not match the acceptance criterion “token issued for tenant A rejected on tenant B host.”

Policy B: host-bound dashboard APIs.
This means both token and Host must agree. If token is Alpha and Host resolves to Bravo, reject.

Pros:

- Clear tenant boundary.
- Matches enterprise expectation for tenant-specific domains.
- Prevents accidental admin work on the wrong store.

Cons:

- Requires careful handling for central dashboard domains.
- Requires platform/admin domains to bypass or explicitly choose tenant context.

Recommended enterprise approach:
Use both modes explicitly:

- Storefront/public routes: host-bound.
- Tenant dashboard on store domain: host + token must match.
- Central dashboard domain: token-bound, with explicit tenant selector.
- Platform admin domain: separate platform-admin auth/audience.

Implementation pattern:
Add an auth option:

export const authenticate = ({ requireHostTenantMatch = false } = {}) => async (req, res, next) => {
...
};

Then:

if (requireHostTenantMatch && req.tenantId && String(req.tenantId) !== String(decoded.tenantId)) {
return res.status(403).json({
success: false,
message: "Token tenant does not match requested tenant.",
});
}

But be careful: current authenticate sets req.tenantId from the token before checking. You need to capture the
existing host-resolved value first:

const hostTenantId = req.tenantId ? String(req.tenantId) : null;
const tokenTenantId = String(decoded.tenantId);

if (requireHostTenantMatch && hostTenantId && hostTenantId !== tokenTenantId) {
return res.status(403).json({ success: false, message: "Tenant mismatch." });
}

Then only after that:

req.tenantId = tenant.\_id;
req.tenant = tenant;
req.models = createScopedModels(mongoose.connection, tenant.\_id);

Route usage:

router.use(authenticate({ requireHostTenantMatch: true }));

Or split middleware:

export const requireTokenMatchesResolvedTenant = (req, res, next) => {
if (req.tenantId && req.user?.tenantId && String(req.tenantId) !== String(req.user.tenantId)) {
return res.status(403).json({ success: false, message: "Tenant mismatch." });
}
next();
};

Required tests:

- Host: bravo.localhost + tokenA on public product list should not show Alpha products.
- Host: bravo.localhost + tokenA on authenticated dashboard API should either:
  - return 403 if host-bound policy is chosen, or
  - return Alpha data if token-scoped policy is chosen and documented.
- Host: alpha.localhost + tokenA succeeds.
- Central dashboard host behavior is explicitly tested if you support it.
- Storefront customer token from Tenant A is ignored or rejected on Tenant B storefront.

Acceptance criteria:

- Product rule is documented.
- Tests match the chosen product rule.
- Middleware behavior cannot silently switch tenant context after host resolution unless the route explicitly
  allows token-scoped mode.
- The stale cross-tenant test name/comment is corrected.

4. Cross-Tenant Token Test Is Stale And Gives False Confidence
   Current test:

- tests/e2e/cross-tenant-isolation.test.js:247

Problem:
The test says:

Tenant A's token cannot access Tenant B's dashboard scope

But the request does not set:

.set("Host", "bravo.localhost")

So it is not actually testing Tenant B host scope. It only tests that tokenA does not see Bravo data when
making a normal request.

Current test behavior:

const resProducts = await request(app)
.get("/api/products")
.set("Authorization", `Bearer ${tokenA}`)
.expect(200);

This is useful, but the name/comment is misleading.

Recommended replacement:
Split it into two tests.

Test 1: token-scoped API does not leak other tenant data.

it("Tenant A token only sees Tenant A data on token-scoped API requests", async () => {
const res = await request(app)
.get("/api/products")
.set("Authorization", `Bearer ${tokenA}`)
.expect(200);

    assertNoBravoProducts(res);

});

Test 2: mismatched host/token behavior.
If choosing host-bound rejection:

it("Tenant A token is rejected on Tenant B host for protected tenant APIs", async () => {
await request(app)
.get("/api/products")
.set("Host", "bravo.localhost")
.set("Authorization", `Bearer ${tokenA}`)
.expect(403);
});

If choosing token-scoped protected APIs:

it("Protected APIs are token-scoped even when Host points to another tenant", async () => {
const res = await request(app)
.get("/api/products")
.set("Host", "bravo.localhost")
.set("Authorization", `Bearer ${tokenA}`)
.expect(200);

    assertShowsAlphaOnly(res);

});

Also add public optional-auth mismatch test:

it("Tenant A token on Tenant B public storefront does not rescope the host tenant", async () => {
const res = await request(app)
.get("/storefront/products")
.set("Host", "bravo.localhost")
.set("Authorization", `Bearer ${tokenA}`)
.expect(200);

    assertShowsBravoOnly(res);

});

Acceptance criteria:

- Test names describe actual behavior.
- At least one test explicitly sets a mismatched Host header.
- Optional-auth host-bound behavior is tested.
- Strict-auth protected behavior is tested according to the chosen policy.

Suggested Fix Order

1. Gate all domain read/utility routes with isManager.
2. Fix or remove document-level populates.
3. Decide protected API host/token mismatch policy.
4. Update authenticate and tests to match that policy.
5. Rename/split stale cross-tenant token tests.
6. Add corrupted-reference tests for populate/reference integrity.
7. Rerun:

node --test tests/e2e/cross-tenant-isolation.test.js
node --test tests/e2e/theme-gating.test.js
node --test tests/e2e/customer-auth.test.js

This will close the current enforcement gaps around business roles and multi-tenancy.
