/**
 * DB-backed integration tests for order lifecycle business rules.
 *
 * Covers:
 *   - Atomic stock decrement guard (two concurrent buyers can't both win
 *     the last unit).
 *   - cancelOrderService restores inventory on Pending/Processing cancel.
 *   - createReturnService creates an RMA attached to an order.
 *
 * Uses the real in-memory replset + real models + real services. No
 * stubs. A single suite so the DB boots once.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { createScopedModels } from "../../utils/scopedModel.js";
import {
  decrementStockRepo,
  incrementStockRepo,
} from "../../repositories/product.js";
import { cancelOrderService, createReturnService } from "../../services/order.js";

let tenantId;
let models;

async function setupTenantAndProduct({ stock = 10 } = {}) {
  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.create({
    name: "Test Store",
    slug: "teststore",
    email: "owner@test.invalid",
    domains: { subdomain: { name: "teststore" }, primaryDomain: "subdomain" },
    settings: { currency: "USD" },
  });
  tenantId = tenant._id;
  models = createScopedModels(mongoose.connection, tenantId);

  const category = await models.Category.create({ name: "Gear", slug: "gear" });
  const product = await models.Product.create({
    name: "Widget",
    slug: "widget",
    description: "A widget.",
    category: category._id,
    price: 10,
    stock,
    sku: "WDG-1",
  });
  const user = await models.User.create({
    name: "Alice",
    email: "alice@example.com",
    password: "password123",
    roles: ["customer"],
  });
  return { product, user };
}

describe("Order lifecycle (DB-backed)", () => {
  before(async () => {
    await startTestDb();
  });
  after(async () => {
    await stopTestDb();
  });
  beforeEach(async () => {
    await clearAllCollections();
  });

  it("decrementStockRepo is atomic — guard prevents oversell", async () => {
    const { product } = await setupTenantAndProduct({ stock: 1 });
    const [a, b] = await Promise.all([
      decrementStockRepo(models, product._id, 1),
      decrementStockRepo(models, product._id, 1),
    ]);
    // Exactly one winner.
    const winners = [a, b].filter((x) => x !== null);
    assert.equal(winners.length, 1, "only one concurrent decrement should succeed");
    const fresh = await models.Product.findById(product._id);
    assert.equal(fresh.stock, 0);
  });

  it("incrementStockRepo rolls stock back up (no upper bound)", async () => {
    const { product } = await setupTenantAndProduct({ stock: 5 });
    await incrementStockRepo(models, product._id, 3);
    const fresh = await models.Product.findById(product._id);
    assert.equal(fresh.stock, 8);
  });

  it("cancelOrderService restores inventory on Processing cancel", async () => {
    const { product, user } = await setupTenantAndProduct({ stock: 10 });
    // Take 4 out of stock to simulate what createOrder would have done.
    await decrementStockRepo(models, product._id, 4);
    const order = await models.Order.create({
      user: user._id,
      products: [{ product: product._id, name: product.name, quantity: 4, price: 10 }],
      subtotal: 40,
      totalAmount: 40,
      status: "Processing",
      paymentMethod: "cash_on_delivery",
    });

    await cancelOrderService(models, order._id, String(user._id), ["customer"]);

    const fresh = await models.Product.findById(product._id);
    assert.equal(fresh.stock, 10, "stock must be restored to pre-order level");
    const cancelled = await models.Order.findById(order._id);
    assert.equal(cancelled.status, "Cancelled");
  });

  it("cancelOrderService rejects cancel on Shipped orders", async () => {
    const { product, user } = await setupTenantAndProduct({ stock: 10 });
    const order = await models.Order.create({
      user: user._id,
      products: [{ product: product._id, name: product.name, quantity: 1, price: 10 }],
      subtotal: 10,
      totalAmount: 10,
      status: "Shipped",
      paymentMethod: "cash_on_delivery",
    });
    await assert.rejects(
      () => cancelOrderService(models, order._id, String(user._id), ["admin"]),
      /Cannot cancel/
    );
  });

  it("createReturnService opens an RMA on a Delivered order", async () => {
    const { product, user } = await setupTenantAndProduct({ stock: 10 });
    const order = await models.Order.create({
      user: user._id,
      products: [{ product: product._id, name: product.name, quantity: 2, price: 10, fulfilledQuantity: 2 }],
      subtotal: 20,
      totalAmount: 20,
      status: "Delivered",
      paymentMethod: "cash_on_delivery",
    });
    const lineId = order.products[0]._id;

    const result = await createReturnService(
      models,
      order._id,
      { items: [{ orderLineId: lineId, quantity: 1, reason: "damaged" }], reason: "damaged on arrival" },
      String(user._id),
      ["orders.write"]
    );
    assert.equal(result.success, true);
    const reloaded = await models.Order.findById(order._id);
    assert.equal(reloaded.returns.length, 1, "a return must be appended");
    const rma = reloaded.returns[0];
    assert.equal(rma.status, "Requested");
    assert.equal(rma.items[0].quantity, 1);
  });

  it("createReturnService accepts legacy Delivered orders without fulfilledQuantity", async () => {
    const { product, user } = await setupTenantAndProduct({ stock: 10 });
    const order = await models.Order.create({
      user: user._id,
      products: [{ product: product._id, name: product.name, quantity: 2, price: 10 }],
      subtotal: 20,
      totalAmount: 20,
      status: "Delivered",
      paymentMethod: "cash_on_delivery",
    });
    const lineId = order.products[0]._id;

    const result = await createReturnService(
      models,
      order._id,
      { items: [{ orderLineId: lineId, quantity: 1, reason: "wrong size" }], reason: "wrong size" },
      String(user._id),
      ["orders.write"]
    );

    assert.equal(result.success, true);
    const reloaded = await models.Order.findById(order._id);
    assert.equal(reloaded.returns.length, 1);
    assert.equal(reloaded.returns[0].items[0].quantity, 1);
  });
});
