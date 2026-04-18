// Sentry initialization for the Node backend.
//
// This module is the *only* place that knows about Sentry. Everything
// else (index.js, error handler, auth middleware) calls into the small
// surface exported here so we can swap providers or tweak PII scrubbing
// in one place.
//
// Hard requirements:
//   1. NEVER ship PII to Sentry. We reuse `redactPII` from utils/logger.js
//      (single source of truth for scrubbing rules) in both `beforeSend`
//      and `beforeBreadcrumb`.
//   2. When SENTRY_DSN is unset, init is a no-op — the app must still
//      start and behave normally. We log the disabled state exactly once.
//   3. Multitenant tagging: every captured event is tagged with the
//      resolved `tenantId` / `userId` so operators can slice by store.

import * as Sentry from "@sentry/node";
import { redactPII } from "./logger.js";
import logger from "./logger.js";
import config from "../config/index.js";

let initialized = false;
let disabledLogged = false;

/**
 * Recursively run `redactPII` over a Sentry event / breadcrumb payload.
 *
 * Sentry's payload shape includes `request.data`, `extra`, `contexts`,
 * `breadcrumbs[].data`, `user` — all of which can carry request bodies,
 * cookies, Authorization headers, email addresses, etc. We push the
 * whole object through the same scrubber the logger uses so nothing
 * leaks regardless of where it was attached.
 */
function scrubEvent(payload) {
  if (!payload || typeof payload !== "object") return payload;
  try {
    return redactPII(payload);
  } catch (err) {
    // If scrubbing throws we'd rather drop the event than risk leaking
    // — return null to signal Sentry to discard.
    logger.warn("Sentry scrub failed — dropping event", {
      error: err?.message,
    });
    return null;
  }
}

/**
 * Initialize Sentry. Safe to call multiple times — subsequent calls are
 * ignored. When SENTRY_DSN is unset, logs once and returns false so
 * callers can skip mounting the Express middleware.
 *
 * @returns {boolean} true if Sentry is active, false when disabled.
 */
export function initSentry() {
  if (initialized) return true;

  const dsn = config.sentryDsn;
  if (!dsn) {
    if (!disabledLogged) {
      logger.info("Sentry disabled — SENTRY_DSN not set");
      disabledLogged = true;
    }
    return false;
  }

  const environment = config.sentryEnvironment;
  const release = config.sentryRelease;
  const tracesSampleRate = config.sentryTracesSampleRate;

  Sentry.init({
    dsn,
    environment,
    release,
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.1,
    sampleRate: 1.0, // capture every error event
    sendDefaultPii: false,
    // PII scrubbing — this runs AFTER Sentry has already serialized the
    // event, so we walk the entire object via `redactPII`. If scrubbing
    // fails we drop the event rather than risk leaking.
    beforeSend(event) {
      return scrubEvent(event);
    },
    beforeBreadcrumb(breadcrumb) {
      return scrubEvent(breadcrumb);
    },
  });

  initialized = true;
  logger.info("Sentry initialized", {
    environment,
    release: release || "(unset)",
    tracesSampleRate,
  });
  return true;
}

/**
 * Capture an exception with structured context. No-op when Sentry is
 * disabled. `context` is passed through `redactPII` before Sentry sees
 * it so ad-hoc captures can't bypass the scrubber.
 */
export function captureException(err, context = {}) {
  if (!initialized) return;
  try {
    const safe = context && typeof context === "object" ? redactPII(context) : {};
    Sentry.withScope((scope) => {
      if (safe.tenantId) scope.setTag("tenantId", String(safe.tenantId));
      if (safe.userId) scope.setTag("userId", String(safe.userId));
      if (safe.extra && typeof safe.extra === "object") {
        for (const [k, v] of Object.entries(safe.extra)) {
          scope.setExtra(k, v);
        }
      }
      Sentry.captureException(err);
    });
  } catch {
    // Never let Sentry failures mask the original error.
  }
}

/**
 * Tiny middleware — mount AFTER auth so `req.user` / `req.tenantId` are
 * populated. Tags every event in this request scope with `tenantId` and
 * `userId`. Safe to mount unconditionally; if Sentry is disabled, all
 * calls are cheap no-ops.
 */
export function sentryTagMiddleware(req, _res, next) {
  if (initialized) {
    try {
      const scope = Sentry.getCurrentScope();
      if (req.tenantId) scope.setTag("tenantId", String(req.tenantId));
      const userId = req.user?.userId;
      if (userId) scope.setTag("userId", String(userId));
    } catch {
      // ignore — tagging must never fail a request.
    }
  }
  next();
}

/**
 * Express error middleware. Sends unhandled errors to Sentry, then
 * delegates to the next error handler (the app's own errorHandler).
 * No-op when Sentry is disabled.
 */
export const sentryErrorHandler = Sentry.expressErrorHandler();

export { Sentry };
