// Sentry initialization for the merchant dashboard SPA.
//
// Hard requirements (mirror the backend):
//   - Never ship PII. We strip `password`, `token`, `email`, `phone`,
//     `cardNumber` from event bodies and breadcrumbs before sending.
//   - When VITE_SENTRY_DSN is unset, initSentry() is a no-op so local
//     development never talks to Sentry.
//   - Session replay uses privacy-by-default: text masked, media blocked.
//
// This file is imported from src/main.tsx BEFORE ReactDOM.createRoot so
// errors thrown during React's initial render are captured.

import { useEffect } from "react";
import {
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes,
} from "react-router-dom";
import * as Sentry from "@sentry/react";

// Fields we always strip from event payloads. Matches the backend's
// REDACT_KEYS set in utils/logger.js. Keep case-insensitive via
// `.toLowerCase()` on the compare side.
const STRIP_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "cookie",
  "setcookie",
  "apikey",
  "secret",
  "email",
  "phone",
  "cardnumber",
  "creditcard",
  "cvv",
  "cvc",
  "ssn",
]);

const REDACTED = "[REDACTED]";

/**
 * Deep-scrub an arbitrary value: any object key that matches STRIP_KEYS
 * (case-insensitive) is replaced with "[REDACTED]". Walks arrays and
 * plain objects; leaves primitives untouched. Cycle-safe via a WeakSet.
 */
function scrubValue(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  if (seen.has(value as object)) return "[Circular]";
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((v) => scrubValue(v, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (STRIP_KEYS.has(k.toLowerCase())) {
      out[k] = REDACTED;
    } else {
      out[k] = scrubValue(v, seen);
    }
  }
  return out;
}

/**
 * Scrub a Sentry event in place — only touches known PII-carrying
 * sub-objects (`request.data`, `extra`, `contexts`, `breadcrumbs`).
 * Running the full scrubber over the whole event would mangle required
 * fields (event_id, timestamp, etc.) that happen to sit alongside
 * scrubbable children.
 */
// Structural view of a Sentry event limited to the sub-objects we need
// to scrub. Keeping the value type as `unknown` (not `any`) preserves
// type safety at use sites — `scrubValue` already accepts `unknown`.
interface ScrubbableEvent {
  request?: {
    data?: unknown;
    headers?: unknown;
    cookies?: unknown;
  };
  extra?: unknown;
  contexts?: unknown;
  breadcrumbs?: Array<Record<string, unknown>>;
  user?: { id?: string } & Record<string, unknown>;
}

function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  // Sentry's Event type is a huge union. We only care about the presence
  // of the known-PII sub-objects so we view it through a narrow, typed
  // structural interface rather than scattering type assertions.
  const e = event as unknown as ScrubbableEvent;
  if (e.request?.data !== undefined) {
    e.request.data = scrubValue(e.request.data);
  }
  if (e.request?.headers) {
    e.request.headers = scrubValue(e.request.headers);
  }
  if (e.request?.cookies) {
    e.request.cookies = scrubValue(e.request.cookies);
  }
  if (e.extra) {
    e.extra = scrubValue(e.extra);
  }
  if (e.contexts) {
    e.contexts = scrubValue(e.contexts);
  }
  if (Array.isArray(e.breadcrumbs)) {
    e.breadcrumbs = e.breadcrumbs.map((bc: Record<string, unknown>) => ({
      ...bc,
      data: bc.data ? scrubValue(bc.data) : bc.data,
    }));
  }
  // `user` often carries email — strip everything except the opaque id.
  if (e.user) {
    e.user = e.user.id ? { id: e.user.id } : {};
  }
  return event;
}

let initialized = false;

/**
 * Initialize the Sentry browser SDK. No-op when VITE_SENTRY_DSN is unset
 * so local dev (and any environment that hasn't been wired up yet) runs
 * clean.
 */
export function initSentry(): void {
  if (initialized) return;

  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) {
    // Quiet in prod, one-line hint in dev so the omission is visible.
    if (import.meta.env.DEV) {
      console.info("[sentry] disabled — VITE_SENTRY_DSN not set");
    }
    return;
  }

  const environment =
    (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ||
    (import.meta.env.MODE as string | undefined) ||
    "development";
  const release = import.meta.env.VITE_SENTRY_RELEASE as string | undefined;
  const isProd = environment === "production";

  Sentry.init({
    dsn,
    environment,
    release,
    tracesSampleRate: isProd ? 0.1 : 1.0,
    replaysSessionSampleRate: isProd ? 0.1 : 0,
    replaysOnErrorSampleRate: 1.0,
    sendDefaultPii: false,
    integrations: [
      // React Router v7 is used by this SPA — see package.json. The
      // integration needs the router hooks passed in so it can wrap
      // navigations as Sentry transactions.
      Sentry.reactRouterV7BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    beforeSend(event) {
      try {
        return scrubEvent(event);
      } catch {
        // If scrubbing throws, drop the event rather than leak.
        return null;
      }
    },
    beforeBreadcrumb(breadcrumb) {
      if (!breadcrumb) return breadcrumb;
      if (breadcrumb.data) {
        breadcrumb.data = scrubValue(breadcrumb.data) as typeof breadcrumb.data;
      }
      return breadcrumb;
    },
  });

  initialized = true;
}

export { Sentry };
