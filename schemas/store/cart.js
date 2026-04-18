import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

const cartSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  user: { type: Schema.Types.ObjectId, ref: "User", required: false },
  sessionId: { type: String, required: false },
  items: [
    {
      product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
      quantity: { type: Number, required: true, min: 1 },
      // Variant identifier (Mongoose subdocument _id from product.variants).
      // Stored as String for forwards-compat with potential non-ObjectId
      // identifiers and for cleaner client serialisation.
      variantId: { type: String, required: false },
      // Snapshot of the variant's option summary, e.g. "Color: Red / Size: M"
      variantName: { type: String },
      // Snapshot of the variant's option pairs for richer rendering
      variantOptions: [
        {
          name: { type: String, required: true },
          value: { type: String, required: true },
          _id: false,
        },
      ],
      // Snapshot of the variant SKU at time of add-to-cart
      variantSku: { type: String },
      unitPrice: { type: Number, min: 0 },
      lineTotal: { type: Number, min: 0 },
      // Pre-order line marker. Set when the line was added against
      // pre-order capacity instead of on-hand stock.
      isPreorder: { type: Boolean, default: false },
      preorderExpectedShipDate: { type: Date },
    },
  ],
  total: { type: Number, default: 0, min: 0 },
  subtotal: { type: Number, default: 0, min: 0 },
  itemCount: { type: Number, default: 0, min: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  // Auto-expire abandoned carts after 30 days
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
});

cartSchema.index({ tenantId: 1, user: 1 });
cartSchema.index({ tenantId: 1, sessionId: 1 });
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

cartSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

applyTenantScope(cartSchema);

export default cartSchema;
