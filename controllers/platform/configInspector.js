import { asyncHandler } from "../../middlewares/errorHandler.js";
import { inspectTenantConfig } from "../../services/platform/configInspector.js";

/** GET /api/platform/tenants/:tenantId/config — read-only, support.read. */
export const inspect = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await inspectTenantConfig(req.params.tenantId) });
});
