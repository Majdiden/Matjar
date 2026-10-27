import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyRounding,
  contextForMarket,
  resolvePricingContext,
  unitPresentmentPrice,
  localizeProduct,
  marketPaymentMethods,
} from "../../services/regionalPricing.js";
import { autoRatesFor } from "../../services/autoRates.js";

const currencies = { base: "USD", rates: { SAR: 3.75, SDG: 600 } };

describe("regional prices", () => {
  it("rounds converted prices up by the rule", () => {
    assert.equal(applyRounding(37.5, "none"), 37.5);
    assert.equal(applyRounding(37.5, "5"), 40);
    assert.equal(applyRounding(40, "5"), 40);
    assert.equal(applyRounding(60000.4, "1000"), 61000);
    assert.equal(applyRounding(37.2, "0.99"), 37.99);
    assert.equal(applyRounding(37, "0.99"), 36.99);
    assert.equal(applyRounding(12.01, "1"), 13);
  });

  it("uses the merchant's own price, else the converted and rounded one", () => {
    const ctx = contextForMarket({ code: "sa", currency: "SAR", priceAdjustmentPct: 0.1, rounding: "5" }, currencies);
    assert.equal(unitPresentmentPrice({ price: 100, prices: { SAR: 349 } }, null, ctx).amount, 349);
    // 10 × 1.1 × 3.75 = 41.25 → 45
    assert.equal(unitPresentmentPrice({ price: 10 }, null, ctx).amount, 45);
    // A variant with its own price uses only its own regional prices.
    const product = { price: 100, prices: { SAR: 349 } };
    assert.equal(unitPresentmentPrice(product, { price: 20 }, ctx).amount, 85); // 82.5 → 85
    assert.equal(unitPresentmentPrice(product, { price: 20, prices: { SAR: 79 } }, ctx).amount, 79);
    assert.equal(unitPresentmentPrice(product, { stock: 1 }, ctx).amount, 349); // inherits
  });

  it("a region without a rate keeps its adjustment in the pricing currency", () => {
    const ctx = contextForMarket({ code: "eu", currency: "EUR", priceAdjustmentPct: 0.1 }, currencies);
    assert.equal(ctx.currency, "USD");
    assert.equal(ctx.missingRate, true);
    assert.ok(Math.abs(ctx.factor - 1.1) < 1e-12);
  });

  it("resolves the shopper's pricing: shipping country, chosen region, then website currency", () => {
    const tenant = {
      settings: {
        currency: "USD",
        currencies: { ...currencies, display: "SDG", rounding: "100" },
        markets: [{ code: "sa", countries: ["SA"], currency: "SAR", enabled: true }],
      },
    };
    assert.equal(resolvePricingContext(tenant, { country: "SA" }).currency, "SAR");
    assert.equal(resolvePricingContext(tenant, { marketCode: "sa" }).currency, "SAR");
    const web = resolvePricingContext(tenant, { country: "SD" });
    assert.equal(web.currency, "SDG");
    assert.equal(web.rounding, "100");
  });

  it("rewrites a product to the pricing-currency equivalent of what is paid", () => {
    const ctx = contextForMarket({ code: "sa", currency: "SAR", rounding: "5" }, currencies);
    const p = localizeProduct(
      { slug: "x", price: 100, compareAtPrice: 120, prices: { SAR: 349 }, variants: [{ price: 20 }, { stock: 2 }] },
      ctx
    );
    assert.equal(Math.round(p.price * 3.75 * 100) / 100, 349);
    // The "was" price keeps its ratio to the own price: 120 / 100 × 349.
    assert.equal(Math.round(p.compareAtPrice * 3.75 * 100) / 100, 418.8);
    assert.equal(Math.round(p.variants[0].price * 3.75 * 100) / 100, 75);
    assert.equal(p.variants[1].price, undefined);
    assert.equal(p.prices, undefined);
  });

  it("lists a region's payment methods (none = all)", () => {
    const tenant = { settings: { markets: [{ code: "sd", enabled: true, paymentMethods: ["bankak"] }, { code: "sa", enabled: true }] } };
    assert.deepEqual(marketPaymentMethods(tenant, "sd"), ["bankak"]);
    assert.equal(marketPaymentMethods(tenant, "sa"), null);
    assert.equal(marketPaymentMethods(tenant, null), null);
  });

  it("automatic rates are the platform rate plus the margin", () => {
    const table = { base: "SDG", rates: { USD: 1 / 600, SAR: 1 / 160 } };
    const { rates, missing } = autoRatesFor(table, "USD", [{ code: "SDG", margin: 0.05 }, { code: "SAR", margin: 0 }, { code: "EGP" }]);
    assert.equal(rates.SDG, 630);
    assert.equal(rates.SAR, 3.75);
    assert.deepEqual(missing, ["EGP"]);
  });
});
