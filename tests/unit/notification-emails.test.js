/**
 * notification.dispatchEmails — staff email fan-out unit tests.
 *
 * Scope: the dispatcher's gating logic (feature flag, role filter,
 * permission gate, per-type opt-in pref, recipient allow-list) and
 * its resilience to per-user send failures. Everything else (persisting
 * the notification, SSE fan-out) lives in services/notification.js::emit
 * and is covered by integration tests.
 *
 * Strategy:
 *   - Fake `models` with in-memory User + Role collections (mirrors the
 *     customerPrivacy.test.js pattern — no mongodb-memory-server needed).
 *   - Drive `isEmailConfigured()` via env: EMAIL_ENABLED + RESEND_API_KEY.
 *   - Inspect sends via the provider's `getTestInbox()` (NODE_ENV=test
 *     forces capture regardless of EMAIL_ENABLED — see providers/email.js).
 *   - Simulate a per-user provider failure via
 *     `__setTestSendEmailHook()` from the provider module.
 */
process.env.NODE_ENV = "test";

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { dispatchEmails } from "../../services/notification.js";
import {
  getTestInbox,
  clearTestInbox,
  __setTestSendEmailHook,
} from "../../services/providers/email.js";

const ORIG_ENV = {
  EMAIL_ENABLED: process.env.EMAIL_ENABLED,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
};

function enableEmail() {
  process.env.EMAIL_ENABLED = "true";
  process.env.RESEND_API_KEY = "re_test_key";
}
function disableEmail() {
  delete process.env.EMAIL_ENABLED;
  delete process.env.RESEND_API_KEY;
}

/**
 * Build a fake `models` object whose User.find(...).select(...).lean()
 * chain returns `users` filtered by the mongoose-style query supplied
 * to find(). Only filters we actually use in dispatchEmails are
 * honored: isActive, email existence, roles $in, _id $in.
 */
function buildModels(users, customRoles = []) {
  return {
    User: {
      find: (filter) => ({
        select: () => ({
          lean: async () => users.filter((u) => matchesFilter(u, filter)),
        }),
      }),
    },
    Role: {
      find: (filter) => ({
        select: () => ({
          lean: async () => {
            const ids = filter?._id?.$in || [];
            const setIds = new Set(ids.map(String));
            return customRoles.filter((r) => setIds.has(String(r._id)));
          },
        }),
      }),
    },
  };
}

function matchesFilter(user, filter) {
  if (filter.isActive !== undefined && user.isActive !== filter.isActive) return false;
  // email existence
  if (filter.email?.$exists && (!user.email || user.email === "")) return false;
  if (filter.email?.$ne !== undefined && user.email === filter.email.$ne) return false;
  // roles $in
  if (filter.roles?.$in) {
    const rolesHit = (user.roles || []).some((r) => filter.roles.$in.includes(r));
    if (!rolesHit) return false;
  }
  // _id $in (recipient allow-list)
  if (filter._id?.$in) {
    const ids = filter._id.$in.map(String);
    if (!ids.includes(String(user._id))) return false;
  }
  return true;
}

function baseNotification(overrides = {}) {
  return {
    type: "order.created",
    title: "New order",
    body: "An order was placed.",
    severity: "info",
    resourceId: "ord_1",
    ...overrides,
  };
}

function optInUser(user, type = "order.created") {
  return {
    isActive: true,
    ...user,
    notificationPreferences: {
      ...(user.notificationPreferences || {}),
      [type]: { email: true },
    },
  };
}

