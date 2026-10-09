/**
 * Generated store pages (PBI 10 — tasks 10-9 and 10-11). Pure: no DB.
 *
 * A first-time merchant answers a few short questions and we write the
 * About page and the delivery / returns / payment policies for them, in
 * Arabic (always) and English (only when they gave English answers). The
 * answers are stored next to the output (Page.generator for About,
 * tenant.settings.policyAnswers for policies) so the text can be rebuilt.
 *
 * Every merchant answer is HTML-escaped before it goes into a template, and
 * the finished HTML still goes through the same sanitiser as hand-written
 * content (utils/sanitizePageHtml.js for pages, the policy sanitiser for
 * policies) — the templates are trusted, the answers never are.
 *
 * Copy rule (PRD): plain, natural standard Arabic written for its meaning,
 * never a word-for-word translation of the English, and plain English.
 */
import crypto from "node:crypto";
import sanitizeHtml from "sanitize-html";
import { normalizeBrandImageUrl } from "../utils/brandKit.js";
import { sanitizePageHtml } from "../utils/sanitizePageHtml.js";

/** Output languages. Arabic is always written; English only from English answers. */
export const GENERATED_LANGS = Object.freeze(["ar", "en"]);
export const PRIMARY_LANG = "ar";

/** Answer field → max length per language (after trimming). */
export const ABOUT_TEXT_MAX_LENGTH = Object.freeze({
  products: 200,
  city: 80,
  different: 600,
});

export const POLICY_TEXT_MAX_LENGTH = Object.freeze({
  areas: 300,
  fee: 200,
  time: 100,
  conditions: 600,
});

/** Oldest "since" year we accept; the newest is the current year. */
export const ABOUT_MIN_YEAR = 1900;
/** Return window bounds, in days. */
export const RETURN_DAYS_MIN = 1;
export const RETURN_DAYS_MAX = 90;

/** Generator kinds stored on Page.generator.kind. */
export const GENERATOR_KIND = Object.freeze({ about: "about" });

/** The policies this generator writes (settings.policies.<key>). Privacy is left to the merchant. */
export const GENERATED_POLICY_KEYS = Object.freeze(["delivery", "returns", "cod"]);

/**
 * Display names of the manual-transfer providers seeded by
 * config/paymentIntegrations.js. A provider not listed here keeps the label
 * the merchant's store has for it.
 */
export const TRANSFER_PROVIDER_NAMES = Object.freeze({
  ar: Object.freeze({ bankak: "بنكك", fawry: "فوري", ocash: "أوكاش", bravo: "برافو", cashi: "كاشي" }),
  en: Object.freeze({ bankak: "Bankak", fawry: "Fawry", ocash: "OCash", bravo: "Bravo", cashi: "Cashi" }),
});

// ─── Templates ───────────────────────────────────────────────────────────────
//
// `{name}`-style slots are filled with already-escaped values by `fill`.
// A sentence whose answer is missing is left out entirely.

export const ABOUT_TEMPLATES = Object.freeze({
  ar: Object.freeze({
    title: "من نحن",
    welcome: "<p>أهلًا بك في {store}. نبيع {products}.</p>",
    since: "<p>بدأنا عملنا عام {year}، ومنذ ذلك الحين نحرص على أن يصلك كل طلب كما تحب.</p>",
    city: "<p>نحن في {city}.</p>",
    differentHeading: "<h2>ما يميزنا</h2>",
    closing: "<p>يسعدنا تواصلك معنا في أي وقت.</p>",
  }),
  en: Object.freeze({
    title: "About us",
    welcome: "<p>Welcome to {store}. We sell {products}.</p>",
    since: "<p>We started in {year}, and since then we have made sure every order reaches you the way you want it.</p>",
    city: "<p>We are based in {city}.</p>",
    differentHeading: "<h2>What makes us different</h2>",
    closing: "<p>We are always happy to hear from you.</p>",
  }),
});

