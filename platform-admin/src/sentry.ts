// Sentry initialization for the platform-admin SPA.
//
// Same contract as the dashboard's src/sentry.ts — see that file for
// the full rationale. We keep the two copies independent (rather than
// sharing a single module) so each SPA can use its own Sentry project
// and the dependency graphs stay isolated.

import { useEffect } from "react";
import {
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes,
} from "react-router-dom";
import * as Sentry from "@sentry/react";

// Keys stripped from every event/breadcrumb payload before send. Keep
// aligned with the dashboard copy and the backend's utils/logger.js.
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

function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  const e = event as unknown as Record<string, unknown>;
  const req = e.request as Record<string, unknown> | undefined;
  if (req?.data !== undefined) {
    req.data = scrubValue(req.data);
  }
  if (req?.headers) {
    req.headers = scrubValue(req.headers);
  }
  if (req?.cookies) {
    req.cookies = scrubValue(req.cookies);
  }
  if (e.extra) {
    e.extra = scrubValue(e.extra);
  }
  if (e.contexts) {
    e.contexts = scrubValue(e.contexts);
  }
  if (Array.isArray(e.breadcrumbs)) {
    e.breadcrumbs = (e.breadcrumbs as Array<Record<string, unknown>>).map((bc) => ({
      ...bc,
      data: bc.data ? scrubValue(bc.data) : bc.data,
    }));
  }
  const user = e.user as { id?: string } | undefined;
  if (user) {
    e.user = user.id ? { id: user.id } : {};
  }
  return event;
}

let initialized = false;

/**
 * Initialize Sentry. No-op when VITE_SENTRY_DSN is unset.
 */
export function initSentry(): void {
  if (initialized) return;

  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) {
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
