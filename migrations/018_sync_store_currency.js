/**
 * 018_sync_store_currency
 *
 * A store's currency lived in two places that were saved separately:
 * `settings.currency` (Settings → Regional; read by the storefront, the
 * dashboard, emails and reports) and `settings.currencies.base` (Settings →
 * Currencies; read by the exchange-rate conversion). A merchant who set the
 * base currency on the Currencies tab saw nothing change on the storefront.
 * The app now writes both together (controllers/settings.js → setStoreCurrency).
 *
 * up(): makes them equal.
 *   - A store that saved the Currencies tab (`currencies.ratesUpdatedAt` set)
 *     chose its base there: `settings.currency` takes that value.
 *   - Every other store keeps `settings.currency`; `currencies.base` copies it.
 *   - The previous `settings.currency` is kept in `settings.currencyBeforeSync`
 *     for down(). Stores already equal are not touched (idempotent).
 *
 * down(): restores `settings.currency` from `currencyBeforeSync`.
 */
export const description = "Make settings.currency and settings.currencies.base the same value";

export async function up(db, { logger, session } = {}) {
  const opt = session ? { session } : {};
  const tenants = db.collection("tenants");
  const cursor = tenants.find(
    {},
    { projection: { "settings.currency": 1, "settings.currencies": 1 }, ...opt }
  );
  let changed = 0;
  for await (const t of cursor) {
    const current = t.settings?.currency || null;
    const base = t.settings?.currencies?.base || null;
    const choseBase = !!t.settings?.currencies?.ratesUpdatedAt && !!base;
    const target = (choseBase ? base : current || base || "SDG").toUpperCase();
    if (current === target && base === target) continue;
    await tenants.updateOne(
      { _id: t._id },
      {
        $set: {
          "settings.currency": target,
          "settings.currencies.base": target,
          "settings.currencyBeforeSync": current,
        },
      },
      opt
    );
    changed++;
  }
  logger?.info?.(`018: aligned the currency of ${changed} store(s)`);
}

export async function down(db, { session } = {}) {
  const opt = session ? { session } : {};
  const tenants = db.collection("tenants");
  const cursor = tenants.find(
    { "settings.currencyBeforeSync": { $exists: true } },
    { projection: { "settings.currencyBeforeSync": 1 }, ...opt }
  );
  for await (const t of cursor) {
    const prev = t.settings.currencyBeforeSync;
    await tenants.updateOne(
      { _id: t._id },
      prev
        ? { $set: { "settings.currency": prev }, $unset: { "settings.currencyBeforeSync": "" } }
        : { $unset: { "settings.currencyBeforeSync": "" } },
      opt
    );
  }
}
