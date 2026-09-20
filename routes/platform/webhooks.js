import { Router } from "express";
// Cross-tenant webhook delivery inspector. Reads: support.read; retry:
// queue.retry. Mounted at /api/platform/webhooks behind platformAuthenticate.
import { requireScope, validateObjectId, PLATFORM_SCOPES } from "../../middlewares/platformAdmin.js";
import {
  listWebhookDeliveries,
  listWebhookEvents,
  getWebhookDelivery,
  retryWebhookDelivery,
} from "../../controllers/platform/webhooks.js";

const router = Router({ mergeParams: true });

router.get("/deliveries", requireScope(PLATFORM_SCOPES.SUPPORT_READ), listWebhookDeliveries);
router.get("/events", requireScope(PLATFORM_SCOPES.SUPPORT_READ), listWebhookEvents);
router.get(
  "/deliveries/:tenantId/:id",
  validateObjectId("tenantId", "id"),
  requireScope(PLATFORM_SCOPES.SUPPORT_READ),
  getWebhookDelivery
);
router.post(
  "/deliveries/:tenantId/:id/retry",
  validateObjectId("tenantId", "id"),
  requireScope(PLATFORM_SCOPES.QUEUE_RETRY),
  retryWebhookDelivery
);

export default router;
