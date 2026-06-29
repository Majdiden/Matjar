import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

const orderSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  orderNumber: { type: String, sparse: true },
  // Server-issued idempotency key bound to the checkout session. Prevents
  // double-click, network retry, and page-reload from creating duplicate
  // orders. Unique per tenant so collisions across tenants are harmless.
  idempotencyKey: { type: String, sparse: true },
  // Version of the calculation engine that produced this order's pricing.
  // Persisted so we can detect and audit orders priced under a previous
  // algorithm if the engine changes. Bump CALCULATION_VERSION in
  // services/checkout.js whenever the pricing logic changes.
  calculationVersion: { type: Number },
  user: { type: Schema.Types.ObjectId, ref: "User", required: false },

  guestCustomer: {
    email: { type: String },
    firstName: { type: String },
    lastName: { type: String },
    phone: { type: String },
  },

  // Language the order was placed in — the store's language at creation for
  // a guest, or the customer's account language for a registered user. Used
  // to localize this order's customer emails regardless of any later
  // store-language change.
  language: { type: String, default: "en" },

  // Immutable snapshot of the customer's contact details at order time.
  // Populated at CREATION from the authenticated user or guestCustomer and
  // never updated afterwards — so receipts, CS lookups, and CSV exports
  // always render the identity the customer actually checked out with,
  // even if the underlying User profile is later edited or deleted.
  customerSnapshot: {
    email: { type: String },
    firstName: { type: String },
    lastName: { type: String },
    phone: { type: String },
  },

  products: [
    {
      product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
      name: String, // Snapshot of product name at time of order
      sku: String,
      // Thumbnail URL at order time so the dashboard line item always
      // renders even if the product's images are edited/removed later.
      image: { type: String },
      quantity: { type: Number, required: true, min: 1 },
      price: { type: Number, required: true, min: 0 },
      // Per-line allocations captured at order time so receipts, refunds
      // and reporting don't drift when merchants change rules later.
      discountAllocation: { type: Number, default: 0, min: 0 },
      taxAllocation: { type: Number, default: 0, min: 0 },
      // Running tallies advanced by the returns lifecycle. `returnedQuantity`
      // bumps when a return hits "Received" (units physically back);
      // `refundedQuantity` bumps when the return hits "Refunded" (money
      // moved). Kept separate because a merchant can receive goods without
      // refunding yet, or refund without receiving (e.g. customer keeps).
      refundedQuantity: { type: Number, default: 0, min: 0 },
      returnedQuantity: { type: Number, default: 0, min: 0 },
      // Variant snapshot — captured at order time so the line stays
      // readable even if the variant is later edited or removed.
      variantId: { type: Schema.Types.ObjectId },
      variantOptions: [
        {
          name: { type: String, required: true },
          value: { type: String, required: true },
          _id: false,
        },
      ],
      // Pre-order line snapshot. When `isPreorder` is true the line was
      // accepted against pre-order capacity rather than on-hand stock,
      // and `preorderExpectedShipDate` records the date promised to the
      // customer at order time.
      isPreorder: { type: Boolean, default: false },
      preorderExpectedShipDate: { type: Date },
      // Running tally of how many units of this line have been allocated
      // to a non-cancelled fulfillment. Drives the "what's left to ship"
      // calculation and prevents over-fulfillment. Server-managed.
      fulfilledQuantity: { type: Number, default: 0, min: 0 },
    },
  ],

  // ── Fulfillments ──────────────────────────────────────────────
  // A real first-class shipment record (rather than a view derived from
  // order.status). Each fulfillment represents one physical shipment and
  // can cover any subset of the order's line items, allowing partial /
  // split fulfillment without losing detail.
  //
  // The order-level `status` is auto-derived from the fulfillments after
  // each transition (see `recomputeOrderStatusFromFulfillments` in the
  // service layer), but admins can still override it manually.
  fulfillments: [
    {
      // Sub-id auto-generated; used as the stable identifier in the API.
      status: {
        type: String,
        enum: ["Pending", "Shipped", "Delivered", "Cancelled"],
        default: "Pending",
      },
      // Lines covered by this shipment. `orderLineId` references one of
      // `order.products[]._id`. We snapshot quantity per line so a single
      // line can be split across two fulfillments (e.g. backordered split).
      items: [
        {
          orderLineId: { type: Schema.Types.ObjectId, required: true },
          quantity: { type: Number, required: true, min: 1 },
          _id: false,
        },
      ],
      trackingNumber: { type: String, trim: true },
      trackingCarrier: { type: String, trim: true },
      // Optional shipping cost allocated to this fulfillment, for
      // reporting on partial shipments.
      shippingCost: { type: Number, min: 0 },
      notes: { type: String },
      // Timestamps for each terminal state — only the relevant one(s) are
      // populated. Lets the storefront timeline render an accurate per-
      // shipment history without scanning the audit trail.
      shippedAt: { type: Date },
      deliveredAt: { type: Date },
      cancelledAt: { type: Date },
      // Append-only history scoped to this fulfillment. Mirrors the
      // shape of order.history so the same renderer can use both.
      history: [
        {
          event: { type: String, required: true },
          status: { type: String },
          previousStatus: { type: String },
          note: { type: String },
          by: { type: Schema.Types.ObjectId, ref: "User" },
          byName: { type: String },
          at: { type: Date, default: Date.now },
        },
      ],
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    },
  ],
  totalAmount: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    enum: [
      "Pending",
      "Confirmed",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
      "Refunded",
      "Archived",
    ],
    default: "Pending",
  },
  // Order-level fulfillment status, derived from `fulfillments[]` by
  // `recomputeOrderFulfillmentStatus`. Stored so the order list view can
  // filter and sort by it without loading every shipment. Separate from
  // `status` so payment/fulfillment/operational lifecycles don't collide.
  fulfillmentStatus: {
    type: String,
    enum: [
      "Unfulfilled",
      "Partially Fulfilled",
      "Fulfilled",
      "Returned",
      "Cancelled",
    ],
    default: "Unfulfilled",
  },
  shippingAddress: {
    firstName: String,
    lastName: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
    phone: String,
    // Free-text "leave at door", "call on arrival", gate code, etc.
    // Rendered on the shipping address card and the packing slip.
    deliveryInstructions: String,
  },
  billingAddress: {
    firstName: String,
    lastName: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
    phone: String,
    deliveryInstructions: String,
  },
  shippingMethod: {
    id: String,
    name: String,
    price: { type: Number, default: 0 },
  },
  paymentMethod: { type: String, required: true },
  // Dynamic payment-method selection. `paymentMethodCode` references the
  // tenant-configured PaymentMethod.code (see schemas/store/paymentMethod.js)
  // and `paymentDetails` stores whatever customer-provided fields that
  // method declared (e.g. bank transfer receipt, transaction ID). The legacy
  // `paymentMethod` string above is kept populated alongside these so older
  // reports/queries keep working.
  paymentMethodCode: { type: String, sparse: true },
  paymentDetails: { type: Schema.Types.Mixed, default: {} },
  paymentStatus: {
    type: String,
    enum: [
      "Not Paid",
      "Authorized",
      "Paid",
      "Partially Refunded",
      "Refunded",
      "Voided",
      "Failed",
    ],
    default: "Not Paid",
  },
  // Cumulative refunded amount. Authoritative source for the refund cap
  // — the refund controller atomically bumps this with a guard that
  // prevents two admins from over-refunding the same order. Legacy orders
  // without this field are lazily backfilled from the Payment collection
  // on their first refund attempt.
  refundedAmount: { type: Number, default: 0, min: 0 },
  subtotal: { type: Number, min: 0 },
  shippingCost: { type: Number, default: 0, min: 0 },
  tax: { type: Number, default: 0, min: 0 },
  // Per-jurisdiction / per-class breakdown captured at order time so the
  // receipt and downstream accounting integrations can render line items
  // even after the merchant changes their tax rules.
  taxBreakdown: [
    {
      name: String,
      rate: Number,
      amount: Number,
      productClass: String,
      _id: false,
    },
  ],
  taxIncluded: { type: Boolean, default: false },
  // Presentment currency snapshot — what the customer SAW at checkout time.
  // The order is still recorded and accounted in the store's base currency
  // (subtotal/tax/totalAmount fields above). `presentmentCurrency` and the
  // `presentment*` mirrors are populated when the buyer's market currency
  // differs from the base; they exist so the receipt and CS dashboard can
  // show "you paid €92.00" even after FX rates drift.
  baseCurrency: { type: String },
  presentmentCurrency: { type: String },
  presentmentSubtotal: { type: Number, min: 0 },
  presentmentTotal: { type: Number, min: 0 },
  presentmentTax: { type: Number, min: 0 },
  presentmentShipping: { type: Number, min: 0 },
  fxRate: { type: Number, min: 0 },
  marketCode: { type: String },
  discount: { type: Number, default: 0, min: 0 },
  discountCode: { type: String, sparse: true },
  // Multi-code support. `discountCode` (singular) is preserved as the
  // legacy shorthand — first applied code wins — so any reporting query
  // that joins on it keeps working. New code paths read `discountCodes`
  // and `discountBreakdown` for the full picture.
  discountCodes: { type: [String], default: [], index: true },
  discountBreakdown: [
    {
      code: { type: String, required: true },
      kind: { type: String, enum: ["product", "order", "shipping"], required: true },
      amount: { type: Number, required: true, min: 0 },
      _id: false,
    },
  ],
  shippingDiscount: { type: Number, default: 0, min: 0 },
  // Gift-card redemption applied at checkout. The full code is never
  // persisted — only the last-4 for customer support lookups. `amount`
  // has already been subtracted from `totalAmount` at order creation.
  giftCardRedemption: {
    code: { type: String },
    codeLast4: { type: String },
    amount: { type: Number, min: 0 },
    redeemedAt: { type: Date },
  },
  notes: { type: String },
  // Internal staff notes — never returned to customers, tenant-scoped.
  internalNotes: [
    {
      body: { type: String, required: true, trim: true, maxlength: 2000 },
      createdBy: { type: Schema.Types.ObjectId, ref: "User" },
      createdByName: { type: String },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
      deletedAt: { type: Date },
      pinned: { type: Boolean, default: false },
    },
  ],
  // Merchant-defined workflow labels (VIP, Urgent, Fraud Review, etc.).
  // Plain strings for now; upgrade to structured tags later.
  tags: { type: [String], default: [], index: true },
  trackingNumber: { type: String },
  trackingCarrier: { type: String },

  // ── Returns (RMA) ──────────────────────────────────────────────
  // Each return is a merchant- or customer-initiated request to send
  // items back. Lifecycle: Requested → Approved/Rejected → Received
  // → Refunded. Refund amount is captured on the record so the receipt
  // can be reconciled even if the refund was issued through a separate
  // provider (Stripe, COD cash, store credit).
  returns: [
    {
      status: {
        type: String,
        enum: ["Requested", "Approved", "Rejected", "Received", "Refunded"],
        default: "Requested",
      },
      items: [
        {
          orderLineId: { type: Schema.Types.ObjectId, required: true },
          quantity: { type: Number, required: true, min: 1 },
          reason: { type: String },
          _id: false,
        },
      ],
      reason: { type: String },
      refundAmount: { type: Number, min: 0 },
      notes: { type: String },
      createdBy: { type: Schema.Types.ObjectId, ref: "User" },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
      history: [
        {
          event: { type: String, required: true },
          status: { type: String },
          previousStatus: { type: String },
          note: { type: String },
          by: { type: Schema.Types.ObjectId, ref: "User" },
          byName: { type: String },
          at: { type: Date, default: Date.now },
        },
      ],
    },
  ],

  // ── Replacement orders ──────────────────────────────────────────
  // When a return or damaged-shipment case is resolved by re-shipping the
  // same items rather than refunding, a replacement order is created at
  // $0 and linked both ways so support staff can trace the full case.
  replacementOf: { type: Schema.Types.ObjectId, ref: "Order" },
  replacementOrders: [{ type: Schema.Types.ObjectId, ref: "Order" }],

  // Audit trail of every meaningful event on this order. Rendered as the
  // timeline in the dashboard order details page. Append-only.
  history: [
    {
      event: { type: String, required: true }, // e.g. "created", "status_changed", "tracking_updated", "cancelled", "note_added"
      status: { type: String }, // for status_changed events
      previousStatus: { type: String },
      note: { type: String },
      by: { type: Schema.Types.ObjectId, ref: "User" },
      byName: { type: String },
      at: { type: Date, default: Date.now },
    },
  ],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Optimistic concurrency — on every `order.save()`, Mongoose verifies the
