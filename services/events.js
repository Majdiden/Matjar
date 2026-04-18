import { EventEmitter } from "events";

class DomainEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  /**
   * Emit a domain event
   * @param {string} eventName - e.g., "order.created", "product.updated", "payment.completed"
   * @param {Object} payload - Event data including tenantId
   */
  emit(eventName, payload) {
    super.emit(eventName, { ...payload, timestamp: new Date().toISOString() });
    super.emit("*", { event: eventName, ...payload, timestamp: new Date().toISOString() }); // wildcard listener
  }
}

export const eventBus = new DomainEventBus();

// Standard domain events
export const EVENTS = {
  ORDER_CREATED: "order.created",
  ORDER_CANCELLED: "order.cancelled",
  ORDER_FULFILLED: "order.fulfilled",
  PAYMENT_COMPLETED: "payment.completed",
  PAYMENT_REFUNDED: "payment.refunded",
  PRODUCT_CREATED: "product.created",
  PRODUCT_UPDATED: "product.updated",
  PRODUCT_DELETED: "product.deleted",
  INVENTORY_LOW: "inventory.low_stock",
  CUSTOMER_REGISTERED: "customer.registered",
  DISCOUNT_REDEEMED: "discount.redeemed",
};

export default eventBus;
