/**
 * Stock concurrency tests.
 *
 * The atomic guard in repositories/product.js (`stock: { $gte: quantity }` +
 * `$inc: { stock: -quantity }`) is the *only* thing standing between us and
 * overselling. These tests fire many concurrent decrements at the same
 * product to prove the conditional update is actually conditional.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";

const TENANT_ID = new mongoose.Types.ObjectId();
const CATEGORY_ID = new mongoose.Types.ObjectId();

async function makeProduct(stock, overrides = {}) {
  const Product = mongoose.connection.model("Product");
  return Product.create({
    tenantId: TENANT_ID,
    name: "Limited Item",
    slug: `limited-${Date.now()}-${Math.random()}`,
    description: "test",
    price: 10,
    category: CATEGORY_ID,
    stock,
    ...overrides,
  });
}

async function decrement(productId, qty) {
  const Product = mongoose.connection.model("Product");
  return Product.findOneAndUpdate(
    { _id: productId, stock: { $gte: qty } },
    { $inc: { stock: -qty } },
    { new: true }
  );
}

describe("Stock concurrency", () => {
  before(async () => {
    await startTestDb();
  });

  after(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await clearAllCollections();
  });

  it("never lets stock go negative under concurrent decrements", async () => {
    const product = await makeProduct(10);

    // 50 concurrent buyers each trying to take 1 unit. Only 10 can succeed.
    const attempts = await Promise.all(
      Array.from({ length: 50 }, () => decrement(product._id, 1))
    );

    const successes = attempts.filter((r) => r !== null).length;
    const failures = attempts.filter((r) => r === null).length;

    assert.equal(successes, 10, "exactly 10 decrements should succeed");
    assert.equal(failures, 40, "the other 40 must fail");

    const Product = mongoose.connection.model("Product");
    const fresh = await Product.findById(product._id).lean();
    assert.equal(fresh.stock, 0, "stock must end at exactly 0");
  });

  it("rejects oversized decrements while letting smaller ones through", async () => {
    const product = await makeProduct(5);

    const attempts = await Promise.all([
      decrement(product._id, 3),
      decrement(product._id, 3),
      decrement(product._id, 3),
      decrement(product._id, 2),
      decrement(product._id, 1),
    ]);

    const successQuantities = attempts
      .map((r, i) => (r ? [3, 3, 3, 2, 1][i] : 0))
      .filter((q) => q > 0);
    const totalTaken = successQuantities.reduce((a, b) => a + b, 0);

    assert.ok(totalTaken <= 5, `total taken (${totalTaken}) must not exceed initial stock`);
    assert.ok(totalTaken >= 1, "at least one decrement should have succeeded");

    const Product = mongoose.connection.model("Product");
    const fresh = await Product.findById(product._id).lean();
    assert.equal(fresh.stock, 5 - totalTaken);
    assert.ok(fresh.stock >= 0);
  });

  it("variant-level decrement is also atomic", async () => {
    const Product = mongoose.connection.model("Product");
    const variantId = new mongoose.Types.ObjectId();
    const product = await Product.create({
      tenantId: TENANT_ID,
      name: "Variant Item",
      slug: `variant-${Date.now()}`,
      description: "test",
      price: 10,
      category: CATEGORY_ID,
      stock: 0,
      hasVariants: true,
      variants: [{ _id: variantId, name: "Small", sku: "S-001", stock: 7 }],
    });

    const decrementVariant = (qty) =>
      Product.findOneAndUpdate(
        {
          _id: product._id,
          variants: { $elemMatch: { _id: variantId, stock: { $gte: qty } } },
        },
        { $inc: { "variants.$.stock": -qty } },
        { new: true }
      );

    const attempts = await Promise.all(
      Array.from({ length: 30 }, () => decrementVariant(1))
    );
    const successes = attempts.filter((r) => r !== null).length;
    assert.equal(successes, 7, "exactly 7 variant decrements should succeed");

    const fresh = await Product.findById(product._id).lean();
    const variant = fresh.variants.find((v) => String(v._id) === String(variantId));
    assert.equal(variant.stock, 0);
  });
});
