import mongoose from "mongoose";
import { eventBus } from "./events.js";
import { dispatchEvent } from "./webhook.js";
import { createScopedModels } from "../utils/scopedModel.js";
import logger from "../utils/logger.js";

/**
 * Bridge: domain events → registered tenant webhooks.
 *
 * Deliveries are fire-and-forget from the emitter's perspective — errors
 * are logged but don't bubble back into the business flow that emitted
 * the event.
 */
export function startWebhookDispatcher() {
  eventBus.on("*", async (payload) => {
    const { event, tenantId, ...rest } = payload || {};
    if (!event || !tenantId) return;
    try {
      const models = createScopedModels(mongoose.connection, tenantId);
      if (!models.Webhook) return;
      await dispatchEvent(models, event, rest);
    } catch (error) {
      logger.error("Webhook dispatch error", { error: error.message, event });
    }
  });
}
