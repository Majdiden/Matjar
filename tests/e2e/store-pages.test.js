/**
 * E2E: generated store pages (PBI 10 — 10-9 About, 10-10 Contact, 10-11
 * policies + trust badges) through the real stack (auth → permission → zod →
 * service → repository) and on to the storefront.
 *
 *   1. A store that never uses these screens keeps exactly its old
 *      storefront payload and page lookups.
 *   2. About: answers → published Arabic (+ English) pages; merchant input is
 *      escaped; a hand edit blocks regeneration until `overwrite: true`.
 *   3. Contact: the switch adds `generatedPages.contact` to the storefront
 *      payload and removes it again.
 *   4. Policies: answers → delivery/returns/payment policies from the
 *      store's zones and payment methods; edited policies are protected;
 *      trust facts reach the storefront.
 *   5. Permissions and cross-tenant isolation.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { createScopedModels } from "../../utils/scopedModel.js";
import { setFeatureOverrides, invalidateFeatureFlagCache } from "../../services/featureFlags.js";

const PASSWORD = "Sup3rSecret!";

async function provisionTenant(app, slug, extra = {}) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ name: `Store ${slug}`, email: `owner@${slug}.test`, password: PASSWORD, subdomain: slug, ...extra })
    .expect(201);
  return res.body.responseObject.tenantId;
}

async function login(app, slug, email = `owner@${slug}.test`) {
  const host = `${slug}.localhost`;
  const res = await request(app)
    .post("/api/auth/login")
    .set("Host", host)
    .send({ email, password: PASSWORD, domain: host })
    .expect(200);
  return res.body.responseObject.accessToken;
}

const call = (app, method, slug, token, path, body) => {
  const req = request(app)[method](`/api/store-pages/${path}`).set("Host", `${slug}.localhost`);
  if (token) req.set("Authorization", `Bearer ${token}`);
  return body === undefined ? req : req.send(body);
};

const storeInfo = async (app, slug) =>
  (await request(app).get("/storefront/store-info").set("Host", `${slug}.localhost`).expect(200)).body.data.store;

const ABOUT_ANSWERS = {
  products: { ar: "عطور <script>alert(1)</script> أصلية", en: "Genuine perfumes" },
  since: 2019,
  city: { ar: "الخرطوم", en: "Khartoum" },
  different: { ar: "نختار كل عطر بأنفسنا" },
};

const POLICY_ANSWERS = {
  delivery: { areas: { ar: "الخرطوم وأم درمان" }, fee: { ar: "٢٠٠٠ جنيه" }, time: { ar: "يومين", en: "two days" } },
  returns: { accepted: true, days: 7, conditions: { ar: "المنتج غير مستعمل" } },
};

describe("E2E generated store pages", () => {
  let app;

  before(async () => {
    await startTestDb();
    app = buildTestApp();
  });

  after(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await clearAllCollections();
    await setFeatureOverrides({ "payments.methods": true }, null);
    invalidateFeatureFlagCache();
  });

  it("leaves a store that never uses the screens exactly as before", async () => {
    await provisionTenant(app, "plain");
    const store = await storeInfo(app, "plain");
    assert.equal("generatedPages" in store, false, "no generatedPages key at all");
    assert.equal("trust" in store, false, "no trust key at all");

    // A page lookup with the new ?lang= preference returns the same page as
    // the plain lookup for a store with one locale per slug.
    const tenantId = (await mongoose.model("Tenant").findOne({ slug: "plain" }).lean())._id;
    const models = createScopedModels(mongoose.connection, tenantId);
    await models.Page.create({ slug: "shipping", title: "Shipping", content: "<p>x</p>", locale: "en", isPublished: true });
    const plain = await request(app).get("/storefront/pages/shipping").set("Host", "plain.localhost").expect(200);
    const pref = await request(app).get("/storefront/pages/shipping?lang=ar").set("Host", "plain.localhost").expect(200);
    assert.deepEqual(pref.body.data, plain.body.data);
  });

  it("writes the About page from answers, escapes input, and protects hand edits", async () => {
    const tenantId = await provisionTenant(app, "nile");
    const token = await login(app, "nile");
    const models = createScopedModels(mongoose.connection, tenantId);

    const empty = await call(app, "get", "nile", token, "about").expect(200);
    assert.equal(empty.body.data.answers, null);

    const saved = await call(app, "put", "nile", token, "about", { answers: ABOUT_ANSWERS }).expect(200);
    assert.deepEqual(saved.body.data.pages.filter((p) => p.generated).map((p) => p.locale).sort(), ["ar", "en"]);
    assert.equal(saved.body.data.edited, false);
    assert.equal(saved.body.data.answers.since, 2019);

    const ar = await models.Page.findOne({ slug: "about", locale: "ar" }).lean();
    assert.equal(ar.isPublished, true);
    assert.equal(ar.title, "من نحن");
    assert.match(ar.content, /أهلًا بك في Store nile/);
    assert.ok(!ar.content.includes("<script"), "merchant input is escaped");
    assert.match(ar.content, /&lt;script&gt;/);
    assert.equal(ar.generator.kind, "about");
    assert.equal(ar.generator.edited, false);

    // Storefront serves the visitor's language.
    const sfAr = await request(app).get("/storefront/pages/about?lang=ar").set("Host", "nile.localhost").expect(200);
    assert.equal(sfAr.body.data.title, "من نحن");
    const sfEn = await request(app).get("/storefront/pages/about?lang=en").set("Host", "nile.localhost").expect(200);
    assert.equal(sfEn.body.data.title, "About us");
    assert.match(sfEn.body.data.content, /We sell Genuine perfumes/);

    // Regenerating untouched pages needs no confirmation; dropping English
    // removes the generated English page.
    await call(app, "put", "nile", token, "about", {
      answers: { products: { ar: "عطور" } },
    }).expect(200);
    assert.equal(await models.Page.countDocuments({ slug: "about", locale: "en" }), 0);

    // A hand edit through the normal page API marks the page edited…
    await request(app)
      .put(`/api/pages/${ar._id}`)
      .set("Host", "nile.localhost")
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "<p>كتبتها بنفسي</p>" })
      .expect(200);
    const afterEdit = await call(app, "get", "nile", token, "about").expect(200);
    assert.equal(afterEdit.body.data.edited, true);

    // …so regenerating is refused until the merchant confirms.
    const conflict = await call(app, "put", "nile", token, "about", { answers: ABOUT_ANSWERS }).expect(409);
    assert.equal(conflict.body.code, "GENERATED_PAGE_EDITED");
    const stillMine = await models.Page.findOne({ slug: "about", locale: "ar" }).lean();
    assert.equal(stillMine.content, "<p>كتبتها بنفسي</p>");

    await call(app, "put", "nile", token, "about", { answers: ABOUT_ANSWERS, overwrite: true }).expect(200);
    const replaced = await models.Page.findOne({ slug: "about", locale: "ar" }).lean();
    assert.match(replaced.content, /نبيع/);
    assert.equal(replaced.generator.edited, false);
  });

  it("rejects bad About answers with 400 and writes nothing", async () => {
    const tenantId = await provisionTenant(app, "nile");
    const token = await login(app, "nile");
    const models = createScopedModels(mongoose.connection, tenantId);
    const before = await models.Page.find({ slug: "about" }).lean();

    const bad = [
      { answers: {} },
      { answers: { products: { en: "English only" } } },
      { answers: { products: { ar: "عطور" }, since: 1500 } },
      { answers: { products: { ar: "عطور" }, since: new Date().getFullYear() + 1 } },
      { answers: { products: { ar: "عطور" }, photo: "javascript:alert(1)" } },
      { answers: { products: { ar: "عطور" }, photo: "http://insecure.example/a.jpg" } },
      { answers: { products: { ar: "ب".repeat(201) } } },
      { answers: { products: { ar: "عطور" }, unknown: "x" } },
    ];
    for (const body of bad) {
      const res = await call(app, "put", "nile", token, "about", body);
      assert.equal(res.status, 400, `${JSON.stringify(body)} → ${res.status} ${JSON.stringify(res.body)}`);
    }
    assert.deepEqual(await models.Page.find({ slug: "about" }).lean(), before);
  });

  it("does not overwrite a hand-made About page without confirmation", async () => {
    const tenantId = await provisionTenant(app, "nile");
    const token = await login(app, "nile");
    const models = createScopedModels(mongoose.connection, tenantId);
    await models.Page.deleteMany({ slug: "about" });
    await models.Page.create({ slug: "about", locale: "ar", title: "قصتنا", content: "<p>قصة كتبها التاجر</p>", isPublished: true });

    const got = await call(app, "get", "nile", token, "about").expect(200);
    assert.equal(got.body.data.edited, true);
    await call(app, "put", "nile", token, "about", { answers: { products: { ar: "عطور" } } }).expect(409);
    assert.equal((await models.Page.findOne({ slug: "about", locale: "ar" }).lean()).title, "قصتنا");
  });

  it("switches the automatic contact page on and off", async () => {
    await provisionTenant(app, "nile");
    const token = await login(app, "nile");
    await request(app)
      .put("/api/store-profile")
      .set("Host", "nile.localhost")
      .set("Authorization", `Bearer ${token}`)
      .send({ brand: { whatsapp: "0912345678", city: { ar: "الخرطوم" } }, contact: { email: "hi@nile.test" } })
      .expect(200);

    const off = await call(app, "get", "nile", token, "contact").expect(200);
    assert.equal(off.body.data.enabled, false);
    assert.equal(off.body.data.preview.whatsapp, "+249912345678");
    assert.deepEqual(off.body.data.preview.city, { ar: "الخرطوم" });
    assert.equal(off.body.data.preview.email, "hi@nile.test");

    const on = await call(app, "put", "nile", token, "contact", { enabled: true }).expect(200);
    assert.equal(on.body.data.enabled, true);
    assert.deepEqual((await storeInfo(app, "nile")).generatedPages, { contact: true });

    await call(app, "put", "nile", token, "contact", { enabled: false }).expect(200);
    assert.equal("generatedPages" in (await storeInfo(app, "nile")), false, "off is the same as never set");
    const stored = await mongoose.model("Tenant").findOne({ slug: "nile" }).lean();
    assert.equal(stored.settings.generatedPages?.contact, undefined);

    await call(app, "put", "nile", token, "contact", { enabled: "yes" }).expect(400);
  });

  it("writes policies from answers, zones and payment methods, and protects edits", async () => {
    const tenantId = await provisionTenant(app, "nile");
    const token = await login(app, "nile");
    const models = createScopedModels(mongoose.connection, tenantId);
    await models.PaymentMethod.deleteMany({});
    await models.PaymentMethod.create([
      { code: "cod", type: "cod", label: "Cash on Delivery", enabled: true },
      {
        code: "manual-transfer",
        type: "manual",
        label: "Manual Transfer",
        enabled: true,
        providers: [
          { code: "bankak", label: "Bankak", enabled: true, accountNumber: "123" },
          { code: "fawry", label: "Fawry", enabled: true }, // no account details → not offered
        ],
      },
    ]);

    // Delivery areas typed at signup v2 (PBI 10-16) live at
    // settings.policyAnswers.deliveryAreas and prefill the questions, but
    // alone they neither count as answers nor show trust badges.
    await mongoose.model("Tenant").updateOne(
      { _id: tenantId },
      { $set: { "settings.policyAnswers.deliveryAreas": { ar: "الخرطوم" } } }
    );
    const first = await call(app, "get", "nile", token, "policies").expect(200);
    assert.equal(first.body.data.answers, null);
    assert.deepEqual(first.body.data.suggestions.areas, { ar: "الخرطوم" });
    assert.equal("trust" in (await storeInfo(app, "nile")), false);
    assert.equal(first.body.data.language, "ar");
    assert.deepEqual(first.body.data.payment, { cod: true, transfers: [{ code: "bankak", label: "Bankak" }] });

    // No zones → areas are required.
    await call(app, "put", "nile", token, "policies", {
      answers: { delivery: { time: { ar: "يومين" } }, returns: { accepted: false } },
    }).expect(400);

    const saved = await call(app, "put", "nile", token, "policies", { answers: POLICY_ANSWERS }).expect(200);
    assert.equal(saved.body.data.policies.delivery.exists, true);
    assert.equal(saved.body.data.policies.delivery.edited, false);

    const tenant = await mongoose.model("Tenant").findById(tenantId).lean();
    const p = tenant.settings.policies;
    assert.equal(p.delivery.title, "التوصيل");
    assert.match(p.delivery.body, /الخرطوم وأم درمان/);
    assert.match(p.returns.body, /خلال 7 أيام/);
    assert.match(p.cod.body, /بنكك/);
    assert.ok(!p.cod.body.includes("فوري"), "providers without account details are not listed");
    assert.equal(tenant.settings.policyAnswers.returns.days, 7);
    assert.deepEqual(tenant.settings.policyAnswers.deliveryAreas, { ar: "الخرطوم وأم درمان" }, "areas written back to the shared path");
    assert.equal(tenant.settings.policyAnswers.delivery.areas, undefined);
    const reread = await call(app, "get", "nile", token, "policies").expect(200);
    assert.deepEqual(reread.body.data.answers.delivery.areas, { ar: "الخرطوم وأم درمان" });

    const store = await storeInfo(app, "nile");
    assert.equal(store.policies.delivery.title, "التوصيل");
    assert.deepEqual(store.trust, {
      payments: true,
      delivery: { areas: { ar: "الخرطوم وأم درمان" }, time: { ar: "يومين", en: "two days" } },
      returns: { days: 7 },
    });

    // The merchant edits the returns policy by hand (bulk settings PUT).
    await request(app)
      .put("/api/store-settings")
      .set("Host", "nile.localhost")
      .set("Authorization", `Bearer ${token}`)
      .send({ policies: { returns: { body: "<p>سياستي الخاصة</p>" } } })
      .expect(200);
    const edited = await call(app, "get", "nile", token, "policies").expect(200);
    assert.equal(edited.body.data.policies.returns.edited, true);
    assert.equal(edited.body.data.policies.delivery.edited, false);

    const conflict = await call(app, "put", "nile", token, "policies", { answers: POLICY_ANSWERS }).expect(409);
    assert.equal(conflict.body.code, "GENERATED_PAGE_EDITED");
    assert.equal(
      (await mongoose.model("Tenant").findById(tenantId).lean()).settings.policies.returns.body,
      "<p>سياستي الخاصة</p>"
    );

    await call(app, "put", "nile", token, "policies", {
      answers: { ...POLICY_ANSWERS, returns: { accepted: false } },
      overwrite: true,
    }).expect(200);
    const after = await mongoose.model("Tenant").findById(tenantId).lean();
    assert.match(after.settings.policies.returns.body, /لا نقبل إرجاع/);
    assert.equal("returns" in (await storeInfo(app, "nile")).trust, false, "no returns badge when returns are off");
  });

  it("uses shipping zones for delivery areas and writes English policies for English stores", async () => {
    const tenantId = await provisionTenant(app, "acme", { language: "en" });
    const token = await login(app, "acme");
    await mongoose.model("Tenant").updateOne(
      { _id: tenantId },
      { $set: { "settings.shipping.zones": [{ name: "Khartoum <b>", countries: ["SD"], rates: [{ name: "Std", price: 2000, estimatedDays: "1-2 days" }] }] } }
    );
    const models = createScopedModels(mongoose.connection, tenantId);
    await models.PaymentMethod.deleteMany({});

    await call(app, "put", "acme", token, "policies", {
      answers: { delivery: { time: { ar: "يومين", en: "two days" } }, returns: { accepted: true, days: 1 } },
    }).expect(200);
    const tenant = await mongoose.model("Tenant").findById(tenantId).lean();
    assert.equal(tenant.settings.policies.delivery.title, "Delivery");
    assert.match(tenant.settings.policies.delivery.body, /Khartoum &lt;b&gt;: 2,000 SDG, within 1-2 days/);
    assert.match(tenant.settings.policies.returns.body, /within 1 day of/);
    assert.equal(tenant.settings.policies.cod?.body || null, null, "no payment policy without payment methods");

    const store = await storeInfo(app, "acme");
    assert.deepEqual(store.trust.delivery.zones, ["Khartoum <b>"]);
  });

  it("requires the page and settings permissions", async () => {
    const tenantId = await provisionTenant(app, "nile");
    const models = createScopedModels(mongoose.connection, tenantId);
    await models.User.create({ name: "Staff", email: "staff@nile.test", password: PASSWORD, roles: ["staff"] });
    await models.User.create({ name: "Manager", email: "manager@nile.test", password: PASSWORD, roles: ["manager"] });

    const staff = await login(app, "nile", "staff@nile.test");
    await call(app, "get", "nile", staff, "about").expect(403);
    await call(app, "put", "nile", staff, "about", { answers: { products: { ar: "عطور" } } }).expect(403);
    await call(app, "put", "nile", staff, "contact", { enabled: true }).expect(403);
    await call(app, "get", "nile", staff, "policies").expect(403);
    await call(app, "put", "nile", staff, "policies", { answers: POLICY_ANSWERS }).expect(403);

    const manager = await login(app, "nile", "manager@nile.test");
    await call(app, "put", "nile", manager, "about", { answers: { products: { ar: "عطور" } } }).expect(200);
    await call(app, "put", "nile", manager, "contact", { enabled: true }).expect(200);
    await call(app, "put", "nile", manager, "policies", { answers: POLICY_ANSWERS }).expect(200);

    await call(app, "get", "nile", null, "about").expect(401);
  });

  it("keeps each store's generated pages to itself", async () => {
    const tenantA = await provisionTenant(app, "alpha");
    const tenantB = await provisionTenant(app, "bravo");
    const tokenA = await login(app, "alpha");
    const tokenB = await login(app, "bravo");

    await call(app, "put", "alpha", tokenA, "about", { answers: { products: { ar: "عطور ألفا" } } }).expect(200);
    await call(app, "put", "alpha", tokenA, "contact", { enabled: true }).expect(200);
    await call(app, "put", "alpha", tokenA, "policies", { answers: POLICY_ANSWERS }).expect(200);

    const b = await call(app, "get", "bravo", tokenB, "about").expect(200);
    assert.equal(b.body.data.answers, null);
    const bPolicies = await call(app, "get", "bravo", tokenB, "policies").expect(200);
    assert.equal(bPolicies.body.data.answers, null);
    const sfB = await storeInfo(app, "bravo");
    assert.equal("generatedPages" in sfB, false);
    assert.equal("trust" in sfB, false);

    // A's token on B's host is refused and B stays untouched.
    const cross = await call(app, "put", "bravo", tokenA, "about", { answers: { products: { ar: "اختراق" } } });
    assert.ok([401, 403].includes(cross.status), `expected 401/403, got ${cross.status}`);
    const modelsB = createScopedModels(mongoose.connection, tenantB);
    assert.equal(await modelsB.Page.countDocuments({ "generator.kind": "about" }), 0);
    const modelsA = createScopedModels(mongoose.connection, tenantA);
    assert.equal(await modelsA.Page.countDocuments({ "generator.kind": "about" }), 1);
  });
});
