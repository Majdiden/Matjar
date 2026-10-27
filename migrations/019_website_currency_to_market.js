/**
 * 019_website_currency_to_market
 *
 * Settings → Markets is now the one place a merchant sets what customers pay:
 * each market has its countries, currency and exchange rate. The older
 * "website currency" (`settings.currencies.display`, everyone sees and pays
 * in it) and the visitor currency switcher are retired.
 *
 * up(): for each store with a website currency other than its pricing
 * currency and no default market, adds a default market in that currency
 * (no countries: it serves every visitor not in another market) with the
 * website-currency rounding, then clears `display` and `showSwitcher`. The
 * previous values are kept in `settings.currencies.beforeMarkets` for down().
 * Idempotent: a store without a website currency is not touched.
 *
 * down(): removes the added market and restores `display` / `showSwitcher`.
 */
import mongoose from "mongoose";

export const description = "Turn the website currency into a default market";

// The market name for the currencies most stores use; others use the code.
const NAMES = {
  SDG: { ar: "السودان", en: "Sudan" },
  SAR: { ar: "السعودية", en: "Saudi Arabia" },
  AED: { ar: "الإمارات", en: "UAE" },
  EGP: { ar: "مصر", en: "Egypt" },
  QAR: { ar: "قطر", en: "Qatar" },
  KWD: { ar: "الكويت", en: "Kuwait" },
  OMR: { ar: "عُمان", en: "Oman" },
  BHD: { ar: "البحرين", en: "Bahrain" },
  USD: { ar: "دولار أمريكي", en: "US dollar" },
};

export async function up(db, { logger, session } = {}) {
  const opt = session ? { session } : {};
  const tenants = db.collection("tenants");
  const cursor = tenants.find(
    { "settings.currencies.display": { $nin: [null, ""] } },
    { projection: { "settings.currency": 1, "settings.currencies": 1, "settings.markets": 1, "settings.language": 1 }, ...opt }
  );
  let changed = 0;
  for await (const t of cursor) {
    const c = t.settings?.currencies || {};
    const base = String(t.settings?.currency || c.base || "SDG").toUpperCase();
    const display = String(c.display || "").toUpperCase();
    const markets = t.settings?.markets || [];
    const before = { display: c.display ?? null, showSwitcher: !!c.showSwitcher };
    const set = {
      "settings.currencies.display": null,
      "settings.currencies.showSwitcher": false,
      "settings.currencies.beforeMarkets": before,
    };
    const update = { $set: set };
    if (display && display !== base && Number(c.rates?.[display]) > 0 && !markets.some((m) => m.isDefault)) {
      const lang = t.settings?.language === "en" ? "en" : "ar";
      const _id = new mongoose.Types.ObjectId();
      update.$push = {
        "settings.markets": {
          _id,
          code: display.toLowerCase(),
          name: NAMES[display]?.[lang] || display,
          countries: [],
          currency: display,
          language: lang,
          priceAdjustmentPct: 0,
          pricing: "convert",
          rounding: c.rounding || "none",
          paymentMethods: [],
          enabled: true,
          isDefault: true,
        },
      };
      set["settings.currencies.beforeMarkets"] = { ...before, marketId: _id };
    }
    await tenants.updateOne({ _id: t._id }, update, opt);
    changed++;
  }
  logger?.info?.(`019: moved the website currency of ${changed} store(s) to markets`);
}

export async function down(db, { session } = {}) {
  const opt = session ? { session } : {};
  const tenants = db.collection("tenants");
  const cursor = tenants.find(
    { "settings.currencies.beforeMarkets": { $exists: true } },
    { projection: { "settings.currencies.beforeMarkets": 1 }, ...opt }
  );
  for await (const t of cursor) {
    const b = t.settings.currencies.beforeMarkets || {};
    const update = {
      $set: { "settings.currencies.display": b.display ?? null, "settings.currencies.showSwitcher": !!b.showSwitcher },
      $unset: { "settings.currencies.beforeMarkets": "" },
    };
    if (b.marketId) update.$pull = { "settings.markets": { _id: b.marketId } };
    await tenants.updateOne({ _id: t._id }, update, opt);
  }
}
