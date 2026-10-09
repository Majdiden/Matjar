/**
 * Store social-media links — normalisation + host allowlist.
 *
 * Merchants routinely paste their Facebook/Instagram page URL where we ask for
 * something else (e.g. the store subdomain at signup). Instead of discarding
 * it, the dashboard recognises it and sends it here so the store's footer can
 * link to it. Every value that reaches `tenant.settings.socialLinks` passes
 * through `normalizeSocialLinks`, which guarantees:
 *
 *   - only known platforms (keys of SOCIAL_PLATFORMS) are stored;
 *   - every URL is absolute `https:` (no `javascript:`/`data:` — themes render
 *     these straight into `href`);
 *   - the host belongs to that platform (a "facebook" link can't point at an
 *     arbitrary site);
 *   - no credentials, no fragments, bounded length.
 *
 * The dashboard mirrors the host list in dashboard/src/lib/storeLink.ts for
 * paste detection — keep the two in sync (same convention as the feature-flag
 * key mirror).
 */

/** Max stored URL length. Real profile URLs are far shorter. */
export const SOCIAL_LINK_MAX_LENGTH = 500;

/**
 * Supported platforms → hosts that belong to them. Subdomains of a listed host
 * (m.facebook.com, web.facebook.com, …) are accepted too.
 */
export const SOCIAL_PLATFORMS = Object.freeze({
  facebook: Object.freeze(["facebook.com", "fb.com", "fb.me"]),
  instagram: Object.freeze(["instagram.com", "instagr.am"]),
  tiktok: Object.freeze(["tiktok.com"]),
  telegram: Object.freeze(["t.me", "telegram.me"]),
  x: Object.freeze(["x.com", "twitter.com"]),
});

export const SOCIAL_PLATFORM_KEYS = Object.freeze(Object.keys(SOCIAL_PLATFORMS));

const hostMatches = (hostname, allowed) =>
  allowed.some((h) => hostname === h || hostname.endsWith(`.${h}`));

/**
 * Normalise one link for a platform. Accepts scheme-less input
 * ("facebook.com/mystore"). Returns the canonical https URL, or null when the
 * value is empty, malformed, too long, or not on the platform's hosts.
 */
export function normalizeSocialLink(platform, raw) {
  const allowed = SOCIAL_PLATFORMS[platform];
  if (!allowed || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > SOCIAL_LINK_MAX_LENGTH) return null;

  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;

  const hostname = url.hostname.toLowerCase();
  if (!hostMatches(hostname, allowed)) return null;

  url.protocol = "https:";
  url.hash = "";
  const out = url.toString();
  return out.length > SOCIAL_LINK_MAX_LENGTH ? null : out;
}

/**
 * Normalise a `{ platform: url }` map. Unknown keys and empty values are
 * dropped. Returns `{ links, invalid }` so callers can decide whether a bad
 * value is an error (API input) or ignorable (legacy data).
 */
export function normalizeSocialLinks(input) {
  const links = {};
  const invalid = [];
  if (!input || typeof input !== "object") return { links, invalid };
  for (const key of SOCIAL_PLATFORM_KEYS) {
    const raw = input[key];
    if (raw == null || (typeof raw === "string" && !raw.trim())) continue;
    const normalized = normalizeSocialLink(key, raw);
    if (normalized) links[key] = normalized;
    else invalid.push(key);
  }
  return { links, invalid };
}

/**
 * Public storefront view: only non-empty, still-valid links, or null when
 * there are none. Themes render every entry they receive, so empty/legacy
 * values must never reach them.
 */
export function publicSocialLinks(stored) {
  const { links } = normalizeSocialLinks(stored);
  return Object.keys(links).length ? links : null;
}
