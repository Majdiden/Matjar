// =============================================================================
// Store link (platform subdomain) helpers — signup's "Your store link" field.
//
// Real merchants paste whatever they think of as "my store's address": their
// Facebook page, a full https://name.matjar.to example, a WhatsApp link — or
// type their store name in Arabic, which a web address can't contain. These
// pure helpers turn any of that into a valid subdomain suggestion and tell the
// UI what happened so it can explain it in plain words.
//
// Pure + dependency-free on purpose: unit-tested directly by node --test
// (tests/unit/storeLink.test.js).
// =============================================================================

/** DNS label limits; must match the backend subdomain validator. */
export const SUBDOMAIN_MIN_LENGTH = 3;
export const SUBDOMAIN_MAX_LENGTH = 63;
export const SUBDOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

// Social platforms we can store (tenant.settings.socialLinks). Hosts mirror
// utils/socialLinks.js on the backend — keep the two lists in sync.
export const SOCIAL_HOSTS = {
  facebook: ['facebook.com', 'fb.com', 'fb.me'],
  instagram: ['instagram.com', 'instagr.am'],
  tiktok: ['tiktok.com'],
  telegram: ['t.me', 'telegram.me'],
  x: ['x.com', 'twitter.com'],
} as const;

export type SocialPlatform = keyof typeof SOCIAL_HOSTS;
export type SocialLinks = Partial<Record<SocialPlatform, string>>;

// WhatsApp links are recognised (to explain them) but not stored: a store's
// WhatsApp is a phone number, captured elsewhere.
const WHATSAPP_HOSTS = ['wa.me', 'whatsapp.com', 'wa.link'];

// Path segments that are never a page's own name.
const NON_NAME_SEGMENTS = new Set([
  'profile.php', 'pages', 'pg', 'people', 'groups', 'share', 'sharer', 'p', 'reel', 'reels',
  'watch', 'events', 'hashtag', 'stories', 'story', 'marketplace', 'home.php', 'login', 'video',
]);

// Placeholder names from our own examples/help text. Merchants copy the
// example link verbatim ("https://store-name.matjar.to"), so these are never
// taken as a real choice — the caller suggests one from the store name.
const EXAMPLE_SLUGS = new Set([
  'store-name', 'storename', 'your-store', 'yourstore', 'your-store-name', 'my-store', 'mystore',
  'store', 'example', 'name', 'rivera-co', 'nile-perfumes',
]);

// Second-level labels under a country TLD (shop.com.sd → "shop").
const GENERIC_SECOND_LEVEL = new Set(['com', 'co', 'net', 'org', 'gov', 'edu', 'ac']);

// ─── Arabic → Latin ──────────────────────────────────────────────────────────
// Readable, not scholarly: the goal is a link a Sudanese merchant recognises
// as their store's name. Follows everyday Sudanese spelling in Latin letters
// (ق → g as in "Gadarif", ذ → z as spoken).
const ARABIC_LETTERS: Record<string, string> = {
  'ا': 'a', 'أ': 'a', 'إ': 'e', 'آ': 'a', 'ٱ': 'a', 'ء': '', 'ؤ': 'o', 'ئ': 'e',
  'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'z',
  'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z',
  'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'g', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ه': 'h', 'ة': 'a', 'ى': 'a', 'پ': 'p', 'چ': 'ch', 'ڤ': 'v', 'گ': 'g', 'ک': 'k', 'ی': 'i',
};
// و / ي are consonants at the start of a word (ward, yasmin) and long vowels
// inside it (nour → "nor", zein → "zin") — close enough to be recognisable.
const ARABIC_SEMIVOWELS: Record<string, [initial: string, medial: string]> = {
  'و': ['w', 'o'],
  'ي': ['y', 'i'],
};
const ARABIC_DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
const ARABIC_INDIC_DIGIT = /[٠-٩۰-۹]/g;
const ARABIC_CHAR = /[؀-ۿ]/;

/** True when the text contains Arabic script. */
export const hasArabic = (text: string): boolean => ARABIC_CHAR.test(text);

/** Transliterate Arabic letters/digits to Latin; other characters pass through. */
export function transliterateArabic(text: string): string {
  const cleaned = text
    .replace(ARABIC_DIACRITICS, '')
    .replace(ARABIC_INDIC_DIGIT, (d) => String(d.charCodeAt(0) & 0xf));
  let out = '';
  let prevIsArabicLetter = false;
  for (const ch of cleaned) {
    const semivowel = ARABIC_SEMIVOWELS[ch];
    if (semivowel) {
      out += prevIsArabicLetter ? semivowel[1] : semivowel[0];
      prevIsArabicLetter = true;
    } else if (ch in ARABIC_LETTERS) {
      out += ARABIC_LETTERS[ch];
      prevIsArabicLetter = true;
    } else {
      out += ch;
      prevIsArabicLetter = false;
    }
  }
  return out;
}

const trimHyphens = (s: string) => s.replace(/^-+|-+$/g, '');

/** Full store name (any script) → finished subdomain suggestion. */
export function slugifyStoreName(name: string): string {
  const latin = transliterateArabic(name.toLowerCase())
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-');
  return trimHyphens(trimHyphens(latin).slice(0, SUBDOMAIN_MAX_LENGTH));
}

/**
 * Keystroke-level cleanup for the subdomain field. Unlike slugifyStoreName it
 * keeps a trailing hyphen so "my-" → "my-s" can be typed; finalizeSubdomain
 * tidies up when the field loses focus.
 */
