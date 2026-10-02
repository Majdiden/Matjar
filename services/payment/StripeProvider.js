/**
 * Real Stripe payment provider.
 *
 * Implements the abstract `PaymentProvider` interface against the
 * official Stripe SDK. Picked up by `PaymentFactory` with either
 * platform-level or tenant-level config, whichever is present.
 *
 * Config shape: { secretKey, publicKey, webhookSecret, apiVersion? }.
 *   - `secretKey` required; throws at construction otherwise so a
 *     misconfigured factory fails loud rather than silently dropping
 *     charges.
 *   - `webhookSecret` required for signature verification. Omitted →
 *     `verifyWebhookSignature` throws rather than returning a blind
 *     "valid" — fail closed on webhook auth.
 */

import Stripe from "stripe";
import { toStripeAmount, fromStripeAmount } from "../../utils/stripeAmount.js";
import { PaymentProvider } from "./PaymentProvider.js";

const DEFAULT_API_VERSION = "2024-06-20";

export class StripeProvider extends PaymentProvider {
  constructor(config) {
    super(config);
    if (!config?.secretKey) {
      throw new Error("StripeProvider: secretKey is required");
    }
    this.webhookSecret = config.webhookSecret || null;
    this.stripe = new Stripe(config.secretKey, {
      apiVersion: config.apiVersion || DEFAULT_API_VERSION,
    });
  }

  async initializePayment({ amount, currency = "usd", metadata = {}, automaticPaymentMethods = true }) {
    const intent = await this.stripe.paymentIntents.create({
      amount: toStripeAmount(amount, currency),
      currency: String(currency).toLowerCase(),
      metadata,
      ...(automaticPaymentMethods ? { automatic_payment_methods: { enabled: true } } : {}),
    });
    return {
      providerId: intent.id,
      clientSecret: intent.client_secret,
      status: intent.status,
      amount: fromStripeAmount(intent.amount, intent.currency),
      currency: intent.currency,
    };
  }

  // Partial capture/refund amounts arrive in major units; the intent's own
  // currency decides how they scale to Stripe's minor units.
  async #intentCurrency(paymentId) {
    const intent = await this.stripe.paymentIntents.retrieve(paymentId);
    return intent.currency;
  }

  async capturePayment(paymentId, amount = null) {
    const params = amount != null
      ? { amount_to_capture: toStripeAmount(amount, await this.#intentCurrency(paymentId)) }
      : undefined;
    const intent = await this.stripe.paymentIntents.capture(paymentId, params);
    return {
      providerId: intent.id,
      status: intent.status,
      amount: fromStripeAmount(intent.amount, intent.currency),
    };
  }

  async refundPayment(transactionId, amount = null, reason = null) {
    const body = { payment_intent: transactionId };
    if (amount != null) body.amount = toStripeAmount(amount, await this.#intentCurrency(transactionId));
    if (reason) body.reason = reason;
    const refund = await this.stripe.refunds.create(body);
    return {
      providerId: refund.id,
      paymentIntentId: transactionId,
      amount: fromStripeAmount(refund.amount, refund.currency),
      status: refund.status,
    };
  }

  async getPaymentStatus(paymentId) {
    const intent = await this.stripe.paymentIntents.retrieve(paymentId);
    return {
      providerId: intent.id,
      status: intent.status,
      amount: fromStripeAmount(intent.amount, intent.currency),
      currency: intent.currency,
    };
  }

  /**
   * Returns the verified Stripe Event on success, throws on bad
   * signature. We return the event itself rather than a boolean so
   * callers use the authenticated payload instead of re-parsing the
   * raw body, which is the usual footgun with Stripe webhooks.
   */
  verifyWebhookSignature(payload, signature) {
    if (!this.webhookSecret) {
      throw new Error("StripeProvider: webhookSecret not configured");
    }
    return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
  }

  async processWebhook(event) {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        return {
          type: "payment_success",
          eventId: event.id,
          providerId: pi.id,
          amount: fromStripeAmount(pi.amount, pi.currency),
          currency: pi.currency,
          metadata: pi.metadata || {},
        };
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        return {
          type: "payment_failed",
          eventId: event.id,
          providerId: pi.id,
          error: pi.last_payment_error?.message,
          metadata: pi.metadata || {},
        };
      }
      case "charge.refunded": {
        const ch = event.data.object;
        return {
          type: "payment_refunded",
          eventId: event.id,
          providerId: ch.payment_intent,
          amount: fromStripeAmount(ch.amount_refunded, ch.currency),
          metadata: ch.metadata || {},
        };
      }
      default:
        return { type: "unhandled", eventType: event.type, eventId: event.id };
    }
  }
}
