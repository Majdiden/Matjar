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

// A region's currency needs a rate, so rates come first.
async function setUsdRates(app, adminToken, rates = { EUR: 0.9, GBP: 0.78 }) {
  await request(app)
    .put("/api/store-settings/currencies")
    .set("Host", HOST)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ base: "USD", rates })
    .expect(200);
}

async function configureMarketsAndFx(app, adminToken) {
  // The FX table via the dedicated currencies endpoint, then the markets via
  // the bulk PUT (covers the validator path).
  await setUsdRates(app, adminToken);
  await request(app)
    .put("/api/store-settings")
    .set("Host", HOST)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ markets: [EU_MARKET, NA_MARKET] })
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
    await setUsdRates(app, adminToken);

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
    await setUsdRates(app, adminToken);

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
    // Rates alone change nothing on the website, and visitors never get a
    // free currency switcher (they pick a market instead).
    assert.equal(info.currencyRates, undefined);
    await put({ showSwitcher: true }).expect(200);
    info = (await request(app).get("/storefront/store-info").set("Host", HOST).expect(200)).body.data.store;
    assert.equal(info.currencyRates, undefined);
    assert.equal(info.currencySwitcher, undefined);

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

    // Showing the pricing currency again clears the website currency.
    await put({ display: null }).expect(200);
    const after = (await request(app).get("/storefront/store-info").set("Host", HOST).expect(200)).body.data.store;
    assert.equal(after.displayCurrency, undefined);
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

  // ── Own prices per currency, rounding, safeguards, payment methods, auto rates ──

  const SA_ADDRESS = { ...EU_ADDRESS, city: "Riyadh", state: "RI", postalCode: "11564", country: "SA", phone: "+966501234567" };
  const SA_MARKET = { code: "sa", name: "Saudi Arabia", countries: ["SA"], currency: "SAR", rounding: "5" };

  it("own prices per currency are shown and charged exactly; other prices are rounded", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await setUsdRates(app, adminToken, { SAR: 3.75 });
    await request(app).post("/api/store-settings/markets").set("Host", HOST).set("Authorization", `Bearer ${adminToken}`)
      .send(SA_MARKET).expect(201);
    const { models, product } = await seedProduct(tenantId);
    await models.Product.updateOne({ _id: product._id }, { $set: { prices: { SAR: 349 } } });
    await models.Product.create({
      name: "Cap", slug: "cap", sku: "CP-1", description: "A cap.", price: 10, category: product.category, stock: 5, status: "active", images: [],
    });

    // Browsing from Saudi Arabia: 349 SAR exactly; 10 USD × 3.75 = 37.5 → 40.
    const shown = async (slug, headers) => {
      let r = request(app).get(`/storefront/products/${slug}`).set("Host", HOST);
      for (const [k, v] of Object.entries(headers)) r = r.set(k, v);
      const res = await r.expect(200);
      const p = res.body.data?.product || res.body.data;
      return Math.round(p.price * 3.75 * 100) / 100;
    };
    assert.equal(await shown("hoodie", { "CF-IPCountry": "SA" }), 349);
    assert.equal(await shown("cap", { "X-Matjar-Market": "sa" }), 40);
    // The only market is the default one, so every visitor gets its prices.
    assert.equal(await shown("hoodie", {}), 349);

    const customerToken = await registerCustomer(app);
    await request(app).post("/api/cart/add").set("Host", HOST).set("Authorization", `Bearer ${customerToken}`)
      .send({ productId: product._id.toString(), quantity: 1 }).expect(200);
    // The cart shows the same 349 SAR.
    const cart = (await request(app).get("/api/cart").set("Host", HOST).set("Authorization", `Bearer ${customerToken}`)
      .set("X-Matjar-Market", "sa").expect(200)).body.data.cart;
    assert.equal(Math.round(cart.subtotal * 3.75 * 100) / 100, 349);
    assert.equal(Math.round(cart.items[0].price * 3.75 * 100) / 100, 349);
    const placed = await request(app).post("/api/orders").set("Host", HOST).set("Authorization", `Bearer ${customerToken}`)
      .send({ shippingAddress: SA_ADDRESS, paymentMethod: "cod" });
    assert.equal(placed.status, 201, JSON.stringify(placed.body));
    const order = placed.body.responseObject;
    assert.equal(order.presentmentCurrency, "SAR");
    assert.equal(order.presentmentSubtotal, 349);
    assert.equal(order.products[0].presentmentPrice, 349);
    // The pricing-currency record is what 349 SAR is worth.
    assert.ok(Math.abs(order.subtotal - 349 / 3.75) < 0.01, `subtotal was ${order.subtotal}`);
  });

  it("a region's currency needs a rate; without one it keeps its adjustment in the pricing currency", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await setUsdRates(app, adminToken, {});
    const blocked = await request(app).post("/api/store-settings/markets").set("Host", HOST).set("Authorization", `Bearer ${adminToken}`)
      .send(EU_MARKET);
    assert.equal(blocked.status, 400);
    assert.equal(blocked.body.code, "MARKET_CURRENCY_NO_RATE");

    await setUsdRates(app, adminToken, { EUR: 0.9 });
    await request(app).post("/api/store-settings/markets").set("Host", HOST).set("Authorization", `Bearer ${adminToken}`)
      .send(EU_MARKET).expect(201);
    // The rate is removed later: EU shoppers see USD with the +10%.
    await setUsdRates(app, adminToken, {});
    const info = (await request(app).get("/storefront/store-info").set("Host", HOST).set("CF-IPCountry", "DE").expect(200)).body.data.store;
    assert.equal(info.markets.find((m) => m.code === "eu").currency, "USD");

    const { product } = await seedProduct(tenantId);
    const customerToken = await registerCustomer(app);
    const order = await placeOrder(app, customerToken, product._id, EU_ADDRESS);
    assert.equal(order.presentmentCurrency, "USD");
    assert.equal(order.marketCode, "eu");
    assert.equal(order.presentmentTotal, 110);
  });

  it("a region can offer only some payment methods", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await setUsdRates(app, adminToken);
    await request(app).post("/api/store-settings/markets").set("Host", HOST).set("Authorization", `Bearer ${adminToken}`)
      .send({ ...NA_MARKET, paymentMethods: ["bank_transfer"] }).expect(201);
    const { models, product } = await seedProduct(tenantId);
    if (!(await models.PaymentMethod.findOne({ code: "cod" }))) {
      await models.PaymentMethod.create({ code: "cod", type: "cod", label: "Cash on delivery", enabled: true });
    }

    const all = (await request(app).get("/storefront/payment-methods").set("Host", HOST).expect(200)).body.data.methods;
    assert.ok(all.some((m) => m.code === "cod"));
    const na = (await request(app).get("/storefront/payment-methods?market=na").set("Host", HOST).expect(200)).body.data.methods;
    assert.ok(!na.some((m) => m.code === "cod"), "the region doesn't offer cash on delivery");

    const customerToken = await registerCustomer(app);
    await request(app).post("/api/cart/add").set("Host", HOST).set("Authorization", `Bearer ${customerToken}`)
      .send({ productId: product._id.toString(), quantity: 1 }).expect(200);
    const res = await request(app).post("/api/orders").set("Host", HOST).set("Authorization", `Bearer ${customerToken}`)
      .send({ shippingAddress: US_ADDRESS, paymentMethod: "cod", paymentMethodCode: "cod" });
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.match(res.body.message, /region/);
  });

  it("automatic rates follow the platform rate plus the merchant's margin", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    const { setFxTable } = await import("../../services/platform/billing/fx.js");
    const { refreshAutoRates } = await import("../../services/autoRates.js");
    await setFxTable({ base: "USD", rates: { SAR: 3.75 } });
    const put = (body) =>
      request(app).put("/api/store-settings/currencies").set("Host", HOST).set("Authorization", `Bearer ${adminToken}`).send(body);

    const missing = await put({ base: "USD", rates: {}, auto: [{ code: "EGP", margin: 0 }] });
    assert.equal(missing.status, 400);
    assert.equal(missing.body.code, "AUTO_RATE_UNAVAILABLE");

    const saved = await put({ base: "USD", rates: {}, auto: [{ code: "SAR", margin: 0.02 }] });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.data.rates.SAR, 3.825);
    const listed = (await request(app).get("/api/store-settings/markets").set("Host", HOST).set("Authorization", `Bearer ${adminToken}`).expect(200)).body.data;
    assert.equal(listed.platformRates.SAR, 3.75);

    // The platform updates its rate: the store follows.
    const { after } = await setFxTable({ base: "USD", rates: { SAR: 4 } });
    await refreshAutoRates(after);
    const tenant = await mongoose.model("Tenant").findById(tenantId).lean();
    assert.equal(tenant.settings.currencies.rates.SAR, 4.08);
  });

  it("Markets (with currencies) works with only the Currencies switch on", async () => {
    await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    invalidateFeatureFlagCache();
    invalidateTenantFeatureCache();
    await setFeatureOverrides([{ key: "settings.markets", value: false }, { key: "settings.currencies", value: true }], "test");
    await setUsdRates(app, adminToken, { SDG: 600 });
    const res = await request(app).get("/api/store-settings/currencies").set("Host", HOST).set("Authorization", `Bearer ${adminToken}`);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.currencies.base, "USD");
    assert.equal(res.body.data.currencies.rates.SDG, 600);
    // Markets and currencies are one page: either switch opens it.
    await request(app).get("/api/store-settings/markets").set("Host", HOST).set("Authorization", `Bearer ${adminToken}`).expect(200);
  });

  it("a market saves its exchange rate with it; the first market is the default", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await setUsdRates(app, adminToken, {});
    const post = (body) =>
      request(app).post("/api/store-settings/markets").set("Host", HOST).set("Authorization", `Bearer ${adminToken}`).send(body);

    const sd = await post({ code: "sd", name: "Sudan", countries: ["SD"], currency: "SDG", rate: 2600, rounding: "100" });
    assert.equal(sd.status, 201, JSON.stringify(sd.body));
    assert.equal(sd.body.data.isDefault, true, "the first market is the default");
    const sa = await post({ code: "sa", name: "Saudi", countries: ["SA"], currency: "SAR", rate: 3.75, pricing: "fixed" });
    assert.equal(sa.status, 201, JSON.stringify(sa.body));
    assert.equal(sa.body.data.isDefault, false);
    assert.equal(sa.body.data.pricing, "fixed");
    assert.equal((await post({ code: "eg", name: "Egypt", countries: ["EG"], currency: "EGP", rate: -1 })).status, 400);

    let listed = (await request(app).get("/api/store-settings/markets").set("Host", HOST).set("Authorization", `Bearer ${adminToken}`).expect(200)).body.data;
    assert.equal(listed.currencies.rates.SDG, 2600);
    assert.equal(listed.currencies.rates.SAR, 3.75);

    // The price table saves a product's own price alone; nothing else changes.
    const { product } = await seedProduct(tenantId);
    const upd = await request(app).put(`/api/products/${product._id}`).set("Host", HOST).set("Authorization", `Bearer ${adminToken}`)
      .send({ prices: { SAR: 79 } });
    assert.equal(upd.status, 200, JSON.stringify(upd.body));
    const stored = await mongoose.model("Product").db.collection("products").findOne({ _id: product._id });
    assert.equal(stored.prices.SAR, 79);
    assert.equal(stored.name, "Hoodie");
    assert.equal(stored.price, 100);

    // Deleting the default market makes the next one the default.
    await request(app).delete(`/api/store-settings/markets/${sd.body.data._id}`).set("Host", HOST).set("Authorization", `Bearer ${adminToken}`).expect(200);
    listed = (await request(app).get("/api/store-settings/markets").set("Host", HOST).set("Authorization", `Bearer ${adminToken}`).expect(200)).body.data;
    assert.deepEqual(listed.markets.map((m) => [m.code, m.isDefault]), [["sa", true]]);
  });

  it("a delivery zone is priced in its customers' currency", async () => {
    const tenantId = await provisionTenant(app);
    const adminToken = await loginAdmin(app);
    await setUsdRates(app, adminToken, {});
    const zone = (body) =>
      request(app).post("/api/store-settings/shipping/zones").set("Host", HOST).set("Authorization", `Bearer ${adminToken}`).send(body);
    const riyadh = { name: "Riyadh", countries: ["SA"], currency: "SAR", rates: [{ name: "Delivery", price: 30 }] };
    // A currency without an exchange rate can't price delivery.
    const refused = await zone(riyadh);
    assert.equal(refused.status, 400);
    assert.equal(refused.body.code, "ZONE_CURRENCY_NO_RATE");

    await request(app).post("/api/store-settings/markets").set("Host", HOST).set("Authorization", `Bearer ${adminToken}`)
      .send({ ...SA_MARKET, rate: 3.75, rounding: "none" }).expect(201);
    const saved = await zone(riyadh);
    assert.equal(saved.status, 201, JSON.stringify(saved.body));
    assert.equal(saved.body.data.currency, "SAR");
    await request(app).put("/api/store-settings").set("Host", HOST).set("Authorization", `Bearer ${adminToken}`)
      .send({ shipping: { type: "zone" } }).expect(200);

    const { product } = await seedProduct(tenantId);
    const customerToken = await registerCustomer(app);
    await request(app).post("/api/cart/add").set("Host", HOST).set("Authorization", `Bearer ${customerToken}`)
      .send({ productId: product._id.toString(), quantity: 1 }).expect(200);
    const res = await request(app).post("/storefront/checkout/quote").set("Host", HOST).set("Authorization", `Bearer ${customerToken}`)
      .send({ shippingAddress: { ...SA_ADDRESS, country: "Saudi Arabia" } }).expect(200);
    const { quote } = res.body.data;
    // 30 SAR is 8 USD, and the customer pays exactly 30 SAR for delivery.
    assert.equal(quote.marketCode, "sa");
    assert.equal(quote.shippingCost, 8);
    assert.equal(quote.presentmentShipping, 30);
    assert.equal(quote.presentmentTotal, 375 + 30);
  });
});
