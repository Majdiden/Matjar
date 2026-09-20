/**
 * Tenant lifecycle transition table + activity label builder — pure logic.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LIFECYCLE_STATES,
  LIFECYCLE_TRANSITIONS,
  canTransition,
  deriveLifecycleState,
  lifecycleUpdate,
} from "../../services/tenantLifecycle.js";
import { buildActivityLabel, humanizeAction } from "../../services/platform/activity.js";

describe("tenant lifecycle transitions", () => {
  it("allows the documented happy path and blocks the rest", () => {
    assert.equal(canTransition("pending", "onboarding"), true);
    assert.equal(canTransition("onboarding", "active"), true);
    assert.equal(canTransition("active", "suspended"), true);
    assert.equal(canTransition("suspended", "active"), true);
    assert.equal(canTransition("active", "closed"), true);
    assert.equal(canTransition("closed", "archived"), true);
    assert.equal(canTransition("closed", "active"), true, "deletion cancelled");
    assert.equal(canTransition("archived", "active"), false);
    assert.equal(canTransition("archived", "suspended"), false);
    assert.equal(canTransition("active", "archived"), false, "must close first");
    assert.equal(canTransition("active", "onboarding"), false);
  });

  it("rejects same-state (double suspend) and treats unknown 'from' as pending", () => {
    assert.equal(canTransition("active", "active"), false);
    assert.equal(canTransition("suspended", "suspended"), false);
    assert.equal(canTransition(undefined, "onboarding"), true);
  });

  it("every state in the table is a known state", () => {
    const known = new Set(Object.values(LIFECYCLE_STATES));
    for (const [from, tos] of Object.entries(LIFECYCLE_TRANSITIONS)) {
      assert.ok(known.has(from), from);
      for (const to of tos) assert.ok(known.has(to), to);
    }
  });

  it("derives the state from legacy flags", () => {
    assert.equal(deriveLifecycleState({ deletedAt: new Date() }), "archived");
    assert.equal(deriveLifecycleState({ deletionScheduledAt: new Date() }), "closed");
    assert.equal(deriveLifecycleState({ subscriptionStatus: "suspended" }), "suspended");
    assert.equal(deriveLifecycleState({ suspendedAt: new Date() }), "suspended");
    assert.equal(deriveLifecycleState({ subscriptionStatus: "cancelled" }), "closed");
    assert.equal(deriveLifecycleState({ isActive: false }), "closed");
    assert.equal(deriveLifecycleState({ setupStatus: { status: "in_progress" } }), "onboarding");
    assert.equal(deriveLifecycleState({ setupStatus: { status: "completed" }, isActive: true }), "active");
    assert.equal(deriveLifecycleState({}), "active");
  });

  it("lifecycleUpdate writes state + bounded history in one update", () => {
    const u = lifecycleUpdate("suspended", { reason: "fraud", changedBy: "ops@x.test" });
    assert.equal(u.$set["lifecycle.state"], "suspended");
    assert.equal(u.$set["lifecycle.reason"], "fraud");
    assert.equal(u.$set["lifecycle.changedBy"], "ops@x.test");
    assert.equal(u.$push["lifecycle.history"].$slice, -50);
    assert.equal(u.$push["lifecycle.history"].$each[0].state, "suspended");
  });
});

describe("activity labels", () => {
  it("humanises unknown actions instead of leaking identifiers", () => {
    assert.equal(humanizeAction("order.status_updated"), "Order status updated");
    assert.equal(
      buildActivityLabel({ source: "merchant", actor: "Ahmed", action: "weird.thing_here" }),
      "Ahmed: Weird thing here"
    );
  });

  it("uses templates for known actions and includes the reason", () => {
    assert.equal(
      buildActivityLabel({ source: "platform", actor: "ops@matjar.test", action: "tenant.suspend", reason: "Billing overdue" }),
      "ops@matjar.test suspended the store — Billing overdue"
    );
    assert.equal(
      buildActivityLabel({ source: "platform", actor: "ops@matjar.test", action: "tenant.unsuspend" }),
      "ops@matjar.test unsuspended the store"
    );
  });

  it("falls back to a neutral actor when none is recorded", () => {
    assert.match(buildActivityLabel({ source: "platform", action: "tenant.purge" }), /^A platform operator purged/);
    assert.match(buildActivityLabel({ source: "merchant", action: "product.created" }), /^Someone created a product/);
  });

  it("describes seeding by outcome", () => {
    assert.match(
      buildActivityLabel({ source: "platform", actor: "a@b.c", action: "tenant.seed_starter_content", after: { seeded: true, products: 6 } }),
      /seeded starter content \(6 products\)/
    );
    assert.match(
      buildActivityLabel({ source: "platform", actor: "a@b.c", action: "tenant.seed_starter_content", after: { seeded: false } }),
      /nothing seeded/
    );
  });
});

import { legacyFlagsFor, currentLifecycleState } from "../../services/tenantLifecycle.js";

describe("lifecycle legacy-flag sync (HIGH-2)", () => {
  it("every transition to active clears suspension + scheduled deletion", () => {
    const f = legacyFlagsFor("active");
    assert.equal(f.$set.subscriptionStatus, "active");
    assert.equal(f.$set.isActive, true);
    assert.deepEqual(Object.keys(f.$unset).sort(), ["deletionScheduledAt", "suspendedAt", "suspensionReason"]);
  });
  it("closing clears suspension fields and records the schedule", () => {
    const at = new Date("2030-01-01");
    const f = legacyFlagsFor("closed", { deletionScheduledAt: at });
    assert.equal(f.$set.subscriptionStatus, "cancelled");
    assert.equal(f.$set.isActive, false);
    assert.equal(f.$set.deletionScheduledAt, at);
    assert.deepEqual(Object.keys(f.$unset).sort(), ["suspendedAt", "suspensionReason"]);
  });
  it("suspending sets the reason and does not touch deletion fields", () => {
    const f = legacyFlagsFor("suspended", { reason: "fraud" });
    assert.equal(f.$set.suspensionReason, "fraud");
    assert.ok(f.$set.suspendedAt instanceof Date);
    assert.deepEqual(f.$unset, {});
  });
  it("archiving tombstones and drops the schedule", () => {
    const f = legacyFlagsFor("archived");
    assert.ok(f.$set.deletedAt instanceof Date);
    assert.deepEqual(Object.keys(f.$unset), ["deletionScheduledAt"]);
  });
});

describe("lifecycle origin checks (HIGH-1 / HIGH-4)", () => {
  it("derives the state for legacy rows without a lifecycle block", () => {
    assert.equal(currentLifecycleState({ subscriptionStatus: "active", setupStatus: { status: "completed" } }), "active");
    assert.equal(currentLifecycleState({ lifecycle: { state: "suspended" }, subscriptionStatus: "active" }), "suspended");
  });
  it("unsuspend is only valid from suspended; cancel-deletion only from closed", () => {
    assert.equal(canTransition("suspended", "active"), true);
    assert.equal(canTransition("closed", "active"), true);
    // the service adds an explicit origin guard on top of the table:
    assert.equal(canTransition("onboarding", "active"), true, "table allows; guard in unsuspendTenant rejects");
  });
  it("purge (archived) is only reachable from closed, regardless of force", () => {
    for (const from of ["pending", "onboarding", "active", "suspended"]) {
      assert.equal(canTransition(from, "archived"), false, from);
    }
    assert.equal(canTransition("closed", "archived"), true);
  });
});
