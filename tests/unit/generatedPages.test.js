/**
 * Generated store pages (PBI 10 — 10-9, 10-11): the pure templates in
 * services/generatedPages.js and the storefront payload keys they add.
 *
 * Pins: Arabic is always written and English only from English answers;
 * missing optional answers drop their sentence instead of leaving gaps;
 * merchant input can never inject markup (XSS); Arabic counted nouns read
 * naturally; and a store that never answered gets exactly the old payload.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ABOUT_TEMPLATES,
  ARABIC_REQUIRED,
  aboutLanguages,
  buildAboutPage,
  buildPolicies,
  contentHash,
  escapeHtml,
  formatDays,
  normalizeAboutAnswers,
  normalizeAnswerText,
  normalizePolicyAnswers,
  publicTrust,
  summarizePaymentMethods,
  summarizeZones,
  summarizeShipping,
} from "../../services/generatedPages.js";
import { buildStoreInfo } from "../../services/storefrontStoreInfo.js";

const XSS = `<script>alert(1)</script><img src=x onerror="alert(2)"><a href="javascript:alert(3)">x</a>`;

const assertNoActiveMarkup = (html) => {
  assert.ok(!/<script/i.test(html), `no <script> in ${html}`);
  assert.ok(!/<img[^>]*onerror/i.test(html), "no event handlers");
  assert.ok(!/<a[^>]*javascript:/i.test(html), "no javascript: links");
};

describe("About page generator", () => {
  const full = normalizeAboutAnswers(
    {
      products: { ar: "ملابس نسائية", en: "women's clothes" },
      since: "2019",
      city: { ar: "أم درمان", en: "Omdurman" },
      different: { ar: "نخيط كل قطعة بأيدينا.\n\nونوصلها بسرعة." },
      photo: "/uploads/about/shop.jpg",
    },
    { now: new Date("2026-10-09") }
  );

  it("writes Arabic from every answer", () => {
    const { title, content } = buildAboutPage(full, { lang: "ar", storeName: "متجر سلمى" });
    assert.equal(title, ABOUT_TEMPLATES.ar.title);
    assert.match(content, /<img src="\/uploads\/about\/shop.jpg" alt="متجر سلمى"/);
    assert.match(content, /أهلًا بك في متجر سلمى. نبيع ملابس نسائية./);
    assert.match(content, /بدأنا عملنا عام 2019/);
    assert.match(content, /نحن في أم درمان./);
    assert.match(content, /<h2>ما يميزنا<\/h2><p>نخيط كل قطعة بأيدينا.<\/p><p>ونوصلها بسرعة.<\/p>/);
  });

  it("writes English only from English answers, never mixing languages", () => {
    assert.deepEqual(aboutLanguages(full), ["ar", "en"]);
    const { title, content } = buildAboutPage(full, { lang: "en", storeName: "Salma" });
    assert.equal(title, "About us");
    assert.match(content, /We sell women&#39;s clothes|We sell women's clothes/);
    assert.match(content, /We are based in Omdurman./);
    assert.ok(!/[؀-ۿ]/.test(content), "no Arabic text in the English page");
    assert.ok(!content.includes("What makes us different"), "untranslated answer is left out");
    assert.deepEqual(aboutLanguages(normalizeAboutAnswers({ products: { ar: "عطور" } })), ["ar"]);
  });

  it("drops sentences for missing optional answers", () => {
    const minimal = normalizeAboutAnswers({ products: { ar: "عطور" } });
    assert.deepEqual(minimal, { products: { ar: "عطور" } });
    const { content } = buildAboutPage(minimal, { lang: "ar", storeName: "" });
    assert.match(content, /أهلًا بك في متجرنا. نبيع عطور./);
    assert.ok(!content.includes("<img"));
    assert.ok(!content.includes("بدأنا"));
    assert.ok(!content.includes("ما يميزنا"));
    assert.ok(!/\{\w+\}/.test(content), "no unfilled template slots");
  });

  it("escapes merchant input everywhere it lands", () => {
    const answers = normalizeAboutAnswers({
      products: { ar: XSS, en: XSS },
      city: { ar: "<b onclick=x>" },
      different: { ar: XSS },
    });
    for (const lang of ["ar", "en"]) {
      const { content } = buildAboutPage(answers, { lang, storeName: `"><script>x</script>` });
      assertNoActiveMarkup(content);
      assert.match(content, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    }
  });

  it("rejects bad answers", () => {
    const now = { now: new Date("2026-10-09") };
    assert.throws(() => normalizeAboutAnswers({}, now), /products: is required/);
    assert.throws(() => normalizeAboutAnswers({ products: { en: "only English" } }, now), /Arabic/);
    assert.throws(() => normalizeAboutAnswers({ products: { ar: "x" }, since: 2027 }, now), /since/);
    assert.throws(() => normalizeAboutAnswers({ products: { ar: "x" }, since: "19x9" }, now), /since/);
    assert.throws(() => normalizeAboutAnswers({ products: { ar: "x" }, photo: "javascript:alert(1)" }, now), /photo/);
    assert.throws(() => normalizeAboutAnswers({ products: { ar: "x" }, photo: "data:image/png;base64,AA" }, now), /photo/);
    assert.throws(() => normalizeAboutAnswers({ products: { ar: "x".repeat(201) } }, now), /products/);
  });
});

describe("policy generator", () => {
  const answers = normalizePolicyAnswers({
    delivery: { areas: { ar: "الخرطوم", en: "Khartoum" }, fee: { ar: "مجانًا فوق ١٠ آلاف" }, time: { ar: "يومين" } },
    returns: { accepted: true, days: 14, conditions: { ar: "المنتج بحالته الأصلية" } },
  });
  const payment = summarizePaymentMethods([
    { type: "cod", code: "cod" },
    {
      type: "manual",
      code: "manual-transfer",
      providers: [
        { code: "bankak", label: "Bankak", enabled: true, accountNumber: "1" },
        { code: "ocash", label: "OCash", enabled: false, accountNumber: "2" },
        { code: "mymoney", label: "My Money", enabled: true, phone: "0912" },
      ],
    },
  ]);

  it("summarises only the payment methods a customer can use", () => {
    assert.deepEqual(payment, {
      cod: true,
      transfers: [
        { code: "bankak", label: "Bankak" },
        { code: "mymoney", label: "My Money" },
      ],
    });
  });

  it("writes Arabic delivery, returns and payment policies", () => {
    const p = buildPolicies(answers, { lang: "ar", payment, currency: "SDG", shipping: { mode: "flat", price: 2000 } });
    assert.equal(p.delivery.title, "التوصيل");
    assert.match(p.delivery.body, /نوصل إلى: الخرطوم./);
    assert.match(p.delivery.body, /رسوم التوصيل: 2,000 SDG./);
    assert.doesNotMatch(p.delivery.body, /١٠ آلاف/, "a typed fee answer is ignored: prices come from the shipping settings");
    assert.match(p.delivery.body, /يصلك طلبك عادةً خلال يومين./);
    assert.match(p.returns.body, /خلال 14 يومًا من استلامه/);
    assert.match(p.returns.body, /<h2>الشروط<\/h2><p>المنتج بحالته الأصلية<\/p>/);
    assert.match(p.cod.body, /نقدًا عند استلام الطلب/);
    assert.match(p.cod.body, /تحويل عبر بنكك/);
    assert.match(p.cod.body, /تحويل عبر My Money/, "unknown providers keep their own label");
  });

  it("writes English and falls back to the Arabic answer for untranslated text", () => {
    const p = buildPolicies(answers, { lang: "en", payment, currency: "SDG" });
    assert.match(p.delivery.body, /We deliver to: Khartoum./);
    assert.match(p.delivery.body, /arrives within يومين/);
    assert.match(p.returns.body, /within 14 days of receiving it/);
    assert.match(p.cod.body, /Transfer with Bankak/);
  });

  it("leaves untranslated answers out of the other language's copy", () => {
    const p = buildPolicies(answers, { lang: "en", fallback: false, payment, currency: "SDG" });
    assert.match(p.delivery.body, /We deliver to: Khartoum./, "the English answer is kept");
    assert.doesNotMatch(p.delivery.body, /يومين|arrives within/, "no Arabic inside English");
    assert.match(p.returns.body, /within 14 days of receiving it/);
  });

  it("lists shipping zones with their lowest price and estimate", () => {
    const zones = summarizeZones([
      { name: "بحري", rates: [{ price: 3000, estimatedDays: "3 أيام" }, { price: 2000, estimatedDays: "يومين" }] },
      { name: "المدينة", rates: [{ price: 0 }] },
      { name: "  ", rates: [{ price: 1 }] },
    ]);
    assert.deepEqual(zones, [
      { name: "بحري", price: 2000, days: "يومين" },
      { name: "المدينة", price: 0, days: null },
    ]);
    const p = buildPolicies(normalizePolicyAnswers({ delivery: { time: "يوم" }, returns: { accepted: false } }, { hasZones: true }), {
      lang: "ar",
      shipping: { mode: "zones", zones },
      currency: "SDG",
    });
    assert.match(p.delivery.body, /<li>بحري: 2,000 SDG، خلال يومين<\/li><li>المدينة: مجانًا<\/li>/);
    assert.match(p.returns.body, /لا نقبل إرجاع المنتجات/);
    assert.equal(p.cod, undefined, "no payment policy without payment methods");
  });

  it("reads delivery prices from the shipping settings like checkout does", () => {
    assert.deepEqual(summarizeShipping(undefined), { mode: "unset" });
    assert.deepEqual(summarizeShipping({ type: "flat", rate: 0 }), { mode: "unset" }, "the default flat 0 means not set");
    assert.deepEqual(summarizeShipping({ type: "flat", rate: 2000, freeShippingThreshold: 50000 }), { mode: "flat", price: 2000, freeOver: 50000 });
    assert.deepEqual(summarizeShipping({ type: "free", rate: 9 }), { mode: "free" });
    assert.deepEqual(summarizeShipping({ type: "weight", baseRate: 1000, perKgRate: 200 }), { mode: "weight", base: 1000, perKg: 200 });
    assert.deepEqual(summarizeShipping({ type: "zone", rate: 1500, zones: [] }), { mode: "flat", price: 1500 }, "zone shipping without zones charges the flat rate");
    assert.deepEqual(summarizeShipping({ type: "flat", rate: 1000, zones: [{ name: "بحري", rates: [{ price: 1 }] }] }), { mode: "flat", price: 1000 }, "zones are ignored unless zone shipping is on");
    assert.equal(summarizeShipping({ type: "zone", zones: [{ name: "بحري", rates: [{ price: 3000 }] }] }).mode, "zones");

    const base = normalizePolicyAnswers({ delivery: { areas: "x", time: "يوم" }, returns: { accepted: false } });
    const body = (shipping, lang = "ar") => buildPolicies(base, { lang, shipping, currency: "SDG" }).delivery.body;
    assert.match(body({ mode: "free" }), /التوصيل مجاني./);
    assert.match(body({ mode: "flat", price: 2000, freeOver: 50000 }), /رسوم التوصيل: 2,000 SDG.<\/p><p>التوصيل مجاني للطلبات من 50,000 SDG فأكثر./);
    assert.match(body({ mode: "weight", base: 1000, perKg: 200 }, "en"), /Delivery costs 1,000 SDG, plus 200 SDG per kilogram./);
    assert.doesNotMatch(body({ mode: "unset" }), /رسوم|مجاني/, "nothing about price until it is set");
  });

  it("escapes merchant input in every policy", () => {
    const evil = normalizePolicyAnswers({
      delivery: { areas: { ar: XSS }, fee: { ar: XSS }, time: { ar: XSS } },
      returns: { accepted: true, days: 3, conditions: { ar: XSS } },
    });
    const p = buildPolicies(evil, {
      lang: "ar",
      shipping: { mode: "zones", zones: summarizeZones([{ name: XSS, rates: [{ price: 5, estimatedDays: XSS }] }]) },
      payment: { cod: false, transfers: [{ code: "x", label: XSS }] },
      currency: `<b>SDG</b>`,
    });
    for (const key of ["delivery", "returns", "cod"]) assertNoActiveMarkup(p[key].body);
  });

  it("validates the answers", () => {
    assert.throws(() => normalizePolicyAnswers({ delivery: { time: "x" }, returns: { accepted: false } }), /areas: is required/);
    assert.doesNotThrow(() => normalizePolicyAnswers({ delivery: { time: "x" }, returns: { accepted: false } }, { hasZones: true }));
    assert.throws(() => normalizePolicyAnswers({ delivery: { areas: "x" }, returns: { accepted: false } }), /time: is required/);
    assert.throws(() => normalizePolicyAnswers({ delivery: { areas: "x", time: "y" }, returns: {} }), /returns.accepted/);
    assert.throws(() => normalizePolicyAnswers({ delivery: { areas: "x", time: "y" }, returns: { accepted: true, days: 0 } }), /returns.days/);
    assert.throws(() => normalizePolicyAnswers({ delivery: { areas: "x", time: "y" }, returns: { accepted: true, days: 91 } }), /returns.days/);
    // A "no returns" answer drops a stale day count.
    assert.deepEqual(
      normalizePolicyAnswers({ delivery: { areas: "x", time: "y" }, returns: { accepted: false, days: 5 } }).returns,
      { accepted: false }
    );
  });
});

describe("helpers", () => {
  it("words day counts the way Arabic counts them", () => {
    assert.deepEqual([1, 2, 3, 10, 11, 30].map((n) => formatDays(n, "ar")), [
      "يوم واحد", "يومين", "3 أيام", "10 أيام", "11 يومًا", "30 يومًا",
    ]);
    assert.deepEqual([1, 2].map((n) => formatDays(n, "en")), ["1 day", "2 days"]);
  });

  it("normalises bilingual answers", () => {
    assert.deepEqual(normalizeAnswerText("  نص  ", 10), { value: { ar: "نص" }, error: null });
    assert.deepEqual(normalizeAnswerText({ ar: " ", en: "" }, 10), { value: null, error: null });
    assert.equal(normalizeAnswerText({ en: "only" }, 10).error, ARABIC_REQUIRED);
    assert.equal(normalizeAnswerText({ ar: "x".repeat(11) }, 10).error, "ar");
    assert.equal(normalizeAnswerText(["x"], 10).error, "invalid");
  });

  it("escapes HTML and hashes deterministically", () => {
    assert.equal(escapeHtml(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
    assert.equal(contentHash("<p>a</p>"), contentHash("<p>a</p>"));
    assert.notEqual(contentHash("<p>a</p>"), contentHash("<p>b</p>"));
  });
});

describe("storefront payload", () => {
  const baseTenant = () => ({
    name: "Nile",
    settings: { storeName: "Nile", currency: "SDG", activeTheme: "modern", shipping: { zones: [] } },
  });

  it("adds nothing for a store that never answered (exactly as before)", () => {
    const s = buildStoreInfo(baseTenant());
    assert.equal("generatedPages" in s, false);
    assert.equal("trust" in s, false);
    assert.deepEqual(Object.keys(s), [
      "name", "description", "logo", "favicon", "currency", "theme", "themeCustomization",
      "socialLinks", "brand", "contactInfo", "contact", "policies", "giftCards",
    ]);
    // An explicit "off" switch and empty answer objects are the same as never set.
    const t = baseTenant();
    t.settings.generatedPages = { contact: false };
    t.settings.policyAnswers = { delivery: {}, returns: {} };
    assert.deepEqual(buildStoreInfo(t), s);
  });

  it("exposes the contact switch and trust facts once used", () => {
    const t = baseTenant();
    t.settings.generatedPages = { contact: true };
    t.settings.shipping.zones = [{ name: "الخرطوم", rates: [{ price: 1000 }] }];
    t.settings.policyAnswers = {
      delivery: { time: { ar: "يومين" } },
      returns: { accepted: true, days: 7 },
      generatedAt: new Date("2026-10-09"),
    };
    const s = buildStoreInfo(t);
    assert.deepEqual(s.generatedPages, { contact: true });
    assert.deepEqual(s.trust, {
      payments: true,
      delivery: { zones: ["الخرطوم"], time: { ar: "يومين" } },
      returns: { days: 7 },
    });
  });

  it("only exposes a returns window when returns are accepted", () => {
    assert.deepEqual(
      publicTrust({ generatedAt: new Date(), returns: { accepted: false, days: 7 } }),
      { payments: true }
    );
    assert.equal(publicTrust(null), null);
    // Signup v2 areas alone (no generatedAt) show no badges; once answered
    // they are read from the shared `deliveryAreas` path.
    assert.equal(publicTrust({ deliveryAreas: { ar: "الخرطوم" } }), null);
    assert.deepEqual(
      publicTrust({ deliveryAreas: { ar: "الخرطوم" }, generatedAt: new Date(), returns: { accepted: false } }),
      { payments: true, delivery: { areas: { ar: "الخرطوم" } } }
    );
  });
});
