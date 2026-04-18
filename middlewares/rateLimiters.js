/**
 * Route-class-specific rate limiters (Redis-backed, horizontally safe).
 *
 * We run 2+ web dynos + a worker on Render, so an in-memory limiter leaks
 * budget across instances — each dyno counts independently and the real
 * effective cap is Nx the configured value. Every limiter below is backed
 * by a shared ioredis client so the window count is global across the
 * fleet.
 *
 * The global /api limiter in index.js protects against broad abuse, but
 * it's generous by design so the dashboard's burst pageloads don't burn
 * through the budget. That generosity is the wrong default for a handful
 * of high-risk endpoints:
 *
 *   - auth/login + auth/register + password-reset: credential-stuffing &
 *     enumeration
 *   - checkout/payment intents: card testing, quote abuse
 *   - uploads: bandwidth + storage cost
 *   - webhook ingestion: provider replay / third-party fan-out
 *   - domain/DNS checks: enumeration & outbound amplification
 *   - SSE stream-token mint: ticket-flood
 *   - storefront public API + cart: tenant-scoped abuse targets
 *
 * Each limiter below is declared once and exported so routes can opt in
 * without reaching for `express-rate-limit` directly. The caps are
 * stricter in production than in development (dev needs headroom for
 * iterating on the dashboard).
 *
 * Redis connection strategy
 * -------------------------
 * We reuse the same ioredis pattern as `services/jobs/queues.js` — a
 * single shared ioredis client opened lazily on first limiter hit. If
 * REDIS_URL is unset *and* we're in development, we fall back to the
 * built-in in-memory store and emit a single warning. In production the
 * config layer already enforces REDIS_URL, so that branch never triggers.
 *
 * Key prefixes per-limiter (`rl:login:`, `rl:signup:`, …) keep the
 * namespaces apart so one endpoint's overflow can't evict another's
 * counters under Redis memory pressure.
 */

import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import IORedis from "ioredis";
import config from "../config/index.js";
import logger from "../utils/logger.js";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// ─── Shared Redis connection for rate limiting ──────────────────────
//
// Singleton. Opened on first limiter construction, closed implicitly on
// process exit. We keep this separate from the BullMQ connection in
// services/jobs/queues.js because BullMQ sets `maxRetriesPerRequest:null`
// (required for blocking commands) while rate limiting is better served
// by the ioredis default of 20 retries — a Redis outage should surface
// as a 5xx, not block on a rate-limit check forever.
let sharedLimiterConnection = null;
let inMemoryWarned = false;

function getLimiterConnection() {
  if (sharedLimiterConnection !== null) return sharedLimiterConnection;
  const url = process.env.REDIS_URL;
  // Tests set REDIS_URL="memory" (or leave empty) to force the in-memory
  // store without Redis being reachable. Prod always provides a real URL
  // via config validation.
  if (!url || url === "memory" || url === "disabled") {
    // Dev-only fallback. Config layer throws in production if REDIS_URL is
    // missing, so we only get here on a local laptop without Redis running.
    if (!inMemoryWarned) {
      logger.warn(
        "REDIS_URL is not set — rate limiters falling back to in-memory store. " +
          "This is NOT safe across multiple instances. Set REDIS_URL for any shared environment."
      );
      inMemoryWarned = true;
    }
    sharedLimiterConnection = false; // sentinel: "no redis, use memory"
    return sharedLimiterConnection;
  }
  try {
    sharedLimiterConnection = new IORedis(url, {
      // `connectTimeout` fails loudly if REDIS_URL is unreachable at boot.
      // We deliberately keep the offline queue enabled (ioredis default):
      // with `enableOfflineQueue: false`, any commands still in-flight
      // when we quit() the client — including rate-limit-redis's
      // startup EVAL to load its Lua script — reject with "Stream isn't
      // writeable" and bubble up as unhandled rejections during test
      // teardown. Under a genuine long outage, the `error` handler still
      // fires so monitoring can catch it.
      connectTimeout: 10_000,
      // Distinct keyPrefix from BullMQ isn't needed — each limiter sets
      // its own prefix below and BullMQ uses `bull:` keys.
    });
    sharedLimiterConnection.on("error", (err) =>
      logger.error("Rate-limit Redis connection error", { error: err.message })
    );
    return sharedLimiterConnection;
  } catch (err) {
    logger.error("Failed to open rate-limit Redis connection; falling back to memory store", {
      error: err.message,
    });
    sharedLimiterConnection = false;
    return sharedLimiterConnection;
  }
}

/**
 * Build a store appropriate for this environment.
 *
 * `prefix` disambiguates limiter namespaces so login counters never
 * collide with signup counters under the same IP. Required.
 */
