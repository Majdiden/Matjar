/**
 * Abstract Payment Provider Interface
 * All payment providers must implement this interface
 */
export class PaymentProvider {
  constructor(config) {
    if (this.constructor === PaymentProvider) {
      throw new Error("PaymentProvider is abstract and cannot be instantiated");
    }
    this.config = config;
  }

  /**
   * Initialize payment
   * @param {Object} paymentData - Payment information
   * @param {number} paymentData.amount - Amount to charge
   * @param {string} paymentData.currency - Currency code
   * @param {Object} paymentData.metadata - Additional metadata
   * @returns {Promise<Object>} Payment initialization result
   */
  async initializePayment(paymentData) {
    throw new Error("initializePayment() must be implemented");
  }

  /**
   * Capture/complete payment
   * @param {string} paymentId - Payment ID from initialization
   * @param {number} amount - Amount to capture
   * @returns {Promise<Object>} Payment capture result
   */
  async capturePayment(paymentId, amount) {
    throw new Error("capturePayment() must be implemented");
  }

  /**
   * Refund payment
   * @param {string} transactionId - Original transaction ID
   * @param {number} amount - Amount to refund
   * @param {string} reason - Refund reason
   * @returns {Promise<Object>} Refund result
   */
  async refundPayment(transactionId, amount, reason) {
    throw new Error("refundPayment() must be implemented");
  }

  /**
   * Get payment status
   * @param {string} paymentId - Payment ID
   * @returns {Promise<Object>} Payment status
   */
  async getPaymentStatus(paymentId) {
    throw new Error("getPaymentStatus() must be implemented");
  }

  /**
   * Verify webhook signature
   * @param {string} payload - Webhook payload
   * @param {string} signature - Webhook signature
   * @returns {boolean} True if signature is valid
   */
  verifyWebhookSignature(payload, signature) {
    throw new Error("verifyWebhookSignature() must be implemented");
  }

  /**
   * Process webhook event
   * @param {Object} event - Webhook event data
   * @returns {Promise<Object>} Processing result
   */
  async processWebhook(event) {
    throw new Error("processWebhook() must be implemented");
  }
}
