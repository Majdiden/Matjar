/**
 * Store social links (utils/socialLinks.js) — the only path into
 * `tenant.settings.socialLinks`, which every theme renders straight into an
 * `href`. Pins the security contract: https-only, per-platform host
 * allowlist, no credentials, bounded length, and empty values never reach
 * the storefront.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSocialLink,
  normalizeSocialLinks,
  publicSocialLinks,
  SOCIAL_LINK_MAX_LENGTH,
} from "../../utils/socialLinks.js";

describe("normalizeSocialLink", () => {
  it("accepts platform URLs and canonicalises them to https without a fragment", () => {
    assert.equal(normalizeSocialLink("facebook", "https://www.facebook.com/nilestore"), "https://www.facebook.com/nilestore");
    assert.equal(normalizeSocialLink("facebook", "http://m.facebook.com/nilestore#about"), "https://m.facebook.com/nilestore");
    assert.equal(normalizeSocialLink("instagram", "instagram.com/nile.store"), "https://instagram.com/nile.store");
    assert.equal(normalizeSocialLink("telegram", "  t.me/nilestore  "), "https://t.me/nilestore");
    assert.equal(normalizeSocialLink("x", "twitter.com/nile"), "https://twitter.com/nile");
  });

  it("keeps profile.php query ids (common for Facebook pages without a username)", () => {
    assert.equal(
      normalizeSocialLink("facebook", "https://www.facebook.com/profile.php?id=1000123"),
      "https://www.facebook.com/profile.php?id=1000123",
    );
  });

  it("rejects dangerous schemes", () => {
    assert.equal(normalizeSocialLink("facebook", "javascript:alert(1)//facebook.com"), null);
    assert.equal(normalizeSocialLink("facebook", "data:text/html,facebook.com"), null);
    assert.equal(normalizeSocialLink("facebook", "ftp://facebook.com/x"), null);
  });

  it("rejects hosts that only look like the platform", () => {
    assert.equal(normalizeSocialLink("facebook", "https://facebook.com.evil.example/x"), null);
    assert.equal(normalizeSocialLink("facebook", "https://notfacebook.com/x"), null);
    assert.equal(normalizeSocialLink("facebook", "https://instagram.com/x"), null);
  });

  it("rejects credentials, unknown platforms, non-strings and oversize input", () => {
    assert.equal(normalizeSocialLink("facebook", "https://user:pw@facebook.com/x"), null);
    assert.equal(normalizeSocialLink("myspace", "https://myspace.com/x"), null);
    assert.equal(normalizeSocialLink("facebook", 42), null);
    assert.equal(normalizeSocialLink("facebook", ""), null);
    assert.equal(normalizeSocialLink("facebook", `https://facebook.com/${"a".repeat(SOCIAL_LINK_MAX_LENGTH)}`), null);
  });
});

describe("normalizeSocialLinks", () => {
  it("drops unknown keys and empty values, and reports invalid ones", () => {
    const { links, invalid } = normalizeSocialLinks({
      facebook: "facebook.com/nile",
      instagram: "",
      tiktok: "https://evil.example/x",
      myspace: "https://myspace.com/x",
    });
    assert.deepEqual(links, { facebook: "https://facebook.com/nile" });
    assert.deepEqual(invalid, ["tiktok"]);
  });

  it("treats missing or non-object input as empty", () => {
    assert.deepEqual(normalizeSocialLinks(undefined), { links: {}, invalid: [] });
    assert.deepEqual(normalizeSocialLinks("facebook.com/x"), { links: {}, invalid: [] });
  });
});

describe("publicSocialLinks", () => {
  it("returns null when nothing valid is stored (themes then render no social row)", () => {
    assert.equal(publicSocialLinks(undefined), null);
    assert.equal(publicSocialLinks({ facebook: null, instagram: "" }), null);
  });

  it("filters out legacy invalid values instead of passing them to themes", () => {
    assert.deepEqual(
      publicSocialLinks({ facebook: "https://facebook.com/nile", x: "javascript:alert(1)" }),
      { facebook: "https://facebook.com/nile" },
    );
  });
});