function buildStore(prefix) {
  const conn = getLimiterConnection();
  if (conn === false) return undefined; // undefined → express-rate-limit uses MemoryStore
  return new RedisStore({
    prefix,
    // rate-limit-redis expects an ioredis-compatible sendCommand.
    sendCommand: (...args) => conn.call(...args),
  });
}

/**
 * Factory — every named limiter below is built from this. Kept small on
 * purpose: the shared bits (standardHeaders, OPTIONS skip, JSON error
 * shape) live here once so individual limiters stay declarative.
 *
 * `prefix` is REQUIRED — it becomes the Redis key prefix so limiters
 * don't share counters. Violating this at call-sites is a programming
 * error, so we throw rather than default.
 */
export function createRateLimiter({
  prefix,
  windowMs,
  max,
  message,
  keyGenerator,
  skipSuccessfulRequests = false,
  skip,
}) {
  if (!prefix || typeof prefix !== "string") {
    throw new Error("createRateLimiter: `prefix` is required (used as Redis key prefix).");
  }
  if (!windowMs || !max) {
    throw new Error("createRateLimiter: `windowMs` and `max` are required.");
  }
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: message || "Too many requests. Please try again later." },
    skipSuccessfulRequests,
    // Default skip: OPTIONS preflight shouldn't count — browsers fire them
    // eagerly and they carry no credentials. Callers can compose on top.
    skip: skip
      ? (req) => req.method === "OPTIONS" || skip(req)
      : (req) => req.method === "OPTIONS",
    keyGenerator,
    store: buildStore(`rl:${prefix}:`),
  });
}

// ─── Key generators ────────────────────────────────────────────────
//
// express-rate-limit v8 exports `ipKeyGenerator` — a helper that
// correctly normalises IPv6 addresses into /64 buckets so a single
// attacker can't evade by flipping the low bits of their v6 address.
// Wrapping it (instead of `req.ip` directly) is the supported way to
// build composite keys.

/** Per-IP key — safe for anonymous endpoints. */
function ipKey(req) {
  return ipKeyGenerator(req.ip);
}

/**
 * Per-authenticated-user key, falling back to IP for anonymous callers.
 * Used where the endpoint requires auth (SSE stream-token, cart ops for
 * logged-in shoppers).
 */
function userOrIpKey(req) {
  const userId =
    req.user?.userId ||
    req.user?._id ||
    req.user?.id ||
    null;
  if (userId) return `u:${userId}`;
  return `ip:${ipKeyGenerator(req.ip)}`;
}

/**
 * Cart key — logged-in user if present, else guest session id, else IP.
 * Session id is preferred over raw IP so shoppers behind a shared NAT
 * (university wifi, mobile carrier) don't rate-limit each other.
 */
function cartKey(req) {
  const userId =
    req.user?.userId ||
    req.user?._id ||
    req.user?.id ||
    null;
  if (userId) return `u:${userId}`;
  const sid = req.session?.id || req.sessionID;
  if (sid) return `s:${sid}`;
  return `ip:${ipKeyGenerator(req.ip)}`;
}

/**
 * Per-tenant key for the public storefront API. Falls back to IP when a
 * tenant wasn't resolved (e.g. a request to a host that doesn't match
 * any tenant — those should 404 anyway, but we still cap them).
 */
function tenantKey(req) {
  const t = req.tenant;
  const tid =
    (t && (t._id || t.id)) ||
    req.tenantId ||
    null;
  if (tid) return `t:${tid}`;
  // Hostname is a reasonable second-best — it's what the tenant resolver
  // uses as input. Still bucket-per-IP if even that's missing.
  const host = req.hostname || req.headers?.host || null;
  if (host) return `h:${host.toLowerCase()}`;
  return `ip:${ipKeyGenerator(req.ip)}`;
}

/** Per-email key for password-reset (prevents targeted email spamming). */
function emailKey(req) {
  const email = (req.body?.email || "").toString().trim().toLowerCase();
  if (email) return `e:${email}`;
  // If the caller didn't supply an email, IP-bucket so we don't bypass
  // the limiter entirely on malformed input.
  return `ip:${ipKeyGenerator(req.ip)}`;
}

// ─── Limiters ──────────────────────────────────────────────────────

/**
 * Login — 5 failed attempts / 15 min per IP in prod. Successful logins
 * don't count (skipSuccessfulRequests) so a legitimate user who typo'd
 * once doesn't get locked out after logging in correctly.
 */
export const loginLimiter = createRateLimiter({
  prefix: "login",
  windowMs: 15 * MINUTE,
  max: config.isDevelopment ? 100 : 5,
  message: "Too many login attempts. Please try again in 15 minutes.",
  skipSuccessfulRequests: true,
  keyGenerator: ipKey,
});

/**
 * Signup — 3 / hour per IP in prod. New merchants from the same office
 * network do occasionally sign up back-to-back; 3/hr covers that without
 * leaving the door open for scripted tenant-spam.
 */
