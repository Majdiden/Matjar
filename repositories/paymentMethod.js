/**
 * PaymentMethod repository (tenant DB). Receives tenant-scoped `models`, so
 * tenantId is injected by the scoped model layer.
 */

/**
 * The store's enabled payment methods that the platform still offers — the
 * same base filter as GET /storefront/payment-methods. No secrets: `config`
 * is `select: false` on the schema.
 */
export const listEnabledPaymentMethodsRepo = async (models) =>
  models.PaymentMethod.find({ enabled: true, platformEnabled: { $ne: false } })
    .select("code type label providers order")
    .sort({ order: 1, createdAt: 1 })
    .lean();
