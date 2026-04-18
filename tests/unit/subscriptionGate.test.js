/**
 * subscriptionGate unit tests — pure middleware logic, no DB.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { subscriptionGate } from "../../middlewares/subscriptionGate.js";

function mockRes() {
  const res = {};
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

describe("subscriptionGate", () => {
  it("passes through when req.tenant is absent", () => {
    let called = false;
    subscriptionGate({ method: "POST" }, mockRes(), () => { called = true; });
    assert.equal(called, true);
  });

  it("allows GET for suspended tenant (read-only mode)", () => {
    let called = false;
    subscriptionGate(
      { method: "GET", tenant: { subscriptionStatus: "suspended", suspendedAt: new Date() } },
      mockRes(),
      () => { called = true; }
    );
    assert.equal(called, true);
  });

  it("blocks POST for suspended tenant with 402", () => {
    const res = mockRes();
    let called = false;
    subscriptionGate(
      { method: "POST", tenant: { subscriptionStatus: "suspended", suspendedAt: new Date() } },
      res,
      () => { called = true; }
    );
    assert.equal(called, false);
    assert.equal(res.statusCode, 402);
    assert.equal(res.body.code, "TENANT_SUSPENDED");
  });

  it("blocks POST with 410 when tenant is scheduled for deletion", () => {
    const res = mockRes();
    let called = false;
    subscriptionGate(
      { method: "PUT", tenant: { subscriptionStatus: "active", deletionScheduledAt: new Date() } },
      res,
      () => { called = true; }
    );
    assert.equal(called, false);
    assert.equal(res.statusCode, 410);
    assert.equal(res.body.code, "TENANT_DELETING");
  });

  it("blocks POST with 402 when cancelled", () => {
    const res = mockRes();
    let called = false;
    subscriptionGate(
      { method: "POST", tenant: { subscriptionStatus: "cancelled" } },
      res,
      () => { called = true; }
    );
    assert.equal(called, false);
    assert.equal(res.statusCode, 402);
    assert.equal(res.body.code, "TENANT_CANCELLED");
  });

  it("allows POST for active tenant", () => {
    let called = false;
    subscriptionGate(
      { method: "POST", tenant: { subscriptionStatus: "active" } },
      mockRes(),
      () => { called = true; }
    );
    assert.equal(called, true);
  });
});
