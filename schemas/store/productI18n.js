import { mongoose, Schema } from "mongoose";

const productI18nSchema = new Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  language: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
});
export default productI18nSchema;
