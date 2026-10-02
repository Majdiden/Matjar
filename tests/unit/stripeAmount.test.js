/**
 * Stripe charge currency + minor-unit scaling.
 * Guards against charging a base-currency total as USD, and against the
 * hardcoded x100 that mis-scales zero- and three-decimal currencies.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toStripeAmount, fromStripeAmount, minorUnitFactor } from "../../utils/stripeAmount.js";
import { StripeProvider } from "../../services/payment/StripeProvider.js";

describe("stripeAmount", () => {
  it("scales two-decimal currencies by 100", () => {
    assert.equal(toStripeAmount(12.34, "usd"), 1234);
    assert.equal(toStripeAmount(10000, "SDG"), 1000000);
    assert.equal(fromStripeAmount(1234, "usd"), 12.34);
  });

  it("does not scale zero-decimal currencies", () => {
    assert.equal(minorUnitFactor("jpy"), 1);
    assert.equal(toStripeAmount(500, "JPY"), 500);
    assert.equal(fromStripeAmount(500, "jpy"), 500);
  });

  it("scales three-decimal currencies by 1000, rounded to a multiple of 10", () => {
    assert.equal(toStripeAmount(5.125, "KWD"), 5130);
    assert.equal(toStripeAmount(5.12, "kwd"), 5120);
    assert.equal(fromStripeAmount(5120, "kwd"), 5.12);
  });

  it("avoids float drift on two-decimal amounts", () => {
    assert.equal(toStripeAmount(0.1 + 0.2, "usd"), 30);
    assert.equal(toStripeAmount(19.99, "eur"), 1999);
  });
});

function stubbedProvider() {
  const calls = [];
  const provider = new StripeProvider({ secretKey: "sk_test_x" });
  provider.stripe = {
    paymentIntents: {
      create: async (p) => {
        calls.push(["create", p]);
        return { id: "pi_1", client_secret: "cs", status: "requires_payment_method", amount: p.amount, currency: p.currency };
      },
      retrieve: async () => ({ id: "pi_1", currency: "kwd" }),
      capture: async (id, p) => {
        calls.push(["capture", p]);
        return { id, status: "succeeded", amount: p?.amount_to_capture ?? 0, currency: "kwd" };
      },
    },
    refunds: {
      create: async (p) => {
        calls.push(["refund", p]);
        return { id: "re_1", amount: p.amount, currency: "kwd", status: "succeeded" };
      },
    },
  };
  return { provider, calls };
}

describe("StripeProvider currency handling", () => {
  it("creates the intent in the given currency with its minor units", async () => {
    const { provider, calls } = stubbedProvider();
    const res = await provider.initializePayment({ amount: 500, currency: "JPY" });
    assert.deepEqual(
      { amount: calls[0][1].amount, currency: calls[0][1].currency },
      { amount: 500, currency: "jpy" }
    );
    assert.equal(res.amount, 500);
  });

  it("scales partial refunds and captures by the intent's currency", async () => {
    const { provider, calls } = stubbedProvider();
    const refund = await provider.refundPayment("pi_1", 1.5);
    assert.equal(calls[0][1].amount, 1500);
    assert.equal(refund.amount, 1.5);
    await provider.capturePayment("pi_1", 2);
    assert.equal(calls[1][1].amount_to_capture, 2000);
  });

  it("reports webhook amounts in major units of the event currency", async () => {
    const { provider } = stubbedProvider();
    const out = await provider.processWebhook({
      id: "evt_1",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_1", amount: 750, currency: "jpy", metadata: {} } },
    });
    assert.equal(out.amount, 750);
  });
});
