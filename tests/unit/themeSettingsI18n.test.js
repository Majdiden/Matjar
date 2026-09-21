import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateSettingsBag, resolveI18nTwin } from "../../utils/themeManifestRules.js";

const defs = [
  { id: "heading", type: "text" },
  { id: "body", type: "richtext" },
  { id: "count", type: "number", min: 0, max: 10 },
];

describe("per-language setting twins (<id>__<lang>)", () => {
  it("accepts Arabic/English twins of text-like settings", () => {
    assert.deepEqual(validateSettingsBag({ heading: "Brands", heading__ar: "العلامات", body__en: "<p>x</p>" }, defs, "s"), []);
  });
  it("still rejects unknown keys, non-text bases, and other languages", () => {
    assert.match(validateSettingsBag({ nope: 1 }, defs, "s")[0], /unknown setting "nope"/);
    assert.match(validateSettingsBag({ count__ar: "1" }, defs, "s")[0], /unknown setting "count__ar"/);
    assert.match(validateSettingsBag({ heading__fr: "x" }, defs, "s")[0], /unknown setting "heading__fr"/);
  });
  it("twins must be strings", () => {
    assert.match(validateSettingsBag({ heading__ar: 5 }, defs, "s")[0], /must be a string/);
    assert.deepEqual(validateSettingsBag({ heading__ar: null }, defs, "s"), []);
  });
  it("resolveI18nTwin returns the base definition", () => {
    const byId = new Map(defs.map((d) => [d.id, d]));
    assert.equal(resolveI18nTwin("heading__ar", byId)?.id, "heading");
    assert.equal(resolveI18nTwin("heading", byId), null);
  });
});
