/**
 * Sentry integration smoke tests.
 *
 * The real safety net for Sentry is `tests/unit/logger-redaction.test.js`
 * — that pins the PII scrubber the `beforeSend`/`beforeBreadcrumb` hooks
 * rely on. This file covers the wiring rules that sit on top:
 *
 *   1. `initSentry()` is a safe no-op when SENTRY_DSN is unset. The app
 *      / worker / SPA builds must still boot without Sentry credentials.
 *   2. `captureException(err, ctx)` is a safe no-op when uninitialized —
 *      worker error paths call it unconditionally.
 *   3. `sentryTagMiddleware` never fails a request, with or without
 *      Sentry initialized.
 *
 * We intentionally DON'T spin up a real Sentry client here. @sentry/node
 * only calls its transport on `captureException` when initialized, and
 * the init path itself contacts Sentry's discovery endpoint — both would
 * turn these unit tests into flaky network-dependent integration tests.
 * The "events are scrubbed before send" contract is covered by
 * tests/unit/logger-redaction.test.js which pins `redactPII`, and
 * utils/sentry.js::scrubEvent routes EVERY event through it.
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

describe("Sentry init — DSN unset", () => {
  const originalDsn = process.env.SENTRY_DSN;

  beforeEach(() => {
    delete process.env.SENTRY_DSN;
  });
  afterEach(() => {
    if (originalDsn === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = originalDsn;
  });

  it("initSentry returns false when SENTRY_DSN is unset", async () => {
    // Bust ESM cache so we pick up the fresh module-scope `initialized`
    // flag — otherwise a prior test in the same process could have
    // marked it true via an env-var leak.
    const { initSentry } = await import(`../../utils/sentry.js?t=${Date.now()}`);
    assert.equal(initSentry(), false);
  });

  it("captureException is a no-op when Sentry is disabled", async () => {
    const { captureException } = await import(`../../utils/sentry.js?t=${Date.now()}`);
    // Must not throw, must not hang, must not return a truthy Sentry id.
    const result = captureException(new Error("smoke"), {
      tenantId: "t1",
      userId: "u1",
      extra: { password: "secret-should-be-scrubbed" },
    });
    assert.equal(result, undefined);
  });

  it("sentryTagMiddleware calls next() even with no Sentry scope", async () => {
    const { sentryTagMiddleware } = await import(`../../utils/sentry.js?t=${Date.now()}`);
    let called = false;
    sentryTagMiddleware({ tenantId: "t1", user: { userId: "u1" } }, {}, () => {
      called = true;
    });
    assert.equal(called, true);
  });
});

describe("Sentry wiring — worker + server entry points", () => {
  it("workers/index.js imports initSentry + captureException from utils/sentry.js", async () => {
    // Static-source check keeps this test honest against future refactors.
    // We read the file as text rather than importing it — importing would
    // try to connect to Mongo/Redis at module-scope via config loading.
    const { readFile } = await import("node:fs/promises");
    const src = await readFile(
      new URL("../../workers/index.js", import.meta.url),
      "utf8",
    );
    assert.match(src, /initSentry\s*\(\s*\)/);
    assert.match(src, /captureException/);
    // Must init BEFORE the other imports so auto-instrumentation can
    // patch mongoose/http/BullMQ at require-time.
    const initIdx = src.indexOf("initSentry()");
    const mongooseIdx = src.indexOf('import mongoose');
    assert.ok(
      initIdx >= 0 && initIdx < mongooseIdx,
      "initSentry() must run before `import mongoose` — Sentry's " +
        "auto-instrumentation patches libraries at require-time and " +
        "silently no-ops if loaded too late.",
    );
  });

  it("index.js initializes Sentry before any other import", async () => {
    const { readFile } = await import("node:fs/promises");
    const src = await readFile(
      new URL("../../index.js", import.meta.url),
      "utf8",
    );
    const initIdx = src.indexOf("initSentry()");
    const expressIdx = src.indexOf('import express');
    assert.ok(initIdx >= 0 && expressIdx > initIdx);
  });
});

describe("Sentry wiring — browser SPAs", () => {
  it("dashboard/src/sentry.ts guards on VITE_SENTRY_DSN", async () => {
    const { readFile } = await import("node:fs/promises");
    const src = await readFile(
      new URL("../../dashboard/src/sentry.ts", import.meta.url),
      "utf8",
    );
    // The SDK must early-return when DSN is unset so local dev and
    // Sentry-less forks don't ship an uninitialized SDK that queues
    // breadcrumbs forever.
    assert.match(src, /VITE_SENTRY_DSN/);
    assert.match(src, /if\s*\(\s*!\s*(dsn|DSN|import\.meta\.env\.VITE_SENTRY_DSN)/);
  });

  it("platform-admin/src/sentry.ts guards on VITE_SENTRY_DSN", async () => {
    const { readFile } = await import("node:fs/promises");
    const src = await readFile(
      new URL("../../platform-admin/src/sentry.ts", import.meta.url),
      "utf8",
    );
    assert.match(src, /VITE_SENTRY_DSN/);
    assert.match(src, /if\s*\(\s*!\s*(dsn|DSN|import\.meta\.env\.VITE_SENTRY_DSN)/);
  });
});

describe("Sentry wiring — vite sourcemap plugin is gated", () => {
  it("dashboard vite.config.ts only activates the plugin when all creds are present", async () => {
    const { readFile } = await import("node:fs/promises");
    const src = await readFile(
      new URL("../../dashboard/vite.config.ts", import.meta.url),
      "utf8",
    );
    assert.match(src, /sentryVitePlugin/);
    // Must check all three before instantiating the plugin.
    assert.match(src, /sentryAuthToken.*&&.*sentryOrg.*&&.*sentryProject/s);
  });

  it("platform-admin vite.config.ts only activates the plugin when all creds are present", async () => {
    const { readFile } = await import("node:fs/promises");
    const src = await readFile(
      new URL("../../platform-admin/vite.config.ts", import.meta.url),
      "utf8",
    );
    assert.match(src, /sentryVitePlugin/);
    assert.match(src, /sentryAuthToken.*&&.*sentryOrg.*&&.*sentryProject/s);
  });
});
