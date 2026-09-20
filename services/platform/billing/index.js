/**
 * Billing service surface + domain-event listeners.
 *
 * `registerBillingListeners()` must run once in the API process (where
 * order events are emitted). It is invoked from routes/platform/billing.js
 * at module load, which every API boot imports; the guard makes repeated
 * calls harmless.
 */
import { eventBus, EVENTS } from "../../events.js";
import logger from "../../../utils/logger.js";
import { recognizeDelivered, reverseForRefund } from "./ledger.js";

let registered = false;

export function registerBillingListeners() {
  if (registered) return;
  registered = true;
  eventBus.on(EVENTS.ORDER_DELIVERED, (payload) => {
    recognizeDelivered(payload).catch((err) =>
      logger.error("billing: recognizeDelivered failed", { tenantId: payload?.tenantId, orderId: payload?.orderId, error: err?.message })
    );
  });
  eventBus.on(EVENTS.ORDER_REFUNDED, (payload) => {
    reverseForRefund(payload).catch((err) =>
      logger.error("billing: reverseForRefund failed", { tenantId: payload?.tenantId, orderId: payload?.orderId, error: err?.message })
    );
  });
}

export * from "./calculator.js";
export * from "./resolver.js";
export * from "./ledger.js";
export * from "./statements.js";
export * from "./planChanges.js";
export * from "./settings.js";
export * from "./fx.js";
export * from "./signupPlan.js";
export { periodKeyFor, periodBounds, previousPeriodKey } from "./money.js";
