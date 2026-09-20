/**
 * utils/secretBox.js — AES-256-GCM seal/open round trip, tamper detection,
 * key handling.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

const KEY = crypto.randomBytes(32).toString("hex");
let box;

before(async () => {
  process.env.PLATFORM_MFA_KEY = KEY;
  box = await import("../../utils/secretBox.js");
  box.__resetKeyCache();
});
after(() => {
  delete process.env.PLATFORM_MFA_KEY;
  box.__resetKeyCache();
});

describe("secretBox", () => {
  it("round-trips and randomises the IV", () => {
    const a = box.seal("GEZDGNBVGY3TQOJQ");
    const b = box.seal("GEZDGNBVGY3TQOJQ");
    assert.notEqual(a, b);
    assert.equal(box.open(a), "GEZDGNBVGY3TQOJQ");
    assert.equal(box.open(b), "GEZDGNBVGY3TQOJQ");
    assert.match(a, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });
  it("detects tampering with the ciphertext and the tag", () => {
    const sealed = box.seal("secret");
    const parts = sealed.split(".");
    const flip = (s) => (s[0] === "A" ? "B" : "A") + s.slice(1);
    assert.throws(() => box.open([parts[0], parts[1], parts[2], flip(parts[3])].join(".")));
    assert.throws(() => box.open([parts[0], parts[1], flip(parts[2]), parts[3]].join(".")));
    assert.throws(() => box.open("v1.x.y"));
    assert.throws(() => box.open("v0.a.b.c"));
  });
  it("fails to open with a different key", () => {
    const sealed = box.seal("secret");
    process.env.PLATFORM_MFA_KEY = crypto.randomBytes(32).toString("hex");
    box.__resetKeyCache();
    assert.throws(() => box.open(sealed));
    process.env.PLATFORM_MFA_KEY = KEY;
    box.__resetKeyCache();
    assert.equal(box.open(sealed), "secret");
  });
  it("rejects a malformed key", () => {
    process.env.PLATFORM_MFA_KEY = "deadbeef";
    box.__resetKeyCache();
    assert.throws(() => box.seal("x"), /32 bytes/);
    process.env.PLATFORM_MFA_KEY = KEY;
    box.__resetKeyCache();
  });
});

describe("secretBox: tag/iv length enforcement", () => {
  it("rejects a truncated auth tag and a short iv", () => {
    const sealed = box.seal("secret");
    const [v, iv, tag, ct] = sealed.split(".");
    const shortTag = Buffer.from(tag, "base64url").subarray(0, 12).toString("base64url");
    assert.throws(() => box.open([v, iv, shortTag, ct].join(".")), /malformed iv\/tag|Unsupported|auth/);
    const shortIv = Buffer.from(iv, "base64url").subarray(0, 8).toString("base64url");
    assert.throws(() => box.open([v, shortIv, tag, ct].join(".")), /malformed iv\/tag/);
  });
});
