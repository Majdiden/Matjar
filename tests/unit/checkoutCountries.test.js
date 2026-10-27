import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toCountryCode } from "../../utils/countryCode.js";
import { storeCountries } from "../../services/shipping.js";
import { resolveMarket } from "../../services/markets.js";

describe("checkout countries", () => {
  it("reads country codes and the storefront's country names", () => {
    assert.equal(toCountryCode("SA"), "SA");
    assert.equal(toCountryCode("sd"), "SD");
    assert.equal(toCountryCode("Saudi Arabia"), "SA");
    assert.equal(toCountryCode("United Arab Emirates"), "AE");
    assert.equal(toCountryCode("Atlantis"), null);
    assert.equal(toCountryCode(""), null);
  });

  it("offers the delivery zones' countries, else the markets', else the platform's", () => {
    const zone = (countries) => ({ _id: "z", name: "z", countries, rates: [{ name: "r", price: 1 }] });
    assert.deepEqual(storeCountries({ shipping: { type: "zone", zones: [zone(["SD"]), zone(["SA"])] } }, ["EG"]), ["SD", "SA"]);
    assert.deepEqual(storeCountries({ shipping: { type: "flat" }, markets: [{ countries: ["SD"] }, { countries: ["SA", "AE"] }] }, ["EG"]), ["SD", "SA", "AE"]);
    // A market for "every other country" leaves the platform's countries.
    assert.deepEqual(storeCountries({ markets: [{ countries: ["SD"] }, { countries: [] }] }, ["SD", "EG"]), ["SD", "EG"]);
    assert.deepEqual(storeCountries({ shipping: { type: "flat" } }, ["SD"]), ["SD"]);
  });

  it("matches a market by the country name an address carries", () => {
    const tenant = { settings: { markets: [{ code: "sa", countries: ["SA"], enabled: true }, { code: "sd", countries: ["SD"], enabled: true, isDefault: true }] } };
    assert.equal(resolveMarket(tenant, "Saudi Arabia").code, "sa");
    assert.equal(resolveMarket(tenant, "SA").code, "sa");
    assert.equal(resolveMarket(tenant, "Egypt").code, "sd");
  });
});
