/**
 * Owner-configured platform email alerts: recipients come from
 * TenantUser.platformNotifications, suspended operators are skipped, and
 * bursty events collapse into one email per throttle window with a count.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { notifyPlatform, resetNotificationWindows } from "../../services/platform/notifications.js";

describe("platform email alerts", () => {
  before(async () => { await startTestDb(); });
  after(async () => { await stopTestDb(); });
  beforeEach(async () => { await clearAllCollections(); resetNotificationWindows(); });

  async function seedOperators() {
    const TenantUser = mongoose.model("TenantUser");
    const tenantId = new mongoose.Types.ObjectId();
    await TenantUser.create([
      { tenantId, name: "Owner", email: "owner@matjar.test", platformAdmin: true, platformRole: "owner", platformNotifications: ["tenant.signup", "system.request_error"] },
      { tenantId, name: "Ops", email: "ops@matjar.test", platformAdmin: true, platformRole: "operations", platformNotifications: ["tenant.signup"] },
      { tenantId, name: "Gone", email: "gone@matjar.test", platformAdmin: true, platformRole: "support", platformStatus: "suspended", platformNotifications: ["tenant.signup"] },
      { tenantId, name: "Quiet", email: "quiet@matjar.test", platformAdmin: true, platformRole: "support", platformNotifications: [] },
      { tenantId, name: "Merchant", email: "merchant@store.test", platformAdmin: false, platformNotifications: ["tenant.signup"] },
    ]);
  }

  it("emails exactly the active platform users subscribed to the event", async () => {
    await seedOperators();
    const sent = [];
    const r = await notifyPlatform("tenant.signup", { subject: "New store signup: Acme", lines: ["Store: Acme"], link: "/tenants/x" }, { sendEmailFn: async (m) => { sent.push(m); return { accepted: true }; } });
    assert.equal(r.sent, 2);
    assert.deepEqual(sent.map((m) => m.to).sort(), ["ops@matjar.test", "owner@matjar.test"]);
    assert.match(sent[0].subject, /^\[Matjar\] New store signup: Acme$/);
    assert.match(sent[0].text, /Store: Acme/);
    assert.match(sent[0].text, /\/tenants\/x/);
  });

  it("throttles bursty events and reports the suppressed count in the next email", async () => {
    await seedOperators();
    const sent = [];
    let t = 1_000_000;
    const opts = { sendEmailFn: async (m) => { sent.push(m); return { accepted: true }; }, now: () => t };
    const first = await notifyPlatform("system.request_error", { subject: "API 500", lines: ["GET /x → 500"] }, opts);
    assert.equal(first.sent, 1);
    for (let i = 0; i < 3; i += 1) {
      const r = await notifyPlatform("system.request_error", { subject: "API 500", lines: ["GET /x → 500"] }, opts);
      assert.equal(r.skipped, "throttled");
    }
    assert.equal(sent.length, 1);
    t += 16 * 60 * 1000; // past the 15-minute window
    const later = await notifyPlatform("system.request_error", { subject: "API 500", lines: ["GET /y → 500"] }, opts);
    assert.equal(later.sent, 1);
    assert.equal(sent.length, 2);
    assert.match(sent[1].text, /3 more occurrence\(s\) were suppressed/);
  });

  it("incidents always reach owner/operations/developer, plus anyone subscribed", async () => {
    await seedOperators();
    const TenantUser = mongoose.model("TenantUser");
    await TenantUser.create({ tenantId: new mongoose.Types.ObjectId(), name: "Dev", email: "dev@matjar.test", platformAdmin: true, platformRole: "developer" });
    await TenantUser.updateOne({ email: "quiet@matjar.test" }, { $set: { platformNotifications: ["incident.opened"] } });
    const sent = [];
    const r = await notifyPlatform("incident.opened", { subject: "Incident opened: x", lines: ["Severity: high"] }, { sendEmailFn: async (m) => { sent.push(m); return { accepted: true }; } });
    // owner + ops (role) + dev (role) + quiet (subscribed support); suspended 'gone' excluded even though ops-adjacent
    assert.equal(r.sent, 4);
    assert.deepEqual(sent.map((m) => m.to).sort(), ["dev@matjar.test", "ops@matjar.test", "owner@matjar.test", "quiet@matjar.test"]);
    assert.match(sent[0].text, /because of your platform role/);
  });

  it("never throws for unknown events or when nobody is subscribed", async () => {
    await seedOperators();
    assert.deepEqual(await notifyPlatform("nope.event", { subject: "x", lines: [] }), { sent: 0, skipped: "unknown_event" });
    const r = await notifyPlatform("system.job_failed", { subject: "x", lines: [] }, { sendEmailFn: async () => { throw new Error("must not be called"); } });
    assert.equal(r.skipped, "no_recipients");
  });
});
