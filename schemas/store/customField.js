import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

const customFieldSchema = new Schema({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },

  // Which resource this field belongs to
  resource: { type: String, required: true, enum: ["Product", "Order", "User", "Category", "Company", "Page"] },
  resourceId: { type: Schema.Types.ObjectId, required: true },

  // Field definition
  namespace: { type: String, required: true, trim: true }, // e.g., "custom", "app.shipping"
  key: { type: String, required: true, trim: true },

  // Typed value
  type: { type: String, required: true, enum: ["string", "number", "boolean", "date", "json", "url", "color", "richtext"] },
  value: Schema.Types.Mixed,

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Unique per resource instance + namespace + key
customFieldSchema.index({ tenantId: 1, resource: 1, resourceId: 1, namespace: 1, key: 1 }, { unique: true });
customFieldSchema.index({ tenantId: 1, resource: 1, namespace: 1, key: 1 });

customFieldSchema.pre("save", function(next) { this.updatedAt = Date.now(); next(); });

applyTenantScope(customFieldSchema);
export default customFieldSchema;
