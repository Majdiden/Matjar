/**
 * Automatic exchange rates. A merchant can let a currency's rate follow the
 * platform's exchange-rate table (Platform → Billing → FX) plus their own
 * margin, instead of typing it. The result is written into
 * `settings.currencies.rates` like a typed rate, so pricing never reads the
 * platform table directly: on the merchant's save and whenever the platform
 * updates its table (refreshAutoRates).
 */
import mongoose from "mongoose";
import { fxMultiplier } from "./platform/billing/fx.js";
import logger from "../utils/logger.js";

// Six significant figures: 600.123, 0.00166667.
const tidy = (n) => Number(n.toPrecision(6));

/**
 * Rates for the `auto` entries ([{ code, margin }]) from the platform table:
 * { rates: { CODE: multiplier from base }, missing: [codes without a rate] }.
 */
export function autoRatesFor(table, base, auto = []) {
  const rates = {};
  const missing = [];
  for (const { code, margin = 0 } of auto) {
    const m = fxMultiplier(table, base, code);
    if (!(m > 0)) missing.push(code);
    else rates[code] = tidy(m * (1 + (Number(margin) || 0)));
  }
  return { rates, missing };
}

/**
 * Recompute every store's automatic rates from the platform table. A
 * currency the table no longer covers keeps its last rate. Returns the
 * number of stores updated.
 */
export async function refreshAutoRates(table) {
  const Tenant = mongoose.model("Tenant");
  const cursor = Tenant.find({ "settings.currencies.auto.0": { $exists: true } })
    .select("settings.currency settings.currencies")
    .lean()
    .cursor();
  let updated = 0;
  for await (const t of cursor) {
    const base = String(t.settings?.currency || t.settings?.currencies?.base || "SDG").toUpperCase();
    const { rates } = autoRatesFor(table, base, t.settings?.currencies?.auto || []);
    if (!Object.keys(rates).length) continue;
    const set = { "settings.currencies.ratesUpdatedAt": new Date() };
    for (const [code, rate] of Object.entries(rates)) set[`settings.currencies.rates.${code}`] = rate;
    try {
      await Tenant.updateOne({ _id: t._id }, { $set: set });
      updated++;
    } catch (err) {
      logger.warn("autoRates: store not updated", { tenantId: String(t._id), error: err?.message });
    }
  }
  return updated;
}
