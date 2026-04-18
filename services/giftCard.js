import crypto from "node:crypto";
import { APIError } from "../middlewares/errorHandler.js";
import {
  listGiftCardsRepo,
  getGiftCardRepo,
  getGiftCardByCodeHashRepo,
  createGiftCardRepo,
  updateGiftCardRepo,
  addTransactionRepo,
  redeemCardAtomicRepo,
  bulkExpireCardsRepo,
} from "../repositories/giftCard.js";

// Characters that are visually unambiguous (no 0/O/1/I)
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Generate a 16-char alphanumeric gift card code formatted as XXXX-XXXX-XXXX-XXXX.
 */
export function generateCode() {
  const bytes = crypto.randomBytes(16);
  let raw = "";
  for (const byte of bytes) {
    raw += CODE_CHARS[byte % CODE_CHARS.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}

/**
 * SHA-256 hash of the normalized code (no hyphens, uppercase).
 */
export function hashCode(code) {
  const normalized = code.replace(/-/g, "").toUpperCase();
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Strip the code field from a lean document — only returned on issue.
 */
/**
 * Coerce a user-supplied amount to a finite number. Rejects NaN/Infinity and
 * non-numeric strings so downstream $inc/aggregation math is always safe.
 */
function coerceAmount(raw, { allowNegative = false, field = "amount" } = {}) {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) throw new APIError(`${field} must be a finite number`, 400);
  if (!allowNegative && n <= 0) throw new APIError(`${field} must be positive`, 400);
  return n;
}

function sanitizeCard(card) {
  if (!card) return null;
  const { code: _code, codeHash: _h, ...rest } = card;
  return rest;
}

/**
 * Issue a new gift card.
 * Returns the full card INCLUDING plaintext code — caller must store it or display once.
 */
export const issueGiftCard = async (
  models,
  tenantId,
  { initialAmount, currency = "SDG", customerId, issuedTo, issuedBy, message, note, expiresAt, orderId, coverShipping, coverTax } = {}
) => {
  initialAmount = coerceAmount(initialAmount, { field: "initialAmount" });

  const code = generateCode();
  const codeHash = hashCode(code);
  const codeLast4 = code.replace(/-/g, "").slice(-4);

  const firstTx = {
    type: "issue",
    amount: initialAmount,
    balanceAfter: initialAmount,
    note: note || "Gift card issued",
    by: issuedBy || null,
    createdAt: new Date(),
  };

  const doc = await createGiftCardRepo(models, {
    tenantId,
    codeHash,
    codeLast4,
    initialAmount,
    balance: initialAmount,
    currency: currency.toUpperCase(),
    customerId: customerId || null,
    issuedTo: issuedTo || {},
    issuedBy: issuedBy || null,
    message: message || "",
    note: note || "",
    status: "active",
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    orderId: orderId || null,
    coverShipping: !!coverShipping,
    coverTax: !!coverTax,
    transactions: [firstTx],
  });

  // Return lean object WITH plaintext code — only time it is exposed.
  // Plaintext is NOT persisted; we attach it here only for the response.
  const obj = doc.toObject();
  delete obj.codeHash;
  obj.code = code;
  return obj;
};

export const listGiftCards = async (models, opts = {}) => {
  const result = await listGiftCardsRepo(models, opts);
  result.items = result.items.map(sanitizeCard);
  return result;
};

export const getGiftCard = async (models, id) => {
  const card = await getGiftCardRepo(models, id);
  if (!card) throw new APIError("Gift card not found", 404);
  return sanitizeCard(card);
};

/**
 * Look up a card by plaintext code. Returns sanitized card for redemption preview.
 * Validates status and expiry.
 */
export const lookupByCode = async (models, code) => {
  if (!code || typeof code !== "string") throw new APIError("code is required", 400);
  const codeHash = hashCode(code);
  const card = await getGiftCardByCodeHashRepo(models, codeHash);
  if (!card) throw new APIError("Gift card not found", 404);

  if (card.status === "disabled") throw new APIError("Gift card is disabled", 400);
  if (card.status === "expired") throw new APIError("Gift card has expired", 400);
  if (card.status === "redeemed") throw new APIError("Gift card has been fully redeemed", 400);
  if (card.expiresAt && card.expiresAt < new Date())
    throw new APIError("Gift card has expired", 400);

  return sanitizeCard(card);
};

/**
 * Redeem a gift card atomically.
 * Uses a single findOneAndUpdate with $inc so there is no TOCTOU window.
 * The query condition `balance: { $gte: amount }` acts as the atomic guard.
 */
export const redeemGiftCard = async (models, code, amount, { orderId, by } = {}) => {
  if (!code || typeof code !== "string") throw new APIError("code is required", 400);
  amount = coerceAmount(amount);

  const codeHash = hashCode(code);
  const existing = await getGiftCardByCodeHashRepo(models, codeHash);
  if (!existing) throw new APIError("Gift card not found", 404);
  if (existing.status === "disabled") throw new APIError("Gift card is disabled", 400);
  if (existing.status === "expired" || (existing.expiresAt && existing.expiresAt < new Date()))
    throw new APIError("Gift card has expired", 400);
  if (existing.status === "redeemed") throw new APIError("Gift card balance is zero", 400);
  if (existing.status !== "active") throw new APIError("Gift card is not active", 400);

  if (existing.balance < amount)
    throw new APIError(`Insufficient balance. Available: ${existing.balance}`, 400);

  const tx = {
    type: "redeem",
    amount,
    orderId: orderId || null,
    note: "Redeemed at checkout",
    by: by || null,
    createdAt: new Date(),
  };

  // Atomic: aggregation pipeline computes post-decrement balance and status in one op
  const updated = await redeemCardAtomicRepo(models, existing._id, tx, amount);

  if (!updated) {
    // Re-fetch to give accurate error
    const fresh = await getGiftCardRepo(models, existing._id);
    if (!fresh) throw new APIError("Gift card not found", 404);
    if (fresh.balance < amount)
      throw new APIError(`Insufficient balance. Available: ${fresh.balance}`, 400);
    throw new APIError("Gift card cannot be redeemed (status changed concurrently)", 409);
  }

  return sanitizeCard(updated);
};

/**
 * Redeem by id (ownership pre-verified by caller).
 *
 * Used by the order service when a signed-in customer picks one of their
 * stored gift cards: we don't have the plaintext code (hash-only storage),
 * so we skip the code lookup and validate the card directly by id. The
 * caller MUST have already proven ownership (customerId match, or
 * issuedTo.email match) BEFORE calling this — this function does not
 * re-check ownership itself.
 */
export const redeemGiftCardById = async (models, id, amount, { orderId, by } = {}) => {
  amount = coerceAmount(amount);
  const existing = await getGiftCardRepo(models, id);
  if (!existing) throw new APIError("Gift card not found", 404);
  if (existing.status === "disabled") throw new APIError("Gift card is disabled", 400);
  if (existing.status === "expired" || (existing.expiresAt && existing.expiresAt < new Date()))
    throw new APIError("Gift card has expired", 400);
  if (existing.status === "redeemed") throw new APIError("Gift card balance is zero", 400);
  if (existing.status !== "active") throw new APIError("Gift card is not active", 400);
  if (existing.balance < amount)
    throw new APIError(`Insufficient balance. Available: ${existing.balance}`, 400);

  const tx = {
    type: "redeem",
    amount,
    orderId: orderId || null,
    note: "Redeemed at checkout",
    by: by || null,
    createdAt: new Date(),
  };
  const updated = await redeemCardAtomicRepo(models, existing._id, tx, amount);
  if (!updated) {
    const fresh = await getGiftCardRepo(models, existing._id);
    if (!fresh) throw new APIError("Gift card not found", 404);
    if (fresh.balance < amount)
      throw new APIError(`Insufficient balance. Available: ${fresh.balance}`, 400);
    throw new APIError("Gift card cannot be redeemed (status changed concurrently)", 409);
  }
  return sanitizeCard(updated);
};

/**
 * Refund an amount back to the gift card.
 * If the card was "redeemed" and balance becomes > 0, flip it back to "active".
 */
export const refundGiftCard = async (models, id, amount, { orderId, by, note } = {}) => {
  amount = coerceAmount(amount);
  const card = await getGiftCardRepo(models, id);
  if (!card) throw new APIError("Gift card not found", 404);
  if (card.status === "disabled") throw new APIError("Gift card is disabled", 400);

  const newBalance = card.balance + amount;

  const tx = {
    type: "refund",
    amount,
    balanceAfter: newBalance,
    orderId: orderId || null,
    note: note || "Refund applied",
    by: by || null,
    createdAt: new Date(),
  };

  // Flip "redeemed" back to "active" if balance > 0 after refund
  const newStatus = card.status === "redeemed" && newBalance > 0 ? "active" : card.status;

  const updated = await addTransactionRepo(models, id, tx, amount, newStatus);
  if (!updated) throw new APIError("Gift card not found", 404);
  return sanitizeCard(updated);
};

/**
 * Manual balance adjustment (admin). Positive = add, negative = subtract.
 * Balance cannot go below 0.
 */
export const adjustGiftCard = async (models, id, amount, { by, note } = {}) => {
  amount = coerceAmount(amount, { allowNegative: true });
  if (amount === 0) throw new APIError("amount must be a non-zero number", 400);

  const card = await getGiftCardRepo(models, id);
  if (!card) throw new APIError("Gift card not found", 404);
  if (card.status === "disabled") throw new APIError("Gift card is disabled", 400);

  const newBalance = card.balance + amount;
  if (newBalance < 0)
    throw new APIError(`Adjustment would result in negative balance. Current: ${card.balance}`, 400);

  const tx = {
    type: "adjust",
    amount,
    balanceAfter: newBalance,
    note: note || "Manual adjustment",
    by: by || null,
    createdAt: new Date(),
  };

  // If previously redeemed and we're adding value, flip back to active
  const newStatus = card.status === "redeemed" && newBalance > 0 ? "active" : card.status;

  // For subtractions, guard against concurrent overdraft with $gte condition
  const conditions = amount < 0 ? { balance: { $gte: Math.abs(amount) } } : {};
  const updated = await addTransactionRepo(models, id, tx, amount, newStatus, conditions);
  if (!updated) throw new APIError("Adjustment failed: insufficient balance or card not found", 400);
  return sanitizeCard(updated);
};

export const disableGiftCard = async (models, id) => {
  const card = await getGiftCardRepo(models, id);
  if (!card) throw new APIError("Gift card not found", 404);
  if (card.status === "disabled") return sanitizeCard(card);
  const updated = await updateGiftCardRepo(models, id, { status: "disabled" });
  return sanitizeCard(updated);
};

export const enableGiftCard = async (models, id) => {
  const card = await getGiftCardRepo(models, id);
  if (!card) throw new APIError("Gift card not found", 404);
  if (card.status !== "disabled") throw new APIError("Gift card is not disabled", 400);
  const updated = await updateGiftCardRepo(models, id, { status: "active" });
  return sanitizeCard(updated);
};

/**
 * Batch-expire cards whose expiresAt has passed.
 * Designed to be called by a cron job — does not schedule anything itself.
 * Returns the count of expired cards.
 */
export const expireOverdueCards = async (models) => {
  const result = await bulkExpireCardsRepo(models, new Date());
  return { expired: result.modifiedCount };
};
