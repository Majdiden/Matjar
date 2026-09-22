/**
 * The platform "new store" alert must fire for EVERY store a merchant opens,
 * including the second and third — a merchant may own several stores.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { generateHash } from "../../utils/misc.js";
import { getTestInbox, clearTestInbox } from "../../services/providers/email.js";

const HOST = "acme.localhost";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

describe("E2E new-store alert fires per store", () => {
  let app;
  before(async () => { await startTestDb(); app = buildTestApp(); });
  after(async () => { await stopTestDb(); });
  beforeEach(async () => { await clearAllCollections(); clearTestInbox(); });

  it("emails subscribed operators when an existing merchant opens another store", async () => {
    await mongoose.model("TenantUser").create({
      tenantId: new mongoose.Types.ObjectId(),
      name: "Ops", email: "ops@matjar.test", platformAdmin: true, platformRole: "operations",
      platformPasswordHash: await generateHash("PlatformPass2025!!"),
      platformNotifications: ["tenant.signup"],
    });

    // First store (plain registration).
    await request(app).post("/api/auth/register").send({
      name: "Acme Owner", email: "owner@acme.test", password: "Sup3rSecret!", subdomain: "acme",
    }).expect(201);
    await wait(400);
    const afterFirst = getTestInbox().filter((m) => /new store/i.test(m.subject || "")).length;
    assert.ok(afterFirst >= 1, `first store should alert operators (inbox: ${JSON.stringify(getTestInbox().map((m) => m.subject))})`);

    clearTestInbox();

    // Second store for the SAME merchant.
    const login = await request(app).post("/api/auth/login").set("Host", HOST)
      .send({ email: "owner@acme.test", password: "Sup3rSecret!", domain: HOST }).expect(200);
    await request(app).post("/api/auth/stores").set("Host", HOST)
      .set("Authorization", `Bearer ${login.body.responseObject.accessToken}`)
      .send({ storeName: "Acme Two", subdomain: "acmetwo" }).expect(201);
    await wait(400);

    const subjects = getTestInbox().map((m) => m.subject);
    const alerts = subjects.filter((s) => /new store/i.test(s || ""));
    assert.ok(alerts.length >= 1, `second store must alert operators too (inbox: ${JSON.stringify(subjects)})`);
    assert.match(alerts[0], /Acme Two/);
  });
});
