import { Schema } from "mongoose";
import { applyTenantScope } from "../utils/tenantScope.js";

const discountSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  code: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ["percentage", "fixed"],
    required: true,
  },
  value: { type: Number, required: true, min: 0 },
  // Shopify-style discount method. Drives which fields the form asks for
  // and which validation/application branch runs at checkout.
  //   - amount_off_products: percentage/fixed off selected products/categories
  //   - amount_off_order:    percentage/fixed off the order subtotal
  //   - buy_x_get_y:         BXGY — buy N of X and get M of Y at a discount
  //   - free_shipping:       waives (or reduces) the shipping cost
  // `kind` below is auto-derived from this in a pre-save hook for back-compat
  // with stacking-rule logic that predates `method`.
  method: {
    type: String,
    enum: [
      "amount_off_products",
      "amount_off_order",
      "buy_x_get_y",
      "free_shipping",
    ],
    default: "amount_off_order",
  },
  // BXGY sub-document — only meaningful when method === "buy_x_get_y".
  // Customer must have buyQuantity of an item matching buyProducts /
  // buyCategories in their cart; they then get getQuantity of an item
  // matching getProducts / getCategories at the specified discount.
  // The same cart can trigger the rule multiple times up to
  // Math.floor(buyCartQty / buyQuantity) applications.
  bxgy: {
    buyProducts: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    buyCategories: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    buyQuantity: { type: Number, min: 1, default: 1 },
    getProducts: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    getCategories: [{ type: Schema.Types.ObjectId, ref: "Category" }],
    getQuantity: { type: Number, min: 1, default: 1 },
    // How the "get" items are discounted:
    //   - percentage: off the item price (100 = free)
    //   - fixed:      flat amount off the item price
    getDiscountType: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage",
    },
    getDiscountValue: { type: Number, min: 0, default: 100 },
    // Upper bound on how many times the rule can apply per cart — null = no cap.
    maxUsesPerOrder: { type: Number, default: null },
  },
  // What this discount targets. Drives stackability and where the
  // reduction is applied at checkout time.
  //   - product:  reduces individual line items (scoped via
  //               applicableProducts/applicableCategories)
  //   - order:    reduces the order subtotal as a whole
  //   - shipping: reduces the shipping cost (set value=100 + percentage
  //               for free shipping)
  // Auto-derived from `method` in pre-save so the stacking rules keep
  // working without duplicating logic in the client.
  kind: {
    type: String,
    enum: ["product", "order", "shipping"],
    default: "order",
  },
  // Stackability rules. By default a discount stacks with NOTHING — each
  // flag opts in to combining with discounts of that kind. Two discounts
  // can stack only if BOTH agree (mutual consent), so a merchant can
  // create a "20% off" order discount that combines with shipping but
  // refuse to combine with another order discount, even if the other
  // order discount opts in to combining.
  combinesWith: {
    product: { type: Boolean, default: false },
    order: { type: Boolean, default: false },
    shipping: { type: Boolean, default: false },
  },
  minOrderAmount: { type: Number, default: 0, min: 0 },
  usageLimit: { type: Number, default: null },
  usedCount: { type: Number, default: 0, min: 0 },
  perUserLimit: { type: Number, default: null },
  applicableProducts: [{ type: Schema.Types.ObjectId, ref: "Product" }],
  applicableCategories: [{ type: Schema.Types.ObjectId, ref: "Category" }],
  expiresAt: { type: Date, default: null },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Code unique per tenant, not globally
discountSchema.index({ tenantId: 1, code: 1 }, { unique: true });
discountSchema.index({ tenantId: 1, isActive: 1, expiresAt: 1 });

// Derive `kind` from `method` so stacking rules (which key off kind) keep
// working without callers having to set both fields in sync.
const METHOD_TO_KIND = {
  amount_off_products: "product",
  amount_off_order: "order",
  buy_x_get_y: "product",
  free_shipping: "shipping",
};

discountSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  // Derive `kind` from `method` unless the caller explicitly set `kind`
  // for this save. The service layer signals an explicit `kind` by
  // attaching a transient `$kindExplicit` flag. This preserves the
  // dashboard flow (sends `method`, expects `kind` to follow) while
  // letting direct callers (tests, seeders, legacy clients) pass
  // `kind` without having to supply a matching `method`.
  const kindExplicit = this.$locals?.kindExplicit === true;
  if (!kindExplicit && this.method && METHOD_TO_KIND[this.method]) {
    this.kind = METHOD_TO_KIND[this.method];
  }
  next();
});

applyTenantScope(discountSchema);

export default discountSchema;
