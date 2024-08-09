import { Schema } from "mongoose";
const currencySchema = new Schema({
  currencyCode: { type: String, required: true },
  exchangeRate: { type: Number, required: true },
  updatedAt: { type: Date, default: Date.now },
});
export default currencySchema;
