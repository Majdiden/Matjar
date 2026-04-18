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

export function subscriptionGate(req, res, next) {
  const tenant = req.tenant;
  if (!tenant) return next();
  if (SAFE_METHODS.has(req.method)) return next();

  const status = tenant.subscriptionStatus;
  const isSuspended = status === "suspended" || !!tenant.suspendedAt;
  const isCancelled = status === "cancelled";
  const isDeleting = !!tenant.deletionScheduledAt || !!tenant.deletedAt;

  if (isSuspended) {
    return res.status(402).json({
      success: false,
      code: "TENANT_SUSPENDED",
      message: "This store is suspended and cannot accept changes. Contact support.",
    });
  }
  if (isDeleting) {
    return res.status(410).json({
      success: false,
      code: "TENANT_DELETING",
      message: "This store is scheduled for deletion. Writes are disabled.",
    });
  }
  if (isCancelled) {
    return res.status(402).json({
      success: false,
      code: "TENANT_CANCELLED",
      message: "This store's subscription is cancelled. Reactivate to make changes.",
    });
  }
  next();
}
