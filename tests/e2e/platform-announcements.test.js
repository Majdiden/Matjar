/**
 * Platform announcements (PBI 10-46): the platform sends a notification to
 * every store or one store; each staff member gets it through the channels
 * the sender picked and they keep switched on.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { generateHash } from "../../utils/misc.js";
import { getTestInbox, clearTestInbox } from "../../services/providers/email.js";
import { sendAnnouncement, measureAudience } from "../../services/platform/announcements.js";
import config from "../../config/index.js";

const PLATFORM_PASSWORD = "PlatformPass2025!!";

async function provisionTenant(app, slug, language) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: `${slug} owner`, storeName: `${slug} store`, email: `owner@${slug}.test`, password: "Sup3rSecret!", subdomain: slug, ...(language && { language }) })
    .expect(201);
  return { tenantId: res.body.responseObject.tenantId, token: res.body.responseObject.token };
}

async function platformUser(app, role) {
  const email = `${role}-${Math.random().toString(36).slice(2, 7)}@matjar.test`;
  await mongoose.model("TenantUser").create({
    tenantId: null,
    name: role,
    email,
    platformAdmin: true,
    platformRole: role,
    platformPasswordHash: await generateHash(PLATFORM_PASSWORD),
  });
  const res = await request(app).post("/api/platform/login").send({ email, password: PLATFORM_PASSWORD }).expect(200);
  return { token: res.body.data.token };
}

const auth = (u) => ({ Authorization: `Bearer ${u.token}` });

const MESSAGE = {
  title: { ar: "ميزة جديدة", en: "New feature" },
  body: { ar: "أصبح بإمكانك الآن إضافة كوبونات.", en: "You can now add coupons." },
  link: "/dashboard/discounts",
};

describe("platform announcements", () => {
  let app;
  const saved = {};
  before(async () => {
    await startTestDb();
    app = await buildTestApp();
    saved.EMAIL_ENABLED = process.env.EMAIL_ENABLED;
    saved.RESEND_API_KEY = process.env.RESEND_API_KEY;
    process.env.EMAIL_ENABLED = "true";
    process.env.RESEND_API_KEY = "re_test_key";
  });
  after(async () => {
    for (const k of ["EMAIL_ENABLED", "RESEND_API_KEY"]) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    await stopTestDb();
  });
  beforeEach(async () => {
    await clearAllCollections();
    clearTestInbox();
  });

  it("lets only staff with announcements.send use it", async () => {
    const support = await platformUser(app, "support");
    await request(app).get("/api/platform/announcements").set(auth(support)).expect(403);
    const owner = await platformUser(app, "owner");
    await request(app).get("/api/platform/announcements").set(auth(owner)).expect(200);
  });

  it("shows the reach, then delivers to every store's notifications page and inbox", async () => {
    const a = await provisionTenant(app, "anna", "ar");
    const b = await provisionTenant(app, "bata", "en");
    const owner = await platformUser(app, "owner");

    clearTestInbox(); // signup emails
    const reach = await request(app).get("/api/platform/announcements/audience?target=all").set(auth(owner)).expect(200);
    assert.equal(reach.body.data.stores, 2);
    assert.equal(reach.body.data.email, 2);

    const res = await request(app)
      .post("/api/platform/announcements")
      .set(auth(owner))
      .send({ ...MESSAGE, target: "all", channels: { app: true, email: true } })
      .expect(202);
    const id = res.body.data.id;

    // Delivery runs in the background; wait for it.
    for (let i = 0; i < 50; i++) {
      const doc = await mongoose.model("Announcement").findById(id).lean();
      if (doc.status !== "sending") break;
      await new Promise((r) => setTimeout(r, 50));
    }
    const doc = await mongoose.model("Announcement").findById(id).lean();
    assert.equal(doc.status, "sent");
    assert.deepEqual({ stores: doc.delivered.stores, app: doc.delivered.app, email: doc.delivered.email }, { stores: 2, app: 2, email: 2 });

    // Store A's notifications page holds it, with both languages and the link.
    const n = await mongoose
      .model("Notification")
      .findOne({ tenantId: a.tenantId, type: "platform.announcement" })
      .lean();
    assert.ok(n, "announcement in store A's notifications");
    assert.deepEqual({ ar: n.data.title.ar, en: n.data.title.en }, MESSAGE.title);
    assert.equal(n.data.link, "/dashboard/discounts");
    assert.equal(n.permission, null);

    // One email each, in the store's language.
    const mails = getTestInbox();
    assert.equal(mails.length, 2);
    const ar = mails.find((m) => m.to === "owner@anna.test");
    assert.equal(ar.subject, "ميزة جديدة");
    assert.match(ar.html, /dir="rtl"/);
    assert.match(ar.html, /\/e\/c\//); // the button goes through the click counter
    assert.equal(mails.find((m) => m.to === "owner@bata.test").subject, "New feature");
    assert.ok(b.tenantId);
  });

  it("sends to one store only, and respects a switched-off email", async () => {
    const a = await provisionTenant(app, "solo");
    await provisionTenant(app, "other");
    const owner = { id: new mongoose.Types.ObjectId(), email: "owner@matjar.test" };

    await mongoose.model("User").updateMany(
      { tenantId: a.tenantId },
      { $set: { "notificationPreferences.platform．announcement": {} } }
    );
    // Switch the announcement email off for store "solo" (key has a dot, so set the whole map).
    const user = await mongoose.model("User").findOne({ tenantId: a.tenantId, email: "owner@solo.test" });
    user.notificationPreferences = { "platform.announcement": { email: false } };
    user.markModified("notificationPreferences");
    await user.save();

    clearTestInbox(); // signup emails
    assert.equal((await measureAudience({ target: "tenant", tenantId: a.tenantId })).email, 0);
    const { doc, delivery } = await sendAnnouncement(
      { ...MESSAGE, target: "tenant", tenantId: a.tenantId, channels: { app: true, email: true } },
      owner
    );
    const delivered = await delivery;
    assert.equal(doc.tenantName, "solo store");
    assert.deepEqual({ stores: delivered.stores, app: delivered.app, email: delivered.email }, { stores: 1, app: 1, email: 0 });
    assert.equal(getTestInbox().length, 0);
    assert.equal(await mongoose.model("Notification").countDocuments({ type: "platform.announcement", tenantId: { $ne: a.tenantId } }), 0);
  });

  it("sends to chosen stores and counts who opened it (email open, click, app read)", async () => {
    const a = await provisionTenant(app, "alfa", "ar");
    const b = await provisionTenant(app, "beta", "en");
    await provisionTenant(app, "left-out");
    const owner = await platformUser(app, "owner");
    clearTestInbox(); // signup emails

    const ids = [a.tenantId, b.tenantId];
    const reach = await request(app)
      .get(`/api/platform/announcements/audience?target=tenants&tenantIds=${ids.join(",")}`)
      .set(auth(owner))
      .expect(200);
    assert.equal(reach.body.data.stores, 2);

    const res = await request(app)
      .post("/api/platform/announcements")
      .set(auth(owner))
      .send({ ...MESSAGE, target: "tenants", tenantIds: ids, channels: { app: true, email: true } })
      .expect(202);
    const id = res.body.data.id;
    for (let i = 0; i < 50; i++) {
      if ((await mongoose.model("Announcement").findById(id).lean()).status !== "sent") await new Promise((r) => setTimeout(r, 50));
    }
    assert.equal(getTestInbox().length, 2, "only the chosen stores");
    assert.equal(await mongoose.model("Notification").countDocuments({ type: "platform.announcement" }), 2);

    // Each email has its own tracking image and tracked button on the app host.
    const mail = getTestInbox().find((m) => m.to === "owner@alfa.test");
    const pixel = mail.html.match(/src="([^"]*\/e\/o\/[^"]+)"/)[1];
    const button = mail.html.match(/href="([^"]*\/e\/c\/[^"]+)"/)[1];
    assert.ok(pixel.startsWith(`${config.appOrigin}/e/o/`), pixel);
    const path = (u) => new URL(u).pathname;

    // Opening twice counts one person; a click redirects to the message's page.
    const img = await request(app).get(path(pixel)).expect(200);
    assert.equal(img.headers["content-type"], "image/gif");
    await request(app).get(path(pixel)).expect(200);
    const click = await request(app).get(path(button)).expect(302);
    assert.equal(click.headers.location, `${config.appOrigin}/dashboard/discounts`);
    // A forged token: still an image, nothing counted.
    await request(app).get("/e/o/bm90LmEudG9rZW4.AAAAAAAAAAAAAAAAAAAAAA").expect(200);
    const forged = await request(app).get("/e/c/bm90LmEudG9rZW4.AAAAAAAAAAAAAAAAAAAAAA").expect(302);
    assert.equal(forged.headers.location, `${config.appOrigin}/dashboard`);

    // Store B's owner reads it in the dashboard.
    const n = await mongoose.model("Notification").findOne({ tenantId: b.tenantId, type: "platform.announcement" });
    const bOwner = await mongoose.model("User").findOne({ tenantId: b.tenantId, email: "owner@beta.test" });
    await mongoose.model("Notification").updateOne({ _id: n._id }, { $push: { readBy: { userId: bOwner._id, readAt: new Date() } } });

    const list = await request(app).get("/api/platform/announcements").set(auth(owner)).expect(200);
    const row = list.body.data.announcements.find((r) => r.id === id);
    assert.equal(row.target, "tenants");
    assert.equal(row.storeCount, 2);
    assert.deepEqual(row.tenantNames.sort(), ["alfa store", "beta store"]);
    assert.deepEqual(row.engagement, { emailOpened: 1, emailClicked: 1, appReadPeople: 1, appReadStores: 1 });
  });

  it("refuses chosen stores that are not active", async () => {
    const a = await provisionTenant(app, "live");
    const owner = await platformUser(app, "owner");
    const ghost = new mongoose.Types.ObjectId().toString();
    await request(app)
      .post("/api/platform/announcements")
      .set(auth(owner))
      .send({ ...MESSAGE, target: "tenants", tenantIds: [a.tenantId, ghost], channels: { app: true, email: false } })
      .expect(404);
    await request(app)
      .post("/api/platform/announcements")
      .set(auth(owner))
      .send({ ...MESSAGE, target: "tenants", tenantIds: [], channels: { app: true, email: false } })
      .expect(400);
  });

  it("rejects an empty message, no channel or a link outside the dashboard", async () => {
    const owner = await platformUser(app, "owner");
    const post = (body) => request(app).post("/api/platform/announcements").set(auth(owner)).send(body);
    await post({ title: { ar: "" }, body: MESSAGE.body, target: "all", channels: { app: true, email: false } }).expect(400);
    await post({ ...MESSAGE, target: "all", channels: { app: false, email: false } }).expect(400);
    await post({ ...MESSAGE, link: "https://evil.example", target: "all", channels: { app: true, email: false } }).expect(400);
  });
});