export const POLICY_TEMPLATES = Object.freeze({
  ar: Object.freeze({
    delivery: Object.freeze({
      title: "التوصيل",
      zonesIntro: "<p>نوصل الطلبات إلى هذه المناطق:</p>",
      zoneLine: "<li>{zone}: {price}</li>",
      zoneLineWithDays: "<li>{zone}: {price}، خلال {days}</li>",
      free: "مجانًا",
      areas: "<p>نوصل إلى: {areas}.</p>",
      fee: "<p>رسوم التوصيل: {fee}.</p>",
      freeAll: "<p>التوصيل مجاني.</p>",
      freeOver: "<p>التوصيل مجاني للطلبات من {amount} فأكثر.</p>",
      weight: "<p>رسوم التوصيل {base}، وتزيد {perKg} لكل كيلوغرام.</p>",
      time: "<p>يصلك طلبك عادةً خلال {time}.</p>",
      closing: "<p>إذا كان لديك سؤال عن التوصيل، تواصل معنا ويسعدنا مساعدتك.</p>",
    }),
    returns: Object.freeze({
      title: "الإرجاع والاستبدال",
      accepted: "<p>يمكنك إرجاع المنتج أو استبداله خلال {days} من استلامه.</p>",
      conditionsHeading: "<h2>الشروط</h2>",
      how: "<p>للإرجاع أو الاستبدال، تواصل معنا وأرسل رقم طلبك.</p>",
      notAccepted:
        "<p>لا نقبل إرجاع المنتجات بعد استلامها. تأكد من طلبك قبل إتمامه، ويسعدنا الرد على أسئلتك قبل الشراء.</p>",
    }),
    cod: Object.freeze({
      title: "طرق الدفع",
      intro: "<p>يمكنك الدفع بإحدى هذه الطرق:</p>",
      codItem: "<li>نقدًا عند استلام الطلب</li>",
      transferItem: "<li>تحويل عبر {provider}</li>",
      codNote: "<p>عند الدفع نقدًا، جهّز المبلغ كاملًا عند وصول الطلب.</p>",
      transferNote:
        "<p>عند الدفع بالتحويل، تظهر لك بيانات الحساب عند إتمام الطلب، ثم ترفع صورة الإيصال.</p>",
    }),
  }),
  en: Object.freeze({
    delivery: Object.freeze({
      title: "Delivery",
      zonesIntro: "<p>We deliver to these areas:</p>",
      zoneLine: "<li>{zone}: {price}</li>",
      zoneLineWithDays: "<li>{zone}: {price}, within {days}</li>",
      free: "free",
      areas: "<p>We deliver to: {areas}.</p>",
      fee: "<p>Delivery fee: {fee}.</p>",
      freeAll: "<p>Delivery is free.</p>",
      freeOver: "<p>Delivery is free on orders of {amount} or more.</p>",
      weight: "<p>Delivery costs {base}, plus {perKg} per kilogram.</p>",
      time: "<p>Your order usually arrives within {time}.</p>",
      closing: "<p>If you have a question about delivery, contact us and we will be glad to help.</p>",
    }),
    returns: Object.freeze({
      title: "Returns and exchanges",
      accepted: "<p>You can return or exchange an item within {days} of receiving it.</p>",
      conditionsHeading: "<h2>Conditions</h2>",
      how: "<p>To return or exchange an item, contact us with your order number.</p>",
      notAccepted:
        "<p>We do not accept returns once an order is delivered. Please check your order before you place it — we are happy to answer your questions before you buy.</p>",
    }),
    cod: Object.freeze({
      title: "Payment methods",
      intro: "<p>You can pay in any of these ways:</p>",
      codItem: "<li>Cash when your order arrives</li>",
      transferItem: "<li>Transfer with {provider}</li>",
      codNote: "<p>If you pay cash, please have the full amount ready when your order arrives.</p>",
      transferNote:
        "<p>If you pay by transfer, you will see the account details when you place your order, then upload a photo of the receipt.</p>",
    }),
  }),
});

// Same rules as the policy bodies written through controllers/settings.js
// (kept in sync by hand: that file owns the bulk settings PUT).
const POLICY_SANITIZE_OPTIONS = {
  allowedTags: [
    "p", "br", "strong", "b", "em", "i", "u", "s", "blockquote",
    "ul", "ol", "li", "h1", "h2", "h3", "h4", "a", "span", "hr",
  ],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
  },
};

