/**
 * markets / presentment — pure logic tests (no DB).
 *
 * Covers the merchant-facing invariants:
 *   - base→presentment FX roundtrip
 *   - default-market fallback
 *   - priceAdjustmentPct flows into subtotal/tax but NOT shipping
 *   - shipping tax toggle and inclusive tax flag interactions are in
 *     tests/unit/tax.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveMarket,
  convertCurrency,
  applyPresentment,
} from "../../services/markets.js";

const currencies = { base: "USD", rates: { EUR: 0.9, GBP: 0.8 } };

const tenant = {
  settings: {
    markets: [
      { code: "us", enabled: true, isDefault: true, countries: ["US"], currency: "USD", priceAdjustmentPct: 0 },
      { code: "eu", enabled: true, countries: ["DE", "FR"], currency: "EUR", priceAdjustmentPct: 0.10 },
      { code: "uk", enabled: false, countries: ["GB"], currency: "GBP", priceAdjustmentPct: 0 },
    ],
  },
};

describe("resolveMarket", () => {
  it("matches by country (case-insensitive)", () => {
    assert.equal(resolveMarket(tenant, "de").code, "eu");
    assert.equal(resolveMarket(tenant, "DE").code, "eu");
  });
  it("ignores disabled markets", () => {
    assert.equal(resolveMarket(tenant, "GB").code, "us"); // disabled uk → default
  });
  it("falls back to default when country unknown", () => {
    assert.equal(resolveMarket(tenant, "JP").code, "us");
  });
  it("returns null when no enabled markets", () => {
    assert.equal(resolveMarket({ settings: { markets: [] } }, "US"), null);
  });
});

describe("convertCurrency", () => {
  it("returns amount unchanged for same currency", () => {
    assert.equal(convertCurrency(100, "USD", "USD", currencies), 100);
  });
  it("base → other uses multiplier", () => {
    assert.equal(convertCurrency(100, "USD", "EUR", currencies), 90);
  });
  it("other → base divides by multiplier", () => {
    assert.equal(convertCurrency(90, "EUR", "USD", currencies), 100);
  });
  it("other → other round-trips via base", () => {
    // 100 EUR → 111.11… USD → 88.88… GBP
    const result = convertCurrency(100, "EUR", "GBP", currencies);
    assert.ok(Math.abs(result - 88.888) < 0.01);
  });
  it("throws on missing rate", () => {
    assert.throws(() => convertCurrency(100, "USD", "JPY", currencies), /Missing FX rate/);
  });
});

describe("applyPresentment", () => {
  const quote = { subtotal: 100, tax: 10, shippingCost: 5, totalAmount: 115, taxIncluded: false };

  it("no market → base currency passthrough", () => {
    const p = applyPresentment(quote, null, currencies);
    assert.equal(p.presentmentCurrency, "USD");
    assert.equal(p.fxRate, 1);
    assert.equal(p.presentmentSubtotal, 100);
    assert.equal(p.presentmentTotal, 115);
  });

  it("applies price adjustment then FX", () => {
    const eu = tenant.settings.markets[1]; // +10%, EUR
    const p = applyPresentment(quote, eu, currencies);
    assert.equal(p.presentmentCurrency, "EUR");
    assert.equal(p.fxRate, 0.9);
    // subtotal: 100 * 1.10 * 0.9 = 99
    assert.equal(p.presentmentSubtotal, 99);
    // tax: 10 * 1.10 * 0.9 = 9.9
    assert.equal(p.presentmentTax, 9.9);
    // shipping: rate-card based, NOT adjusted — just FX
    assert.equal(p.presentmentShipping, 4.5);
    // total: (110 + 5 + 11) * 0.9 = 113.4
    assert.equal(p.presentmentTotal, 113.4);
  });

  it("same-currency market still applies price adjustment", () => {
    const us = { ...tenant.settings.markets[0], priceAdjustmentPct: 0.05 };
    const p = applyPresentment(quote, us, currencies);
    assert.equal(p.presentmentCurrency, "USD");
    assert.equal(p.fxRate, 1);
    assert.equal(p.presentmentSubtotal, 105);
  });
});
