/**
 * Platform audit ledger writer.
 *
 * Every mutating platform-admin action calls `recordPlatformAudit` (or the
 * `auditedAction` wrapper). Fail-soft: a ledger write failure is logged but
 * never turns a successful operation into an error — but it is also never
 * silently skipped: the failure itself is logged at error level.
 *
 * Never put secrets in before/after/metadata. Redaction of known secret keys
 * is applied defensively.
 */
import mongoose from "mongoose";
import logger from "../../utils/logger.js";

const SECRET_KEY_RE = /password|secret|token|hash|authorization|api[_-]?key|cookie/i;

export function redactForAudit(value, depth = 0) {
  if (value == null) return value;
  if (depth > 5) return "[truncated]";
  if (Array.isArray(value)) return value.map((v) => redactForAudit(v, depth + 1));
  if (typeof value === "object") {
    if (value instanceof Date || value instanceof mongoose.Types.ObjectId) return value;
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEY_RE.test(k) ? "[redacted]" : redactForAudit(v, depth + 1);
    }
    return out;
  }
  return value;
}

const REQUEST_ID_RE = /^[A-Za-z0-9._-]{1,128}$/;
function requestIdOf(req) {
  const raw = req?.id || req?.headers?.["x-request-id"];
  const v = raw == null ? null : String(raw);
  return v && REQUEST_ID_RE.test(v) ? v : null;
}

function clientIp(req) {
  return req?.ip || req?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() || null;
}

/**
 * @param {import('express').Request|null} req   platform request (req.platformUser) or null for system actors
 * @param {object} entry
 * @param {string} entry.action        dotted verb, e.g. "tenant.suspend"
 * @param {string} [entry.resourceType]
 * @param {string|object} [entry.resourceId]
 * @param {string|object} [entry.tenantId]
 * @param {string} [entry.reason]
 * @param {object} [entry.before]
 * @param {object} [entry.after]
 * @param {object} [entry.metadata]
 * @param {"success"|"failure"} [entry.outcome]
 */
export async function recordPlatformAudit(req, entry) {
  try {
    const PlatformAuditLog = mongoose.model("PlatformAuditLog");
    const actor = req?.platformUser || null;
    await PlatformAuditLog.create({
      actorId: actor?.id || null,
      actorEmail: actor?.email || null,
      actorRole: actor?.role || null,
      actorType: actor ? "platform_user" : "system",
      action: entry.action,
      resourceType: entry.resourceType || null,
      resourceId: entry.resourceId != null ? String(entry.resourceId) : null,
      tenantId: entry.tenantId || null,
      reason: entry.reason || null,
      before: redactForAudit(entry.before ?? null),
      after: redactForAudit(entry.after ?? null),
      metadata: redactForAudit(entry.metadata ?? null),
      ip: clientIp(req),
      userAgent: req?.headers?.["user-agent"]?.slice(0, 300) || null,
      requestId: requestIdOf(req),
      outcome: entry.outcome || "success",
    });
  } catch (err) {
    logger.error("platformAudit: failed to write ledger row", {
      action: entry?.action,
      error: err?.message,
    });
  }
}
