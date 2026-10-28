/** Migration 020: store websites open in Arabic by default. */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { up, down } from "../../migrations/020_store_language_arabic.js";

const tenants = () => mongoose.connection.db.collection("tenants");
const store = (name, settings) => ({
  _id: new mongoose.Types.ObjectId(), name, slug: name, domains: { subdomain: { name } }, settings,
});

describe("migration 020: Arabic store language", () => {
  before(async () => { await startTestDb(); });
  after(async () => { await stopTestDb(); });
  beforeEach(async () => { await clearAllCollections(); });

  it("moves English and unset stores to Arabic; down() restores", async () => {
    await tenants().insertMany([
      store("en", { language: "en" }),
      store("none", { currency: "SDG" }),
      store("ar", { language: "ar" }),
    ]);
    await up(mongoose.connection.db, {});
    const by = async (name) => (await tenants().findOne({ name })).settings;
    assert.equal((await by("en")).language, "ar");
    assert.equal((await by("none")).language, "ar");
    assert.equal((await by("ar")).languageBeforeArabicDefault, undefined);

    await up(mongoose.connection.db, {}); // idempotent
    assert.equal((await by("en")).languageBeforeArabicDefault, "en");

    await down(mongoose.connection.db, {});
    assert.equal((await by("en")).language, "en");
    assert.equal((await by("none")).language, undefined);
    assert.equal((await by("en")).languageBeforeArabicDefault, undefined);
  });
});
