import { Schema, Types } from "mongoose";

const tenantUserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  tenantId: {
    type: Types.ObjectId,
    ref: "Tenant",
  },
});

export default tenantUserSchema;
