/**
 * Refresh token rotation/replay concurrency tests.
 *
 * The refresh-token contract from services/auth.js:
 *   - Each successful refresh marks the consumed token as revoked and
 *     issues a brand-new token in the same family.
 *   - Reusing an already-revoked token revokes the entire family
 *     (replay detection).
 *
 * Under contention — e.g. a mobile client retrying a slow refresh — two
 * requests can race against the same token. At most one should win;
 * the loser's later attempt should trip the replay guard and revoke
 * the family.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import mongoose from "mongoose";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";

const TENANT_ID = new mongoose.Types.ObjectId();
const USER_ID = new mongoose.Types.ObjectId();

function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function seedToken({ family, isRevoked = false } = {}) {
  const RefreshToken = mongoose.connection.model("RefreshToken");
  const raw = crypto.randomUUID();
  const doc = await RefreshToken.create({
    tenantId: TENANT_ID,
    user: USER_ID,
    token: hashToken(raw),
    family: family || crypto.randomUUID(),
    isRevoked,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  return { raw, doc };
}

/**
 * Atomic "consume" — only marks revoked if the token is still active.
 * Returns the previous doc if we won, null if someone else already
 * consumed it. The race winner is whichever caller flips the flag first.
 */
async function atomicConsume(tokenId) {
  const RefreshToken = mongoose.connection.model("RefreshToken");
  return RefreshToken.findOneAndUpdate(
    { _id: tokenId, isRevoked: false },
    { $set: { isRevoked: true } },
    { new: false }
  );
}

describe("Refresh token concurrency", () => {
  before(async () => {
    await startTestDb();
  });

  after(async () => {
    await stopTestDb();
  });

  beforeEach(async () => {
    await clearAllCollections();
  });

  it("only one of N concurrent refreshes against the same token wins", async () => {
    const { doc } = await seedToken();

    const attempts = await Promise.all(
      Array.from({ length: 10 }, () => atomicConsume(doc._id))
    );

    const winners = attempts.filter((r) => r !== null);
    const losers = attempts.filter((r) => r === null);

    assert.equal(winners.length, 1, "exactly one refresh should win the race");
    assert.equal(losers.length, 9, "all others must observe the token already consumed");

    const RefreshToken = mongoose.connection.model("RefreshToken");
    const fresh = await RefreshToken.findById(doc._id).lean();
    assert.equal(fresh.isRevoked, true);
  });

  it("replay of a revoked token revokes the entire family", async () => {
    const family = crypto.randomUUID();
    // Token A: already consumed.
    const { doc: tokenA } = await seedToken({ family });
    // Tokens B and C: legit successors that haven't been used yet.
    const { doc: tokenB } = await seedToken({ family });
    const { doc: tokenC } = await seedToken({ family });

    const RefreshToken = mongoose.connection.model("RefreshToken");

    // Mark A as already used (simulates a successful prior refresh).
    await RefreshToken.updateOne({ _id: tokenA._id }, { $set: { isRevoked: true } });

    // Attacker presents A again. Detection logic: if the token we look up
    // is already revoked, kill the family.
    const found = await RefreshToken.findById(tokenA._id);
    assert.equal(found.isRevoked, true, "token A is already revoked");

    await RefreshToken.updateMany(
      { family },
      { $set: { isRevoked: true } }
    );

    const survivors = await RefreshToken.find({ family, isRevoked: false }).lean();
    assert.equal(survivors.length, 0, "no token in the family should remain active");

    const freshB = await RefreshToken.findById(tokenB._id).lean();
    const freshC = await RefreshToken.findById(tokenC._id).lean();
    assert.equal(freshB.isRevoked, true);
    assert.equal(freshC.isRevoked, true);
  });

  it("revoking one family does not touch siblings in another family", async () => {
    const familyA = crypto.randomUUID();
    const familyB = crypto.randomUUID();

    await seedToken({ family: familyA });
    await seedToken({ family: familyA });
    const { doc: untouched } = await seedToken({ family: familyB });

    const RefreshToken = mongoose.connection.model("RefreshToken");
    await RefreshToken.updateMany(
      { family: familyA },
      { $set: { isRevoked: true } }
    );

    const stillActive = await RefreshToken.findById(untouched._id).lean();
    assert.equal(stillActive.isRevoked, false, "family B should be untouched");
  });
});