describe("dispatchEmails", () => {
  beforeEach(() => {
    clearTestInbox();
    __setTestSendEmailHook(null);
  });

  afterEach(() => {
    // Restore env so tests don't leak into each other.
    if (ORIG_ENV.EMAIL_ENABLED === undefined) delete process.env.EMAIL_ENABLED;
    else process.env.EMAIL_ENABLED = ORIG_ENV.EMAIL_ENABLED;
    if (ORIG_ENV.RESEND_API_KEY === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = ORIG_ENV.RESEND_API_KEY;
    __setTestSendEmailHook(null);
  });

  it("no-ops when email is not configured", async () => {
    disableEmail();
    const models = buildModels([
      optInUser({ _id: "u1", email: "admin@x.test", roles: ["admin"] }),
    ]);
    await dispatchEmails(models, baseNotification());
    assert.equal(getTestInbox().length, 0, "must not hit sendEmail when email disabled");
  });

  it("sends to staff users who opted in via notificationPreferences[type].email", async () => {
    enableEmail();
    const models = buildModels([
      optInUser({ _id: "u1", email: "admin@x.test", roles: ["admin"] }),
      optInUser({ _id: "u2", email: "mgr@x.test", roles: ["manager"] }),
      optInUser({ _id: "u3", email: "staff@x.test", roles: ["staff"] }),
    ]);
    await dispatchEmails(models, baseNotification());
    const inbox = getTestInbox();
    assert.equal(inbox.length, 3);
    const recipients = inbox.map((m) => m.to).sort();
    assert.deepEqual(recipients, ["admin@x.test", "mgr@x.test", "staff@x.test"]);
    // Sanity: the subject is the notification title and the body has
    // the "View in dashboard:" prefix we document as a stable contract.
    assert.equal(inbox[0].subject, "New order");
    assert.match(inbox[0].text, /View in dashboard:/);
  });

  it("skips users whose pref is explicitly false or missing", async () => {
    enableEmail();
    const models = buildModels([
      // opted in
      optInUser({ _id: "u1", email: "in@x.test", roles: ["admin"] }),
      // explicitly opted out
      {
        _id: "u2",
        email: "out@x.test",
        roles: ["manager"],
        isActive: true,
        notificationPreferences: { "order.created": { email: false } },
      },
      // no prefs at all → default OFF
      {
        _id: "u3",
        email: "default@x.test",
        roles: ["staff"],
        isActive: true,
      },
    ]);
    await dispatchEmails(models, baseNotification());
    const inbox = getTestInbox();
    assert.equal(inbox.length, 1);
    assert.equal(inbox[0].to, "in@x.test");
  });

  it("honors the permission gate", async () => {
    enableEmail();
    const models = buildModels([
      // admin — has "*" → always passes the gate
      optInUser({ _id: "u1", email: "admin@x.test", roles: ["admin"] }, "refund.created"),
      // staff — lacks "payments.refund" per ROLE_PERMISSIONS catalog
      optInUser({ _id: "u2", email: "staff@x.test", roles: ["staff"] }, "refund.created"),
      // manager — has "payments.refund"
      optInUser({ _id: "u3", email: "mgr@x.test", roles: ["manager"] }, "refund.created"),
    ]);
    await dispatchEmails(models, {
      type: "refund.created",
      title: "Refund issued",
      body: "A refund was processed.",
      permission: "payments.refund",
      resourceId: "ord_42",
    });
    const recipients = getTestInbox().map((m) => m.to).sort();
    assert.deepEqual(
      recipients,
      ["admin@x.test", "mgr@x.test"],
      "staff without payments.refund must be skipped"
    );
  });

  it("honors recipientUserIds allow-list", async () => {
    enableEmail();
    const models = buildModels([
      optInUser({ _id: "u1", email: "a@x.test", roles: ["admin"] }),
      optInUser({ _id: "u2", email: "b@x.test", roles: ["manager"] }),
      optInUser({ _id: "u3", email: "c@x.test", roles: ["staff"] }),
    ]);
    await dispatchEmails(
      models,
      baseNotification({ recipientUserIds: ["u1", "u3"] })
    );
    const recipients = getTestInbox().map((m) => m.to).sort();
    assert.deepEqual(recipients, ["a@x.test", "c@x.test"]);
  });

  it("swallows per-user send failures; other users still receive", async () => {
    enableEmail();
    const models = buildModels([
      optInUser({ _id: "u1", email: "ok1@x.test", roles: ["admin"] }),
      optInUser({ _id: "u2", email: "boom@x.test", roles: ["manager"] }),
      optInUser({ _id: "u3", email: "ok2@x.test", roles: ["staff"] }),
    ]);
    // Simulate provider failure for one specific recipient only.
    __setTestSendEmailHook(({ to }) => {
      if (to === "boom@x.test") {
        throw new Error("simulated provider outage");
      }
    });

    // dispatchEmails must not throw.
    await dispatchEmails(models, baseNotification());

    const recipients = getTestInbox().map((m) => m.to).sort();
    assert.deepEqual(
      recipients,
      ["ok1@x.test", "ok2@x.test"],
      "failure for one user must not abort the fan-out"
    );
  });

  it("ignores customers even when opted-in (staff-only channel)", async () => {
    enableEmail();
    const models = buildModels([
      optInUser({ _id: "u1", email: "admin@x.test", roles: ["admin"] }),
      // A customer who somehow set a notification pref — must never
      // be emailed on this staff channel. The User.find filter also
      // filters by staff roles, but we defend-in-depth in the
      // per-user check too.
      optInUser({ _id: "u2", email: "buyer@x.test", roles: ["customer"] }),
    ]);
    await dispatchEmails(models, baseNotification());
    const recipients = getTestInbox().map((m) => m.to);
    assert.deepEqual(recipients, ["admin@x.test"]);
  });

  it("returns without sending when the notification arg is falsy", async () => {
    enableEmail();
    const models = buildModels([
      optInUser({ _id: "u1", email: "a@x.test", roles: ["admin"] }),
    ]);
    await dispatchEmails(models, null);
    await dispatchEmails(models, undefined);
    assert.equal(getTestInbox().length, 0);
  });
});
