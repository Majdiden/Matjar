/**
 * Store subdomain rules (utils/subdomain.js) — shared by signup and the
 * availability check. Pins reserved names and the pasted-web-address guard,
 * and that the dashboard's pattern (dashboard/src/lib/storeLink.ts) agrees.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateSubdomain, subdomainLooksLikeLink, RESERVED_SUBDOMAINS } from "../../utils/subdomain.js";
import { slugLooksLikeLink } from "../../dashboard/src/lib/storeLink.ts";

describe("validateSubdomain", () => {
  it("accepts ordinary store names", () => {
    for (const s of ["nile", "nile-perfumes", "mtjr-alshms", "store24"]) assert.equal(validateSubdomain(s).valid, true, s);
  });
  it("rejects bad shapes and reserved platform names", () => {
    for (const s of ["ab", "-nile", "nile-", "Nile", "ni_le"]) assert.equal(validateSubdomain(s).valid, false, s);
    for (const s of ["app", "api", "admin", "www", "platform", "dashboard"]) {
      assert.ok(RESERVED_SUBDOMAINS.includes(s));
      assert.equal(validateSubdomain(s).valid, false, s);
    }
  });
  it("rejects a pasted web address with its punctuation stripped", () => {
    const r = validateSubdomain("httpswwwfacebookcomprofilephpid6157530046005");
    assert.equal(r.valid, false);
    assert.equal(r.code, "SUBDOMAIN_LOOKS_LIKE_LINK");
  });
});

describe("link-like pattern parity (server ⇄ dashboard)", () => {
  it("agrees on every sample", () => {
    const samples = [
      "httpswwwfacebookcomx", "https-www-facebook-com-x", "www-nile-com", "facebook-com-nile", "fb-com-x",
      "wa-me-249", "whatsapp-x", "t-me-nile", "http-nile", "nile", "nile-perfumes", "httpie", "wame", "fbshop", "tme",
    ];
    for (const s of samples) assert.equal(subdomainLooksLikeLink(s), slugLooksLikeLink(s), s);
  });
});
