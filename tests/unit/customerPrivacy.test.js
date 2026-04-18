/**
 * customerPrivacy — anonymization replaces PII, preserves order IDs.
 * Uses in-memory mocks so no Mongo is required.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { anonymizeCustomer, exportCustomer } from "../../services/customerPrivacy.js";

function buildModels() {
  const saved = { user: null, orderUpdates: [] };
  const userDoc = {
    _id: "u1",
    name: "Alice",
    firstName: "Alice",
    lastName: "Smith",
    email: "alice@example.com",
    phone: "+15550001111",
    tokenVersion: 2,
    isActive: true,
    save: async function () {
      saved.user = { ...this };
      return this;
    },
  };
  return {
    saved,
    User: {
      findById: async (id) => (id === "u1" ? userDoc : null),
    },
    Order: {
      updateMany: async (filter, update) => {
        saved.orderUpdates.push({ filter, update });
        return { modifiedCount: 3 };
      },
      find: () => ({ lean: async () => [{ _id: "o1", total: 99 }] }),
    },
  };
}

describe("customerPrivacy.anonymizeCustomer", () => {
  it("redacts PII and bumps tokenVersion", async () => {
    const models = buildModels();
    const result = await anonymizeCustomer(models, "u1");
    assert.ok(result.anonymizedAt);
    assert.match(models.saved.user.email, /redacted\+.*@anonymous\.invalid/);
    assert.equal(models.saved.user.name, "Redacted Customer");
    assert.equal(models.saved.user.phone, "REDACTED");
    assert.equal(models.saved.user.isActive, false);
    assert.equal(models.saved.user.tokenVersion, 3);
    assert.equal(models.saved.orderUpdates.length, 1);
    assert.equal(models.saved.orderUpdates[0].update.$set["customer.name"], "Redacted Customer");
  });

  it("throws for missing user", async () => {
    const models = buildModels();
    await assert.rejects(() => anonymizeCustomer(models, "nope"), /User not found/);
  });
});

describe("customerPrivacy.exportCustomer", () => {
  it("returns a dump without the password field", async () => {
    const models = {
      User: { findById: (id) => ({ lean: async () => (id === "u1" ? { _id: "u1", email: "a@b.c", password: "HASH" } : null) }) },
      Order: { find: () => ({ lean: async () => [] }) },
      Review: { find: () => ({ lean: async () => [] }) },
      Wishlist: { find: () => ({ lean: async () => [] }) },
      Cart: { find: () => ({ lean: async () => [] }) },
    };
    const dump = await exportCustomer(models, "u1");
    assert.equal(dump.user.email, "a@b.c");
    assert.equal(dump.user.password, undefined);
    assert.ok(dump.exportedAt);
  });
});
