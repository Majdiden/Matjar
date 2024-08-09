import { mongoose, Schema } from "mongoose";
const productSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
  stock: { type: Number, required: true },
  variants: [
    {
      name: String,
      additionalPrice: Number,
      stock: Number,
    },
  ],
  images: [String],
  seoTitle: String,
  seoDescription: String,
  seoKeywords: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export default productSchema;
