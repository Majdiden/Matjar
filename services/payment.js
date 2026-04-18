import Stripe from "stripe";
import config from "../config/index.js";

let stripe;

if (config.stripeSecretKey) {
  stripe = new Stripe(config.stripeSecretKey, {
    apiVersion: "2024-06-20",
  });
}

/**
 * Check if Stripe is configured
 */
const ensureStripe = () => {
  if (!stripe) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY in environment.");
  }
};

/**
 * Create a payment intent for an order
 */
export const createPaymentIntent = async (order, tenantId) => {
  ensureStripe();

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(order.totalAmount * 100), // Stripe uses cents
    currency: order.currency || "usd",
    metadata: {
      orderId: order._id.toString(),
      tenantId: tenantId.toString(),
      orderNumber: order.orderNumber,
    },
    automatic_payment_methods: { enabled: true },
  });

  return {
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  };
};

/**
 * Confirm payment was received (webhook handler)
 */
export const handlePaymentWebhook = async (rawBody, signature) => {
  ensureStripe();

  const webhookSecret = config.stripeWebhookSecret;
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }

  const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

  switch (event.type) {
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object;
      return {
        type: "payment_success",
        eventId: event.id,
        orderId: paymentIntent.metadata.orderId,
        tenantId: paymentIntent.metadata.tenantId,
        amount: paymentIntent.amount / 100,
        paymentIntentId: paymentIntent.id,
      };
    }
    case "payment_intent.amount_capturable_updated": {
      // Manual-capture flow: the PI has authorized funds but not yet
      // captured them. Surface this as a distinct "authorized" event so the
      // order timeline shows auth → capture as two steps.
      const paymentIntent = event.data.object;
      return {
        type: "payment_authorized",
        eventId: event.id,
        orderId: paymentIntent.metadata.orderId,
        tenantId: paymentIntent.metadata.tenantId,
        amount: (paymentIntent.amount_capturable || paymentIntent.amount) / 100,
        paymentIntentId: paymentIntent.id,
      };
    }
    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object;
      return {
        type: "payment_failed",
        eventId: event.id,
        orderId: paymentIntent.metadata.orderId,
        tenantId: paymentIntent.metadata.tenantId,
        error: paymentIntent.last_payment_error?.message,
      };
    }
    default:
      return { type: "unhandled", eventType: event.type };
  }
};

/**
 * Create a refund
 */
export const createRefund = async (paymentIntentId, amount = null) => {
  ensureStripe();

  const refundData = { payment_intent: paymentIntentId };
  if (amount) {
    refundData.amount = Math.round(amount * 100);
  }

  const refund = await stripe.refunds.create(refundData);
  return {
    refundId: refund.id,
    amount: refund.amount / 100,
    status: refund.status,
  };
};

/**
 * Check if Stripe is available (for feature flags)
 */
export const isStripeConfigured = () => !!stripe;
