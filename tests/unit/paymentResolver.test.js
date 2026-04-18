/**
 * paymentResolver unit tests.
 * Guards the tenant-first / platform-fallback precedence so a merchant
 * bringing their own Stripe keys isn't silently shadowed by platform env.
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { resolvePaymentProvider } from "../../services/providers/paymentResolver.js";

const ORIG_ENV = { ...process.env };

describe("paymentResolver", () => {
  beforeEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });
  afterEach(() => {
    Object.assign(process.env, ORIG_ENV);
  });

  it("returns null when no config present anywhere", () => {
    assert.equal(resolvePaymentProvider({}, "stripe"), null);
  });

  it("uses platform env when tenant has no stripe config", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_platform";
    const p = resolvePaymentProvider({}, "stripe");
    assert.ok(p);
    assert.equal(p.constructor.name, "StripeProvider");
  });

  it("prefers tenant config over platform env", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_platform";
    const tenant = {
      paymentProviders: { stripe: { enabled: true, secretKey: "sk_test_tenant" } },
    };
    const p = resolvePaymentProvider(tenant, "stripe");
    assert.ok(p);
    // The tenant's secret key is on the internal Stripe instance — we
    // can't read it directly, but the `config` passed to the provider
    // is stored on `.config`.
    assert.equal(p.config.secretKey, "sk_test_tenant");
  });

  it("ignores disabled tenant config", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_platform";
    const tenant = {
      paymentProviders: { stripe: { enabled: false, secretKey: "sk_test_tenant" } },
    };
    const p = resolvePaymentProvider(tenant, "stripe");
    assert.equal(p.config.secretKey, "sk_test_platform");
  });

  it("returns null for unknown providers with no config", () => {
    assert.equal(resolvePaymentProvider({}, "bitcoin"), null);
  });

  it("throws when tenant enables an unsupported provider", () => {
    assert.throws(
      () =>
        resolvePaymentProvider(
          { paymentProviders: { bitcoin: { enabled: true, secretKey: "x" } } },
          "bitcoin"
        ),
      /Unsupported/
    );
  });
});
