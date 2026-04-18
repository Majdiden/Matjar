import { StripeProvider } from "./StripeProvider.js";
import { APIError } from "../../middlewares/errorHandler.js";

/**
 * Payment Factory
 * Creates payment provider instances based on configuration
 */
export class PaymentFactory {
  static providers = {
    stripe: StripeProvider,
  };

  /**
   * Get payment provider instance
   * @param {string} providerName - Provider name (stripe)
   * @param {Object} config - Provider configuration
   * @returns {PaymentProvider} Payment provider instance
   */
  static getProvider(providerName, config = {}) {
    const ProviderClass = this.providers[providerName.toLowerCase()];

    if (!ProviderClass) {
      throw new APIError(
        `Unsupported payment provider: ${providerName}. Supported providers: ${Object.keys(
          this.providers
        ).join(", ")}`,
        400
      );
    }

    return new ProviderClass(config);
  }

  /**
   * Register custom payment provider
   * @param {string} name - Provider name
   * @param {Class} ProviderClass - Provider class
   */
  static registerProvider(name, ProviderClass) {
    this.providers[name.toLowerCase()] = ProviderClass;
  }

  /**
   * Get list of available providers
   * @returns {string[]} List of provider names
   */
  static getAvailableProviders() {
    return Object.keys(this.providers);
  }
}
