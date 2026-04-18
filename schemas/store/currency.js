import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

const currencySchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  currencyCode: { type: String, required: true, uppercase: true, trim: true },
  exchangeRate: { type: Number, required: true, min: 0 },
  symbol: { type: String, trim: true },
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

currencySchema.index({ tenantId: 1, currencyCode: 1 }, { unique: true });
currencySchema.index({ tenantId: 1, isDefault: 1 });

currencySchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

applyTenantScope(currencySchema);

export default currencySchema;
