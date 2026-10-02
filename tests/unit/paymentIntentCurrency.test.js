/**
 * Payment intents charge the order total in the store's currency.
 * Regression: the intent used `order.currency || "usd"`, and orders have no
 * `currency` field, so every base-currency total was charged as USD.
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

let buildPaymentIntentParams;
before(async () => {
  // services/payment.js loads config, which validates these at import time.
  process.env.DB_URI ||= "mongodb://localhost/test";
  process.env.JWT_SECRET ||= "test";
  process.env.JWT_REFRESH_SECRET ||= "test";
  process.env.REDIS_URL ||= "redis://localhost";
  ({ buildPaymentIntentParams } = await import("../../services/payment.js"));
});

const order = (fields) => ({ _id: "o1", orderNumber: "1001", totalAmount: 10000, ...fields });

describe("buildPaymentIntentParams", () => {
  it("falls back to the store currency when the order has no baseCurrency", () => {
    const p = buildPaymentIntentParams(order({}), "t1", "SDG");
    assert.equal(p.currency, "sdg");
    assert.equal(p.amount, 1000000);
  });

  it("prefers the order's recorded baseCurrency", () => {
    const p = buildPaymentIntentParams(order({ baseCurrency: "KWD", totalAmount: 5.12 }), "t1", "SDG");
    assert.equal(p.currency, "kwd");
    assert.equal(p.amount, 5120);
  });

  it("refuses to build params with no currency instead of defaulting to USD", () => {
    assert.throws(() => buildPaymentIntentParams(order({}), "t1", undefined), /currency is unknown/);
  });
});
