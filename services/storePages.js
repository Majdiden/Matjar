/**
 * Store pages written for the merchant (PBI 10 — tasks 10-9, 10-10, 10-11).
 *
 *   - About (10-9): answers → one `about` Page per language (Arabic always,
 *     English when answered). Answers live on Page.generator so the text can
 *     be rebuilt; a page the merchant rewrote by hand is "edited" and is only
 *     replaced when the request says `overwrite: true`.
 *   - Contact (10-10): a switch (`settings.generatedPages.contact`). When on,
 *     themes render /contact and /pages/contact from the brand kit instead of
 *     Page content; nothing is copied, so the page always shows current data.
 *   - Policies (10-11): answers → settings.policies.{delivery,returns,cod}
 *     in the store's language. A policy whose body no longer matches what we
 *     wrote (generatedHash) is "edited", same overwrite rule as About.
 *
 * The text itself comes from the pure templates in services/generatedPages.js.
 * Page writes are idempotent (same answers → same pages), so a failure part
 * way through is fixed by saving again; no transaction is needed.
 */
import { APIError } from "../middlewares/errorHandler.js";
import { getATenantRepo, updateATenantRepo } from "../repositories/tenant.js";
import {
  listPagesBySlugRepo,
  createPageRepo,
  updatePageRepo,
  deletePageRepo,
} from "../repositories/page.js";
import { listEnabledPaymentMethodsRepo } from "../repositories/paymentMethod.js";
import { isFeatureEnabledForTenantId } from "./featureFlags.js";
import { publicBrand } from "../utils/brandKit.js";
import { publicSocialLinks } from "../utils/socialLinks.js";
import { STORE_CONTACT_FIELDS } from "../utils/storeContact.js";
import {
  AnswerError,
  GENERATOR_KIND,
  GENERATED_POLICY_KEYS,
  PRIMARY_LANG,
  aboutLanguages,
  buildAboutPage,
  buildPolicies,
  contentHash,
  normalizeAboutAnswers,
  normalizePolicyAnswers,
  summarizePaymentMethods,
  summarizeShipping,
} from "./generatedPages.js";

export const ABOUT_SLUG = "about";

const zonesOf = (shipping) => (shipping.mode === "zones" ? shipping.zones : []);

/** Error code on the 409 returned when saving would replace the merchant's own edits. */
export const EDITED_CONFLICT_CODE = "GENERATED_PAGE_EDITED";

/** Bad answer → 400 naming the field, before anything is written. */
function toBadRequest(err) {
  if (err instanceof AnswerError) {
    return new APIError(`Answer ${err.message}`, 400, [{ field: `answers.${err.field}`, message: err.reason }]);
  }
  return err;
}

function editedConflict(what, fields) {
  const err = new APIError(
    `Your ${what} was changed by hand. Saving will replace those changes — send overwrite: true to confirm.`,
    409,
    fields.map((field) => ({ field, code: "edited" }))
  );
  err.code = EDITED_CONFLICT_CODE;
  return err;
}

/** Storefront languages every generated policy is written in. */
const POLICY_LANGS = Object.freeze(["ar", "en"]);

const storeNameOf = (tenant) => tenant?.settings?.storeName || tenant?.name || "";

// ─── About (10-9) ────────────────────────────────────────────────────────────

/**
 * Would rebuilding this page lose the merchant's own words? Generated pages
 * only once edited by hand; hand-made pages whenever they have content;
 * starter (demo) pages never — they are placeholder text.
 */
const isProtectedPage = (page) => {
  if (!page) return false;
  if (page.generator) return page.generator.edited === true;
  return !page.isDemo && Boolean(page.content && page.content.trim());
};

const aboutPageSummary = (page) => ({
  id: String(page._id),
  locale: page.locale,
  title: page.title,
  isPublished: !!page.isPublished,
  generated: !!page.generator,
  edited: isProtectedPage(page),
});

/**
 * The About questionnaire state: stored answers (or null), the pages that
 * exist for /about, and whether saving would replace hand edits.
 */
