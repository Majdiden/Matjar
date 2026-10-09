/**
 * Store subdomain rules — shared by signup (services/tenant.js), the
 * availability check and subdomain changes (services/domain.js).
 *
 * Besides DNS-label shape and reserved names, rejects values that are
 * clearly a pasted web address with its punctuation stripped
 * ("httpswwwfacebookcom…", "facebook-com-mystore"): merchants paste their
 * Facebook page into this field. The dashboard catches this first with a
 * friendlier message (dashboard/src/lib/storeLink.ts → slugLooksLikeLink,
 * keep the two patterns in sync); this is the server-side backstop.
 */
export const SUBDOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/;

export const RESERVED_SUBDOMAINS = Object.freeze([
  "www", "api", "admin", "app", "mail", "email", "ftp", "blog", "shop", "store", "help", "support",
  "dev", "staging", "test", "demo", "cdn", "static", "assets", "matjar", "platform", "dashboard",
]);

// Scheme/www leftovers at the start, or a social/messaging host anywhere.
const LINK_LIKE_PATTERN = /^(https?(-|www)|www-)|(facebook|fb|instagram|tiktok|twitter|youtube)-?com|(^|-)wa-me(-|$)|whatsapp|(^|-)t-me-/;

export const subdomainLooksLikeLink = (subdomain) => LINK_LIKE_PATTERN.test(String(subdomain || ""));

export function validateSubdomain(subdomain) {
  if (!SUBDOMAIN_PATTERN.test(subdomain)) {
    return { valid: false, error: "Subdomain must be 3-63 characters, contain only lowercase letters, numbers, and hyphens" };
  }
  if (RESERVED_SUBDOMAINS.includes(subdomain)) return { valid: false, error: "This subdomain is reserved" };
  if (subdomainLooksLikeLink(subdomain)) {
    return { valid: false, code: "SUBDOMAIN_LOOKS_LIKE_LINK", error: "This looks like a web link. Choose a short name for your store instead." };
  }
  return { valid: true };
}
