import logger from "./logger.js";

/**
 * Log an audit event. Fire-and-forget — never blocks the request and
 * never throws. The audit pipeline must not become a foot-gun: a write
 * failure here will not roll back business logic, will not fail the
 * HTTP response, and will not propagate to the caller.
 *
 * Convenience: callers can pass `req` instead of plucking actor/ip/UA
 * out themselves. We extract them defensively because some call sites
 * (background jobs, webhooks) only have `models` and an explicit actor.
 */
export function logAudit(models, opts) {
  try {
    if (!models?.AuditLog) return;
    const { action, resource, resourceId, changes, metadata, req } = opts;
    const actor = opts.actor || req?.user?.userId || null;
    const actorName = opts.actorName || req?.user?.name || null;

    // If this request was made via a platform-admin impersonation token,
    // capture the operator's identity and reason in metadata. Without
    // this, support actions look like they came from the tenant user.
    const impersonatedBy = req?.user?.impersonatedBy;
    const impersonationReason = req?.user?.impersonationReason;
    const enrichedMetadata =
      impersonatedBy
        ? { ...(metadata || {}), impersonatedBy, impersonationReason }
        : metadata;

    models.AuditLog.create({
      actor,
      actorName,
      action,
      resource,
      resourceId,
      changes,
      metadata: enrichedMetadata,
      ip: req?.ip,
      userAgent: req?.get?.("user-agent"),
    }).catch((err) => {
      // Failures here used to be silently swallowed, leaving the audit log
      // page mysteriously empty. Surface them at warn level so the cause
      // (cast errors, missing fields, connection issues) is visible in logs.
      logger.warn(`audit log write failed (${action} on ${resource}): ${err?.message}`);
    });
  } catch (err) {
    logger.warn(`audit log threw: ${err?.message}`);
  }
}
