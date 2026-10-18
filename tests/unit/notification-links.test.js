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
import { describe, it, afterEach } from "node:test";
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

// Every emailed dashboard link is on the app host (app.<platform domain>).
const ENV_KEYS = ["PUBLIC_DASHBOARD_URL", "DASHBOARD_URL", "PLATFORM_DOMAIN"];
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
const restoreEnv = () => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
};
const useEnv = (vars) => {
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, { PLATFORM_DOMAIN: "matjar.to", ...vars });
};

describe("dashboardBaseUrl", () => {
  afterEach(restoreEnv);

  it("is the app host when nothing is configured", () => {
    useEnv({});
    assert.equal(dashboardBaseUrl(), "https://app.matjar.to");
  });

  it("ignores a configured URL on another host (the bare platform domain)", () => {
    useEnv({ PUBLIC_DASHBOARD_URL: "https://matjar.to" });
    assert.equal(dashboardBaseUrl(), "https://app.matjar.to");
    useEnv({ DASHBOARD_URL: "https://legacy.matjar.to" });
    assert.equal(dashboardBaseUrl(), "https://app.matjar.to");
  });

  it("keeps a configured URL on the app host, without trailing slashes", () => {
    useEnv({ PUBLIC_DASHBOARD_URL: "https://app.matjar.to///" });
    assert.equal(dashboardBaseUrl(), "https://app.matjar.to");
  });

  it("uses http for a local development host", () => {
    useEnv({ PLATFORM_DOMAIN: "localhost:3000" });
    assert.equal(dashboardBaseUrl(), "http://app.localhost:3000");
  });
});

describe("resolveNotificationUrl", () => {
  afterEach(restoreEnv);

  it("links into the dashboard on the app host", () => {
    useEnv({ PUBLIC_DASHBOARD_URL: "https://matjar.to" });
    const url = resolveNotificationUrl({ type: "order.created", resourceId: "o1" });
    assert.equal(url, "https://app.matjar.to/dashboard/orders/o1");
  });

  it("returns null for unknown types (even with a base URL)", () => {
    process.env.PUBLIC_DASHBOARD_URL = "https://admin.matjar.to";
    assert.equal(resolveNotificationUrl({ type: "does.not.exist" }), null);
  });
});

describe("notificationPreferencesUrl", () => {
  afterEach(restoreEnv);

  it("is the notification settings on the app host", () => {
    useEnv({});
    assert.equal(notificationPreferencesUrl(), "https://app.matjar.to/dashboard/settings?tab=notifications");
  });
});
