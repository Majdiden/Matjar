import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { visitorCountry } from "../../utils/visitorCountry.js";
import { applyPresentment } from "../../services/markets.js";
import { buildStoreInfo } from "../../services/storefrontStoreInfo.js";

describe("regions", () => {
  it("reads the visitor's country from CDN headers, ignoring unknowns", () => {
    assert.equal(visitorCountry({ headers: { "cf-ipcountry": "sa" } }), "SA");
    assert.equal(visitorCountry({ headers: { "cf-ipcountry": "XX", "x-vercel-ip-country": "AE" } }), "AE");
    assert.equal(visitorCountry({ headers: {} }), null);
    assert.equal(visitorCountry({ headers: { "cf-ipcountry": "Saudi" } }), null);
  });

  it("a region total includes the discount (adjusted like prices)", () => {
    // 100 of goods, 20 off, 10 shipping, no tax → base total 90.
    const quote = { subtotal: 100, discount: 20, shippingDiscount: 0, shippingCost: 10, tax: 0, taxIncluded: false, totalAmount: 90 };
    const market = { code: "sa", currency: "SAR", priceAdjustmentPct: 0.1 };
    const p = applyPresentment(quote, market, { base: "USD", rates: { SAR: 4 } });
    // Goods after discount 80 × 1.1 = 88, + shipping 10 → 98 USD → × 4.
    assert.equal(p.presentmentTotal, 392);
    assert.equal(p.presentmentDiscount, 88); // 20 × 1.1 × 4
    assert.ok(Math.abs(p.presentmentPriceFactor - 4.4) < 1e-9);
  });

  it("the store payload lists the regions and picks the visitor's", () => {
    const tenant = {
      name: "Store",
      settings: {
        currency: "USD",
        currencies: { base: "USD", rates: { SDG: 600, SAR: 3.75 } },
        markets: [
          { code: "sd", name: "Sudan", countries: ["SD"], currency: "SDG", enabled: true, isDefault: true },
          { code: "sa", name: "Saudi", countries: ["SA"], currency: "SAR", priceAdjustmentPct: 0.1, enabled: true },
          { code: "eu", name: "Europe", countries: ["DE"], currency: "EUR", enabled: true }, // no rate: shown in USD
          { code: "off", name: "Off", countries: ["EG"], currency: "SDG", enabled: false },
        ],
      },
    };
    const sa = buildStoreInfo(tenant, { visitorCountry: "SA" });
    assert.deepEqual(sa.markets.map((m) => m.code), ["sd", "sa", "eu"]);
    assert.equal(sa.markets[2].currency, "USD");
    assert.equal(sa.market, "sa");
    assert.equal(sa.markets[1].priceAdjustmentPct, 0.1);
    assert.equal(sa.currencyRates.SAR, 3.75);
    assert.equal(buildStoreInfo(tenant, { visitorCountry: "US" }).market, "sd"); // default
    assert.equal(buildStoreInfo({ name: "x", settings: { currency: "SDG" } }).markets, undefined);
  });
});
