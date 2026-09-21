import { asyncHandler } from "../../middlewares/errorHandler.js";
import {
  getPlatformAnalytics,
  getCommerceAnalytics,
  getRevenueAnalytics,
  getUsageAnalytics,
} from "../../services/platform/analytics.js";

const noStore = (res) => res.set("Cache-Control", "private, no-store");

/** GET /api/platform/analytics/platform — support.read */
export const platform = asyncHandler(async (req, res) => {
  noStore(res);
  res.json({ success: true, data: await getPlatformAnalytics(req.query) });
});

/** GET /api/platform/analytics/commerce — support.read */
export const commerce = asyncHandler(async (req, res) => {
  noStore(res);
  res.json({ success: true, data: await getCommerceAnalytics(req.query) });
});

/** GET /api/platform/analytics/revenue — billing.read (route-enforced) */
export const revenue = asyncHandler(async (req, res) => {
  noStore(res);
  res.json({ success: true, data: await getRevenueAnalytics(req.query) });
});

/** GET /api/platform/analytics/usage — support.read */
export const usage = asyncHandler(async (req, res) => {
  noStore(res);
  res.json({ success: true, data: await getUsageAnalytics(req.query) });
});
