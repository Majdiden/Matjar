import { mongoose, Schema } from "mongoose";
const promotionSchema = new Schema({
  name: { type: String, required: true },
  description: String,
  discountType: { type: String, enum: ["percentage", "fixed"], required: true },
  discountValue: { type: Number, required: true },
  applicableProducts: [
    { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  ],
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
export default promotionSchema;
