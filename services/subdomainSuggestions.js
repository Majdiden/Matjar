/**
 * Short store-link suggestions from a store name (signup and the dashboard's
 * link change).
 *
 * Turning the whole name into the link gives long addresses:
 * «بيتنا أصل العطور السودانية» → bitna-asl-alator-alsodania.matjar.to. Here
 * generic words (store, shop, «متجر», «شركة») are dropped, "ال" / "لل" / "و"
 * prefixes are removed, and a few short forms are built from what is left:
 * the first word (bitna), a spelling variant (betna), the first two words
 * (bitna-asl), first word + "store" / "sd", the initials. Only free ones are
 * returned, best first; the merchant picks one or types their own.
 */
import mongoose from "mongoose";
import { cleanInput, slugify } from "../utils/slugify.js";
import { validateSubdomain } from "../utils/subdomain.js";

/** How many suggestions to return. */
export const SUGGESTION_COUNT = 5;
/** Suggestions longer than this are not offered (the point is short links). */
const MAX_SUGGESTION_LENGTH = 24;
const MIN_LENGTH = 3;

// Words that say what kind of business it is, not which one. Compared after
// diacritics and the "ال" / "لل" / "و" prefixes are removed.
const FILLER_WORDS = new Set([
  "متجر", "متاجر", "محل", "محلات", "دكان", "بوتيك", "شركة", "شركه", "مؤسسة", "مؤسسه", "مركز", "معرض",
  "مجموعة", "مجموعه", "سوق", "اسواق", "أسواق", "مول", "ستور", "شوب",
  "store", "stores", "shop", "shops", "the", "and", "of", "for", "co", "company", "group", "trading", "online",
]);
const ARABIC_PREFIXES = ["وال", "بال", "لل", "ال", "و"];
const ARABIC_DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

/** The word without diacritics and without a leading "ال" / "لل" / "و" (kept when too short). */
function bareWord(word) {
  const w = word.replace(ARABIC_DIACRITICS, "");
  for (const p of ARABIC_PREFIXES) {
    if (w.startsWith(p) && w.length - p.length >= 3) return w.slice(p.length);
  }
  return w;
}

/** The store name's identifying words, as link slugs, in order. */
export function significantWords(name) {
  return cleanInput(name)
    .split(/[\s\-_.,،/&+|]+/)
    .filter(Boolean)
    .map((w) => ({ raw: w.toLowerCase(), bare: bareWord(w.toLowerCase()) }))
    .filter((w) => !FILLER_WORDS.has(w.bare) && !FILLER_WORDS.has(w.raw))
    .map((w) => slugify(w.bare))
    .filter(Boolean);
}

/**
 * A second spelling of a transliterated Arabic word (bitna → betna,
 * nor → nour): the same name is written several ways in Latin letters.
 */
function spellingVariant(word) {
  if (/i/.test(word)) return word.replace("i", "e");
  if (/o/.test(word) && !/oo/.test(word)) return word.replace("o", "ou");
  return null;
}

/** Candidate links from a store name, best first (not checked for availability). */
export function subdomainCandidates(name) {
  const words = significantWords(name);
  // Nothing identifying left ("My store"): fall back to every word.
  const list = words.length ? words : [slugify(name)].filter(Boolean);
  if (!list.length) return [];
  const [first, second] = list;
  const out = [
    first,
    /[\u0600-\u06ff]/.test(name) ? spellingVariant(first) : null,
    second && `${first}-${second}`,
    second && `${first}${second}`,
    `${first}-store`,
    `${first}sd`,
    list.length >= 3 ? list.map((w) => w[0]).join("") : null,
    slugify(name),
  ];
  const seen = new Set();
  return out.filter((c) => {
    if (!c || seen.has(c) || c.length < MIN_LENGTH || c.length > MAX_SUGGESTION_LENGTH) return false;
    seen.add(c);
    return validateSubdomain(c).valid;
  });
}

/**
 * Up to SUGGESTION_COUNT free links for the name. When the short forms are
 * taken, numbered ones (bitna2, bitna3, …) fill the list.
 */
export async function suggestSubdomains(name) {
  const candidates = subdomainCandidates(name);
  if (!candidates.length) return [];
  const base = candidates[0];
  for (let n = 2; n <= 9; n++) candidates.push(`${base}${n}`);
  const Tenant = mongoose.model("Tenant");
  const taken = new Set(
    (await Tenant.find({ "domains.subdomain.name": { $in: candidates } }).select("domains.subdomain.name").lean())
      .map((t) => t.domains?.subdomain?.name)
  );
  return candidates.filter((c) => !taken.has(c)).slice(0, SUGGESTION_COUNT);
}
