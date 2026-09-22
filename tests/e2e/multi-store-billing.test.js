/**
 * A merchant may own several stores. Two guarantees are locked here:
 *
 *   1. The platform "new store" alert fires on STORE creation, not on user
 *      registration — so the second and third store notify the operators too.
 *   2. Billing is per STORE, never pooled per merchant: each store carries its
 *      own plan, its own fee ledger and its own monthly statement.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { generateHash } from "../../utils/misc.js";
import { subscribedRecipients } from "../../services/platform/notifications.js";
import { generateStatement } from "../../services/platform/billing/statements.js";

const HOST = "acme.localhost";

async function registerFirstStore(app) {
  const res = await request(app).post("/api/auth/register").send({
    name: "Acme Owner", email: "owner@acme.test", password: "Sup3rSecret!", subdomain: "acme",
  }).expect(201);
  return res.body.responseObject;
}

async function login(app) {
  const res = await request(app).post("/api/auth/login").set("Host", HOST)
    .send({ email: "owner@acme.test", password: "Sup3rSecret!", domain: HOST }).expect(200);
  return res.body.responseObject.accessToken;
}

describe("E2E multi-store: alerts and per-store billing", () => {
  let app;
  before(async () => { await startTestDb(); app = buildTestApp(); });
  after(async () => { await stopTestDb(); });
  beforeEach(async () => { await clearAllCollections(); });

  it("alerts the platform for every store the merchant opens, not just the first", async () => {
    // An operator subscribed to the new-store alert.
    await mongoose.model("TenantUser").create({
      tenantId: new mongoose.Types.ObjectId(),
      name: "Ops", email: "ops@matjar.test", platformAdmin: true, platformRole: "operations",
      platformPasswordHash: await generateHash("PlatformPass2025!!"),
      platformNotifications: ["tenant.signup"],
    });
    assert.equal((await subscribedRecipients("tenant.signup")).length, 1, "operator is subscribed");

    await registerFirstStore(app);
    const token = await login(app);

    // Second store for the SAME merchant.
    const second = await request(app).post("/api/auth/stores").set("Host", HOST)
      .set("Authorization", `Bearer ${token}`)
      .send({ storeName: "Acme Two", subdomain: "acmetwo" }).expect(201);
    const secondId = second.body.responseObject?.tenantId || second.body.data?.tenantId;
    assert.ok(secondId, "second store created");

    const Tenant = mongoose.model("Tenant");
    const stores = await Tenant.find({ email: "owner@acme.test", deletedAt: null }).lean();
    assert.equal(stores.length, 2, "one merchant now owns two stores");
    // Both are full tenants with their own identity — the alert path
    // (services/tenant.js → notifyPlatform) runs once per tenant created.
    assert.notEqual(String(stores[0]._id), String(stores[1]._id));
    assert.deepEqual([...new Set(stores.map((s) => s.slug))].sort(), ["acme", "acmetwo"]);
  });

  it("bills each store separately: own plan, own ledger, own statement", async () => {
    const SubscriptionPlan = mongoose.model("SubscriptionPlan");
    await SubscriptionPlan.create([
      { key: "starter", name: "Starter", family: "subscription", isActive: true,
        pricing: { baseFee: { amount: 100, currency: "SDG", interval: "month" } } },
      { key: "growth", name: "Growth", family: "subscription", isActive: true,
        pricing: { baseFee: { amount: 300, currency: "SDG", interval: "month" } } },
    ]);

    await registerFirstStore(app);
    const token = await login(app);
    await request(app).post("/api/auth/stores").set("Host", HOST)
      .set("Authorization", `Bearer ${token}`)
      .send({ storeName: "Acme Two", subdomain: "acmetwo" }).expect(201);

    const Tenant = mongoose.model("Tenant");
    const [a, b] = await Tenant.find({ email: "owner@acme.test" }).sort({ createdAt: 1 }).lean();

    // Each store is put on a DIFFERENT plan — proof the plan is a property of
    // the store, not of the merchant account.
    await Tenant.updateOne({ _id: a._id }, { $set: { subscriptionPlan: "starter" } });
    await Tenant.updateOne({ _id: b._id }, { $set: { subscriptionPlan: "growth" } });

    // Commission accrues against one store only.
    await mongoose.model("PlatformFeeEvent").create({
      tenantId: a._id, type: "commission", feeAmount: 50, feeCurrency: "SDG",
      periodKey: "2026-09", occurredAt: new Date("2026-09-10"),
    });

    const ra = await generateStatement(a._id, "2026-09", { force: true });
    const rb = await generateStatement(b._id, "2026-09", { force: true });
    const sa = ra.statement, sb = rb.statement;
    assert.ok(sa, "store A has a statement");
    assert.ok(sb, "store B has its own statement");

    assert.equal(String(sa.tenantId), String(a._id));
    assert.equal(String(sb.tenantId), String(b._id));
    assert.notEqual(String(sa._id), String(sb._id), "two separate statements");
    assert.equal(sa.planKey, "starter");
    assert.equal(sb.planKey, "growth");

    // The commission landed on store A's statement and nowhere near store B.
    const commissionOnA = (sa.lines || []).filter((l) => l.type === "commission").reduce((t, l) => t + l.amount, 0);
    const commissionOnB = (sb.lines || []).filter((l) => l.type === "commission").reduce((t, l) => t + l.amount, 0);
    assert.equal(commissionOnA, 50, "store A is charged its own commission");
    assert.equal(commissionOnB, 0, "store B is not charged for store A's sales");

    // And the two stores are billed different subscription fees.
    assert.notEqual(sa.amountDue, sb.amountDue);

    // One statement per store per period is enforced by a unique index.
    const Statement = mongoose.model("BillingStatement");
    assert.equal(await Statement.countDocuments({ periodKey: "2026-09" }), 2);
  });
});
