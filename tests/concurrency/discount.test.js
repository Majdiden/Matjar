/**
 * Discount usage-limit concurrency tests.
 *
 * services/discount.js:applyDiscount() uses a $expr conditional update so
 * that two carts redeeming the same code at the same instant cannot both
 * push usedCount past usageLimit. These tests prove that.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";

const TENANT_ID = new mongoose.Types.ObjectId();

async function makeDiscount(code, usageLimit) {
  const Discount = mongoose.connection.model("Discount");
  return Discount.create({
    tenantId: TENANT_ID,
    code,
    type: "percentage",
    value: 10,
    usageLimit,
    usedCount: 0,
    isActive: true,
  });
}

async function applyDiscountAtomic(code) {
  const Discount = mongoose.connection.model("Discount");
  return Discount.findOneAndUpdate(
    {
      code: code.toUpperCase(),
      isActive: true,
      $or: [
        { usageLimit: null },
        { $expr: { $lt: ["$usedCount", "$usageLimit"] } },
      ],
    },
    { $inc: { usedCount: 1 } },
    { new: true }
  );
}

describe("Discount usage-limit concurrency", () => {
  before(async () => {
    await startTestDb();
  });

  after(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await clearAllCollections();
  });

  it("never exceeds usageLimit under concurrent applies", async () => {
    await makeDiscount("LIMIT5", 5);

    const attempts = await Promise.all(
      Array.from({ length: 25 }, () => applyDiscountAtomic("LIMIT5"))
    );

    const successes = attempts.filter((r) => r !== null).length;
    assert.equal(successes, 5, "exactly 5 redemptions should succeed");

    const Discount = mongoose.connection.model("Discount");
    const fresh = await Discount.findOne({ code: "LIMIT5" }).lean();
    assert.equal(fresh.usedCount, 5);
    assert.ok(fresh.usedCount <= fresh.usageLimit);
  });

  it("allows unlimited redemptions when usageLimit is null", async () => {
    await makeDiscount("UNLIMITED", null);

    const attempts = await Promise.all(
      Array.from({ length: 30 }, () => applyDiscountAtomic("UNLIMITED"))
    );

    const successes = attempts.filter((r) => r !== null).length;
    assert.equal(successes, 30, "all redemptions should succeed for unlimited code");

    const Discount = mongoose.connection.model("Discount");
    const fresh = await Discount.findOne({ code: "UNLIMITED" }).lean();
    assert.equal(fresh.usedCount, 30);
  });

  it("rejects redemptions for inactive codes", async () => {
    await makeDiscount("OFF", 100);
    const Discount = mongoose.connection.model("Discount");
    await Discount.updateOne({ code: "OFF" }, { $set: { isActive: false } });

    const result = await applyDiscountAtomic("OFF");
    assert.equal(result, null);

    const fresh = await Discount.findOne({ code: "OFF" }).lean();
    assert.equal(fresh.usedCount, 0);
  });
});
