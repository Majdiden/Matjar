/** Migration 019: the website currency becomes a default market. */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { up, down } from "../../migrations/019_website_currency_to_market.js";

const tenants = () => mongoose.connection.db.collection("tenants");
const store = (name, settings) => ({
  _id: new mongoose.Types.ObjectId(), name, slug: name, domains: { subdomain: { name } }, settings,
});

describe("migration 019: website currency → default market", () => {
  before(async () => { await startTestDb(); });
  after(async () => { await stopTestDb(); });
  beforeEach(async () => { await clearAllCollections(); });

  it("adds a default market in the website currency; down() restores", async () => {
    await tenants().insertMany([
      // Priced in USD, sold in SDG with rounding and the switcher on.
      store("a", { currency: "USD", language: "ar", currencies: { base: "USD", rates: { SDG: 600 }, display: "SDG", showSwitcher: true, rounding: "100" } }),
      // Already has a default market: only the website currency is cleared.
      store("b", { currency: "USD", currencies: { base: "USD", rates: { SDG: 600 }, display: "SDG" }, markets: [{ _id: new mongoose.Types.ObjectId(), code: "sa", name: "KSA", countries: ["SA"], currency: "USD", isDefault: true }] }),
      // No website currency: untouched.
      store("c", { currency: "SDG", currencies: { base: "SDG", rates: {} } }),
    ]);
    await up(mongoose.connection.db, {});
    const by = async (name) => (await tenants().findOne({ name })).settings;
    const a = await by("a");
    assert.equal(a.markets.length, 1);
    assert.deepEqual(
      [a.markets[0].name, a.markets[0].currency, a.markets[0].isDefault, a.markets[0].rounding, a.markets[0].countries.length],
      ["السودان", "SDG", true, "100", 0]
    );
    assert.equal(a.currencies.display, null);
    assert.equal(a.currencies.showSwitcher, false);
    assert.equal((await by("b")).markets.length, 1);
    assert.equal((await by("b")).currencies.display, null);
    assert.equal((await by("c")).currencies.beforeMarkets, undefined);

    await up(mongoose.connection.db, {}); // idempotent
    assert.equal((await by("a")).markets.length, 1);

    await down(mongoose.connection.db, {});
    const restored = await by("a");
    assert.equal(restored.markets.length, 0);
    assert.equal(restored.currencies.display, "SDG");
    assert.equal(restored.currencies.showSwitcher, true);
  });
});