export function sanitizeSubdomainTyping(value: string): string {
  return transliterateArabic(value.toLowerCase())
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s._/]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .slice(0, SUBDOMAIN_MAX_LENGTH);
}

/**
 * On blur: drop the leftovers of a URL typed character by character
 * ("https-www-nile-matjar-to" → "nile") and any edge hyphens.
 */
export function finalizeSubdomain(value: string, platformDomain: string): string {
  const typedSuffix = `-${platformDomain.toLowerCase().replace(/\./g, '-')}`;
  let v = trimHyphens(value);
  v = v.replace(/^(https?-+)?(www-+)?/, '');
  if (v.endsWith(typedSuffix)) v = v.slice(0, -typedSuffix.length);
  return trimHyphens(v);
}

/** Does this pasted/typed text look like a URL rather than a name? */
export function looksLikeLink(text: string): boolean {
  const t = text.trim();
  if (!t || /\s/.test(t)) return false;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(t) || /^www\./i.test(t) || /^[^/]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(t);
}

const hostIn = (host: string, list: readonly string[]) =>
  list.some((h) => host === h || host.endsWith(`.${h}`));

const parseUrl = (text: string): URL | null => {
  const t = text.trim();
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`);
  } catch {
    return null;
  }
};

/** First path segment that reads like a page name ("/@nile.store" → "nile-store"). */
const nameFromPath = (url: URL): string => {
  for (const raw of url.pathname.split('/')) {
    let seg: string;
    try {
      seg = decodeURIComponent(raw).replace(/^@/, '');
    } catch {
      seg = raw;
    }
    if (!seg || NON_NAME_SEGMENTS.has(seg.toLowerCase()) || /^\d+$/.test(seg)) continue;
    return slugifyStoreName(seg);
  }
  return '';
};

/** Registrable-name label of a host ("shop.nile.com.sd" → "nile"). */
const nameFromHost = (host: string): string => {
  const labels = host.split('.');
  let i = labels.length - 2;
  if (i > 0 && GENERIC_SECOND_LEVEL.has(labels[i])) i -= 1;
  return i >= 0 ? slugifyStoreName(labels[i]) : '';
};

export type LinkInterpretation =
  /** Plain text (a name) — slug is its cleaned form. */
  | { kind: 'text'; slug: string }
  /** Our example link/name copied verbatim — no slug; suggest from the store name. */
  | { kind: 'example'; slug: '' }
  /** One of OUR store links (name.matjar.to) — slug is the name part. */
  | { kind: 'platform'; slug: string }
  /** A storable social page — keep `url`; slug is suggested from the page name. */
  | { kind: 'social'; platform: SocialPlatform; url: string; slug: string }
  /** A WhatsApp link — nothing to keep, no slug to suggest. */
  | { kind: 'whatsapp'; slug: string }
  /** Any other website — slug suggested from its name. */
  | { kind: 'website'; slug: string };

/**
 * Work out what the merchant put in the store-link field and what subdomain
 * to suggest for it. `slug` may be empty when nothing usable can be derived
 * (e.g. a facebook.com/profile.php?id=… link) — callers then fall back to the
 * store name.
 */
export function interpretLinkInput(text: string, platformDomain: string): LinkInterpretation {
  if (!looksLikeLink(text)) {
    const slug = finalizeSubdomain(sanitizeSubdomainTyping(text), platformDomain);
    return EXAMPLE_SLUGS.has(slug) ? { kind: 'example', slug: '' } : { kind: 'text', slug };
  }
  const url = parseUrl(text);
  if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) {
    return { kind: 'text', slug: finalizeSubdomain(sanitizeSubdomainTyping(text), platformDomain) };
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const domain = platformDomain.toLowerCase();

  if (host === domain || host.endsWith(`.${domain}`)) {
    const sub = host === domain ? '' : host.slice(0, -(domain.length + 1)).split('.')[0];
    const slug = slugifyStoreName(sub);
    return !slug || EXAMPLE_SLUGS.has(slug) ? { kind: 'example', slug: '' } : { kind: 'platform', slug };
  }
  for (const platform of Object.keys(SOCIAL_HOSTS) as SocialPlatform[]) {
    if (hostIn(host, SOCIAL_HOSTS[platform])) {
      url.protocol = 'https:';
      url.hash = '';
      return { kind: 'social', platform, url: url.toString(), slug: nameFromPath(url) };
    }
  }
  if (hostIn(host, WHATSAPP_HOSTS)) return { kind: 'whatsapp', slug: '' };
  return { kind: 'website', slug: nameFromHost(host) };
}

/**
 * Text inserted by an input change (prev → next), by stripping the common
 * prefix and suffix. Lets onChange spot a URL inserted by keyboards that
 * don't fire a paste event (e.g. Android clipboard suggestions).
 */
export function insertedText(prev: string, next: string): string {
  let start = 0;
  while (start < prev.length && start < next.length && prev[start] === next[start]) start += 1;
  let end = 0;
  while (
    end < prev.length - start &&
    end < next.length - start &&
    prev[prev.length - 1 - end] === next[next.length - 1 - end]
  ) end += 1;
  return next.slice(start, next.length - end);
}

/** Full public URL for a subdomain on the platform domain. */
export const storeUrlFor = (subdomain: string, platformDomain: string): string =>
  `https://${subdomain}.${platformDomain}`;
