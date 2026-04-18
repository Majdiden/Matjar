import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

export const GIFT_CARD_STATUSES = ["active", "redeemed", "expired", "disabled"];
export const GIFT_CARD_TRANSACTION_TYPES = ["issue", "redeem", "refund", "adjust"];

const transactionSchema = new Schema(
  {
    type: { type: String, enum: GIFT_CARD_TRANSACTION_TYPES, required: true },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    note: { type: String, trim: true },
    by: { type: Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const giftCardSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    // Plaintext code is NEVER stored. Only the SHA-256 hash for lookup
    // and the last 4 characters for display are persisted. Plaintext is
    // returned exactly once from issueGiftCard() in the response body.
    codeHash: { type: String, required: true, index: true },
    codeLast4: { type: String },
    initialAmount: { type: Number, required: true, min: 0 },
    balance: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "SDG", uppercase: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User" },
    issuedTo: {
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
    },
    issuedBy: { type: Schema.Types.ObjectId, ref: "User" },
    note: { type: String, trim: true },
    message: { type: String, trim: true },
    status: { type: String, enum: GIFT_CARD_STATUSES, default: "active" },
    // Per-card redemption coverage flags. A card with coverShipping=true
    // can pay for shipping in addition to goods; coverTax=true lets it
    // pay for tax. Defaulting both to false keeps cards goods-only unless
    // the merchant opts in at issue time.
    coverShipping: { type: Boolean, default: false },
    coverTax: { type: Boolean, default: false },
    expiresAt: { type: Date, default: null },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    transactions: [transactionSchema],
  },
  { timestamps: true }
);

// Compound indexes
giftCardSchema.index({ tenantId: 1, codeHash: 1 }, { unique: true });
giftCardSchema.index({ tenantId: 1, status: 1 });
giftCardSchema.index({ tenantId: 1, customerId: 1 });
giftCardSchema.index({ tenantId: 1, expiresAt: 1 });

applyTenantScope(giftCardSchema);

export default giftCardSchema;
