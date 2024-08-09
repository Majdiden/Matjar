import { mongoose, Schema } from "mongoose";

const analyticsSchema = new Schema({
  eventType: { type: String, required: true },
  eventData: mongoose.Schema.Types.Mixed,
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});
export default analyticsSchema;
