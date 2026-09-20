/**
 * Money helpers for billing. All arithmetic goes through integer minor
 * units at the policy's precision so 0.1 + 0.2 style drift never reaches
 * the ledger.
 */

/** 10^precision, precision clamped to [0, 4]. */
export function scaleFor(precision = 0) {
  const p = Math.max(0, Math.min(4, Number(precision) || 0));
  return 10 ** p;
}

/**
 * Round `amount` to `precision` decimals using `mode`:
 *   nearest (half away from zero) | up (away from zero) | down (toward zero)
 */
export function roundMoney(amount, precision = 0, mode = "nearest") {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  const scale = scaleFor(precision);
  // Nudge by an epsilon to counter binary representation error before rounding.
  const scaled = n * scale;
  const eps = 1e-9 * Math.sign(scaled || 1);
  let units;
  if (mode === "up") units = scaled >= 0 ? Math.ceil(scaled - 1e-9) : Math.floor(scaled + 1e-9);
  else if (mode === "down") units = scaled >= 0 ? Math.floor(scaled + 1e-9) : Math.ceil(scaled - 1e-9);
  else units = Math.round(scaled + eps);
  return units / scale;
}

/** Sum a list of numbers with minor-unit accumulation. */
export function sumMoney(values, precision = 4) {
  const scale = scaleFor(precision);
  let units = 0;
  for (const v of values) units += Math.round((Number(v) || 0) * scale);
  return units / scale;
}

/** YYYY-MM period key in UTC for a date. */
export function periodKeyFor(date = new Date()) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** [start, end) UTC bounds for a YYYY-MM period key. Throws on bad input. */
export function periodBounds(periodKey) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(periodKey || ""));
  if (!m) throw new Error(`Invalid period key "${periodKey}" (expected YYYY-MM)`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) throw new Error(`Invalid period key "${periodKey}"`);
  const start = new Date(Date.UTC(y, mo - 1, 1));
  const end = new Date(Date.UTC(y, mo, 1));
  return { start, end };
}

/** The period key immediately before `periodKey`. */
export function previousPeriodKey(periodKey) {
  const { start } = periodBounds(periodKey);
  return periodKeyFor(new Date(start.getTime() - 1));
}

/**
 * The currency a store is billed in (N2): the store's base trading currency.
 * Single definition used by ledger recognition, adjustments and statements so
 * every row of a statement is guaranteed to share one currency.
 */
export function storeCurrencyOf(tenant) {
  return String(tenant?.settings?.currencies?.base || tenant?.settings?.currency || "SDG").toUpperCase();
}
