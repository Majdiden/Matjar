/**
 * Who may sign up (PBI 10-47): the registration lock and invitation codes.
 *
 * The owner sets one of three modes in the platform console
 * (`platformconfigs._id: "registration"`):
 *   - "open"     anyone can sign up (the default);
 *   - "optional" signup shows a "Referral code" field the merchant may fill;
 *   - "required" signup needs a "Beta invitation code".
 * A code that is given must be valid in both code modes. Each code registers
 * one store: it is claimed atomically when the store is created and released
 * if creating the store fails. Adding another store from an existing account
 * never asks for a code (that path does not come through here).
 */
import crypto from "node:crypto";
import mongoose from "mongoose";
import logger from "../utils/logger.js";
import { APIError } from "../middlewares/errorHandler.js";
import { INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH } from "../schemas/inviteCode.js";

export const SIGNUP_MODES = Object.freeze(["open", "optional", "required"]);
export const DEFAULT_SIGNUP_MODE = "open";

const CONFIG_ID = "registration";
const CACHE_TTL_MS = 30_000;
let cache = { value: null, at: 0 };

const col = () => mongoose.connection?.db?.collection("platformconfigs") || null;
const InviteCode = () => mongoose.model("InviteCode");

/** The current signup mode (cached briefly; "open" when unset or unreadable). */
export async function getSignupMode() {
  if (cache.value && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  try {
    const doc = await col()?.findOne({ _id: CONFIG_ID });
    const value = SIGNUP_MODES.includes(doc?.mode) ? doc.mode : DEFAULT_SIGNUP_MODE;
    cache = { value, at: Date.now() };
    return value;
  } catch (err) {
    logger.warn("signupAccess: failed to read the signup mode", { error: err?.message });
    return cache.value || DEFAULT_SIGNUP_MODE;
  }
}

export async function setSignupMode(mode, updatedBy) {
  if (!SIGNUP_MODES.includes(mode)) throw new APIError("Unknown signup mode", 400);
  const c = col();
  if (!c) throw new APIError("Platform config store unavailable", 503);
  await c.updateOne(
    { _id: CONFIG_ID },
    { $set: { mode, updatedAt: new Date(), updatedBy: updatedBy || null } },
    { upsert: true }
  );
  cache = { value: mode, at: Date.now() };
  return mode;
}

export function invalidateSignupModeCache() {
  cache = { value: null, at: 0 };
}

/** "abcd-ef 12" → "ABCDEF12": what the merchant typed, as stored. */
export const normalizeCode = (raw) =>
  String(raw ?? "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");

/** "ABCDEF12" → "ABCD-EF12" for display. */
export const formatCode = (code) => {
  const c = normalizeCode(code);
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
};

/** A new random code (crypto-random, unambiguous characters). */
export function generateCode() {
  const bytes = crypto.randomBytes(INVITE_CODE_LENGTH);
  let out = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) out += INVITE_CODE_ALPHABET[bytes[i] % INVITE_CODE_ALPHABET.length];
  return out;
}

/** A 400 the signup form shows on the code field. */
const codeError = (message, code) => {
  const err = new APIError(message, 400, [{ field: "invitationCode", message, code }]);
  err.code = code;
  return err;
};

/**
 * Decide, before creating anything, whether this signup may go ahead and
 * which code it uses. Returns the normalized code or null (none needed / none
 * given). Throws a 400 with code INVITE_CODE_REQUIRED / INVITE_CODE_INVALID.
 */
export async function checkSignupCode(rawCode) {
  const mode = await getSignupMode();
  if (mode === "open") return null;
  const code = normalizeCode(rawCode);
  if (!code) {
    if (mode === "required") throw codeError("A beta invitation code is required to sign up.", "INVITE_CODE_REQUIRED");
    return null;
  }
  const found = await InviteCode().findOne({ code, status: "active" }).select("_id").lean();
  if (!found) throw codeError("This code is not valid or was already used.", "INVITE_CODE_INVALID");
  return code;
}

/** Whether a code can register a store right now (signup form check). */
export async function isCodeUsable(rawCode) {
  const code = normalizeCode(rawCode);
  if (!code || code.length > 32) return false;
  return !!(await InviteCode().exists({ code, status: "active" }));
}

/**
 * Claim a code for a signup that is about to create its store. Atomic: two
 * signups racing for the same code — only one gets it. Returns the claimed
 * code document, or throws INVITE_CODE_INVALID.
 */
export async function claimCode(code, { email } = {}) {
  const claimed = await InviteCode().findOneAndUpdate(
    { code, status: "active" },
    { $set: { status: "used", usedAt: new Date(), usedByEmail: email || null } },
    { new: true }
  );
  if (!claimed) throw codeError("This code is not valid or was already used.", "INVITE_CODE_INVALID");
  return claimed;
}

/** Give a claimed code back when creating the store failed. */
export async function releaseCode(codeId) {
  try {
    await InviteCode().updateOne(
      { _id: codeId, status: "used", usedByTenantId: null },
      { $set: { status: "active", usedAt: null, usedByEmail: null } }
    );
  } catch (err) {
    logger.error("signupAccess: failed to release a code", { codeId: String(codeId), error: err?.message });
  }
}

/** Record the store a claimed code registered, on both sides. */
export async function linkCodeToStore(claimed, tenantId, storeName) {
  await InviteCode().updateOne(
    { _id: claimed._id },
    { $set: { usedByTenantId: tenantId, usedByTenantName: storeName || null } }
  );
  await mongoose.model("Tenant").updateOne(
    { _id: tenantId },
    { $set: { inviteCode: { codeId: claimed._id, code: claimed.code, promoterId: claimed.createdBy, usedAt: claimed.usedAt } } }
  );
}
