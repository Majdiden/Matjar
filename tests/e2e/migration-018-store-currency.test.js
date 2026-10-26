/** Migration 018: settings.currency and settings.currencies.base become one value. */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { up, down } from "../../migrations/018_sync_store_currency.js";

const tenants = () => mongoose.connection.db.collection("tenants");

describe("migration 018: one store currency", () => {
  before(async () => { await startTestDb(); });
  after(async () => { await stopTestDb(); });
  beforeEach(async () => { await clearAllCollections(); });

  it("takes the base chosen on the Currencies tab, else keeps the store currency; down() restores", async () => {
    await tenants().insertMany([
      // Chose USD on the Currencies tab; the storefront still showed SDG.
      { _id: new mongoose.Types.ObjectId(), name: "a", slug: "a", domains: { subdomain: { name: "a" } }, settings: { currency: "SDG", currencies: { base: "USD", rates: { SDG: 600 }, ratesUpdatedAt: new Date() } } },
      // Never opened the Currencies tab: the schema default base must not win.
      { _id: new mongoose.Types.ObjectId(), name: "b", slug: "b", domains: { subdomain: { name: "b" } }, settings: { currency: "AED", currencies: { base: "SDG", rates: {}, ratesUpdatedAt: null } } },
      // Already equal: untouched.
      { _id: new mongoose.Types.ObjectId(), name: "c", slug: "c", domains: { subdomain: { name: "c" } }, settings: { currency: "SDG", currencies: { base: "SDG" } } },
    ]);
    await up(mongoose.connection.db, {});
    const by = async (name) => (await tenants().findOne({ name })).settings;
    assert.deepEqual([(await by("a")).currency, (await by("a")).currencies.base], ["USD", "USD"]);
    assert.deepEqual([(await by("b")).currency, (await by("b")).currencies.base], ["AED", "AED"]);
    assert.equal((await by("c")).currencyBeforeSync, undefined);

    await up(mongoose.connection.db, {}); // idempotent
    assert.equal((await by("a")).currencyBeforeSync, "SDG");

    await down(mongoose.connection.db, {});
    assert.equal((await by("a")).currency, "SDG");
    assert.equal((await by("a")).currencyBeforeSync, undefined);
  });
});
