import { asyncHandler } from "../../middlewares/errorHandler.js";
import { PLATFORM_SCOPES } from "../../middlewares/platformAdmin.js";
import { getOverviewSummary, redactRevenue } from "../../services/platform/overview.js";

/**
 * GET /api/platform/overview/summary[?refresh=1] — support.read.
 * The summary is computed and cached once for everyone; the billing figures
 * are stripped per request for operators without billing.read (never cached
 * per user).
 */
export const getSummary = asyncHandler(async (req, res) => {
  const force = req.query.refresh === "1";
  const full = await getOverviewSummary({ force });
  const canReadBilling = req.platformUser.scopes.includes(PLATFORM_SCOPES.BILLING_READ);
  const data = canReadBilling ? full : redactRevenue(full);
  res.set("Cache-Control", "private, no-store");
  res.json({ success: true, data });
});
