/**
 * utils/totp.js — RFC 6238 test vectors (SHA-1, 8 digits reduced to 6 by
 * taking the low 6) plus window / replay / base32 behaviour.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hotp, totp, verifyTotp, base32Encode, base32Decode, generateSecret, otpauthUri } from "../../utils/totp.js";

// RFC 6238 Appendix B secret for SHA-1: "12345678901234567890" (ASCII).
const RFC_SECRET = Buffer.from("12345678901234567890", "ascii");
const RFC_SECRET_B32 = base32Encode(RFC_SECRET); // GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ

// RFC 6238 Table 1 — time, T (counter), TOTP (8 digits, SHA1). We compare
// the 6-digit variant, which is the last 6 of the 8-digit value.
const VECTORS = [
  { time: 59, counter: 1, otp8: "94287082" },
  { time: 1111111109, counter: 0x023523ec, otp8: "07081804" },
  { time: 1111111111, counter: 0x023523ed, otp8: "14050471" },
  { time: 1234567890, counter: 0x0273ef07, otp8: "89005924" },
  { time: 2000000000, counter: 0x03f940aa, otp8: "69279037" },
  { time: 20000000000, counter: 0x27bc86aa, otp8: "65353130" },
];

describe("totp: RFC 6238 vectors", () => {
  for (const v of VECTORS) {
    it(`time=${v.time} → ${v.otp8.slice(-6)}`, () => {
      assert.equal(hotp(RFC_SECRET, v.counter, 8), v.otp8);
      assert.equal(totp(RFC_SECRET_B32, { now: v.time * 1000 }), v.otp8.slice(-6));
    });
  }
});

describe("totp: verification", () => {
  const now = 1111111111 * 1000;
  it("accepts the current step and ±1 step, rejects ±2", () => {
    const secret = RFC_SECRET_B32;
    const cur = totp(secret, { now });
    const prev = totp(secret, { now: now - 30_000 });
    const next = totp(secret, { now: now + 30_000 });
    const far = totp(secret, { now: now + 60_000 });
    assert.equal(typeof verifyTotp(secret, cur, { now }), "number");
    assert.equal(typeof verifyTotp(secret, prev, { now }), "number");
    assert.equal(typeof verifyTotp(secret, next, { now }), "number");
    assert.equal(verifyTotp(secret, far, { now }), null);
  });
  it("returns the matched step so callers can block replay", () => {
    const step = verifyTotp(RFC_SECRET_B32, totp(RFC_SECRET_B32, { now }), { now });
    assert.equal(step, Math.floor(now / 1000 / 30));
  });
  it("rejects malformed input", () => {
    assert.equal(verifyTotp(RFC_SECRET_B32, "12345", { now }), null);
    assert.equal(verifyTotp(RFC_SECRET_B32, "abcdef", { now }), null);
    assert.equal(verifyTotp(RFC_SECRET_B32, "", { now }), null);
  });
});

describe("totp: base32 + secrets", () => {
  it("round-trips base32", () => {
    for (const len of [1, 5, 10, 20, 33]) {
      const buf = Buffer.from(Array.from({ length: len }, (_, i) => (i * 37 + 11) & 255));
      assert.deepEqual(base32Decode(base32Encode(buf)), buf);
    }
  });
  it("generates 160-bit secrets", () => {
    const s = generateSecret();
    assert.equal(base32Decode(s).length, 20);
    assert.notEqual(s, generateSecret());
  });
  it("builds an otpauth URI", () => {
    const uri = otpauthUri({ secret: "ABC", label: "me@x.io", issuer: "Matjar Platform" });
    assert.match(uri, /^otpauth:\/\/totp\/Matjar%20Platform:me%40x\.io\?secret=ABC&issuer=Matjar%20Platform&algorithm=SHA1&digits=6&period=30$/);
  });
});
