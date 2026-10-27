/**
 * E2E: delivery areas (shipping zones) at checkout (PBI 10-50).
 *
 * A store that delivers by zone lists its zones' names in store-info (no
 * prices); the shopper picks one at checkout, the quote prices that zone, and
 * the order records it. With several zones an order needs the pick; with one
 * zone it is used without asking.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { createScopedModels } from "../../utils/scopedModel.js";

const HOST = "acme.localhost";

const ZONES = [
  { name: "Khartoum", countries: ["SA"], rates: [{ name: "Delivery", price: 5 }] },
  { name: "Omdurman", countries: ["SA"], rates: [{ name: "Delivery", price: 9 }] },
];

const ADDRESS = {
  firstName: "Jane",
  lastName: "Doe",
  addressLine1: "Street 15, house 4",
  city: "Khartoum",
  state: "",
  postalCode: "11111",
  country: "SA",
  phone: "+966501234567",
};

async function setup(app, zones = ZONES) {
  const reg = await request(app)
    .post("/api/auth/register")
    .send({ name: "Acme", email: "owner@acme.test", password: "Sup3rSecret!", subdomain: "acme" })
    .expect(201);
  const tenantId = reg.body.responseObject.tenantId;
  const login = await request(app)
    .post("/api/auth/login")
    .set("Host", HOST)
    .send({ email: "owner@acme.test", password: "Sup3rSecret!", domain: HOST })
    .expect(200);
  const adminToken = login.body.responseObject.accessToken;
  const settings = await request(app)
    .put("/api/store-settings")
    .set("Host", HOST)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ shipping: { type: "zone", zones } });
  assert.equal(settings.status, 200, JSON.stringify(settings.body));
  const savedZones = settings.body.data.shipping.zones;

  const models = createScopedModels(mongoose.connection, tenantId);
  const category = await models.Category.create({ name: "Perfume", slug: "perfume", description: "x" });
  const product = await models.Product.create({
    name: "Oud",
    slug: "oud",
    sku: "OUD-1",
    description: "x",
    price: 20,
    category: category._id,
    stock: 10,
    status: "active",
    images: [],
  });

  const customer = await request(app)
    .post("/storefront/auth/register")
    .set("Host", HOST)
    .send({ name: "Jane Doe", email: "jane@buyer.test", password: "Sup3rSecret!" })
    .expect(201);
  const token = customer.body.data.accessToken;
  await request(app)
    .post("/api/cart/add")
    .set("Host", HOST)
    .set("Authorization", `Bearer ${token}`)
    .send({ productId: product._id.toString(), quantity: 1 })
    .expect(200);
  return { token, savedZones, models };
}

describe("E2E delivery areas at checkout", () => {
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
  });

  it("store-info lists the zone names only, without prices", async () => {
    const { savedZones } = await setup(app);
    const res = await request(app).get("/storefront/store-info").set("Host", HOST).expect(200);
    const areas = res.body.data.store.deliveryZones;
    assert.deepEqual(
      areas,
      savedZones.map((z) => ({ id: String(z._id), name: z.name, countries: z.countries }))
    );
    assert.ok(!JSON.stringify(areas).includes("price"));
    // Checkout offers only the countries the store delivers to.
    assert.deepEqual(res.body.data.store.shipCountries, ["SA"]);
  });

  it("the quote prices the picked zone, not the first one for the country", async () => {
    const { token, savedZones } = await setup(app);
    const omdurman = savedZones.find((z) => z.name === "Omdurman");
    const res = await request(app)
      .post("/storefront/checkout/quote")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${token}`)
      .send({ shippingAddress: { ...ADDRESS, deliveryZoneId: String(omdurman._id) } })
      .expect(200);
    const { quote } = res.body.data;
    assert.equal(quote.shippingCost, 9, JSON.stringify(quote));
    assert.equal(quote.totalAmount, 29);
    assert.deepEqual(quote.deliveryZone, { id: String(omdurman._id), name: "Omdurman" });
  });

  it("an order without a picked zone is refused when the store has several", async () => {
    const { token } = await setup(app);
    const res = await request(app)
      .post("/api/orders")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${token}`)
      .send({ shippingAddress: ADDRESS, paymentMethod: "cod" });
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.match(JSON.stringify(res.body), /DELIVERY_ZONE_REQUIRED/);
  });

  it("an unknown zone id counts as not picked", async () => {
    const { token } = await setup(app);
    const res = await request(app)
      .post("/api/orders")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${token}`)
      .send({ shippingAddress: { ...ADDRESS, deliveryZoneId: "000000000000000000000000" }, paymentMethod: "cod" });
    assert.equal(res.status, 400);
  });

  it("the order records the picked zone and charges its price", async () => {
    const { token, savedZones, models } = await setup(app);
    const omdurman = savedZones.find((z) => z.name === "Omdurman");
    const res = await request(app)
      .post("/storefront/orders")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${token}`)
      .send({
        // A tampered area name is replaced by the picked zone's name.
        shippingAddress: { ...ADDRESS, state: "Elsewhere", deliveryZoneId: String(omdurman._id) },
        paymentMethod: "cod",
      });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const order = res.body.responseObject.order || res.body.responseObject;
    assert.equal(order.shippingCost, 9);
    const saved = await models.Order.findById(order._id).lean();
    assert.equal(saved.shippingAddress.state, "Omdurman");
    assert.equal(saved.shippingAddress.deliveryZoneId, String(omdurman._id));
  });

  it("a store with one zone uses it without a pick", async () => {
    const { token, models } = await setup(app, [ZONES[1]]);
    const res = await request(app)
      .post("/api/orders")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${token}`)
      .send({ shippingAddress: ADDRESS, paymentMethod: "cod" });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.responseObject.shippingCost, 9);
    const saved = await models.Order.findById(res.body.responseObject._id).lean();
    assert.equal(saved.shippingAddress.state, "Omdurman");
  });

  it("the country picks the area when it has only one; the address may carry the country name", async () => {
    const { token } = await setup(app, [
      ...ZONES,
      { name: "Cairo", countries: ["EG"], rates: [{ name: "Delivery", price: 12 }] },
    ]);
    const res = await request(app)
      .post("/storefront/checkout/quote")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${token}`)
      .send({ shippingAddress: { ...ADDRESS, city: "Cairo", country: "Egypt" } })
      .expect(200);
    const { quote } = res.body.data;
    assert.equal(quote.shippingCost, 12, JSON.stringify(quote));
    assert.equal(quote.deliveryZone.name, "Cairo");
    assert.ok(!quote.deliveryZoneMissing);
    // A zone of another country is not accepted for this address.
    const sa = await request(app)
      .post("/storefront/checkout/quote")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${token}`)
      .send({ shippingAddress: { ...ADDRESS, country: "Saudi Arabia" } })
      .expect(200);
    assert.equal(sa.body.data.quote.deliveryZoneMissing, true, "Saudi Arabia has two areas: one must be picked");
  });
});
