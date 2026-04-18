import net from "node:net";
import config from "../config/index.js";

/**
 * Hostname normalization + validation for the domain registry.
 *
 * Hostnames enter the system from merchant input (dashboard form),
 * HTTP Host headers, and DNS lookups. Before we compare, store, or
 * resolve them we normalize aggressively:
 *
 *   1. Strip whitespace + trailing dot + URL scheme if someone pasted
 *      a full URL.
 *   2. Drop the port — Host headers carry it, the registry must not.
 *   3. Lowercase ASCII.
 *   4. Punycode IDNs via WHATWG URL (Node's URL parser IDNA-encodes).
 *   5. Reject IP literals (v4 + v6) — you can't have a cert for an IP
 *      in most provider flows and routing-by-IP defeats the multi-
 *      tenant model.
 *   6. Reject reserved TLDs / localhost / single-label for custom
 *      domains. Platform subdomains skip this check because the
 *      *.localhost setup in dev is intentional.
 *   7. Reject hostnames that fall under the platform's own base
 *      domain — a merchant can't claim `admin.matjar.com` as their
 *      custom domain even if DNS would let them.
 */

// RFC 1123 label: 1-63 chars, alnum + hyphen, no leading/trailing hyphen.
const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

// TLDs and suffixes we refuse to register as custom domains. `localhost`
// stays in the list even though dev uses *.localhost subdomains because
// those are created as `platform_subdomain` kind, which bypasses this
// validator.
const RESERVED_SUFFIXES = [
  "localhost",
  "local",
  "internal",
  "localdomain",
  "test",
  "example",
  "invalid",
  "onion",
];

const RESERVED_LABELS = new Set([
  "localhost",
  "broadcasthost",
  "ip6-localhost",
  "ip6-loopback",
]);

/**
 * Normalize a raw hostname string. Returns null on invalid input
 * rather than throwing — callers decide whether to surface an error.
 *
 * Accepts: "Store.Com", "https://store.com/", "store.com:443",
 *          "STÖRE.com", "store.com."
 * Returns: "store.com" | "xn--stre-loa.com" | null
 */
export function normalizeHostname(raw) {
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s) return null;

  // Strip scheme + path if they pasted a URL.
  if (s.includes("://")) {
    try {
      s = new URL(s).host;
    } catch {
      return null;
    }
  }

  // Drop port.
  const colonIdx = s.lastIndexOf(":");
  if (colonIdx !== -1 && !s.startsWith("[")) {
    // Not a v6 bracketed literal — safe to split on last colon.
    s = s.slice(0, colonIdx);
  }

  // Strip trailing dot (DNS root indicator).
  if (s.endsWith(".")) s = s.slice(0, -1);

  if (!s) return null;

  // Punycode IDNs via URL parser. `new URL('http://<host>')` IDNA-encodes
  // the hostname on the .hostname getter, which is the cheapest way to
  // get punycode without pulling in the deprecated `punycode` module.
  let normalized;
  try {
    normalized = new URL(`http://${s}`).hostname;
  } catch {
    return null;
  }

  if (!normalized) return null;
  return normalized.toLowerCase();
}

/**
 * Returns true if the hostname is a literal IPv4 or IPv6 address.
 */
export function isIpLiteral(hostname) {
  if (!hostname) return false;
  // `new URL` wraps IPv6 in brackets on .hostname — strip for `net.isIP`.
  const stripped = hostname.replace(/^\[|\]$/g, "");
  return net.isIP(stripped) !== 0;
}

/**
 * Validate a hostname for use as a *custom* domain (apex or subdomain
 * the merchant controls). Platform subdomains use a separate slug
 * validator in `services/domain.js`.
 *
 * Returns { ok: true, hostname } on success or
 *         { ok: false, reason } on failure.
 */
export function validateCustomDomain(raw) {
  const hostname = normalizeHostname(raw);
  if (!hostname) return { ok: false, reason: "invalid_hostname" };

  if (isIpLiteral(hostname)) {
    return { ok: false, reason: "ip_literal_not_allowed" };
  }

  if (RESERVED_LABELS.has(hostname)) {
    return { ok: false, reason: "reserved_hostname" };
  }

  const labels = hostname.split(".");
  if (labels.length < 2) {
    // Single-label like "foo" — not a real domain.
    return { ok: false, reason: "single_label_not_allowed" };
  }

  for (const label of labels) {
    if (!LABEL_RE.test(label)) {
      return { ok: false, reason: "invalid_label" };
    }
  }

  // Reject hostnames whose TLD is in our reserved suffix list.
  const tld = labels[labels.length - 1];
  if (RESERVED_SUFFIXES.includes(tld)) {
    return { ok: false, reason: "reserved_tld" };
  }

  // Reject any hostname under the platform's own base domain — a
  // merchant trying to register `rogue.matjar.com` as their "custom"
  // domain is either confused or attacking us. Platform subdomains
  // are created via a different code path (`kind: platform_subdomain`).
  const baseDomain = (config.baseDomain || "").toLowerCase();
  if (baseDomain && (hostname === baseDomain || hostname.endsWith(`.${baseDomain}`))) {
    return { ok: false, reason: "platform_domain_not_allowed" };
  }

  // Hostname length cap — RFC 1035 says 255 octets total.
  if (hostname.length > 253) {
    return { ok: false, reason: "hostname_too_long" };
  }

  return { ok: true, hostname };
}

/**
 * Classify a normalized custom hostname as apex or subdomain.
 * Apex = exactly two labels (`store.com`). Anything deeper is a
 * subdomain (`www.store.com`, `shop.eu.store.com`).
 *
 * This is a heuristic — the public-suffix list would be more
 * correct but requires a dependency. Good enough for now since the
 * distinction only affects DNS-instruction wording (A/ALIAS vs
 * CNAME) and the merchant sees the instructions before committing.
 */
export function classifyCustomHostname(hostname) {
  if (!hostname) return null;
  const labels = hostname.split(".");
  return labels.length === 2 ? "custom_apex" : "custom_subdomain";
}
