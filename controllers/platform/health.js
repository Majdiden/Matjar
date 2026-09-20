import { asyncHandler } from "../../middlewares/errorHandler.js";
import { getSystemHealth, listIntegrations } from "../../services/platform/health.js";

/** GET /api/platform/system/health[?refresh=1] */
export const systemHealth = asyncHandler(async (req, res) => {
  const data = await getSystemHealth({ force: req.query.refresh === "1" });
  res.json({ success: true, data });
});

/** GET /api/platform/system/integrations */
export const systemIntegrations = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { integrations: listIntegrations(), generatedAt: new Date().toISOString() } });
});
