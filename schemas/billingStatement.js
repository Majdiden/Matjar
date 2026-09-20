import { Schema } from "mongoose";

/**
 * Monthly billing statement per tenant (admin DB). Built from the fee ledger
 * for one period; payments are recorded manually by an operator until
 * collection is automated (decision 5: no enforcement at launch).
 */
const statementLineSchema = new Schema(
  {
    type: { type: String, enum: ["subscription", "commission", "adjustment", "credit", "tax"], required: true },
    description: { type: String, default: "" },
    amount: { type: Number, required: true },
    ref: { type: String, default: null },
  },
  { _id: false }
);

const paymentRecordSchema = new Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ["bankak", "bank_transfer", "cash", "gateway", "other"], required: true },
    reference: { type: String, default: null, trim: true },
    note: { type: String, default: null, trim: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: "TenantUser", required: true },
    recordedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const billingStatementSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    periodKey: { type: String, required: true }, // YYYY-MM
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    currency: { type: String, required: true, uppercase: true },
    planKey: { type: String, default: null },
    planFamily: { type: String, default: null },

    lines: { type: [statementLineSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    credits: { type: Number, default: 0 },
    amountDue: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["draft", "issued", "paid", "partially_paid", "overdue", "waived", "void"],
      default: "draft",
      index: true,
    },
    issuedAt: { type: Date, default: null },
    dueAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    payments: { type: [paymentRecordSchema], default: [] },
    note: { type: String, default: null },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

billingStatementSchema.index({ tenantId: 1, periodKey: 1 }, { unique: true });
billingStatementSchema.index({ status: 1, dueAt: 1 });

billingStatementSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export default billingStatementSchema;
