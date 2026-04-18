/**
 * Email provider adapter — canonical email-sending module.
 *
 * This is the ONE place in the app that knows how to put an email on
 * the wire. Callers should never import `resend` directly — they go
 * through `sendEmail` here so:
 *   - EMAIL_ENABLED=false short-circuits to a log-only stub (used in
 *     dev and CI so we don't blast real mail);
 *   - unit / e2e tests can inspect an in-memory capture instead of
 *     having to mock the transport layer per-suite;
 *   - swapping providers (SES, SendGrid, Postmark) later is a
 *     single-file change.
 *
 * Two consumers plug into this module:
 *   - services/orderNotifications.js       — customer-facing order emails
 *   - services/notification.js             — staff dashboard notification
 *                                             fan-out
 *   - services/staff.js                    — staff invite emails
 *
 * Shape of the return value:
 *   { id, provider: "resend" | "log" | "inbox", accepted: true }
 * or { success: false, error } on a handled provider error. We
 * deliberately return `accepted: true` from the stub and test-inbox
 * branches so upstream side-effect flows (order status update, invite
 * creation) don't treat a disabled-email setup as a failure.
 */

import logger from "../../utils/logger.js";
import config from "../../config/index.js";

let resendClient = null;

async function getResendClient() {
  if (resendClient) return resendClient;
  const { Resend } = await import("resend");
  if (!config.resendApiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  resendClient = new Resend(config.resendApiKey);
  return resendClient;
}

// ---------------------------------------------------------------------------
// Test inbox
// ---------------------------------------------------------------------------
// When NODE_ENV=test (or when no provider is configured), `sendEmail` pushes
// the payload onto this in-memory array so tests can assert what would have
// gone out. Exported helpers let tests clear the inbox between cases and
// inspect the captured messages. This is intentionally process-global:
// supertest drives the same module the code under test imports, so the
// module-level array is the only shared state that works without DI.

const __testInbox = [];

/** Return a reference to the captured inbox. Do not mutate. */
export const getTestInbox = () => __testInbox;

/** Empty the captured inbox. Call in beforeEach. */
export const clearTestInbox = () => {
  __testInbox.length = 0;
};

// Optional test-only hook that runs before the inbox push. Tests set
// this to simulate provider failures (the capture path itself never
// throws). Guarded by NODE_ENV=test so it can't accidentally be
// invoked in production.
let __testSendEmailHook = null;

/**
 * TEST-ONLY. Install a function that runs at the start of sendEmail
 * (before capture). Return undefined to let the capture continue, or
 * throw to simulate a provider failure. Pass `null` to clear.
 */
export function __setTestSendEmailHook(fn) {
  if (!config.isTest) return;
  __testSendEmailHook = typeof fn === "function" ? fn : null;
}

function captureForTest({ to, subject, html, text, from }) {
  if (__testSendEmailHook) {
    // Hook may throw to simulate a send failure — let the error
    // propagate so the caller's try/catch path is exercised.
    __testSendEmailHook({ to, subject, html, text, from });
  }
  __testInbox.push({
    to,
    subject,
    html,
    text,
    from: from || null,
    at: new Date(),
  });
  return {
    id: `inbox-${__testInbox.length}`,
    provider: "inbox",
    accepted: true,
    // Legacy consumers (orderNotifications) inspect `.success` on the
    // return value. Keep the key so a tenant status update doesn't
    // false-positive on the soft path.
    success: true,
  };
}

// ---------------------------------------------------------------------------
// Core send
// ---------------------------------------------------------------------------

/**
 * Send an email via the configured provider.
 *
 * @param {object} opts
 * @param {string|string[]} opts.to       Recipient address(es). Required.
 * @param {string}          opts.subject  Subject line. Required.
 * @param {string}         [opts.html]    HTML body. One of html|text required.
 * @param {string}         [opts.text]    Plain-text body.
 * @param {string}         [opts.from]    Override sender. Defaults to EMAIL_FROM.
 * @param {string}         [opts.replyTo] Reply-To header.
 * @param {object}         [opts.tags]    Provider-specific tags.
 */
export async function sendEmail({ to, subject, html, text, from, replyTo, tags }) {
  // Test environment always captures into the in-memory inbox — we never
  // want a test run to hit the network, regardless of env-var state.
  if (config.isTest) {
    return captureForTest({ to, subject, html, text, from });
  }

  // Platform gate. EMAIL_ENABLED=false (the default) means dev / staging
  // is reachable but we still don't want to spam inboxes from every
  // developer's laptop. Log + return the stub envelope.
  if (!config.emailEnabled) {
    logger.info("Email (stub)", {
      to,
      subject,
      preview: (text || html || "").slice(0, 120),
    });
    return { id: "stub", provider: "log", accepted: true, success: true };
  }

  if (!to || !subject || (!html && !text)) {
    throw new Error("sendEmail: to, subject, and html|text required");
  }

  try {
    const client = await getResendClient();
    const fromAddr = from || config.emailFrom;
    if (!fromAddr) throw new Error("EMAIL_FROM is not configured");

    const resp = await client.emails.send({
      from: fromAddr,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
      reply_to: replyTo,
      tags,
    });
    if (resp?.error) {
      throw new Error(`Resend error: ${resp.error.message || resp.error}`);
    }
    return {
      id: resp?.data?.id,
      provider: "resend",
      accepted: true,
      success: true,
    };
  } catch (error) {
    logger.error("Failed to send email", {
      error: error.message,
      to,
      subject,
    });
    // Return the failure envelope rather than throwing — order-status
    // notifications and the staff invite flow both treat a delivery
    // failure as a soft failure and must not roll back the caller.
    return { success: false, accepted: false, error: error.message };
  }
}

/**
 * Platform-level "can we actually send mail right now?" check. Used by
 * the notification fan-out to cheap-skip the DB work when email is off.
 * Note this is distinct from the NODE_ENV=test inbox branch in
 * sendEmail — under test we still *capture* sends, but we report
 * configured=false so the fan-out codepath mirrors production.
 */
export function isEmailConfigured() {
  return config.emailEnabled && !!config.resendApiKey;
}
