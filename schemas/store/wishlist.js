import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

const wishlistSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  products: [{ type: Schema.Types.ObjectId, ref: "Product" }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// One wishlist per user per tenant
wishlistSchema.index({ tenantId: 1, user: 1 }, { unique: true });

wishlistSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

applyTenantScope(wishlistSchema);

export default wishlistSchema;
