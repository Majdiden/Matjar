/**
 * Guided onboarding rules (dashboard/src/lib/onboarding.ts, PBI 10-16/10-17):
 * which signup flow runs, the v2 step order, the theme cards offered, and
 * when each "first sale" checklist step counts as done. Dependency-free
 * TypeScript, imported directly via Node's built-in type stripping.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FIRST_SALE_STEP_ROUTES,
  firstSaleSteps,
  isBrandReady,
  FIRST_SALE_STEPS,
  SIGNUP_V2_THEME_LIMIT,
  firstSaleProgress,
  resolveSignupFlow,
  signupSteps,
  themesForNiche,
} from "../../dashboard/src/lib/onboarding.ts";

describe("resolveSignupFlow", () => {
  it("follows the global flag, and fails closed to v1 while it is unknown", () => {
    assert.equal(resolveSignupFlow("", true), "v2");
    assert.equal(resolveSignupFlow("", false), "v1");
    assert.equal(resolveSignupFlow("", null), "v1");
    assert.equal(resolveSignupFlow("", undefined), "v1");
  });

  it("lets ?flow= force either flow, whatever the flag says", () => {
    assert.equal(resolveSignupFlow("?flow=v2", false), "v2");
    assert.equal(resolveSignupFlow("?flow=V2", null), "v2");
    assert.equal(resolveSignupFlow("?flow=v1", true), "v1");
    assert.equal(resolveSignupFlow("?add=1&flow=v2", false), "v2");
  });

  it("ignores an unknown override", () => {
    assert.equal(resolveSignupFlow("?flow=v3", true), "v2");
    assert.equal(resolveSignupFlow("?flow=", false), "v1");
  });
});

describe("signupSteps", () => {
  it("keeps v1 exactly as it was", () => {
    assert.deepEqual([...signupSteps("v1")], ["welcome", "account", "otp", "store", "niche", "theme"]);
  });

  it("asks where the merchant is right before the look in v2", () => {
    assert.deepEqual(
      [...signupSteps("v2")],
      ["welcome", "account", "otp", "store", "niche", "location", "theme"]
    );
  });
});

describe("themesForNiche", () => {
  const themes = [
    { slug: "modern", categories: ["general"] },
    { slug: "boutique", categories: ["fashion"] },
    { slug: "tech", categories: ["electronics"] },
    { slug: "grocer", categories: ["food"] },
    { slug: "atelier", categories: ["fashion", "home"] },
  ];
  const slugs = (list) => list.map((t) => t.slug);

  it("v2: niche themes first, then the rest, at most 3", () => {
    assert.deepEqual(slugs(themesForNiche(themes, "fashion", SIGNUP_V2_THEME_LIMIT)), ["boutique", "atelier", "modern"]);
    assert.deepEqual(slugs(themesForNiche(themes, "books", SIGNUP_V2_THEME_LIMIT)), ["modern", "boutique", "tech"]);
    assert.deepEqual(slugs(themesForNiche(themes, "general", SIGNUP_V2_THEME_LIMIT)), ["modern", "boutique", "tech"]);
    assert.deepEqual(slugs(themesForNiche(themes.slice(0, 2), "food", SIGNUP_V2_THEME_LIMIT)), ["modern", "boutique"]);
  });

  it("v1 (no limit): niche matches only, or everything when none match", () => {
    assert.deepEqual(slugs(themesForNiche(themes, "fashion")), ["boutique", "atelier"]);
    assert.deepEqual(slugs(themesForNiche(themes, "books")), slugs(themes));
    assert.deepEqual(slugs(themesForNiche(themes, "")), slugs(themes));
  });

  it("prefers the platform-managed categoryKeys over raw manifest categories", () => {
    const managed = [
      { slug: "glow", categories: ["cosmetics"], categoryKeys: ["beauty"] },
      { slug: "plain", categories: ["beauty"], categoryKeys: [] },
      { slug: "old", categories: ["beauty"] },
    ];
    assert.deepEqual(slugs(themesForNiche(managed, "beauty")), ["glow", "old"]);
    assert.deepEqual(slugs(themesForNiche(managed, "beauty", SIGNUP_V2_THEME_LIMIT)), ["glow", "old", "plain"]);
  });
});

describe("firstSaleProgress", () => {
  const base = { productCount: 0, brandReady: false, policiesReady: false, sharedAt: null };
  const at = "2026-10-09T12:00:00.000Z";

  it("starts at 0 of 4 with the first product as the current step", () => {
    const p = firstSaleProgress(base);
    assert.deepEqual(p.done, { product: false, brand: false, policies: false, share: false });
    assert.equal(p.doneCount, 0);
    assert.equal(p.total, 4);
    assert.equal(p.complete, false);
    assert.equal(p.current, "product");
    assert.deepEqual([...FIRST_SALE_STEPS], ["product", "brand", "policies", "share"]);
  });

  it("has no payment step (cash on delivery is on by default)", () => {
    assert.ok(!FIRST_SALE_STEPS.includes("payments"));
  });

  it("product, then logo and cover, then delivery and returns, then share", () => {
    assert.equal(firstSaleProgress({ ...base, productCount: 1 }).current, "brand");
    assert.equal(firstSaleProgress({ ...base, productCount: 1, brandReady: true }).current, "policies");
    assert.equal(firstSaleProgress({ ...base, productCount: 1, brandReady: true, policiesReady: true }).current, "share");
    const p = firstSaleProgress({ productCount: 4, brandReady: true, policiesReady: true, sharedAt: at });
    assert.equal(p.complete, true);
    assert.equal(p.current, null);
  });

  it("leaves out the My Store steps for stores without the My Store screens", () => {
    const steps = firstSaleSteps({ myStore: false });
    assert.deepEqual(steps, ["product", "share"]);
    const p = firstSaleProgress({ ...base, productCount: 1 }, steps);
    assert.equal(p.total, 2);
    assert.equal(p.current, "share");
    assert.equal(firstSaleProgress({ ...base, productCount: 1, sharedAt: at }, steps).complete, true);
  });

  it("the current step skips steps already done out of order", () => {
    const p = firstSaleProgress({ ...base, sharedAt: at, productCount: 2 });
    assert.equal(p.current, "brand");
    assert.equal(p.doneCount, 2);
  });

  it("logo and cover needs the logo, the cover photo and the Arabic tagline", () => {
    const full = { logo: "/uploads/l.png", brand: { coverImage: "/uploads/c.jpg", tagline: { ar: "عطور أصلية" } } };
    assert.equal(isBrandReady(full), true);
    assert.equal(isBrandReady(null), false);
    assert.equal(isBrandReady({ ...full, logo: null }), false);
    assert.equal(isBrandReady({ ...full, brand: { ...full.brand, coverImage: null } }), false);
    assert.equal(isBrandReady({ ...full, brand: { ...full.brand, tagline: { ar: "  " } } }), false);
    assert.equal(isBrandReady({ ...full, brand: { ...full.brand, tagline: null } }), false);
  });

  it("every step that opens a page has a route", () => {
    assert.equal(FIRST_SALE_STEP_ROUTES.product, "/dashboard/products/quick");
    assert.equal(FIRST_SALE_STEP_ROUTES.brand, "/dashboard/store/brand");
    assert.equal(FIRST_SALE_STEP_ROUTES.policies, "/dashboard/store/policies");
    assert.equal(FIRST_SALE_STEP_ROUTES.share, null);
  });
});