export const sanitizeGeneratedPolicy = (html) =>
  sanitizeHtml(String(html ?? ""), POLICY_SANITIZE_OPTIONS).trim();

// ─── Helpers ─────────────────────────────────────────────────────────────────

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escape merchant text for HTML text and attribute positions. */
export const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

/** Replace `{slot}` markers with the given (already escaped) values. */
const fill = (template, values) =>
  template.replace(/\{(\w+)\}/g, (m, key) => (values[key] !== undefined ? values[key] : m));

/** Free text → escaped paragraphs; blank lines split paragraphs, single newlines become <br>. */
const paragraphs = (text) =>
  String(text)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

const isBlank = (v) => v == null || (typeof v === "string" && !v.trim());

/** `normalizeAnswerText` error: English was given without Arabic. */
export const ARABIC_REQUIRED = "arabic_required";

/**
 * Normalise one `{ ar, en }` answer (a plain string counts as Arabic).
 * Returns `{ value, error }`: value is null when empty; error is
 * ARABIC_REQUIRED when only English was given, the language ("ar"/"en")
 * that is too long or not text, or "invalid" for a non-object input.
 */
export function normalizeAnswerText(input, max) {
  if (isBlank(input)) return { value: null, error: null };
  if (typeof input === "string") input = { ar: input };
  if (typeof input !== "object" || Array.isArray(input)) return { value: null, error: "invalid" };
  const value = {};
  for (const lang of GENERATED_LANGS) {
    const raw = input[lang];
    if (isBlank(raw)) continue;
    if (typeof raw !== "string") return { value: null, error: lang };
    const trimmed = raw.trim();
    if (trimmed.length > max) return { value: null, error: lang };
    value[lang] = trimmed;
  }
  if (!Object.keys(value).length) return { value: null, error: null };
  if (!value[PRIMARY_LANG]) return { value: null, error: ARABIC_REQUIRED };
  return { value, error: null };
}

/** Text in `lang`, falling back to Arabic when `fallback` is set. */
const pick = (text, lang, { fallback = false } = {}) =>
  text?.[lang] || (fallback ? text?.[PRIMARY_LANG] : null) || null;

/** Stable fingerprint of generated HTML, used to tell whether it was edited since. */
export const contentHash = (html) =>
  crypto.createHash("sha256").update(String(html ?? ""), "utf8").digest("hex");

/**
 * A number of days, worded for the sentence "خلال …" / "within …".
 * Arabic counted nouns change with the number (يوم واحد، يومين، ٣ أيام، ١١ يومًا).
 */
export function formatDays(n, lang) {
  if (lang === "en") return n === 1 ? "1 day" : `${n} days`;
  if (n === 1) return "يوم واحد";
  if (n === 2) return "يومين";
  if (n >= 3 && n <= 10) return `${n} أيام`;
  return `${n} يومًا`;
}

/** A price with its currency ("2,000 SDG"), or the template's "free". */
function formatPrice(price, currency, lang) {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return POLICY_TEMPLATES[lang].delivery.free;
  return `${n.toLocaleString("en-US")} ${escapeHtml(currency || "")}`.trim();
}

class AnswerError extends Error {
  constructor(field, reason) {
    super(`${field}: ${reason}`);
    this.field = field;
    this.reason = reason;
  }
}

/** Throws AnswerError for a bad `{ ar, en }` answer; returns the normalised value. */
function answerText(field, input, max, { required = false } = {}) {
  const { value, error } = normalizeAnswerText(input, max);
  if (error === ARABIC_REQUIRED) throw new AnswerError(field, "needs an Arabic answer (English is optional)");
  if (error) throw new AnswerError(field, `is too long or not text (${error})`);
  if (required && !value) throw new AnswerError(field, "is required");
  return value;
}

// ─── About page (10-9) ───────────────────────────────────────────────────────

/**
 * Validate and normalise the About answers. Throws AnswerError.
 *
 * @returns {{ products: object, since?: number, city?: object, different?: object, photo?: string }}
 */
