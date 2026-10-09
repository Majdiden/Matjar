/**
 * Dashboard display locale (dashboard/src/lib/format.ts): prices and dates
 * always use Latin digits (0-9) and follow the dashboard UI language, even
 * when the store itself defaults to Arabic ('ar-SD').
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

const ARABIC_INDIC = /[٠-٩۰-۹]/;

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.document = { documentElement: { lang: "ar" } };

let fmt;
before(async () => {
  fmt = await import("../../dashboard/src/lib/format.ts");
  fmt.setTenantLocale("ar-SD");
  fmt.setTenantCurrency("SDG");
});

describe("display locale", () => {
  it("Arabic UI + Arabic store: prices use Latin digits", () => {
    globalThis.document.documentElement.lang = "ar";
    const out = fmt.formatPrice(15000, "SDG");
    assert.match(out, /15,000/);
    assert.doesNotMatch(out, ARABIC_INDIC);
    assert.match(fmt.getTenantLocale(), /^ar-SD-u-nu-latn$/);
  });

  it("Arabic UI: dates use Latin digits", () => {
    globalThis.document.documentElement.lang = "ar";
    const d = new Date(2026, 9, 9);
    for (const out of [fmt.formatDate(d), fmt.formatDate(d, "medium"), fmt.formatDateTime(d)]) {
      assert.match(out, /2026/);
      assert.doesNotMatch(out, ARABIC_INDIC);
    }
  });

  it("English UI on an Arabic store: English formatting", () => {
    globalThis.document.documentElement.lang = "en";
    const out = fmt.formatPrice(15000, "SDG");
    assert.match(out, /SDG/);
    assert.match(out, /15,000/);
    assert.doesNotMatch(out, ARABIC_INDIC);
    // en-SD (English UI, Sudan region) reads "9 Oct 2026".
    assert.match(fmt.formatDate(new Date(2026, 9, 9), "medium"), /Oct.*2026/);
  });
});
