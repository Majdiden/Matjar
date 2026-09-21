/**
 * Read-only impersonation guard — decision table for the pure helper that
 * middlewares/auth.js applies to every impersonated request.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isReadOnlyImpersonationBlocked, checkImpersonationGrant } from "../../middlewares/auth.js";

const GRANT = "6a96e8a1b11c4ed4b0460421";

describe("isReadOnlyImpersonationBlocked", () => {
  it("never blocks a full-access grant", () => {
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      assert.equal(isReadOnlyImpersonationBlocked({ readOnly: false, method, path: "/api/products", grantId: GRANT }), false);
    }
  });

  it("allows safe methods under a read-only grant", () => {
    for (const method of ["GET", "HEAD", "OPTIONS", "get", "head"]) {
      assert.equal(isReadOnlyImpersonationBlocked({ readOnly: true, method, path: "/api/orders", grantId: GRANT }), false);
    }
  });

  it("blocks every mutating method under a read-only grant", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "post", "Patch"]) {
      assert.equal(isReadOnlyImpersonationBlocked({ readOnly: true, method, path: "/api/products", grantId: GRANT }), true, method);
    }
  });

  it("allows only the operator's own exit-self call as a mutation", () => {
    assert.equal(
      isReadOnlyImpersonationBlocked({ readOnly: true, method: "POST", path: `/api/impersonation/${GRANT}/exit-self`, grantId: GRANT }),
      false
    );
    assert.equal(
      isReadOnlyImpersonationBlocked({ readOnly: true, method: "POST", path: `/api/impersonation/${GRANT}/exit-self/`, grantId: GRANT }),
      false,
      "trailing slash is normalised"
    );
    // A different grant id, a different verb, or a different sub-path is still blocked.
    assert.equal(
      isReadOnlyImpersonationBlocked({ readOnly: true, method: "POST", path: `/api/impersonation/000000000000000000000000/exit-self`, grantId: GRANT }),
      true
    );
    assert.equal(
      isReadOnlyImpersonationBlocked({ readOnly: true, method: "DELETE", path: `/api/impersonation/${GRANT}/exit-self`, grantId: GRANT }),
      true
    );
    assert.equal(
      isReadOnlyImpersonationBlocked({ readOnly: true, method: "POST", path: `/api/impersonation/${GRANT}/approve`, grantId: GRANT }),
      true
    );
    assert.equal(
      isReadOnlyImpersonationBlocked({ readOnly: true, method: "POST", path: `/api/impersonation/${GRANT}/exit-self`, grantId: null }),
      true,
      "no grant id → nothing is exempt"
    );
  });

  it("treats a missing method as GET and missing path as blocked-on-write", () => {
    assert.equal(isReadOnlyImpersonationBlocked({ readOnly: true }), false);
    assert.equal(isReadOnlyImpersonationBlocked({ readOnly: true, method: "POST" }), true);
  });
});

describe("checkImpersonationGrant (shared by authenticate + optionalAuth)", () => {
  const SUPPORT = "6a96e8a1b11c4ed4b0460422";
  const future = new Date(Date.now() + 60_000);
  const modelsWith = (grant) => ({
    ImpersonationGrant: { findById: () => ({ select: () => ({ lean: async () => grant }) }) },
  });
  const decoded = { impersonation: { grantId: GRANT, supportUserId: SUPPORT } };

  it("returns null for a token without an impersonation claim", async () => {
    assert.equal(await checkImpersonationGrant({ models: modelsWith(null), method: "POST", path: "/x" }, { userId: "u" }), null);
  });

  it("blocks (401 impersonation_ended) when the grant is revoked, expired or belongs to another operator", async () => {
    const cases = [
      null,
      { status: "ended", sessionExpiresAt: future, supportUserId: SUPPORT },
      { status: "active", sessionExpiresAt: new Date(Date.now() - 1), supportUserId: SUPPORT },
      { status: "active", sessionExpiresAt: future, supportUserId: "000000000000000000000000" },
    ];
    for (const g of cases) {
      const r = await checkImpersonationGrant({ models: modelsWith(g), method: "GET", path: "/api/orders" }, decoded);
      assert.equal(r.error?.status, 401);
      assert.equal(r.error?.code, "impersonation_ended");
    }
  });

  it("blocks mutations (403 IMPERSONATION_READ_ONLY) on a read-only grant — the optionalAuth storefront path included", async () => {
    const grant = { status: "active", sessionExpiresAt: future, supportUserId: SUPPORT, readOnly: true, ticket: "T-1" };
    const r = await checkImpersonationGrant({ models: modelsWith(grant), method: "POST", path: "/storefront/orders" }, decoded);
    assert.equal(r.error?.status, 403);
    assert.equal(r.error?.code, "IMPERSONATION_READ_ONLY");
    const ok = await checkImpersonationGrant({ models: modelsWith(grant), method: "GET", path: "/storefront/orders" }, decoded);
    assert.deepEqual(ok, { grantId: GRANT, supportUserId: SUPPORT, ticket: "T-1", readOnly: true });
  });

  it("treats a missing readOnly flag as read-only (fail closed)", async () => {
    const grant = { status: "active", sessionExpiresAt: future, supportUserId: SUPPORT };
    const r = await checkImpersonationGrant({ models: modelsWith(grant), method: "DELETE", path: "/api/products/1" }, decoded);
    assert.equal(r.error?.code, "IMPERSONATION_READ_ONLY");
  });
});