export const signupLimiter = createRateLimiter({
  prefix: "signup",
  windowMs: 1 * HOUR,
  max: config.isDevelopment ? 50 : 3,
  message: "Too many signups from this network. Please try again in an hour.",
  keyGenerator: ipKey,
});

/**
 * Password reset — 3 / hour per IP AND 3 / day per target email. We
 * export the email-scoped limiter separately so routes can stack both;
 * the IP limiter catches broad enumeration while the email limiter
 * stops targeted harassment.
 */
export const passwordResetLimiter = createRateLimiter({
  prefix: "pwreset:ip",
  windowMs: 1 * HOUR,
  max: config.isDevelopment ? 50 : 3,
  message: "Too many password reset attempts. Please try again in an hour.",
  keyGenerator: ipKey,
});

export const passwordResetEmailLimiter = createRateLimiter({
  prefix: "pwreset:email",
  windowMs: 1 * DAY,
  max: config.isDevelopment ? 100 : 3,
  message: "Too many password reset requests for this email today.",
  keyGenerator: emailKey,
});

/**
 * SSE stream-token mint — 30 / min per user. The dashboard calls this
 * on every tab load + whenever the JWT expires, so 30/min is comfortably
 * above the legit rate but low enough that a compromised token can't be
 * used to harvest SSE tickets.
 */
export const streamTokenLimiter = createRateLimiter({
  prefix: "streamtoken",
  windowMs: 1 * MINUTE,
  max: config.isDevelopment ? 300 : 30,
  message: "Too many stream-token requests. Please slow down.",
  keyGenerator: userOrIpKey,
});

/**
 * Webhook ingestion — 100 / min per IP in prod. Providers legitimately
 * burst on retry cascades, so the window is short and the cap sits
 * above any realistic single-provider volume.
 */
export const webhookLimiter = createRateLimiter({
  prefix: "webhook",
  windowMs: 1 * MINUTE,
  max: config.isDevelopment ? 1000 : 100,
  message: "Webhook rate limit reached.",
  keyGenerator: ipKey,
});

/**
 * Public storefront API — 300 / min PER TENANT. Keyed on tenantId so
 * one tenant's viral moment (or abusive bot) can't starve every other
 * tenant on the fleet. Per-IP would be wrong here: a popular store
 * legitimately has thousands of concurrent shoppers from distinct IPs.
 */
export const storefrontApiLimiter = createRateLimiter({
  prefix: "storefront",
  windowMs: 1 * MINUTE,
  max: config.isDevelopment ? 3000 : 300,
  message: "Storefront API rate limit reached. Please try again shortly.",
  keyGenerator: tenantKey,
});

/**
 * Cart ops — 60 / min per user/session. Cart abuse (inventory holding,
 * price scraping via cart preview) is the most common storefront attack
 * we see; 60/min covers legitimate "add variant → update qty → remove
 * → re-add" shopper flows but chokes scripts hard.
 */
export const cartLimiter = createRateLimiter({
  prefix: "cart",
  windowMs: 1 * MINUTE,
  max: config.isDevelopment ? 600 : 60,
  message: "Too many cart requests. Please slow down and try again.",
  keyGenerator: cartKey,
});

// ─── Legacy limiters preserved for existing mount points ────────────
//
// These were on `express-rate-limit` directly before Redis backing was
// added. Keeping the exported names lets routes keep importing them.

export const checkoutLimiter = createRateLimiter({
  prefix: "checkout",
  windowMs: 5 * MINUTE,
  max: config.isDevelopment ? 500 : 30,
  message: "Too many checkout attempts. Please slow down and try again.",
  keyGenerator: ipKey,
});

export const uploadLimiter = createRateLimiter({
  prefix: "upload",
  windowMs: 1 * MINUTE,
  max: config.isDevelopment ? 300 : 60,
  message: "Upload rate limit reached. Please wait a moment and retry.",
  keyGenerator: userOrIpKey,
});

export const domainCheckLimiter = createRateLimiter({
  prefix: "domaincheck",
  windowMs: 1 * MINUTE,
  max: config.isDevelopment ? 200 : 20,
  message: "Too many domain checks. Please try again in a minute.",
  keyGenerator: ipKey,
});

export const orderLookupLimiter = createRateLimiter({
  prefix: "orderlookup",
  windowMs: 5 * MINUTE,
  max: config.isDevelopment ? 500 : 60,
  message: "Too many order lookups. Please slow down.",
  keyGenerator: userOrIpKey,
});

/**
 * Close the shared Redis connection. Called from process SIGTERM
 * handlers in index.js so Redis isn't left holding dangling clients
 * across deploys.
 */
export async function closeRateLimiterConnection() {
  if (sharedLimiterConnection && sharedLimiterConnection !== false) {
    await sharedLimiterConnection.quit().catch(() => {});
    sharedLimiterConnection = null;
  }
}
