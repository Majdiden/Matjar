/**
 * Global configuration registry — integrity + validation + fail-safe reads.
 * Pure (no DB): the coercion helper is what both the read and write paths use.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PLATFORM_SETTINGS_REGISTRY,
  DEFAULT_SETTINGS,
  getSettingDef,
  CURRENCY_ALLOWLIST,
  MIME_ALLOWLIST,
} from "../../config/platformSettingsRegistry.js";
import { coerceSetting, processCeilings } from "../../services/platform/settings.js";
import config from "../../config/index.js";

describe("platform settings registry", () => {
  it("has unique keys, valid types, and defaults that satisfy their own bounds", () => {
    const seen = new Set();
    for (const def of PLATFORM_SETTINGS_REGISTRY) {
      assert.equal(seen.has(def.key), false, `duplicate ${def.key}`);
      seen.add(def.key);
      assert.ok(["integer", "stringList"].includes(def.type), def.key);
      assert.ok(def.group && def.label && def.description, def.key);
      if (def.editable) {
        assert.ok(def.bounds, `${def.key} editable without bounds`);
        assert.notEqual(coerceSetting(def, def.default), undefined, `${def.key} default violates bounds`);
      }
    }
    assert.equal(Object.keys(DEFAULT_SETTINGS).length, PLATFORM_SETTINGS_REGISTRY.length);
  });

  it("never lets SVG (or anything beyond the magic-byte-validated types) into the upload MIME allow-list", () => {
    assert.deepEqual([...MIME_ALLOWLIST], ["image/jpeg", "image/jpg", "image/png", "image/webp"]);
    const def = getSettingDef("uploads.allowedMimeTypes");
    assert.equal(coerceSetting(def, ["image/png", "image/svg+xml"]), undefined);
    assert.equal(coerceSetting(def, ["image/png", "image/gif"]), undefined);
  });

  it("keeps the console page-size knob display-only until it is consumed", () => {
    assert.equal(getSettingDef("console.listPageSize").editable, false);
  });

  it("keeps order/payment/fulfillment states read-only", () => {
    for (const k of ["orders.statuses", "orders.paymentStatuses", "orders.fulfillmentStatuses"]) {
      assert.equal(getSettingDef(k).editable, false, k);
      assert.equal(coerceSetting(getSettingDef(k), ["Anything"]), undefined, `${k} must reject writes`);
    }
  });
});

describe("coerceSetting", () => {
  const size = getSettingDef("uploads.maxFileSizeMB");
  const cur = getSettingDef("commerce.baseCurrencies");

  it("enforces integer bounds and rejects non-integers", () => {
    assert.equal(coerceSetting(size, 10), 10);
    assert.equal(coerceSetting(size, "10"), 10);
    assert.equal(coerceSetting(size, 0), undefined);
    assert.equal(coerceSetting(size, 51), undefined);
    assert.equal(coerceSetting(size, 2.5), undefined);
    assert.equal(coerceSetting(size, "abc"), undefined);
    assert.equal(coerceSetting(size, null), undefined);
  });

  it("enforces list allow-lists, minimum length, and dedupes", () => {
    assert.deepEqual(coerceSetting(cur, ["SDG", "USD", "SDG"]), ["SDG", "USD"]);
    assert.equal(coerceSetting(cur, []), undefined);
    assert.equal(coerceSetting(cur, ["SDG", "XXX"]), undefined);
    assert.equal(coerceSetting(cur, "SDG"), undefined);
    assert.ok(CURRENCY_ALLOWLIST.includes("SDG"));
  });

  it("returns undefined for unknown or read-only definitions", () => {
    assert.equal(coerceSetting(null, 1), undefined);
    assert.equal(coerceSetting(getSettingDef("limits.apiPaginationMax"), 50), undefined);
  });
});

describe("upload process ceilings", () => {
  it("derive from config and are never below 1", () => {
    const { ceilingMB, ceilingFiles } = processCeilings();
    assert.equal(ceilingMB, Math.max(1, Math.floor(config.maxFileSize / (1024 * 1024))));
    assert.equal(ceilingFiles, Math.max(1, config.maxFilesPerUpload));
  });
});
