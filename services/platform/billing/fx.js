/**
 * Platform-owned FX reference table (H3). Merchants can edit their own
 * `settings.currencies.rates` for storefront presentment, so those rates
 * must NEVER drive what the platform charges. Tier lookups and base-fee
 * conversion use this table only; a missing pair → `null` → fxMissing path.
 *
 * Stored in `platformconfigs._id:"fx"` as { base, rates: { CODE: multiplier
 * vs base }, updatedAt, updatedBy }. `base` is the policy/platform currency.
 */
import mongoose from "mongoose";
import { APIError } from "../../../middlewares/errorHandler.js";
import logger from "../../../utils/logger.js";

const CONFIG_ID = "fx";
const CACHE_TTL_MS = 30_000;
const CODE_RE = /^[A-Z]{3}$/;
let cache = { value: null, at: 0 };

function col() {
  return mongoose.connection?.db?.collection("platformconfigs") || null;
}

export function sanitizeFxTable(raw = {}, fallbackBase = "SDG") {
  const base = String(raw.base || fallbackBase || "SDG").toUpperCase().trim();
  if (!CODE_RE.test(base)) throw new APIError("base must be a 3-letter currency code", 400);
  const rates = {};
  const src = raw.rates && typeof raw.rates === "object" && !Array.isArray(raw.rates) ? raw.rates : {};
  for (const [code, v] of Object.entries(src)) {
    const c = String(code).toUpperCase().trim();
    if (!CODE_RE.test(c)) throw new APIError(`Invalid currency code "${code}"`, 400);
    if (c === base) continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) throw new APIError(`Rate for ${c} must be a positive number`, 400);
    rates[c] = n;
  }
  return { base, rates };
}

export async function getFxTable() {
  if (cache.value && Date.now() - cache.at < CACHE_TTL_MS) return cache.value;
  let value = { base: "SDG", rates: {}, updatedAt: null };
  try {
    const c = col();
    if (c) {
      const doc = await c.findOne({ _id: CONFIG_ID });
      if (doc) value = { ...sanitizeFxTable(doc), updatedAt: doc.updatedAt || null };
    }
    cache = { value, at: Date.now() };
    return value;
  } catch (err) {
    logger.error("fx: failed to load platform FX table; treating all cross-currency as missing", { error: err?.message });
    return cache.value || value;
  }
}

export async function setFxTable(raw, updatedBy) {
  const before = await getFxTable();
  const next = sanitizeFxTable(raw, before.base); // (N8) keep the stored base unless given
  const c = col();
  if (!c) throw new APIError("Platform config store unavailable", 503);
  await c.updateOne(
    { _id: CONFIG_ID },
    { $set: { ...next, updatedAt: new Date(), updatedBy: updatedBy || null } },
    { upsert: true }
  );
  cache = { value: null, at: 0 };
  return { before, after: await getFxTable() };
}

export function invalidateFxCache() {
  cache = { value: null, at: 0 };
}

/**
 * Pure: multiplier converting `from` → `to` using a platform table
 * `{ base, rates }` (rates are "1 base = rate[CODE] CODE"). 1 for same
 * currency; null when either leg is unknown.
 */
export function fxMultiplier(table, from, to) {
  const f = String(from || "").toUpperCase();
  const t = String(to || "").toUpperCase();
  if (!f || !t) return null;
  if (f === t) return 1;
  const base = String(table?.base || "SDG").toUpperCase();
  const rates = table?.rates || {};
  const rate = (code) => (code === base ? 1 : Number.isFinite(Number(rates[code])) && Number(rates[code]) > 0 ? Number(rates[code]) : null);
  const rf = rate(f);
  const rt = rate(t);
  if (rf == null || rt == null) return null;
  // amount_in_to = amount_in_from / rf * rt
  return rt / rf;
}
