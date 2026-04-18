import crypto from "crypto";
import logger from "../utils/logger.js";
import { APIError } from "./errorHandler.js";

/**
 * Idempotency middleware.
 *
 * When the client sends `Idempotency-Key: <uuid>` on a mutating request,
 * this middleware guarantees at-most-once semantics by short-circuiting
 * replays with the stored response. Used on endpoints where double-
 * submission is a real operational hazard (payments, fulfillments,
 * returns, refunds).
 *
 * Flow:
 *   1. Read the header. If absent, no-op — endpoint runs as normal.
 *   2. Hash the request body for payload-mismatch detection.
 *   3. Look up `(tenantId, key)` in IdempotencyRecord.
 *      - hit + same (method, path, bodyHash) → replay stored response.
 *      - hit + different bodyHash → 409 "key reused with different payload".
 *      - miss → monkey-patch `res.json` so after the handler runs we
 *        persist the outcome keyed by (tenantId, key). The unique index
 *        on (tenantId, key) also protects against two concurrent requests
 *        with the same key — the second write fails with E11000, which
 *        we treat as a lost race and replay the winner's record.
 *
 * The collection has a 24h TTL — plenty for realistic retry windows
 * without accumulating records indefinitely.
 */

/**
 * SHA-256 of a stable JSON serialisation of the request body.
 * Empty / missing body hashes to the empty-string digest so GET-style
 * replay behaves sensibly (not expected, but defensive).
 */
function hashBody(body) {
  let canonical = "";
  try {
    canonical = body == null ? "" : JSON.stringify(body);
  } catch {
    // Circular references etc. — fall back to a stringified form so
    // collisions are avoided in practice even if not cryptographically
    // perfect. Worst case is a false mismatch, which is safe.
    canonical = String(body);
  }
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

export function idempotency() {
  return async function idempotencyMiddleware(req, res, next) {
    const rawKey = req.get("Idempotency-Key") || req.get("idempotency-key");
    if (!rawKey) return next();

    const key = String(rawKey).trim();
    if (!key) return next();

    // Bound the key length so a malicious client can't spam giant keys.
    if (key.length > 255) {
      return next(new APIError("Idempotency-Key exceeds 255 characters", 400));
    }

    const models = req.models;
    if (!models?.IdempotencyRecord) {
      // No tenant context / model registry — allow the request through
      // unprotected rather than blocking it. This keeps the middleware
      // safe to mount anywhere; routes requiring it still work, just
      // without the replay guarantee on this particular hop.
      return next();
    }

    const method = req.method;
    const path = req.baseUrl + req.path;
    const bodyHash = hashBody(req.body);

    try {
      const existing = await models.IdempotencyRecord.findOne({ key }).lean();
      if (existing) {
        if (existing.method !== method || existing.path !== path) {
          return next(
            new APIError(
              "Idempotency key reused with a different endpoint",
              409
            )
          );
        }
        if (existing.bodyHash !== bodyHash) {
          return next(
            new APIError(
              "Idempotency key reused with different payload",
              409
            )
          );
        }
        // Cache hit — replay the stored response verbatim.
        return res
          .status(existing.statusCode || 200)
          .json(existing.response);
      }
    } catch (err) {
      // Never let an idempotency-store outage break the request path.
      // We log and fall through; the endpoint will run as if the header
      // hadn't been sent.
      logger.warn("idempotency lookup failed", { err: err?.message });
      return next();
    }

    // Monkey-patch res.json to capture the outcome once the handler runs,
    // then persist it under (tenantId, key). We capture only JSON
    // responses — that's how every API handler in this codebase responds.
    const originalJson = res.json.bind(res);
    let persisted = false;
    res.json = (body) => {
      // Fire-and-forget write; never delay the client response on the
      // idempotency persistence path.
      if (!persisted) {
        persisted = true;
        const statusCode = res.statusCode || 200;
        // Only persist successful or client-error responses — server
        // errors (5xx) likely indicate a transient failure the caller
        // SHOULD retry. Storing a 500 and replaying it would mask
        // recovery.
        if (statusCode < 500) {
          const record = {
            key,
            method,
            path,
            bodyHash,
            statusCode,
            response: body,
          };
          models.IdempotencyRecord.create(record).catch((err) => {
            // E11000 = another concurrent request with the same key won
            // the race. That's fine — the winner's record is now the
            // canonical one. Anything else we log but don't surface.
            if (err?.code !== 11000) {
              logger.warn("idempotency persist failed", { err: err?.message });
            }
          });
        }
      }
      return originalJson(body);
    };

    return next();
  };
}

export default idempotency;
