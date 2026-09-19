/**
 * utils/phone.js unit tests — pure normalisation, no DB.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, splitE164, isE164, toAsciiDigits } from "../../utils/phone.js";
import { getCatalogCountry, PHONE_COUNTRY_CATALOG, DEFAULT_PHONE_COUNTRY } from "../../config/phoneCountries.js";

const SD = getCatalogCountry("SD");
const EG = getCatalogCountry("EG");

describe("phone catalog", () => {
  it("defaults to Sudan (+249, 9-digit national numbers)", () => {
    assert.equal(DEFAULT_PHONE_COUNTRY, "SD");
    assert.equal(SD.dialCode, "+249");
    assert.equal(SD.minDigits, 9);
    assert.equal(SD.maxDigits, 9);
  });

  it("has unique iso2 codes and well-formed dial codes", () => {
    const seen = new Set();
    for (const c of PHONE_COUNTRY_CATALOG) {
      assert.equal(seen.has(c.iso2), false, `duplicate ${c.iso2}`);
      seen.add(c.iso2);
      assert.match(c.dialCode, /^\+[1-9]\d{0,3}$/);
      assert.ok(c.minDigits <= c.maxDigits);
    }
  });
});

describe("normalizePhone", () => {
  it("accepts a plain Sudanese mobile and returns E.164", () => {
    const r = normalizePhone("912345678", SD);
    assert.deepEqual(r, { ok: true, e164: "+249912345678", national: "912345678" });
  });

  it("strips the trunk 0 (0912345678 → +249912345678)", () => {
    assert.equal(normalizePhone("0912345678", SD).e164, "+249912345678");
  });

  it("ignores spaces, dashes and parentheses", () => {
    assert.equal(normalizePhone("(091) 234-5678", SD).e164, "+249912345678");
  });

  it("accepts the number pasted with its own dial code (+249 / 00249)", () => {
    assert.equal(normalizePhone("+249 912 345 678", SD).e164, "+249912345678");
    assert.equal(normalizePhone("00249912345678", SD).e164, "+249912345678");
  });

  it("rejects a number carrying a DIFFERENT country's dial code", () => {
    const r = normalizePhone("+20 1001234567", SD);
    assert.equal(r.ok, false);
    assert.equal(r.reason, "wrong-country");
  });

  it("maps Arabic-Indic digits to ASCII", () => {
    assert.equal(toAsciiDigits("٠٩١٢٣٤٥٦٧٨"), "0912345678");
    assert.equal(normalizePhone("٠٩١٢٣٤٥٦٧٨", SD).e164, "+249912345678");
  });

  it("enforces per-country digit bounds", () => {
    assert.equal(normalizePhone("91234567", SD).reason, "too-short");
    assert.equal(normalizePhone("9123456789", SD).reason, "too-long");
    // Egypt allows 9–10 national digits.
    assert.equal(normalizePhone("1001234567", EG).e164, "+201001234567");
  });

  it("rejects empty / non-numeric input", () => {
    assert.equal(normalizePhone("", SD).reason, "empty");
    assert.equal(normalizePhone("   ", SD).reason, "empty");
    assert.equal(normalizePhone("91abc5678", SD).reason, "invalid-characters");
  });

  it("fails closed without a country", () => {
    assert.equal(normalizePhone("912345678", null).reason, "no-country");
  });
});

describe("isE164 / splitE164", () => {
  it("recognises E.164", () => {
    assert.equal(isE164("+249912345678"), true);
    assert.equal(isE164("0912345678"), false);
    assert.equal(isE164("+0912345678"), false);
  });

  it("splits by the longest matching dial code", () => {
    const r = splitE164("+249912345678", PHONE_COUNTRY_CATALOG);
    assert.equal(r.iso2, "SD");
    assert.equal(r.national, "912345678");
  });

  it("prefers the hinted country on shared dial codes (+1 → CA)", () => {
    assert.equal(splitE164("+14165550123", PHONE_COUNTRY_CATALOG, "CA").iso2, "CA");
    assert.equal(splitE164("+14165550123", PHONE_COUNTRY_CATALOG, "US").iso2, "US");
  });

  it("returns bare digits for an unknown dial code", () => {
    const r = splitE164("+99912345678", PHONE_COUNTRY_CATALOG);
    assert.equal(r.iso2, null);
    assert.equal(r.national, "99912345678");
  });
});
