/**
 * services/platform/mfa.js — atomic single-use TOTP steps and recovery codes.
 * Mongoose is mocked with an in-memory "collection" whose updateOne applies
 * the same filter semantics the real query relies on, so a concurrent replay
 * (two verifications of the same code) can be simulated deterministically.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import mongoose from "mongoose";

process.env.PLATFORM_MFA_KEY = crypto.randomBytes(32).toString("hex");
const { seal } = await import("../../utils/secretBox.js");
const { generateSecret, totp } = await import("../../utils/totp.js");
const mfa = await import("../../services/platform/mfa.js");

const hashCode = (c) => crypto.createHash("sha256").update(String(c).toUpperCase().replace(/[^A-Z0-9]/g, "")).digest("hex");
const secret = generateSecret();
const recovery = ["ABCDE-FGHJK", "LMNPQ-RSTUV"];
let doc;

function resetDoc() {
  doc = {
    _id: "u1",
    platformAdmin: true,
    platformMfa: {
      enabled: true,
      secretSealed: seal(secret),
      lastUsedStep: null,
      recoveryCodeHashes: recovery.map(hashCode),
      recoveryCodesRemaining: recovery.length,
    },
  };
}

// Minimal model double: findOne().select() → doc copy; updateOne applies the
// two filter shapes the service uses and reports modifiedCount honestly.
const fakeModel = {
  findOne() {
    return { select: async () => ({ ...doc, platformMfa: { ...doc.platformMfa, recoveryCodeHashes: [...doc.platformMfa.recoveryCodeHashes] } }) };
  },
  async updateOne(filter, update) {
    if (filter.$or) {
      const step = update.$set["platformMfa.lastUsedStep"];
      const ok = doc.platformMfa.lastUsedStep == null || doc.platformMfa.lastUsedStep < step;
      if (!ok) return { modifiedCount: 0 };
      doc.platformMfa.lastUsedStep = step;
      return { modifiedCount: 1 };
    }
    const h = filter["platformMfa.recoveryCodeHashes"];
    if (!doc.platformMfa.recoveryCodeHashes.includes(h)) return { modifiedCount: 0 };
    doc.platformMfa.recoveryCodeHashes = doc.platformMfa.recoveryCodeHashes.filter((x) => x !== h);
    doc.platformMfa.recoveryCodesRemaining -= 1;
    return { modifiedCount: 1 };
  },
};

const realModel = mongoose.model;
before(() => {
  mongoose.model = (name) => (name === "TenantUser" ? fakeModel : realModel.call(mongoose, name));
});
after(() => {
  mongoose.model = realModel;
});

describe("mfa: atomic single-use", () => {
  it("accepts a TOTP once per step and rejects the replay", async () => {
    resetDoc();
    const code = totp(secret);
    const first = await mfa.verifyCode("u1", code);
    assert.equal(first.method, "totp");
    await assert.rejects(() => mfa.verifyCode("u1", code), /already used/);
  });

  it("two concurrent verifications of the same TOTP: exactly one wins", async () => {
    resetDoc();
    const code = totp(secret);
    const results = await Promise.allSettled([mfa.verifyCode("u1", code), mfa.verifyCode("u1", code)]);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    assert.equal(ok, 1);
  });

  it("consumes a recovery code once; concurrent reuse fails", async () => {
    resetDoc();
    const results = await Promise.allSettled([mfa.verifyCode("u1", recovery[0]), mfa.verifyCode("u1", recovery[0])]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(doc.platformMfa.recoveryCodesRemaining, 1);
    await assert.rejects(() => mfa.verifyCode("u1", recovery[0]), /Invalid code/);
    // The other code still works.
    const r = await mfa.verifyCode("u1", recovery[1]);
    assert.equal(r.method, "recovery");
    assert.equal(doc.platformMfa.recoveryCodesRemaining, 0);
  });
});
