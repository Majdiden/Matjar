/**
 * E2E: markets + currencies.
 *
 * Pins:
 *   1. Admin CRUD on /api/store-settings/markets round-trips.
 *   2. Customers cannot mutate markets or currencies (role gating).
 *   3. Validation:
 *      - bad country code
 *      - bad currency code
 *      - >1 default market
 *      - priceAdjustmentPct out of range
 *      - currency rates: non-positive, non-numeric
 *   4. Currencies PUT replaces the rates table wholesale and stamps
 *      ratesUpdatedAt.
 *   5. Checkout integration:
 *      - Order shipped to a country in the EU market gets persisted with
 *        presentmentCurrency=EUR, fxRate, and a presentmentTotal that
 *        reflects the per-market priceAdjustmentPct.
 *      - Order shipped to a country in NO market keeps presentment in the
 *        base currency (or omits the block entirely).
 *      - Order shipped to a country covered ONLY by the default market
 *        falls into the default.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { createScopedModels } from "../../utils/scopedModel.js";
import { setFeatureOverrides, invalidateFeatureFlagCache, invalidateTenantFeatureCache } from "../../services/featureFlags.js";

const HOST = "acme.localhost";

async function provisionTenant(app) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({
      name: "Acme Coffee",
      email: "owner@acme.test",
      password: "Sup3rSecret!",
      subdomain: "acme",
    })
    .expect(201);
  return res.body.responseObject.tenantId;
}

async function loginAdmin(app) {
  const res = await request(app)
    .post("/api/auth/login")
    .set("Host", HOST)
    .send({ email: "owner@acme.test", password: "Sup3rSecret!", domain: "acme.localhost" })
    .expect(200);
  return res.body.responseObject.accessToken;
}

async function registerCustomer(app, email = "jane@buyer.test") {
  const res = await request(app)
    .post("/storefront/auth/register")
    .set("Host", HOST)
    .send({ name: "Jane Doe", email, password: "Sup3rSecret!" })
    .expect(201);
  return res.body.data.accessToken;
}

async function seedProduct(tenantId) {
  const models = createScopedModels(mongoose.connection, tenantId);
  const category = await models.Category.create({
    name: "Goods",
    slug: "goods",
    description: "Stuff",
  });
  const product = await models.Product.create({
    name: "Hoodie",
    slug: "hoodie",
    sku: "HD-001",
    description: "Cosy.",
    price: 100,
    category: category._id,
    stock: 50,
    status: "active",
    images: [],
  });
  return { models, product };
}

const EU_MARKET = {
  code: "eu",
  name: "European Union",
  countries: ["DE", "FR", "IT", "ES"],
  currency: "EUR",
  language: "en",
  // EU prices are 10% higher than the USD base — common for VAT-bearing
  // regions where the merchant absorbs the duty differential.
  priceAdjustmentPct: 0.1,
};

const NA_MARKET = {
  code: "na",
  name: "North America",
  countries: ["US", "CA"],
  currency: "USD",
  isDefault: true,
};

const EU_ADDRESS = {
  firstName: "Jane",
  lastName: "Doe",
  addressLine1: "1 Linden St",
  city: "Berlin",
  state: "BE",
  postalCode: "10115",
  country: "DE",
  phone: "+49301234567",
};

const US_ADDRESS = {
  firstName: "Jane",
  lastName: "Doe",
  addressLine1: "1 Market St",
  city: "Portland",
  state: "OR",
  postalCode: "97201",
  country: "US",
  phone: "+15035551234",
};

const ANTARCTIC_ADDRESS = {
  firstName: "Jane",
  lastName: "Doe",
  addressLine1: "Vostok Station",
  city: "Vostok",
  state: "AQ",
  postalCode: "0000",
  country: "AQ",
  phone: "+10000000000",
};

async function configureMarketsAndFx(app, adminToken) {
  // Bulk-set markets via the bulk PUT (covers the validator path) and the
  // FX table via the dedicated currencies endpoint.
  await request(app)
    .put("/api/store-settings")
    .set("Host", HOST)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ markets: [EU_MARKET, NA_MARKET] })
    .expect(200);
  await request(app)
    .put("/api/store-settings/currencies")
    .set("Host", HOST)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ base: "USD", rates: { EUR: 0.9, GBP: 0.78 } })
    .expect(200);
}

async function placeOrder(app, customerToken, productId, address) {
  await request(app)
    .post("/api/cart/add")
    .set("Host", HOST)
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ productId: productId.toString(), quantity: 1 })
    .expect(200);
  const res = await request(app)
    .post("/api/orders")
    .set("Host", HOST)
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ shippingAddress: address, paymentMethod: "cod" });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.responseObject;
}

describe("E2E markets + currencies", () => {
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
    // Markets and currencies are behind feature flags (off by default).
    invalidateFeatureFlagCache();
    invalidateTenantFeatureCache();
    await setFeatureOverrides([{ key: "settings.markets", value: true }, { key: "settings.currencies", value: true }], "test");
  });

  it("admin can CRUD markets via the granular endpoints", async () => {
    await provisionTenant(app);
    const adminToken = await loginAdmin(app);

    const createRes = await request(app)
      .post("/api/store-settings/markets")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(EU_MARKET);
    assert.equal(createRes.status, 201, JSON.stringify(createRes.body));
    const marketId = createRes.body.data._id;
    assert.ok(marketId);
    assert.deepEqual(createRes.body.data.countries, ["DE", "FR", "IT", "ES"]);
    assert.equal(createRes.body.data.currency, "EUR");

    const listRes = await request(app)
      .get("/api/store-settings/markets")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    assert.equal(listRes.body.data.markets.length, 1);

    await request(app)
      .put(`/api/store-settings/markets/${marketId}`)
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...EU_MARKET, name: "EU (revised)" })
      .expect(200);

    await request(app)
      .delete(`/api/store-settings/markets/${marketId}`)
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const finalList = await request(app)
      .get("/api/store-settings/markets")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    assert.equal(finalList.body.data.markets.length, 0);
  });

  it("creating a default market demotes the previous default", async () => {
    await provisionTenant(app);
    const adminToken = await loginAdmin(app);

    await request(app)
      .post("/api/store-settings/markets")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...NA_MARKET, isDefault: true })
      .expect(201);

    await request(app)
      .post("/api/store-settings/markets")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...EU_MARKET, isDefault: true })
      .expect(201);

    const listRes = await request(app)
      .get("/api/store-settings/markets")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    const defaults = listRes.body.data.markets.filter((m) => m.isDefault);
    assert.equal(defaults.length, 1, "exactly one default after second create");
    assert.equal(defaults[0].code, "eu");
  });

  it("customers cannot mutate markets or currencies", async () => {
    await provisionTenant(app);
    const customerToken = await registerCustomer(app);

    const r1 = await request(app)
      .post("/api/store-settings/markets")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${customerToken}`)
      .send(EU_MARKET);
    assert.equal(r1.status, 403);

    const r2 = await request(app)
      .put("/api/store-settings/currencies")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ rates: { EUR: 0.9 } });
    assert.equal(r2.status, 403);
  });

  it("rejects malformed market payloads", async () => {
    await provisionTenant(app);
    const adminToken = await loginAdmin(app);

    // Bad country code
    const r1 = await request(app)
      .post("/api/store-settings/markets")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...EU_MARKET, countries: ["DEU"] });
    assert.equal(r1.status, 400);

    // Bad currency
    const r2 = await request(app)
      .post("/api/store-settings/markets")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...EU_MARKET, currency: "EURO" });
    assert.equal(r2.status, 400);

    // Adjustment out of range
    const r3 = await request(app)
      .post("/api/store-settings/markets")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ ...EU_MARKET, priceAdjustmentPct: 10 });
    assert.equal(r3.status, 400);

    // Bulk PUT with two defaults
    const r4 = await request(app)
      .put("/api/store-settings")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        markets: [
          { ...EU_MARKET, isDefault: true },
          { ...NA_MARKET, isDefault: true },
        ],
      });
    assert.equal(r4.status, 400);
  });

  it("the base currency is the store currency; rates reach the storefront with the switcher", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    const put = (body) =>
      request(app).put("/api/store-settings/currencies").set("Host", HOST).set("Authorization", `Bearer ${adminToken}`).send(body);

    // 1 SDG = 1/600 USD; the base itself in the table is ignored.
    const res = await put({ base: "SDG", rates: { USD: 1 / 600, SDG: 1 } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(Object.keys(res.body.data.rates), ["USD"]);

    let info = (await request(app).get("/storefront/store-info").set("Host", HOST).expect(200)).body.data.store;
    assert.equal(info.currency, "SDG");
    // Rates alone change nothing on the website…
    assert.equal(info.currencyRates, undefined);
    // …until visitors may switch (or the website shows another currency).
    await put({ showSwitcher: true }).expect(200);
    info = (await request(app).get("/storefront/store-info").set("Host", HOST).expect(200)).body.data.store;
    assert.ok(Math.abs(info.currencyRates.USD - 1 / 600) < 1e-12);

    // Changing the base on the Currencies tab changes the store currency.
    await put({ base: "USD", rates: {} }).expect(200);
    const tenant = await mongoose.model("Tenant").findById(tenantId).lean();
    assert.equal(tenant.settings.currency, "USD");
    assert.equal(tenant.settings.currencies.base, "USD");
    info = (await request(app).get("/storefront/store-info").set("Host", HOST).expect(200)).body.data.store;
    assert.equal(info.currency, "USD");
    assert.equal(info.currencyRates, undefined);

    // And the Regional tab's currency changes the base.
    await request(app)
      .put("/api/store-settings")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ currency: "SDG" })
      .expect(200);
    const after = (await request(app).get("/api/store-settings/markets").set("Host", HOST).set("Authorization", `Bearer ${adminToken}`).expect(200)).body.data;
    assert.equal(after.currencies.base, "SDG");
  });

  it("priced in USD, sold in SDG: visitors see and pay in SDG, the order keeps both", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    const put = (body) =>
      request(app).put("/api/store-settings/currencies").set("Host", HOST).set("Authorization", `Bearer ${adminToken}`).send(body);

    // A website currency needs a rate.
    await put({ base: "USD", rates: {}, display: "SDG" }).expect(400);
    const saved = await put({ base: "USD", rates: { SDG: 600 }, display: "SDG", showSwitcher: false });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.data.display, "SDG");

    const info = (await request(app).get("/storefront/store-info").set("Host", HOST).expect(200)).body.data.store;
    assert.equal(info.currency, "USD");
    assert.equal(info.displayCurrency, "SDG");
    assert.equal(info.currencyRates.SDG, 600);
    assert.equal(info.currencySwitcher, undefined);

    // The order is charged in SDG: 100 USD × 600 (no markets configured).
    const { product } = await seedProduct(tenantId);
    const customerToken = await registerCustomer(app);
    const order = await placeOrder(app, customerToken, product._id, US_ADDRESS);
    assert.equal(order.baseCurrency, "USD");
    assert.equal(order.presentmentCurrency, "SDG");
    assert.equal(order.fxRate, 600);
    assert.equal(order.presentmentSubtotal, 60000);
    assert.equal(order.presentmentTotal, Math.round(order.totalAmount * 600 * 100) / 100);

    // Switching on the currency menu; showing the pricing currency again clears the website currency.
    await put({ showSwitcher: true }).expect(200);
    let after = (await request(app).get("/storefront/store-info").set("Host", HOST).expect(200)).body.data.store;
    assert.equal(after.currencySwitcher, true);
    await put({ display: null }).expect(200);
    after = (await request(app).get("/storefront/store-info").set("Host", HOST).expect(200)).body.data.store;
    assert.equal(after.displayCurrency, undefined);
    assert.equal(after.currencySwitcher, true);
  });

  it("store-info picks the visitor's region from their country", async () => {
    await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await configureMarketsAndFx(app, adminToken);
    const info = async (country) =>
      (await request(app).get("/storefront/store-info").set("Host", HOST).set("CF-IPCountry", country).expect(200)).body.data.store;
    const eu = await info("DE");
    assert.deepEqual(eu.markets.map((m) => m.code).sort(), ["eu", "na"]);
    assert.equal(eu.market, "eu");
    assert.equal(eu.currencyRates.EUR, 0.9);
    // A country in no market gets the default one.
    assert.equal((await info("AQ")).market, "na");
  });

  it("rejects malformed currency payloads", async () => {
    await provisionTenant(app);
    const adminToken = await loginAdmin(app);

    // Negative rate
    const r1 = await request(app)
      .put("/api/store-settings/currencies")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ rates: { EUR: -1 } });
    assert.equal(r1.status, 400);

    // Bad code
    const r2 = await request(app)
      .put("/api/store-settings/currencies")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ rates: { EURO: 0.9 } });
    assert.equal(r2.status, 400);

    // Bad base
    const r3 = await request(app)
      .put("/api/store-settings/currencies")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ base: "DOLLAR" });
    assert.equal(r3.status, 400);
  });

  it("currencies PUT replaces the rates table and stamps ratesUpdatedAt", async () => {
    await provisionTenant(app);
    const adminToken = await loginAdmin(app);

    await request(app)
      .put("/api/store-settings/currencies")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ base: "USD", rates: { EUR: 0.9, GBP: 0.78 } })
      .expect(200);

    // Replace — GBP should be gone after the second write.
    const second = await request(app)
      .put("/api/store-settings/currencies")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ rates: { EUR: 0.92 } })
      .expect(200);
    assert.equal(second.body.data.rates.EUR, 0.92);
    assert.ok(second.body.data.rates.GBP === undefined, "GBP should have been wiped");
    assert.ok(second.body.data.ratesUpdatedAt, "ratesUpdatedAt must be stamped");
  });

  it("EU order persists EUR presentment with the price adjustment baked in", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await configureMarketsAndFx(app, adminToken);
    const { product } = await seedProduct(tenantId);
    const customerToken = await registerCustomer(app);

    const order = await placeOrder(app, customerToken, product._id, EU_ADDRESS);

    // Base economics — store still records and charges in USD.
    assert.equal(order.subtotal, 100);
    assert.equal(order.totalAmount, 100);

    // Presentment overlay — buyer SAW EUR with the +10% market adjustment.
    //   adjusted base subtotal = 100 * 1.10 = 110 USD
    //   converted at 0.9       = 99 EUR
    assert.equal(order.baseCurrency, "USD");
    assert.equal(order.presentmentCurrency, "EUR");
    assert.equal(order.marketCode, "eu");
    assert.equal(order.fxRate, 0.9);
    assert.ok(
      Math.abs(order.presentmentSubtotal - 99) < 0.01,
      `presentmentSubtotal was ${order.presentmentSubtotal}, expected 99`
    );
    assert.ok(
      Math.abs(order.presentmentTotal - 99) < 0.01,
      `presentmentTotal was ${order.presentmentTotal}, expected 99`
    );
  });

  it("US order falls into the default NA market and stays in USD", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await configureMarketsAndFx(app, adminToken);
    const { product } = await seedProduct(tenantId);
    const customerToken = await registerCustomer(app);

    const order = await placeOrder(app, customerToken, product._id, US_ADDRESS);

    assert.equal(order.subtotal, 100);
    assert.equal(order.totalAmount, 100);
    assert.equal(order.presentmentCurrency, "USD");
    assert.equal(order.marketCode, "na");
    assert.equal(order.fxRate, 1);
    assert.equal(order.presentmentTotal, 100);
  });

  it("country with no explicit market falls back to the default market", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await configureMarketsAndFx(app, adminToken);
    const { product } = await seedProduct(tenantId);
    const customerToken = await registerCustomer(app);

    const order = await placeOrder(app, customerToken, product._id, ANTARCTIC_ADDRESS);

    // AQ isn't in either market's country list, so the default (NA) wins.
    assert.equal(order.marketCode, "na");
    assert.equal(order.presentmentCurrency, "USD");
  });
});