export function normalizeAboutAnswers(input = {}, { now = new Date() } = {}) {
  const out = {};
  out.products = answerText("products", input.products, ABOUT_TEXT_MAX_LENGTH.products, { required: true });
  if (!isBlank(input.since)) {
    const year = Number(typeof input.since === "string" ? input.since.trim() : input.since);
    if (!Number.isInteger(year) || year < ABOUT_MIN_YEAR || year > now.getFullYear()) {
      throw new AnswerError("since", `must be a year between ${ABOUT_MIN_YEAR} and ${now.getFullYear()}`);
    }
    out.since = year;
  }
  const city = answerText("city", input.city, ABOUT_TEXT_MAX_LENGTH.city);
  if (city) out.city = city;
  const different = answerText("different", input.different, ABOUT_TEXT_MAX_LENGTH.different);
  if (different) out.different = different;
  if (!isBlank(input.photo)) {
    const photo = normalizeBrandImageUrl(input.photo);
    if (!photo) throw new AnswerError("photo", "must be an https:// URL or an uploaded image");
    out.photo = photo;
  }
  return out;
}

/** Languages the About page is written in: Arabic, plus English when "what you sell" has English. */
export const aboutLanguages = (answers) => (answers?.products?.en ? ["ar", "en"] : ["ar"]);

/**
 * Build the About page for one language from normalised answers.
 * English leaves out a sentence whose answer has no English text rather
 * than mixing languages.
 *
 * @returns {{ title: string, content: string }}
 */
export function buildAboutPage(answers, { lang = PRIMARY_LANG, storeName = "" } = {}) {
  const tpl = ABOUT_TEMPLATES[lang] || ABOUT_TEMPLATES[PRIMARY_LANG];
  const parts = [];
  const store = escapeHtml(storeName.trim() || (lang === "en" ? "our store" : "متجرنا"));

  if (answers.photo) {
    parts.push(`<figure><img src="${escapeHtml(answers.photo)}" alt="${store}"></figure>`);
  }
  const products = pick(answers.products, lang);
  if (products) parts.push(fill(tpl.welcome, { store, products: escapeHtml(products) }));
  if (answers.since) parts.push(fill(tpl.since, { year: String(answers.since) }));
  const city = pick(answers.city, lang);
  if (city) parts.push(fill(tpl.city, { city: escapeHtml(city) }));
  const different = pick(answers.different, lang);
  if (different) parts.push(tpl.differentHeading + paragraphs(different));
  parts.push(tpl.closing);

  return { title: tpl.title, content: sanitizePageHtml(parts.join("")) };
}

// ─── Policies (10-11) ────────────────────────────────────────────────────────

/**
 * Validate and normalise the policy answers. Throws AnswerError.
 * `hasZones`: the store already has shipping zones, so delivery areas come
 * from them and the free-text areas answer is optional.
 */
export function normalizePolicyAnswers(input = {}, { hasZones = false } = {}) {
  const delivery = input.delivery && typeof input.delivery === "object" ? input.delivery : {};
  const returns = input.returns && typeof input.returns === "object" ? input.returns : {};
  const out = { delivery: {}, returns: {} };

  const areas = answerText("delivery.areas", delivery.areas, POLICY_TEXT_MAX_LENGTH.areas, { required: !hasZones });
  if (areas) out.delivery.areas = areas;
  // Delivery prices are not asked: they come from the shipping settings
  // (summarizeShipping), the same numbers checkout charges.
  out.delivery.time = answerText("delivery.time", delivery.time, POLICY_TEXT_MAX_LENGTH.time, { required: true });

  if (typeof returns.accepted !== "boolean") throw new AnswerError("returns.accepted", "must be yes or no");
  out.returns.accepted = returns.accepted;
  if (returns.accepted) {
    const days = Number(returns.days);
    if (!Number.isInteger(days) || days < RETURN_DAYS_MIN || days > RETURN_DAYS_MAX) {
      throw new AnswerError("returns.days", `must be a whole number from ${RETURN_DAYS_MIN} to ${RETURN_DAYS_MAX}`);
    }
    out.returns.days = days;
    const conditions = answerText("returns.conditions", returns.conditions, POLICY_TEXT_MAX_LENGTH.conditions);
    if (conditions) out.returns.conditions = conditions;
  }
  return out;
}

const positiveNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * What the delivery policy says about prices, read from the store's shipping
 * settings with the same rules as checkout (services/shipping.js):
 *   - `zones`: zone shipping with named zones (each zone's cheapest rate);
 *   - `flat`: one price for every order (also zone shipping without zones,
 *     which charges the flat rate);
 *   - `weight`: a base price plus a price per kilogram;
 *   - `free`: free delivery;
 *   - `unset`: nothing set yet (flat at 0, the default). The policy then
 *     says nothing about price and the dashboard points to the settings.
 * `freeOver` is the free-delivery threshold when one is set.
 */
export function summarizeShipping(shipping) {
  const s = shipping && typeof shipping === "object" ? shipping : {};
  const freeOver = positiveNumber(s.freeShippingThreshold);
  const flat = positiveNumber(s.rate);
  const withFree = (out) => (freeOver ? { ...out, freeOver } : out);
  switch (s.type) {
    case "free":
      return { mode: "free" };
    case "zone": {
      const zones = summarizeZones(s.zones);
      if (zones.length) return withFree({ mode: "zones", zones });
      return flat ? withFree({ mode: "flat", price: flat }) : { mode: "unset" };
    }
    case "weight": {
      const base = positiveNumber(s.baseRate);
      const perKg = positiveNumber(s.perKgRate);
      return base || perKg ? withFree({ mode: "weight", base: base || 0, perKg: perKg || 0 }) : { mode: "unset" };
    }
    default:
      return flat ? withFree({ mode: "flat", price: flat }) : { mode: "unset" };
  }
}

/**
 * Shipping zones reduced to what a policy mentions: name, lowest rate and
 * its delivery estimate. Zones without a name are skipped.
 */
export function summarizeZones(zones = []) {
  const out = [];
  for (const z of Array.isArray(zones) ? zones : []) {
    const name = typeof z?.name === "string" ? z.name.trim() : "";
    if (!name) continue;
    const rates = (Array.isArray(z.rates) ? z.rates : []).filter((r) => Number.isFinite(Number(r?.price)));
    const cheapest = rates.reduce((a, r) => (a == null || Number(r.price) < Number(a.price) ? r : a), null);
    out.push({
      name,
      price: cheapest ? Number(cheapest.price) : null,
      days: typeof cheapest?.estimatedDays === "string" && cheapest.estimatedDays.trim() ? cheapest.estimatedDays.trim() : null,
    });
  }
  return out;
}

/**
 * Payment methods reduced to what a policy or badge mentions:
 * `{ cod: boolean, transfers: [{ code, label }] }`.
 */
export function summarizePaymentMethods(methods = []) {
  const out = { cod: false, transfers: [] };
  const seen = new Set();
  for (const m of Array.isArray(methods) ? methods : []) {
    if (m?.type === "cod") out.cod = true;
    if (m?.type !== "manual") continue;
    for (const p of m.providers || []) {
      if (!p?.enabled || !(p.accountNumber || p.phone) || !p.code || seen.has(p.code)) continue;
      seen.add(p.code);
      out.transfers.push({ code: p.code, label: p.label || p.code });
    }
  }
  return out;
}

const providerName = (provider, lang) =>
  TRANSFER_PROVIDER_NAMES[lang]?.[provider.code] || provider.label || provider.code;

/**
 * Build the generated policies for one language.
 *
 * Free-text answers use the requested language and fall back to Arabic: a
 * policy is a single text in the store's language, so an English store
 * whose merchant answered only in Arabic still gets complete sentences.
 *
 * @param {object} answers  normalised policy answers
 * @param {object} ctx      { lang, zones (summarizeZones), payment (summarizePaymentMethods), currency }
 * @returns {{ delivery: {title, body}, returns: {title, body}, cod?: {title, body} }}
 */
export function buildPolicies(
  answers,
  { lang = PRIMARY_LANG, shipping = { mode: "unset" }, payment = null, currency = "" } = {}
) {
  const tpl = POLICY_TEMPLATES[lang] || POLICY_TEMPLATES[PRIMARY_LANG];
  const text = (v) => pick(v, lang, { fallback: true });
  const out = {};
  const price = (n) => formatPrice(n, currency, lang);
  const zones = shipping.mode === "zones" ? shipping.zones : [];

  // Delivery
  const d = [];
  if (zones.length) {
    d.push(tpl.delivery.zonesIntro);
    d.push(
      "<ul>" +
        zones
          .map((z) =>
            fill(z.days ? tpl.delivery.zoneLineWithDays : tpl.delivery.zoneLine, {
              zone: escapeHtml(z.name),
              price: z.price == null ? tpl.delivery.free : formatPrice(z.price, currency, lang),
              days: escapeHtml(z.days || ""),
            })
          )
          .join("") +
        "</ul>"
    );
  }
  const areas = text(answers.delivery?.areas);
  if (areas) d.push(fill(tpl.delivery.areas, { areas: escapeHtml(areas) }));
  // Prices: from the shipping settings only (summarizeShipping).
  if (shipping.mode === "free") d.push(tpl.delivery.freeAll);
  if (shipping.mode === "flat") d.push(fill(tpl.delivery.fee, { fee: price(shipping.price) }));
  if (shipping.mode === "weight") d.push(fill(tpl.delivery.weight, { base: price(shipping.base), perKg: price(shipping.perKg) }));
  if (shipping.freeOver) d.push(fill(tpl.delivery.freeOver, { amount: price(shipping.freeOver) }));
  const time = text(answers.delivery?.time);
  if (time) d.push(fill(tpl.delivery.time, { time: escapeHtml(time) }));
  d.push(tpl.delivery.closing);
  out.delivery = { title: tpl.delivery.title, body: sanitizeGeneratedPolicy(d.join("")) };

  // Returns
  const r = [];
  if (answers.returns?.accepted) {
    r.push(fill(tpl.returns.accepted, { days: formatDays(answers.returns.days, lang) }));
    const conditions = text(answers.returns.conditions);
    if (conditions) r.push(tpl.returns.conditionsHeading + paragraphs(conditions));
    r.push(tpl.returns.how);
  } else {
    r.push(tpl.returns.notAccepted);
  }
  out.returns = { title: tpl.returns.title, body: sanitizeGeneratedPolicy(r.join("")) };

  // Payment (stored under the `cod` policy key). Only when the store takes payments.
  if (payment && (payment.cod || payment.transfers?.length)) {
    const items = [];
    if (payment.cod) items.push(tpl.cod.codItem);
    for (const p of payment.transfers || []) {
      items.push(fill(tpl.cod.transferItem, { provider: escapeHtml(providerName(p, lang)) }));
    }
    const notes = [];
    if (payment.cod) notes.push(tpl.cod.codNote);
    if (payment.transfers?.length) notes.push(tpl.cod.transferNote);
    out.cod = {
      title: tpl.cod.title,
      body: sanitizeGeneratedPolicy(tpl.cod.intro + `<ul>${items.join("")}</ul>` + notes.join("")),
    };
  }
  return out;
}

/**
 * Public trust-badge facts for the storefront (`store.trust`), or null when
 * the merchant never answered the policy questions — themes then render
 * exactly as before. Payment badges are resolved by the storefront from its
 * live payment methods; `payments: true` only says "show them".
 */
export function publicTrust(policyAnswers, { zones = [] } = {}) {
  if (!policyAnswers?.generatedAt) return null;
  const out = { payments: true };
  const delivery = {};
  const zoneNames = summarizeZones(zones).map((z) => z.name);
  if (zoneNames.length) delivery.zones = zoneNames;
  // Stored at `deliveryAreas` (shared with signup v2, PBI 10-16).
  const areas = normalizeAnswerText(policyAnswers.deliveryAreas, POLICY_TEXT_MAX_LENGTH.areas).value;
  if (areas) delivery.areas = areas;
  const time = normalizeAnswerText(policyAnswers.delivery?.time, POLICY_TEXT_MAX_LENGTH.time).value;
  if (time) delivery.time = time;
  if (Object.keys(delivery).length) out.delivery = delivery;
  const days = Number(policyAnswers.returns?.days);
  if (policyAnswers.returns?.accepted === true && Number.isInteger(days) && days >= RETURN_DAYS_MIN && days <= RETURN_DAYS_MAX) {
    out.returns = { days };
  }
  return out;
}

export { AnswerError };
