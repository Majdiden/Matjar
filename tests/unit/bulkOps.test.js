/**
 * Bulk tenant operations — allow-list and cap are enforced both by the zod
 * validator (request edge) and by the service guard (defence in depth).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bulkTenantsSchema, BULK_ACTIONS, BULK_MAX_TENANTS } from "../../validators/bulk.validator.js";
import { validateBulkRequest } from "../../services/platform/bulk.js";

const id = (n) => n.toString(16).padStart(24, "0");
const ids = (n) => Array.from({ length: n }, (_, i) => id(i + 1));
const parse = (body) => bulkTenantsSchema.safeParse({ body });

describe("bulk tenant actions — allow-list", () => {
  it("exposes exactly the five reversible actions and never purge/delete", () => {
    assert.deepEqual([...BULK_ACTIONS].sort(), ["add_to_program", "change_plan", "remove_from_program", "suspend", "unsuspend"]);
    for (const forbidden of ["purge", "delete", "close", "archive", "schedule_deletion"]) {
      assert.equal(parse({ action: forbidden, tenantIds: ids(1), reason: "cleanup" }).success, false, forbidden);
      assert.match(validateBulkRequest({ action: forbidden, tenantIds: ids(1) }) || "", /Unsupported/);
    }
  });

  it("requires action-specific params", () => {
    assert.equal(parse({ action: "add_to_program", tenantIds: ids(1), reason: "promo" }).success, false);
    assert.equal(parse({ action: "remove_from_program", tenantIds: ids(1), reason: "promo" }).success, false);
    assert.equal(parse({ action: "change_plan", tenantIds: ids(1), reason: "promo" }).success, false);
    assert.equal(parse({ action: "add_to_program", tenantIds: ids(1), reason: "promo", params: { programId: id(9) } }).success, true);
    assert.equal(parse({ action: "change_plan", tenantIds: ids(1), reason: "promo", params: { planKey: "Growth" } }).success, true);
    assert.equal(parse({ action: "suspend", tenantIds: ids(1), reason: "abuse" }).success, true);
  });

  it("requires a meaningful reason", () => {
    assert.equal(parse({ action: "suspend", tenantIds: ids(1), reason: "" }).success, false);
    assert.equal(parse({ action: "suspend", tenantIds: ids(1), reason: "ab" }).success, false);
    assert.equal(parse({ action: "suspend", tenantIds: ids(1) }).success, false);
  });
});

describe("bulk tenant actions — cap and shape", () => {
  it(`accepts up to ${BULK_MAX_TENANTS} ids and rejects more`, () => {
    assert.equal(BULK_MAX_TENANTS, 50);
    assert.equal(parse({ action: "suspend", tenantIds: ids(BULK_MAX_TENANTS), reason: "abuse wave" }).success, true);
    assert.equal(parse({ action: "suspend", tenantIds: ids(BULK_MAX_TENANTS + 1), reason: "abuse wave" }).success, false);
    assert.equal(validateBulkRequest({ action: "suspend", tenantIds: ids(BULK_MAX_TENANTS) }), null);
    assert.match(validateBulkRequest({ action: "suspend", tenantIds: ids(BULK_MAX_TENANTS + 1) }), /At most 50/);
  });

  it("rejects empty, duplicate and malformed ids", () => {
    assert.equal(parse({ action: "suspend", tenantIds: [], reason: "abuse" }).success, false);
    assert.equal(parse({ action: "suspend", tenantIds: [id(1), id(1)], reason: "abuse" }).success, false);
    assert.equal(parse({ action: "suspend", tenantIds: ["not-an-id"], reason: "abuse" }).success, false);
    assert.equal(parse({ action: "suspend", tenantIds: [{ $ne: null }], reason: "abuse" }).success, false);
    assert.match(validateBulkRequest({ action: "suspend", tenantIds: [] }), /No tenants/);
    assert.match(validateBulkRequest({ action: "suspend", tenantIds: [id(1), id(1)] }), /Duplicate/);
    assert.match(validateBulkRequest({ action: "suspend", tenantIds: "abc" }), /No tenants/);
  });

  it("normalises the plan key and defaults params", () => {
    const r = parse({ action: "change_plan", tenantIds: ids(2), reason: "migration", params: { planKey: "  GROWTH " } });
    assert.equal(r.success, true);
    assert.equal(r.data.body.params.planKey, "growth");
    const s = parse({ action: "suspend", tenantIds: ids(1), reason: "abuse" });
    assert.deepEqual(s.data.body.params, {});
  });
});

describe("bulk tenant actions — per-action scope", () => {
  it("mirrors the single-tenant routes: lifecycle, flags.write, billing.write", async () => {
    const { BULK_ACTION_SCOPE, BULK_SCOPES } = await import("../../controllers/platform/bulk.js");
    assert.deepEqual(BULK_ACTION_SCOPE, {
      suspend: "tenant.lifecycle",
      unsuspend: "tenant.lifecycle",
      add_to_program: "flags.write",
      remove_from_program: "flags.write",
      change_plan: "billing.write",
    });
    // Every allow-listed action has a scope, and nothing else does.
    assert.deepEqual(Object.keys(BULK_ACTION_SCOPE).sort(), [...BULK_ACTIONS].sort());
    assert.deepEqual([...BULK_SCOPES].sort(), ["billing.write", "flags.write", "tenant.lifecycle"]);
  });

  it("refuses change_plan for a lifecycle-only operator with 403 FORBIDDEN", async () => {
    const { runTenants } = await import("../../controllers/platform/bulk.js");
    const req = { body: { action: "change_plan", tenantIds: ids(1), reason: "promo", params: { planKey: "growth" } }, platformUser: { id: "p1", email: "ops@x", scopes: ["tenant.lifecycle"] } };
    let status = 0, body = null;
    const res = { status: (s) => { status = s; return res; }, json: (b) => { body = b; return res; } };
    await runTenants(req, res, (e) => { throw e; });
    assert.equal(status, 403);
    assert.equal(body.code, "FORBIDDEN");
    assert.deepEqual(body.missing, ["billing.write"]);
  });
});
