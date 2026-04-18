import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

const reviewSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  title: { type: String, trim: true },
  comment: { type: String, trim: true },
  isVerifiedPurchase: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: true },
  helpfulCount: { type: Number, default: 0, min: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// One review per user per product per tenant
reviewSchema.index({ tenantId: 1, product: 1, user: 1 }, { unique: true });
reviewSchema.index({ tenantId: 1, product: 1, isApproved: 1, rating: -1 });
reviewSchema.index({ tenantId: 1, user: 1 });

reviewSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

applyTenantScope(reviewSchema);

export default reviewSchema;
