/**
 * notificationLinks — backend contract test.
 *
 * Pins the deep-link switch in utils/notificationLinks.js against a
 * shared fixture (tests/fixtures/notification-link-cases.json). The
 * dashboard's `resolveNotificationLink` (dashboard/src/hooks/
 * useNotifications.ts) must stay byte-compatible with this fixture;
 * the frontend isn't tested here because node --test can't import TSX
 * without a bundler — we rely on the "KEEP IN SYNC" comment block in
 * both files + a fixture-driven sanity check on the backend to catch
 * the common drift case (someone adds a case on one side only).
 *
 * Also covers the absolute-URL helpers so the email fan-out doesn't
 * silently emit broken links when PUBLIC_DASHBOARD_URL is misconfigured.
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  resolveNotificationPath,
  resolveNotificationUrl,
  dashboardBaseUrl,
  notificationPreferencesUrl,
} from "../../utils/notificationLinks.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, "..", "fixtures", "notification-link-cases.json");
const cases = JSON.parse(readFileSync(fixturePath, "utf8"));

describe("resolveNotificationPath — fixture-driven", () => {
  for (const tc of cases) {
    it(tc.name, () => {
      const got = resolveNotificationPath(tc.input);
      assert.equal(got, tc.expected);
    });
  }
});

describe("dashboardBaseUrl", () => {
  const ORIG = {
    PUBLIC_DASHBOARD_URL: process.env.PUBLIC_DASHBOARD_URL,
    DASHBOARD_URL: process.env.DASHBOARD_URL,
  };
  beforeEach(() => {
    delete process.env.PUBLIC_DASHBOARD_URL;
    delete process.env.DASHBOARD_URL;
  });
  afterEach(() => {
    if (ORIG.PUBLIC_DASHBOARD_URL === undefined) delete process.env.PUBLIC_DASHBOARD_URL;
    else process.env.PUBLIC_DASHBOARD_URL = ORIG.PUBLIC_DASHBOARD_URL;
    if (ORIG.DASHBOARD_URL === undefined) delete process.env.DASHBOARD_URL;
    else process.env.DASHBOARD_URL = ORIG.DASHBOARD_URL;
  });

  it("prefers PUBLIC_DASHBOARD_URL", () => {
    process.env.PUBLIC_DASHBOARD_URL = "https://admin.matjar.to";
    process.env.DASHBOARD_URL = "https://legacy.matjar.to";
    assert.equal(dashboardBaseUrl(), "https://admin.matjar.to");
  });

  it("falls back to DASHBOARD_URL when PUBLIC_DASHBOARD_URL is unset", () => {
    process.env.DASHBOARD_URL = "https://legacy.matjar.to";
    assert.equal(dashboardBaseUrl(), "https://legacy.matjar.to");
  });

  it("strips trailing slashes", () => {
    process.env.PUBLIC_DASHBOARD_URL = "https://admin.matjar.to///";
    assert.equal(dashboardBaseUrl(), "https://admin.matjar.to");
  });

  it("returns empty string when nothing is configured", () => {
    assert.equal(dashboardBaseUrl(), "");
  });
});

describe("resolveNotificationUrl", () => {
  const ORIG = process.env.PUBLIC_DASHBOARD_URL;
  afterEach(() => {
    if (ORIG === undefined) delete process.env.PUBLIC_DASHBOARD_URL;
    else process.env.PUBLIC_DASHBOARD_URL = ORIG;
  });

  it("prefixes the base URL when configured", () => {
    process.env.PUBLIC_DASHBOARD_URL = "https://admin.matjar.to";
    const url = resolveNotificationUrl({ type: "order.created", resourceId: "o1" });
    assert.equal(url, "https://admin.matjar.to/dashboard/orders/o1");
  });

  it("falls back to relative path when base URL is empty", () => {
    delete process.env.PUBLIC_DASHBOARD_URL;
    delete process.env.DASHBOARD_URL;
    const url = resolveNotificationUrl({ type: "order.created", resourceId: "o1" });
    assert.equal(url, "/dashboard/orders/o1");
  });

  it("returns null for unknown types (even with a base URL)", () => {
    process.env.PUBLIC_DASHBOARD_URL = "https://admin.matjar.to";
    assert.equal(resolveNotificationUrl({ type: "does.not.exist" }), null);
  });
});

describe("notificationPreferencesUrl", () => {
  const ORIG = process.env.PUBLIC_DASHBOARD_URL;
  afterEach(() => {
    if (ORIG === undefined) delete process.env.PUBLIC_DASHBOARD_URL;
    else process.env.PUBLIC_DASHBOARD_URL = ORIG;
  });

  it("returns the absolute preferences URL when base is set", () => {
    process.env.PUBLIC_DASHBOARD_URL = "https://admin.matjar.to";
    assert.equal(
      notificationPreferencesUrl(),
      "https://admin.matjar.to/dashboard/settings?tab=notifications"
    );
  });

  it("returns the relative path when no base URL", () => {
    delete process.env.PUBLIC_DASHBOARD_URL;
    delete process.env.DASHBOARD_URL;
    assert.equal(
      notificationPreferencesUrl(),
      "/dashboard/settings?tab=notifications"
    );
  });
});
