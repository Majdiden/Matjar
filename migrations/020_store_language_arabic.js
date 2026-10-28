/**
 * 020_store_language_arabic
 *
 * Store websites open in the store's language (settings.language). Signup
 * used to set it to the language of the dashboard during signup, and the
 * settings page saved "en" for a store without one, so most stores opened in
 * English. Arabic is the platform default: signup and the settings page now
 * use it, and this migration moves existing stores to it.
 *
 * up(): sets settings.language = "ar" for every store whose language is not
 * Arabic, keeping the previous value in settings.languageBeforeArabicDefault.
 * Idempotent. Merchants who want English switch it in Settings → Regional.
 *
 * down(): restores the previous value.
 */
export const description = "Store websites open in Arabic by default";

export async function up(db, { logger, session } = {}) {
  const opt = session ? { session } : {};
  const tenants = db.collection("tenants");
  const cursor = tenants.find(
    { "settings.language": { $ne: "ar" }, "settings.languageBeforeArabicDefault": { $exists: false } },
    { projection: { "settings.language": 1 }, ...opt }
  );
  let changed = 0;
  for await (const t of cursor) {
    await tenants.updateOne(
      { _id: t._id },
      { $set: { "settings.language": "ar", "settings.languageBeforeArabicDefault": t.settings?.language ?? null } },
      opt
    );
    changed++;
  }
  logger?.info?.(`020: ${changed} store(s) now open in Arabic`);
}

export async function down(db, { session } = {}) {
  const opt = session ? { session } : {};
  const tenants = db.collection("tenants");
  const cursor = tenants.find(
    { "settings.languageBeforeArabicDefault": { $exists: true } },
    { projection: { "settings.languageBeforeArabicDefault": 1 }, ...opt }
  );
  for await (const t of cursor) {
    const prev = t.settings.languageBeforeArabicDefault;
    await tenants.updateOne(
      { _id: t._id },
      prev
        ? { $set: { "settings.language": prev }, $unset: { "settings.languageBeforeArabicDefault": "" } }
        : { $unset: { "settings.language": "", "settings.languageBeforeArabicDefault": "" } },
      opt
    );
  }
}
