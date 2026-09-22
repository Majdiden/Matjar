import { isValidEditorPreviewToken } from "./themeCustomization.js";

/**
 * Build the public store payload — the exact object returned as
 * `data.store` by GET /storefront/store-info.
 *
 * Extracted so the SPA shell can embed the SAME payload in the HTML it
 * serves (see middlewares/storefrontServe.js). Without that, every theme
 * renders one frame against its manifest DEFAULTS — default colors, fonts,
 * name and sections — before the store fetch resolves, which is the
 * "flash of the default theme on refresh" merchants see. Both callers must
 * agree byte-for-byte or the embedded payload would be overwritten by a
 * different one on the first fetch, producing a second flash.
 *
 * @param {object} tenant   Tenant document (lean or hydrated)
 * @param {object} [options]
 * @param {string|null} [options.previewParam]  `?preview=<token>` value — when it
 *   matches the tenant's editor token (and hasn't expired), the DRAFT
 *   customization snapshot is returned instead of the published one.
 * @param {string|null} [options.previewTheme]  `?previewTheme=<slug>` value — a
 *   different theme's bundle is being served, so report that slug and drop
 *   the customization (its sections belong to another theme's schema).
 * @returns {object} the `store` payload
 */
export function buildStoreInfo(tenant, options = {}) {
  const previewParam =
    typeof options.previewParam === "string" ? options.previewParam : null;
  const previewTheme =
    typeof options.previewTheme === "string" && options.previewTheme.trim()
      ? options.previewTheme.trim()
      : null;

  const tc = tenant.themeCustomization || {};
  const activeTheme = tenant.settings?.activeTheme || null;

  // ─── Preview token handling ─────────────────────────────────
  //
  // When the dashboard editor opens the storefront inside its
  // preview iframe, it appends `?preview=<token>`. If that token
  // matches the stored one AND hasn't expired, we return the
  // *draft* snapshot instead of the published one — this is the
  // only place a logged-out request can see unpublished content,
  // and the token is the entire authorization check for that.
  //
  // Comparison is constant-time to prevent timing oracles from
  // revealing partial token matches character-by-character. The
  // token itself is 64 hex chars (32 bytes of CSPRNG entropy),
  // which makes enumeration infeasible even under a timing leak,
  // but defense in depth is cheap here.
  //
  // Shared editor-preview validation (audit 6.4 reuses this exact
  // check for CMS page preview). Same token, same constant-time
  // comparison + expiry gate.
  const servePreview = isValidEditorPreviewToken(tenant, previewParam);

  // ─── Customization selection ────────────────────────────────
  //
  // Rule: the storefront bundle being served and the customization
  // we return MUST belong to the same theme slug. If the tenant's
  // activeTheme is missing a build artifact, storefrontServe.js
  // falls back to the default theme's bundle — so returning the
  // tenant's (mismatched) published customization would render
  // the fallback React app with sections it doesn't know. We
  // detect that by comparing the snapshot's themeSlug against
  // the tenant's declared activeTheme and, when they diverge,
  // return null (causing the fallback bundle to use its manifest
  // defaults instead of choking on foreign section types).
  // `sectionsByTemplate` is the canonical per-template store (audit
  // 1.3); the flat `sections` key is kept in the response as an alias
  // of the index bucket so older theme bundles keep rendering.
  const draftByTpl =
    tc.sectionsByTemplate && typeof tc.sectionsByTemplate === "object"
      ? tc.sectionsByTemplate
      : {};
  const publishedByTpl =
    tc.published?.sectionsByTemplate && typeof tc.published.sectionsByTemplate === "object"
      ? tc.published.sectionsByTemplate
      : {};

  let themeCustomization = null;
  if (servePreview) {
    themeCustomization = {
      themeSlug: activeTheme,
      settings: tc.settings || {},
      sections: Array.isArray(draftByTpl.index) ? draftByTpl.index : [],
      sectionsByTemplate: draftByTpl,
      customCSS: tc.customCSS || "",
      version: null,
      publishedAt: null,
      preview: true,
    };
  } else if (tc.published?.publishedAt && tc.published.themeSlug === activeTheme) {
    themeCustomization = {
      themeSlug: tc.published.themeSlug,
      settings: tc.published.settings,
      sections: Array.isArray(publishedByTpl.index) ? publishedByTpl.index : [],
      sectionsByTemplate: publishedByTpl,
      customCSS: tc.published.customCSS,
      version: tc.published.version,
      publishedAt: tc.published.publishedAt,
    };
  }

  // ─── Theme PREVIEW override ─────────────────────────────────
  //
  // When the dashboard opens the storefront with `?previewTheme=<slug>`,
  // a DIFFERENT theme's bundle is being served (see storefrontServe.js).
  // The tenant's published customization belongs to their *active* theme,
  // whose section schema the preview bundle doesn't understand — returning
  // it would render foreign sections. Report the preview slug as the theme
  // and drop the customization so the preview bundle falls back to its own
  // manifest defaults. Purely read-only; nothing is persisted.
  const effectiveTheme = previewTheme || activeTheme;
  const effectiveCustomization = previewTheme ? null : themeCustomization;

  return {
    name: tenant.settings?.storeName || tenant.name,
    description: tenant.settings?.storeDescription || "",
    logo: tenant.settings?.logo || null,
    favicon: tenant.settings?.favicon || null,
    currency: tenant.settings?.currency || "SDG",
    theme: effectiveTheme,
    themeCustomization: effectiveCustomization,
    socialLinks: tenant.settings?.socialLinks || null,
    contactInfo: tenant.settings?.contactInfo || null,
    contact: tenant.settings?.contact || null,
    // Only expose policies that actually have a body — the storefront
    // shows a link/section per present policy and hides the rest.
    policies: (() => {
      const src = tenant.settings?.policies || {};
      const out = {};
      for (const key of ["privacy", "returns", "delivery", "cod"]) {
        const p = src[key];
        if (p && p.body) out[key] = { title: p.title || null, body: p.body };
      }
      return Object.keys(out).length ? out : null;
    })(),
    giftCards: {
      enabled: tenant.settings?.giftCards?.enabled !== false,
    },
  };
}

export default buildStoreInfo;
