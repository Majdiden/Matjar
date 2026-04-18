/**
 * Resolve the right payment provider for a tenant.
 *
 * Resolution order:
 *   1. Tenant-level config (tenant.paymentProviders[provider]) if
 *      `enabled: true` and keys are present. Lets a merchant bring
 *      their own Stripe account.
 *   2. Platform-level config from env (STRIPE_SECRET_KEY etc.). The
 *      platform takes a cut via Stripe Connect / destination charges
 *      configured out-of-band.
 *   3. `null` → caller should surface "payments not configured".
 *
 * Webhook secrets follow the same precedence so an incoming webhook
 * is verified against the key that minted the intent.
 */

import { PaymentFactory } from "../payment/PaymentFactory.js";
import config from "../../config/index.js";

export function resolvePaymentProvider(tenant, providerName = "stripe") {
  const tenantCfg = tenant?.paymentProviders?.[providerName];
  if (tenantCfg?.enabled && (tenantCfg.secretKey || tenantCfg.clientSecret)) {
    return PaymentFactory.getProvider(providerName, {
      secretKey: tenantCfg.secretKey,
      publicKey: tenantCfg.publicKey,
      clientId: tenantCfg.clientId,
      clientSecret: tenantCfg.clientSecret,
      webhookSecret: tenantCfg.webhookSecret || config.stripeWebhookSecret,
    });
  }

  if (providerName === "stripe" && config.stripeSecretKey) {
    return PaymentFactory.getProvider("stripe", {
      secretKey: config.stripeSecretKey,
      webhookSecret: config.stripeWebhookSecret,
    });
  }

  return null;
}
