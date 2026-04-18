import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

const refreshTokenSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  token: {
    type: String,
    required: true,
    unique: true,
  },
  family: {
    type: String,
    required: true,
    index: true,
  },
  isRevoked: {
    type: Boolean,
    default: false,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

refreshTokenSchema.index({ tenantId: 1, family: 1 });
refreshTokenSchema.index({ tenantId: 1, user: 1 });

applyTenantScope(refreshTokenSchema);

export default refreshTokenSchema;
