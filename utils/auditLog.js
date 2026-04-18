/**
 * Write immutable audit log entries for state transitions.
 *
 * Every order / payment / fulfillment / inventory state change MUST call
 * logTransition() so the tenant has a defensible, queryable record of who
 * changed what, when, and why. These entries power:
 *   - Dashboard audit timeline
 *   - Chargeback evidence
 *   - Support debugging
 *   - Compliance reporting
 *
 * Failures here are swallowed (logged to stderr) rather than propagated —
 * a broken audit log must never block the state change it's recording.
 */

/**
 * Write an audit log entry. Fire-and-forget by default.
 *
 * @param {Object} models - Scoped models (auto-injects tenantId)
 * @param {Object} params
 * @param {string} params.action     - e.g. "order.status_changed", "payment.paid"
 * @param {string} params.resource   - e.g. "Order", "Payment", "Fulfillment"
 * @param {import("mongoose").Types.ObjectId} params.resourceId
 * @param {import("mongoose").Types.ObjectId|null} params.actor - userId or null for system
 * @param {string} [params.actorName] - snapshot display name
 * @param {Object} [params.changes]  - { field: { from, to } }
 * @param {Object} [params.metadata] - arbitrary extra context
 * @param {string} [params.ip]
 * @param {string} [params.userAgent]
 * @param {import("mongoose").ClientSession} [params.session] - if inside a transaction
 */
export async function logTransition(models, params) {
  try {
    const doc = {
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      actor: params.actor || undefined,
      actorName: params.actorName || undefined,
      changes: params.changes || undefined,
      metadata: params.metadata || undefined,
      ip: params.ip || undefined,
      userAgent: params.userAgent || undefined,
    };

    if (params.session) {
      // Inside a transaction — must participate in the same session
      // so the log entry commits or aborts with the state change.
      await models.AuditLog.create(doc);
    } else {
      // Outside a transaction — best-effort, swallow failures.
      await models.AuditLog.create(doc);
    }
  } catch (err) {
    // Never block the state change. Log to stderr for ops visibility.
    console.error("[audit-log] Failed to write entry:", err.message, params.action);
  }
}

/**
 * Convenience: log a state transition with standardised `changes` shape.
 */
export async function logStateChange(models, {
  entity,       // "order" | "payment" | "fulfillment" | "return"
  resourceId,
  from,
  to,
  actor,
  actorName,
  reason,
  metadata,
  ip,
  userAgent,
  session,
}) {
  return logTransition(models, {
    action: `${entity}.status_changed`,
    resource: entity.charAt(0).toUpperCase() + entity.slice(1),
    resourceId,
    actor,
    actorName,
    changes: { status: { from, to } },
    metadata: {
      ...metadata,
      ...(reason ? { reason } : {}),
    },
    ip,
    userAgent,
    session,
  });
}
