/**
 * Provider webhook router.
 *
 * Single entry point the platform webhook endpoint calls:
 *   routeProviderWebhook({ provider, rawBody, headers, tenant })
 *
 * - Resolves the right provider instance (tenant-level config with
 *   platform fallback, see providers/paymentResolver.js).
 * - Verifies the signature (throws on mismatch — fail closed).
 * - Normalizes the event to { type, eventId, providerId, amount?, metadata? }.
 * - Returns the normalized event. Caller is responsible for the
 *   idempotency check (AuditLog / Payment.findOne({ eventId })) and
 *   the state-machine transition.
 *
 * We deliberately do NOT touch the database here — the router is
 * pure normalization. Side-effects happen in the controller so the
 * existing idempotency + audit wiring keeps working unchanged.
 */

import { resolvePaymentProvider } from "./paymentResolver.js";

const STRIPE_SIGNATURE_HEADER = "stripe-signature";

export function routeProviderWebhook({ provider, rawBody, headers, tenant }) {
  const normalizedProvider = String(provider || "").toLowerCase();

  if (normalizedProvider === "stripe") {
    const instance = resolvePaymentProvider(tenant, "stripe");
    if (!instance) throw new Error("Stripe is not configured for this tenant or platform");
    const signature = headers[STRIPE_SIGNATURE_HEADER] || headers[STRIPE_SIGNATURE_HEADER.toLowerCase()];
    if (!signature) throw new Error("Missing stripe-signature header");
    const event = instance.verifyWebhookSignature(rawBody, signature);
    return instance.processWebhook(event);
  }

  throw new Error(`Unsupported webhook provider: ${provider}`);
}
