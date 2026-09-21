/**
 * E2E: right-to-erasure and access-request against real scoped models.
 *
 * Orders/reviews/carts/wishlists reference the customer as `user`; a
 * field-name mismatch here would make anonymisation a silent no-op while
 * the audit ledger claims the erasure happened. This test seeds a customer
 * with an order and a review, runs both operations, and checks the data.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { createScopedModels } from "../../utils/scopedModel.js";
import { anonymizeCustomer, exportCustomer } from "../../services/customerPrivacy.js";

describe("E2E customer privacy (erasure + export)", () => {
  let models;
  before(async () => { await startTestDb(); });
  after(async () => { await stopTestDb(); });
  beforeEach(async () => {
    await clearAllCollections();
    models = createScopedModels(mongoose.connection, new mongoose.Types.ObjectId());
  });

  async function seed() {
    const user = await models.User.create({
      name: "Jane Doe", firstName: "Jane", lastName: "Doe", email: "jane@buyer.test",
      phone: "+249912345678", password: "Sup3rSecret!", roles: ["customer"],
      passwordResetTokenHash: "abc", passwordResetTokenExpiresAt: new Date(Date.now() + 3600e3),
    });
    const productId = new mongoose.Types.ObjectId();
    const order = await models.Order.create({
      user: user._id, totalAmount: 10, paymentMethod: "cod",
      customerSnapshot: { email: "jane@buyer.test", firstName: "Jane", lastName: "Doe", phone: "+249912345678" },
      shippingAddress: { firstName: "Jane", lastName: "Doe", addressLine1: "12 Nile St", city: "Khartoum", country: "SD", phone: "+249912345678", deliveryInstructions: "ring twice" },
      billingAddress: { firstName: "Jane", lastName: "Doe", addressLine1: "12 Nile St", city: "Khartoum", country: "SD", phone: "+249912345678" },
      items: [{ product: productId, quantity: 1, price: 10 }],
      notes: "Leave with Jane's neighbour",
      paymentDetails: { senderName: "Jane Doe", senderPhone: "+249912345678", reference: "TX-1" },
      // Merchant-internal notes are the store's own records: kept on erasure, never exported.
      internalNotes: [{ body: "Staff-only: VIP customer", createdByName: "Staff Sam" }],
    });
    const review = await models.Review.create({ user: user._id, product: productId, rating: 5, title: "Jane's mug", comment: "Loved it, Jane Doe" });
    return { user, order, review };
  }

  it("export contains the customer's orders and reviews but no secrets", async () => {
    const { user, order } = await seed();
    const dump = await exportCustomer(models, user._id);
    assert.equal(dump.orders.length, 1);
    assert.equal(String(dump.orders[0]._id), String(order._id));
    assert.equal(dump.reviews.length, 1);
    assert.equal(dump.user.email, "jane@buyer.test");
    assert.equal(dump.user.password, undefined);
    assert.equal(dump.user.passwordResetTokenHash, undefined);
    assert.equal(dump.user.tokenVersion, undefined);
    // Merchant-internal notes and staff names never reach the data subject.
    assert.equal(dump.orders[0].internalNotes, undefined);
    assert.equal(dump.orders[0].history, undefined);
    assert.equal(JSON.stringify(dump).includes("Staff Sam"), false);
  });

  it("anonymise redacts order PII, review text and reset tokens; keeps city/country/totals", async () => {
    const { user, order, review } = await seed();
    await anonymizeCustomer(models, user._id);

    const u = await models.User.findById(user._id).lean();
    assert.equal(u.isActive, false);
    assert.ok(u.anonymizedAt);
    assert.equal(u.password, null);
    assert.equal(u.passwordResetTokenHash, null);
    assert.equal(await u.email, `redacted+${String(user._id).slice(-8)}@anonymous.invalid`);

    const o = await models.Order.findById(order._id).lean();
    assert.equal(o.totalAmount, 10);
    assert.equal(o.customerSnapshot.firstName, "Redacted Customer");
    assert.equal(o.customerSnapshot.lastName, "");
    assert.match(o.customerSnapshot.email, /anonymous\.invalid$/);
    assert.equal(o.customerSnapshot.phone, "REDACTED");
    assert.equal(o.shippingAddress.addressLine1, "Redacted Customer");
    assert.equal(o.shippingAddress.deliveryInstructions, "");
    assert.equal(o.shippingAddress.city, "Khartoum");
    assert.equal(o.shippingAddress.country, "SD");
    assert.equal(o.billingAddress.phone, "REDACTED");
    assert.equal(o.notes, "");
    assert.deepEqual(o.paymentDetails, {});
    assert.equal(JSON.stringify(o).includes("Jane"), false);
    assert.equal(JSON.stringify(o).includes("Nile"), false);

    const r = await models.Review.findById(review._id).lean();
    assert.equal(r.rating, 5);
    assert.equal(r.title, "");
    assert.equal(r.comment, "");
  });
});