// document's __v (versionKey, defaults to `__v`) against the DB's current
// value and throws a VersionError if another writer has committed since we
// loaded the doc. The service layer wraps the affected mutations in a
// retry helper (`withVersionRetry`) so concurrent fulfillment / payment /
// return / status writes on the same order collapse safely instead of
// racing. versionKey is left at its default so existing legacy orders
// pick this up on their next save.
orderSchema.set("optimisticConcurrency", true);

orderSchema.index({ tenantId: 1, orderNumber: 1 }, { unique: true, sparse: true });
// Partial index: only enforce uniqueness when idempotencyKey is actually set.
// `sparse: true` doesn't work here because Mongoose sets the field to null
// (rather than omitting it) on orders created without an idempotency key,
// and MongoDB's sparse index includes null values.
orderSchema.index(
  { tenantId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);
orderSchema.index({ tenantId: 1, user: 1, createdAt: -1 });
orderSchema.index({ tenantId: 1, status: 1 });
orderSchema.index({ tenantId: 1, createdAt: -1 });
orderSchema.index({ tenantId: 1, paymentStatus: 1 });
orderSchema.index({ tenantId: 1, fulfillmentStatus: 1 });
orderSchema.index({ tenantId: 1, user: 1, discountCode: 1 });
orderSchema.index({ tenantId: 1, tags: 1 });

orderSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

applyTenantScope(orderSchema);

export default orderSchema;
