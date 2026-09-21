/**
 * Payment integrations available IN CODE. The platform owner turns these
 * into catalog entries (schemas/platformPaymentMethod.js) with a label,
 * description and logo; merchants then enable a catalog entry for their
 * store and fill in their own details (account numbers, API keys…).
 *
 * Adding a gateway = ship the adapter, then add a row here describing the
 * merchant-side fields it needs. Nothing else in the platform has to change.
 */
export const PAYMENT_INTEGRATIONS = Object.freeze([
  {
    key: "cod",
    type: "cod",
    label: "Cash on delivery",
    description: "Customer pays the courier on delivery. No merchant setup needed.",
    supportsProviders: false,
    merchantFields: [],
  },
  {
    key: "manual-transfer",
    type: "manual",
    label: "Manual transfer (bank / mobile money)",
    description:
      "Customer transfers to the merchant's account with one of the providers you list (Bankak, Fawry…), then uploads the receipt. The merchant fills in account details per provider.",
    supportsProviders: true,
    merchantFields: [],
    defaultCustomerFields: [
      { name: "transactionNumber", label: "Transaction number", type: "text", required: true, placeholder: "e.g. TXN-8827463" },
      { name: "receipt", label: "Payment receipt", type: "file", required: true, accept: "image/*,application/pdf", maxSize: 5 * 1024 * 1024 },
    ],
  },
  // Future gateways declare what a merchant must provide, e.g.
  // { key: "stripe", type: "gateway", label: "Stripe", supportsProviders: false,
  //   merchantFields: [{ name: "publishableKey", label: "Publishable key", type: "text", required: true },
  //                    { name: "secretKey", label: "Secret key", type: "password", secret: true, required: true }] },
]);

export const PAYMENT_INTEGRATION_KEYS = Object.freeze(PAYMENT_INTEGRATIONS.map((i) => i.key));

export function paymentIntegration(key) {
  return PAYMENT_INTEGRATIONS.find((i) => i.key === key) || null;
}

/** Built-in catalog seeded on an empty platform so stores keep working. */
export const DEFAULT_CATALOG_ENTRIES = Object.freeze([
  {
    code: "cod",
    integrationKey: "cod",
    label: "Cash on Delivery",
    labelAr: "الدفع عند الاستلام",
    description: "Pay when your order arrives.",
    descriptionAr: "ادفع عند وصول طلبك.",
    instructions: "",
    instructionsAr: "",
    icon: "cod",
    enabled: true,
    enabledByDefault: true,
    order: 1,
  },
  {
    code: "manual-transfer",
    integrationKey: "manual-transfer",
    label: "Manual Transfer",
    labelAr: "تحويل يدوي",
    description: "Pay by bank or mobile-money transfer. You'll get the merchant's account details at checkout.",
    descriptionAr: "ادفع عبر تحويل بنكي أو محفظة إلكترونية. ستظهر لك تفاصيل حساب التاجر عند إتمام الطلب.",
    instructions: "Transfer the exact order total to the account shown, then upload the receipt and enter your transaction number.",
    instructionsAr: "حوّل إجمالي الطلب بالضبط إلى الحساب الظاهر، ثم ارفع الإيصال وأدخل رقم العملية.",
    icon: "bank",
    enabled: true,
    enabledByDefault: false,
    order: 2,
    providers: [
      { code: "bankak", label: "Bankak", logo: "bankak" },
      { code: "fawry", label: "Fawry", logo: "fawry" },
      { code: "ocash", label: "OCash", logo: "ocash" },
      { code: "bravo", label: "Bravo", logo: "bravo" },
      { code: "cashi", label: "Cashi", logo: "cashi" },
    ],
  },
]);
