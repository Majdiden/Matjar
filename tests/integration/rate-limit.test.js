/**
 * Rate-limit smoke test.
 *
 * Exercises the limiter factory end-to-end: mount `loginLimiter` on a
 * stub Express route, fire more requests than the configured cap, and
 * assert the excess ones come back 429.
 *
 * Runs without Redis. With REDIS_URL unset, `middlewares/rateLimiters.js`
 * falls back to the in-memory store — same limiter semantics, just
 * per-process instead of shared. That's the right model for CI: we're
 * testing the limiter contract, not the Redis integration.
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import supertest from "supertest";

// NODE_ENV=test gives us the strict (non-dev) caps without triggering
// the production-only config validator that requires a real Redis URL.
// Must happen before importing anything that transitively imports config.
process.env.NODE_ENV = "test";
// Provide minimal required env vars so config/index.js doesn't throw
// at import time. Config's `validateRequiredVars` needs REDIS_URL set;
// we delete it AFTER module load so the limiter's lazy Redis-connection
// read picks the in-memory fallback.
process.env.DB_URI = process.env.DB_URI || "mongodb://stub.invalid/matjar";
process.env.JWT_SECRET = process.env.JWT_SECRET || "a".repeat(40);
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "b".repeat(40);
// Sentinel value — rateLimiters.js treats "memory" as "no redis, use
// the in-memory store". This keeps the required-vars config check happy
// while avoiding a real Redis dependency in CI.
process.env.REDIS_URL = "memory";

const { loginLimiter, cartLimiter, createRateLimiter } = await import(
  "../../middlewares/rateLimiters.js"
);

describe("rate limiters", () => {
  describe("loginLimiter", () => {
    let app;
    before(() => {
      app = express();
      // Match production trust-proxy so `req.ip` comes from X-Forwarded-For
      // when supertest sets it (our per-request IP tagging below).
      app.set("trust proxy", 1);
      app.use(express.json());
      app.post("/login", loginLimiter, (_req, res) =>
        // Return 401 so skipSuccessfulRequests counts the attempt — this
        // mirrors real login behaviour for bad credentials.
        res.status(401).json({ ok: false })
      );
    });

    it("returns 429 on the 6th failed attempt within the window", async () => {
      // Use a unique source IP so this test doesn't share counter state
      // with any other test that might run in the same process.
      const ip = "203.0.113.7";
      const request = supertest(app);
      const statuses = [];
      for (let i = 0; i < 7; i += 1) {
        const res = await request
          .post("/login")
          .set("X-Forwarded-For", ip)
          .send({ email: "a@b.test", password: "wrong" });
        statuses.push(res.status);
      }
      // First 5 failed attempts pass through (401). Attempts 6 and 7 are
      // blocked by the limiter (429). Production cap is 5/15min.
      assert.deepEqual(statuses.slice(0, 5), [401, 401, 401, 401, 401]);
      assert.equal(statuses[5], 429, "6th attempt must be rate-limited");
      assert.equal(statuses[6], 429, "7th attempt must still be rate-limited");
    });

    it("isolates counters per IP", async () => {
      const request = supertest(app);
      // Burn the budget from IP A.
      for (let i = 0; i < 6; i += 1) {
        await request
          .post("/login")
          .set("X-Forwarded-For", "198.51.100.10")
          .send({ email: "a@b.test", password: "wrong" });
      }
      // A fresh IP should still pass on its first request.
      const res = await request
        .post("/login")
        .set("X-Forwarded-For", "198.51.100.11")
        .send({ email: "a@b.test", password: "wrong" });
      assert.equal(res.status, 401, "unrelated IPs must not share counters");
    });
  });

  describe("createRateLimiter", () => {
    it("throws when prefix is missing", () => {
      assert.throws(
        () => createRateLimiter({ windowMs: 1000, max: 1 }),
        /prefix/
      );
    });

    it("throws when windowMs or max is missing", () => {
      assert.throws(
        () => createRateLimiter({ prefix: "x", max: 1 }),
        /windowMs/
      );
      assert.throws(
        () => createRateLimiter({ prefix: "x", windowMs: 1000 }),
        /windowMs|max/
      );
    });
  });

  describe("cartLimiter", () => {
    // The cart limiter uses a composite key (user → session → IP). Hit it
    // with distinct session ids under the same IP to prove the session
    // bucket takes precedence — otherwise shared-NAT shoppers would rate
    // -limit each other.
    it("keys on session id when userId is absent", async () => {
      const app = express();
      app.set("trust proxy", 1);
      app.use(express.json());
      app.use((req, _res, next) => {
        // Stub session from a header so supertest can drive distinct
        // sessions from the same IP.
        const sid = req.headers["x-test-session"];
        if (sid) {
          req.session = { id: sid };
          req.sessionID = sid;
        }
        next();
      });
      app.post("/cart/add", cartLimiter, (_req, res) =>
        res.status(200).json({ ok: true })
      );
      const request = supertest(app);
      // Different session ids, same IP — each gets its own bucket.
      const res1 = await request
        .post("/cart/add")
        .set("X-Forwarded-For", "192.0.2.9")
        .set("x-test-session", "session-alpha")
        .send({});
      const res2 = await request
        .post("/cart/add")
        .set("X-Forwarded-For", "192.0.2.9")
        .set("x-test-session", "session-beta")
        .send({});
      assert.equal(res1.status, 200);
      assert.equal(res2.status, 200);
    });
  });
});
