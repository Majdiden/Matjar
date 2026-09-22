/**
 * 015_backfill_default_menu_translations
 *
 * The default header menu seeded at store creation baked ONE language into
 * each item's `label` and left `translations` empty. The storefront renders
 * `translations[lang].label` and falls back to `label`
 * (storefront-themes/_shared/hooks/useMenu.ts), so the nav froze at whatever
 * language the store was created in — an Arabic store showed "Home / All
 * Products / About / Contact" to Arabic shoppers, and vice versa.
 *
 * services/storeSetup.js now seeds both languages. This backfills the stores
 * that were created before that.
 *
 * Conservative by construction: an item is only touched when BOTH its `url`
 * and its `label` still match one of the four seeded defaults (in either
 * language) and it carries no non-empty translation yet. A merchant who
 * renamed "About" to "Our story", repointed a link, or filled in their own
 * translation is left completely alone.
 *
 * Idempotent: once an item has translations it no longer matches, so a
 * re-run writes nothing.
 */
export const description =
  "Backfill en/ar translations on default-seeded storefront menu items";

// The four items seeded by services/storeSetup.js::seedDefaultMenus, with
// every label that seeder has ever produced. Intentionally duplicated here —
// a migration must not follow the seeder through future edits.
const DEFAULTS = [
  { url: "/", en: "Home", ar: "الرئيسية" },
  { url: "/products", en: "All Products", ar: "جميع المنتجات" },
  { url: "/about", en: "About", ar: "من نحن" },
  { url: "/contact", en: "Contact", ar: "اتصل بنا" },
];

const has = (v) => typeof v === "string" && v.trim() !== "";

/** The default this item is an untouched copy of, or null. */
function matchDefault(item) {
  if (!item || typeof item !== "object") return null;
  const label = typeof item.label === "string" ? item.label.trim() : "";
  const url = typeof item.url === "string" ? item.url.trim() : "";
  return (
    DEFAULTS.find((d) => d.url === url && (d.en === label || d.ar === label)) || null
  );
}

/**
 * Walk an items[] tree, filling translations on untouched defaults.
 * Returns the number of items changed; mutates `items` in place.
 */
function fillItems(items) {
  if (!Array.isArray(items)) return 0;
  let changed = 0;
  for (const item of items) {
    const def = matchDefault(item);
    const t = item?.translations || {};
    // Never overwrite a translation the merchant supplied.
    const untranslated = !has(t.en?.label) && !has(t.ar?.label);
    if (def && untranslated) {
      item.translations = { en: { label: def.en }, ar: { label: def.ar } };
      changed += 1;
    }
    changed += fillItems(item?.children);
  }
  return changed;
}

export async function up(db, { logger, session } = {}) {
  const sessionOpt = session ? { session } : undefined;
  const menus = db.collection("menus");

  // Only the seeded navigation menus can contain seeded items.
  const cursor = menus.find(
    { $or: [{ handle: "header" }, { location: "header" }] },
    sessionOpt
  );

  let scanned = 0;
  let menusUpdated = 0;
  let itemsUpdated = 0;

  while (await cursor.hasNext()) {
    const menu = await cursor.next();
    scanned += 1;

    const items = menu.items;
    const changed = fillItems(items);
    if (!changed) continue;

    await menus.updateOne({ _id: menu._id }, { $set: { items } }, sessionOpt);
    menusUpdated += 1;
    itemsUpdated += changed;
  }

  logger?.info?.(
    `015: scanned ${scanned} header menu(s) — translated ${itemsUpdated} item(s) across ${menusUpdated} menu(s)`
  );
  return { scanned, menusUpdated, itemsUpdated };
}

export async function down(db, { logger, session } = {}) {
  const sessionOpt = session ? { session } : undefined;
  const menus = db.collection("menus");

  // Clear translations only where they are still exactly the pair this
  // migration wrote; anything the merchant edited since no longer matches.
  const isOurs = (item) => {
    const def = matchDefault(item);
    const t = item?.translations || {};
    return Boolean(def && t.en?.label === def.en && t.ar?.label === def.ar);
  };
  const clear = (items) => {
    if (!Array.isArray(items)) return 0;
    let changed = 0;
    for (const item of items) {
      if (isOurs(item)) {
        item.translations = { en: { label: "" }, ar: { label: "" } };
        changed += 1;
      }
      changed += clear(item?.children);
    }
    return changed;
  };

  const cursor = menus.find(
    { $or: [{ handle: "header" }, { location: "header" }] },
    sessionOpt
  );
  let menusUpdated = 0;
  while (await cursor.hasNext()) {
    const menu = await cursor.next();
    const items = menu.items;
    if (!clear(items)) continue;
    await menus.updateOne({ _id: menu._id }, { $set: { items } }, sessionOpt);
    menusUpdated += 1;
  }
  logger?.info?.(`015 down: cleared translations on ${menusUpdated} menu(s)`);
}
