/**
 * Webhook delivery processor.
 *
 * Signs the payload with an HMAC-SHA256 of the shared secret and POSTs
 * to the merchant's registered URL. Non-2xx responses throw so BullMQ
 * retries with the queue's exponential backoff. After 5 attempts the
 * job lands in the failed set (our DLQ) for operator inspection.
 *
 * Idempotency is enforced at enqueue time via stable `jobId` built from
 * (tenant, event, payload.id). BullMQ deduplicates on jobId so a
 * retried producer can't fan out duplicate deliveries to the merchant.
 */

import crypto from "crypto";
import axios from "axios";
import logger from "../../utils/logger.js";

const DELIVERY_TIMEOUT_MS = 10_000;

export async function processWebhookDelivery(job) {
  const { tenantId, event, payload, targetUrl, secret } = job.data || {};
  if (!targetUrl) throw new Error("webhook job missing targetUrl");

  const body = JSON.stringify({ event, payload });
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "Matjar-Webhook/1.0",
    "X-Matjar-Event": event || "unknown",
    "X-Matjar-Delivery": job.id || crypto.randomUUID(),
  };
  if (tenantId) headers["X-Matjar-Tenant"] = tenantId;
  if (secret) {
    const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
    headers["X-Matjar-Signature"] = `sha256=${sig}`;
  }

  try {
    const res = await axios.post(targetUrl, body, {
      headers,
      timeout: DELIVERY_TIMEOUT_MS,
      // Do not follow redirects — the merchant registered a specific
      // URL, and following a 3xx to an unrelated host is a blind-SSRF
      // shaped footgun.
      maxRedirects: 0,
      // Accept only 2xx ourselves — anything else is a retry trigger.
      validateStatus: (s) => s >= 200 && s < 300,
    });
    return { status: res.status, attempt: job.attemptsMade + 1 };
  } catch (err) {
    const status = err.response?.status;
    logger.warn("webhook delivery failed", {
      tenantId,
      event,
      targetUrl,
      status,
      attempt: job.attemptsMade + 1,
      message: err.message,
    });
    throw err;
  }
}
