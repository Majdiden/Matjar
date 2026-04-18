/**
 * Email delivery processor.
 *
 * Uses Resend (already installed as a dependency). When `EMAIL_ENABLED`
 * is not "true" the processor short-circuits to a log line so local /
 * CI runs don't blast real email even if the queue is live.
 *
 * Template rendering is deliberately tiny: `{{var}}` substitution over
 * the payload `data` bag. The richer templating in services/
 * orderNotifications.js already produces fully rendered strings; this
 * processor is the transport layer.
 */

import logger from "../../utils/logger.js";
import config from "../../config/index.js";

let resendClient = null;
async function getClient() {
  if (resendClient) return resendClient;
  const { Resend } = await import("resend");
  resendClient = new Resend(config.resendApiKey);
  return resendClient;
}

function render(template, data = {}) {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key) => {
    const v = key.split(".").reduce((acc, k) => (acc == null ? acc : acc[k]), data);
    return v == null ? "" : String(v);
  });
}

export async function processEmail(job) {
  const { to, subject, template, data, tenantId } = job.data || {};
  if (!to) throw new Error("email job missing `to`");

  // Off by default. Flipping EMAIL_ENABLED=true in prod is an explicit
  // operational decision, not an accident of running this worker.
  if (!config.emailEnabled) {
    logger.info("email: skipped (EMAIL_ENABLED!=true)", { to, subject, tenantId, jobId: job.id });
    return { skipped: true, reason: "email-disabled" };
  }

  const client = await getClient();
  const from = config.emailFrom;
  if (!from) throw new Error("EMAIL_FROM must be set when EMAIL_ENABLED=true");

  const rendered = {
    subject: render(subject, data),
    html: typeof template === "string" ? render(template, data) : template?.html,
    text: typeof template === "string" ? undefined : template?.text,
  };

  const { error, data: result } = await client.emails.send({
    from,
    to,
    subject: rendered.subject || "(no subject)",
    html: rendered.html,
    text: rendered.text,
  });
  if (error) {
    // Throw so BullMQ retries per the default backoff.
    throw new Error(`Resend send failed: ${error.message || JSON.stringify(error)}`);
  }
  return { id: result?.id, to };
}
