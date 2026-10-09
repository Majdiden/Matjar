/**
 * Guided onboarding rules (dashboard/src/lib/onboarding.ts, PBI 10-16/10-17):
 * which signup flow runs, the v2 step order, the theme cards offered, and
 * when each "first sale" checklist step counts as done. Dependency-free
 * TypeScript, imported directly via Node's built-in type stripping.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  COD_METHOD_CODE,
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
});

describe("firstSaleProgress", () => {
  const base = { productCount: 0, enabledPaymentCodes: [COD_METHOD_CODE], paymentsReviewedAt: null, sharedAt: null };
  const at = "2026-10-09T12:00:00.000Z";

  it("starts at 0 of 3 with the first product as the current step", () => {
    const p = firstSaleProgress(base);
    assert.deepEqual(p.done, { product: false, payments: false, share: false });
    assert.equal(p.doneCount, 0);
    assert.equal(p.total, 3);
    assert.equal(p.complete, false);
    assert.equal(p.current, "product");
    assert.deepEqual([...FIRST_SALE_STEPS], ["product", "payments", "share"]);
  });

  it("product: done with at least one product", () => {
    const p = firstSaleProgress({ ...base, productCount: 1 });
    assert.equal(p.done.product, true);
    assert.equal(p.doneCount, 1);
    assert.equal(p.current, "payments");
  });

  it("payments: COD alone is not done until the merchant has reviewed it", () => {
    assert.equal(firstSaleProgress(base).done.payments, false);
    assert.equal(firstSaleProgress({ ...base, paymentsReviewedAt: at }).done.payments, true);
  });

  it("payments: switching on another method (e.g. Bankak transfer) counts as set up", () => {
    const p = firstSaleProgress({ ...base, enabledPaymentCodes: ["cod", "manual-transfer"] });
    assert.equal(p.done.payments, true);
    assert.equal(firstSaleProgress({ ...base, enabledPaymentCodes: ["manual-transfer"] }).done.payments, true);
  });

  it("payments: never done when every method is switched off, even if reviewed", () => {
    assert.equal(firstSaleProgress({ ...base, enabledPaymentCodes: [], paymentsReviewedAt: at }).done.payments, false);
  });

  it("payments: with the methods unknown (feature off) COD is assumed on, so reviewing is enough", () => {
    assert.equal(firstSaleProgress({ ...base, enabledPaymentCodes: null }).done.payments, false);
    assert.equal(firstSaleProgress({ ...base, enabledPaymentCodes: null, paymentsReviewedAt: at }).done.payments, true);
  });

  it("share: done once the merchant has tapped Share; all three → complete", () => {
    const p = firstSaleProgress({ productCount: 4, enabledPaymentCodes: ["cod"], paymentsReviewedAt: at, sharedAt: at });
    assert.equal(p.done.share, true);
    assert.equal(p.doneCount, 3);
    assert.equal(p.complete, true);
    assert.equal(p.current, null);
  });

  it("the current step skips steps already done out of order", () => {
    const p = firstSaleProgress({ ...base, sharedAt: at, productCount: 2 });
    assert.equal(p.current, "payments");
    assert.equal(p.doneCount, 2);
  });
});
