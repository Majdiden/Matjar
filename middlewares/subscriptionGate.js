/**
 * Subscription-state gate.
 *
 * Blocks writes to a tenant's data while its subscriptionStatus is
 * `suspended` or `cancelled`, or while `deletionScheduledAt` is set.
 * Read methods (GET/HEAD/OPTIONS) are allowed so:
 *   - shoppers browsing the storefront see a read-only store rather
 *     than a hard outage;
 *   - the merchant can still view/export their data during the
 *     grace window before a deletion is finalized.
 *
 * Mounted after `authenticate` (needs req.tenant) but before any
 * write handler. Applies only when req.tenant is present — platform
 * routes and unauthenticated storefront reads pass through.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Pure evaluation of the subscription write-block for a tenant + method.
 * Returns `{ statusCode, body }` when the request should be blocked, or
 * `null` when it's allowed. Shared by the host-mounted `subscriptionGate`
 * (tenant subdomains, where req.tenant is host-resolved) and by the auth
 * middleware on the app host (where the tenant is only known from the JWT).
 */
export function evaluateSubscriptionBlock(tenant, method) {
  if (!tenant) return null;
  if (SAFE_METHODS.has(method)) return null;

  const status = tenant.subscriptionStatus;
  const isSuspended = status === "suspended" || !!tenant.suspendedAt;
  const isCancelled = status === "cancelled";
  const isDeleting = !!tenant.deletionScheduledAt || !!tenant.deletedAt;

  if (isSuspended) {
    return {
      statusCode: 402,
      body: {
        success: false,
        code: "TENANT_SUSPENDED",
        message: "This store is suspended and cannot accept changes. Contact support.",
      },
    };
  }
  if (isDeleting) {
    return {
      statusCode: 410,
      body: {
        success: false,
        code: "TENANT_DELETING",
        message: "This store is scheduled for deletion. Writes are disabled.",
      },
    };
  }
  if (isCancelled) {
    return {
      statusCode: 402,
      body: {
        success: false,
        code: "TENANT_CANCELLED",
        message: "This store's subscription is cancelled. Reactivate to make changes.",
      },
    };
  }
  return null;
}

export function subscriptionGate(req, res, next) {
  const blocked = evaluateSubscriptionBlock(req.tenant, req.method);
  if (blocked) return res.status(blocked.statusCode).json(blocked.body);
  next();
}
