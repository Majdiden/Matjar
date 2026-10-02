import Stripe from "stripe";
import config from "../config/index.js";
import { toStripeAmount, fromStripeAmount } from "../utils/stripeAmount.js";

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
 * Create a payment intent for an order.
 *
 * `order.totalAmount` is in the store's base currency, so the intent must be
 * created in that same currency. The order only carries `baseCurrency` when
 * checkout resolved a market, so callers pass the tenant's base currency as
 * the fallback.
 */
export const buildPaymentIntentParams = (order, tenantId, storeCurrency) => {
  const currency = order.baseCurrency || storeCurrency;
  if (!currency) {
    throw new Error("Cannot create payment intent: store currency is unknown");
  }
  return {
    amount: toStripeAmount(order.totalAmount, currency),
    currency: currency.toLowerCase(),
    metadata: {
      orderId: order._id.toString(),
      tenantId: tenantId.toString(),
      orderNumber: order.orderNumber,
    },
    automatic_payment_methods: { enabled: true },
  };
};

export const createPaymentIntent = async (order, tenantId, storeCurrency) => {
  ensureStripe();

  const paymentIntent = await stripe.paymentIntents.create(
    buildPaymentIntentParams(order, tenantId, storeCurrency)
  );

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
        amount: fromStripeAmount(paymentIntent.amount, paymentIntent.currency),
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
        amount: fromStripeAmount(
          paymentIntent.amount_capturable || paymentIntent.amount,
          paymentIntent.currency
        ),
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
    // Read the currency off the intent itself rather than the order, so
    // intents created before the currency fix are refunded in the
    // currency they were actually charged in.
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    refundData.amount = toStripeAmount(amount, intent.currency);
  }

  const refund = await stripe.refunds.create(refundData);
  return {
    refundId: refund.id,
    amount: fromStripeAmount(refund.amount, refund.currency),
    status: refund.status,
  };
};

/**
 * Check if Stripe is available (for feature flags)
 */
export const isStripeConfigured = () => !!stripe;