export async function getAboutService(models, tenantId) {
  const [pages, tenant] = await Promise.all([
    listPagesBySlugRepo(models, ABOUT_SLUG),
    getATenantRepo({ "settings.brand": 1 }, { _id: tenantId }),
  ]);
  const generated = pages.filter((p) => p.generator?.kind === GENERATOR_KIND.about);
  const source = generated.find((p) => p.locale === PRIMARY_LANG) || generated[0] || null;
  const brand = publicBrand(tenant?.settings?.brand);
  return {
    answers: source?.generator?.answers || null,
    generatedAt: source?.generator?.generatedAt || null,
    edited: pages.some(isProtectedPage),
    pages: pages.map(aboutPageSummary),
    // Prefill for a first visit: the city from the brand kit.
    suggestions: { city: brand?.city || null },
  };
}

/**
 * Validate answers and (re)write the About page(s). Publishes them: the
 * merchant asked for the page. A generated English page the merchant no
 * longer answers for is removed unless it was edited by hand.
 */
export async function saveAboutService(models, tenantId, input = {}) {
  let answers;
  try {
    answers = normalizeAboutAnswers(input.answers || {});
  } catch (err) {
    throw toBadRequest(err);
  }
  const overwrite = input.overwrite === true;

  const tenant = await getATenantRepo({ name: 1, "settings.storeName": 1 }, { _id: tenantId });
  if (!tenant) throw new APIError("Tenant not found", 404);
  const storeName = storeNameOf(tenant);

  const langs = aboutLanguages(answers);
  const byLocale = new Map((await listPagesBySlugRepo(models, ABOUT_SLUG)).map((p) => [p.locale, p]));

  const blocked = langs.filter((lang) => isProtectedPage(byLocale.get(lang)));
  if (blocked.length && !overwrite) throw editedConflict("About page", blocked.map((l) => `pages.${l}`));

  const now = new Date();
  const generator = { kind: GENERATOR_KIND.about, answers, generatedAt: now, edited: false };
  for (const lang of langs) {
    const { title, content } = buildAboutPage(answers, { lang, storeName });
    const existing = byLocale.get(lang);
    if (existing) {
      await updatePageRepo(models, existing._id, {
        title,
        content,
        metaTitle: title,
        isPublished: true,
        publishedAt: existing.publishedAt || now,
        publishAt: null,
        isDemo: false,
        generator,
      });
    } else {
      await createPageRepo(models, {
        slug: ABOUT_SLUG,
        locale: lang,
        title,
        content,
        metaTitle: title,
        metaDescription: "",
        isPublished: true,
        publishedAt: now,
        generator,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  for (const [locale, page] of byLocale) {
    if (!langs.includes(locale) && page.generator?.kind === GENERATOR_KIND.about && !page.generator.edited) {
      await deletePageRepo(models, page._id);
    }
  }

  return getAboutService(models, tenantId);
}

/**
 * Rewrite the generated About page(s) from their stored answers, e.g. after
 * the store name changed (the welcome line names the store). Pages the
 * merchant rewrote by hand are left alone, as are stores without a
 * generated About page. Returns whether anything was rewritten.
 */
export async function refreshGeneratedAboutService(models, tenantId) {
  const pages = await listPagesBySlugRepo(models, ABOUT_SLUG);
  const generated = pages.filter((p) => p.generator?.kind === GENERATOR_KIND.about);
  if (!generated.length || pages.some(isProtectedPage)) return false;
  const source = generated.find((p) => p.locale === PRIMARY_LANG) || generated[0];
  if (!source.generator?.answers) return false;
  await saveAboutService(models, tenantId, { answers: source.generator.answers });
  return true;
}

// ─── Contact (10-10) ─────────────────────────────────────────────────────────

/**
 * Whether the automatic contact page is on, plus exactly what it will show
 * (the brand kit, contact info and social pages — the same values the
 * storefront payload carries).
 */
export async function getContactService(tenantId) {
  const tenant = await getATenantRepo(
    {
      name: 1,
      "settings.storeName": 1,
      "settings.brand": 1,
      "settings.contact": 1,
      "settings.socialLinks": 1,
      "settings.generatedPages": 1,
    },
    { _id: tenantId }
  );
  if (!tenant) throw new APIError("Tenant not found", 404);
  const s = tenant.settings || {};
  const brand = publicBrand(s.brand) || {};
  return {
    enabled: s.generatedPages?.contact === true,
    preview: {
      storeName: storeNameOf(tenant),
      whatsapp: brand.whatsapp || null,
      city: brand.city || null,
      hours: brand.hours || null,
      ...Object.fromEntries(STORE_CONTACT_FIELDS.map((f) => [f, s.contact?.[f] || null])),
      socialLinks: publicSocialLinks(s.socialLinks) || {},
    },
  };
}

/** Turn the automatic contact page on or off. Off removes the key: absent = as before. */
export async function setContactService(tenantId, enabled) {
  const update = enabled
    ? { $set: { "settings.generatedPages.contact": true } }
    : { $unset: { "settings.generatedPages.contact": "" } };
  const result = await updateATenantRepo({ _id: tenantId }, update);
  if (!result.matchedCount) throw new APIError("Tenant not found", 404);
  return getContactService(tenantId);
}

// ─── Policies (10-11) ────────────────────────────────────────────────────────

const POLICY_SELECT = {
  "settings.policies": 1,
  "settings.policyAnswers": 1,
  "settings.shipping": 1,
  "settings.language": 1,
  "settings.currency": 1,
};

/** Policies are one text each, written in the store's language. */
const policyLanguage = (tenant) => (tenant?.settings?.language === "en" ? "en" : PRIMARY_LANG);

/**
 * The store's payment methods as a policy mentions them. Mirrors the
 * storefront: when the operator has payment methods off for this store,
 * only cash on delivery is offered.
 */
async function loadPaymentSummary(models, tenantId) {
  const [methods, methodsAllowed] = await Promise.all([
    listEnabledPaymentMethodsRepo(models),
    isFeatureEnabledForTenantId(tenantId, "payments.methods"),
  ]);
  const summary = summarizePaymentMethods(methods);
  if (!methodsAllowed) summary.transfers = [];
  return summary;
}

/** True when a stored policy has text that is not the text we generated. */
export function isPolicyEdited(tenant, key) {
  const body = tenant?.settings?.policies?.[key]?.body;
  if (!body) return false;
  const hash = tenant?.settings?.policyAnswers?.generatedHash?.[key];
  return !hash || hash !== contentHash(body);
}

/**
 * Stored answers in the shape the questionnaire sends, or null. Delivery
 * areas live at `policyAnswers.deliveryAreas`, the path signup v2 (10-16)
 * also writes; the API keeps them under `delivery.areas`.
 */
function storedPolicyAnswers(policyAnswers) {
  if (!policyAnswers?.generatedAt) return null;
  const { delivery = {}, returns = {}, deliveryAreas } = policyAnswers;
  return {
    delivery: {
      ...(deliveryAreas?.ar && { areas: deliveryAreas }),
      ...(delivery.fee?.ar && { fee: delivery.fee }),
      ...(delivery.time?.ar && { time: delivery.time }),
    },
    returns: {
      accepted: returns.accepted === true,
      ...(Number.isInteger(returns.days) && { days: returns.days }),
      ...(returns.conditions?.ar && { conditions: returns.conditions }),
    },
  };
}

/**
 * Policy questionnaire state: stored answers, what the store already has
 * (shipping zones, payment methods) and, per generated policy, whether it
 * exists and whether the merchant changed it by hand.
 */
export async function getPoliciesService(models, tenantId) {
  const [tenant, payment] = await Promise.all([
    getATenantRepo(POLICY_SELECT, { _id: tenantId }),
    loadPaymentSummary(models, tenantId),
  ]);
  if (!tenant) throw new APIError("Tenant not found", 404);
  const s = tenant.settings || {};
  return {
    answers: storedPolicyAnswers(s.policyAnswers),
    generatedAt: s.policyAnswers?.generatedAt || null,
    // Prefill for a first visit: the delivery areas given at signup (10-16).
    suggestions: { areas: s.policyAnswers?.deliveryAreas?.ar ? s.policyAnswers.deliveryAreas : null },
    language: policyLanguage(tenant),
    // Delivery prices come from the shipping settings (shown read-only with
    // a link to edit them); `zones` is kept for older dashboards.
    shipping: summarizeShipping(s.shipping),
    zones: zonesOf(summarizeShipping(s.shipping)),
    currency: s.currency || null,
    payment,
    policies: Object.fromEntries(
      GENERATED_POLICY_KEYS.map((key) => [
        key,
        {
          title: s.policies?.[key]?.title || null,
          exists: Boolean(s.policies?.[key]?.body),
          edited: isPolicyEdited(tenant, key),
        },
      ])
    ),
  };
}

/**
 * Validate answers and (re)write the delivery, returns and payment policies.
 * The payment policy is written only when the store takes a payment method;
 * a payment policy we wrote earlier and that the merchant left alone is
 * cleared when there is no longer anything to say.
 *
 * @returns {Promise<{ state: object, changes: object }>}
 */
export async function savePoliciesService(models, tenantId, input = {}) {
  const [tenant, payment] = await Promise.all([
    getATenantRepo(POLICY_SELECT, { _id: tenantId }),
    loadPaymentSummary(models, tenantId),
  ]);
  if (!tenant) throw new APIError("Tenant not found", 404);
  const s = tenant.settings || {};
  const shipping = summarizeShipping(s.shipping);

  let answers;
  try {
    answers = normalizePolicyAnswers(input.answers || {}, { hasZones: zonesOf(shipping).length > 0 });
  } catch (err) {
    throw toBadRequest(err);
  }

  const lang = policyLanguage(tenant);
  const context = { shipping, payment, currency: s.currency || "" };
  // One copy per storefront language; the store's language is the main one
  // (title/body, what the merchant edits). Untranslated answers fall back to
  // the Arabic text inside the English copy.
  const byLang = Object.fromEntries(POLICY_LANGS.map((l) => [l, buildPolicies(answers, { ...context, lang: l })]));
  const generated = byLang[lang];
  const keys = Object.keys(generated);

  const blocked = keys.filter((key) => isPolicyEdited(tenant, key));
  if (blocked.length && input.overwrite !== true) {
    throw editedConflict("policy", blocked.map((k) => `policies.${k}`));
  }

  const $set = {};
  const generatedHash = {};
  for (const key of keys) {
    $set[`settings.policies.${key}.title`] = generated[key].title;
    $set[`settings.policies.${key}.body`] = generated[key].body;
    $set[`settings.policies.${key}.translations`] = Object.fromEntries(
      POLICY_LANGS.filter((l) => byLang[l][key]).map((l) => [l, { title: byLang[l][key].title, body: byLang[l][key].body }])
    );
    generatedHash[key] = contentHash(generated[key].body);
  }
  for (const key of GENERATED_POLICY_KEYS) {
    if (keys.includes(key)) continue;
    const body = s.policies?.[key]?.body;
    if (body && !isPolicyEdited(tenant, key)) {
      $set[`settings.policies.${key}.title`] = null;
      $set[`settings.policies.${key}.body`] = null;
      $set[`settings.policies.${key}.translations`] = null;
    }
  }
  // Areas are written back to the path signup v2 shares (deliveryAreas).
  const { areas, ...deliveryRest } = answers.delivery;
  $set["settings.policyAnswers"] = {
    ...(areas && { deliveryAreas: areas }),
    delivery: deliveryRest,
    returns: answers.returns,
    language: lang,
    generatedAt: new Date(),
    generatedHash,
  };

  const result = await updateATenantRepo({ _id: tenantId }, { $set });
  if (!result.matchedCount) throw new APIError("Tenant not found", 404);

  return { state: await getPoliciesService(models, tenantId), changes: { policies: keys, language: lang } };
}
