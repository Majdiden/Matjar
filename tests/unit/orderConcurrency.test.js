/**
 * Unit tests for the `withVersionRetry` helper.
 *
 * The helper wraps the mutating-order services so that a Mongoose
 * VersionError (raised by optimistic concurrency on `order.save()`)
 * triggers a bounded reload+retry rather than surfacing a 500. After
 * `retries` VersionError attempts we throw a user-facing 409 — this
 * test file locks that contract in.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { withVersionRetry } from "../../services/order.js";

// Fake VersionError — Mongoose tags its own with `name === "VersionError"`
// and that's all the helper discriminates on.
function makeVersionError() {
  const err = new Error("No matching document found for id 'x' version N");
  err.name = "VersionError";
  return err;
}

describe("withVersionRetry", () => {
  it("returns the value on first-attempt success", async () => {
    let calls = 0;
    const out = await withVersionRetry(async () => {
      calls += 1;
      return { ok: true };
    });
    assert.deepEqual(out, { ok: true });
    assert.equal(calls, 1);
  });

  it("retries on VersionError and returns the eventual value", async () => {
    let calls = 0;
    const out = await withVersionRetry(async () => {
      calls += 1;
      if (calls < 3) throw makeVersionError();
      return "done";
    });
    assert.equal(out, "done");
    assert.equal(calls, 3);
  });

  it("throws a 409 APIError after exhausting retries", async () => {
    let calls = 0;
    await assert.rejects(
      withVersionRetry(async () => {
        calls += 1;
        throw makeVersionError();
      }),
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.match(err.message, /another request/i);
        return true;
      }
    );
    assert.equal(calls, 3);
  });

  it("respects a custom retries count", async () => {
    let calls = 0;
    await assert.rejects(
      withVersionRetry(
        async () => {
          calls += 1;
          throw makeVersionError();
        },
        { retries: 5 }
      ),
      (err) => err.statusCode === 409
    );
    assert.equal(calls, 5);
  });

  it("rethrows non-VersionError failures immediately without retrying", async () => {
    let calls = 0;
    const boom = new Error("database exploded");
    await assert.rejects(
      withVersionRetry(async () => {
        calls += 1;
        throw boom;
      }),
      (err) => err === boom
    );
    assert.equal(calls, 1);
  });

  it("propagates the original return value shape (no wrapping)", async () => {
    const payload = { success: true, statusCode: 200, responseObject: { _id: "abc" } };
    const out = await withVersionRetry(async () => payload);
    assert.equal(out, payload);
  });
});
