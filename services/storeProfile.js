/**
 * Store profile service (PBI 10 — brand kit).
 *
 * The store profile is what a merchant tells us about their business once:
 * name, logo, the brand kit (`settings.brand`: tagline, cover photo, colour,
 * WhatsApp, city, hours), social pages and contact info. It lives on the
 * tenant, independent of the active theme, and reaches themes through
 * services/storefrontStoreInfo.js.
 *
 * Partial-update semantics: only keys present in the input change; null or
 * "" clears a field. A bilingual text (`{ ar, en }`) is replaced as a whole,
 * so sending `{ ar }` alone drops a previous English text. Everything is
 * validated before anything is written — one bad value is a 400 with
 * nothing stored. Brand and social fields are `$unset` when cleared (absent
 * stays absent, see schemas/tenant.js); name/logo/contact keep their
 * existing null/"" conventions.
 */
import { getATenantRepo, updateATenantRepo } from "../repositories/tenant.js";
import { APIError } from "../middlewares/errorHandler.js";
import {
  BRAND_TEXT_FIELDS,
  isBlankBrandValue,
  normalizeBilingualText,
  normalizeBrandColor,
  normalizeBrandImageUrl,
  publicBrand,
  unwrapWhatsappLink,
} from "../utils/brandKit.js";
import { SOCIAL_PLATFORM_KEYS, normalizeSocialLink, normalizeSocialLinks } from "../utils/socialLinks.js";
import { STORE_CONTACT_FIELDS, normalizeStoreContactField } from "../utils/storeContact.js";
import { splitE164, toAsciiDigits } from "../utils/phone.js";
import { getEnabledPhoneCountries, resolveMerchantPhone } from "./phoneCountries.js";
import {
  STORE_NAME_MIN_LENGTH,
  STORE_NAME_MAX_LENGTH,
} from "../validators/storeProfile.validator.js";

/** Tenant fields the profile reads — nothing else leaves the repository. */
const PROFILE_SELECT = {
  name: 1,
  "settings.storeName": 1,
  "settings.logo": 1,
  "settings.brand": 1,
  "settings.socialLinks": 1,
  "settings.contact": 1,
};

/**
 * Shape a tenant into the profile the dashboard edits. `brand` and
 * `socialLinks` are always objects (empty when nothing is set) so a form can
 * bind to them directly; the storefront gets `null` instead (see
 * services/storefrontStoreInfo.js).
 */
export function toStoreProfile(tenant) {
  const s = tenant?.settings || {};
  return {
    storeName: s.storeName || null,
    logo: s.logo || null,
    brand: publicBrand(s.brand) || {},
    socialLinks: normalizeSocialLinks(s.socialLinks).links,
    contact: Object.fromEntries(STORE_CONTACT_FIELDS.map((f) => [f, s.contact?.[f] || null])),
  };
}

/**
 * Normalise a merchant-entered WhatsApp number to E.164 against the enabled
 * phone countries. A pasted wa.me link is unwrapped first. An international
 * number ("+20…", "0020…") picks its own country when no country is given;
 * a local number uses `country`, else the platform default. Throws 400.
 */
export async function normalizeWhatsapp(raw, country) {
  const value = unwrapWhatsappLink(raw);
  let iso2 = country || null;
  const cleaned = toAsciiDigits(value).replace(/[\s\-().]/g, "");
  if (!iso2 && /^(\+|00)\d/.test(cleaned)) {
    const { countries } = await getEnabledPhoneCountries();
    iso2 = splitE164(`+${cleaned.replace(/^(\+|00)/, "")}`, countries).iso2;
  }
  try {
    const { phone } = await resolveMerchantPhone(value, iso2);
    return phone;
  } catch (err) {
    if (err?.statusCode === 400) throw new APIError(`WhatsApp: ${err.message}`, 400);
    throw err;
  }
}

/**
 * Validate the input and build the Mongo update. Pure apart from the phone
 * country lookup; throws APIError(400) before anything is written.
 *
 * @returns {Promise<{ $set: object, $unset: object }>}
 */
export async function buildStoreProfileUpdate(input = {}) {
  const $set = {};
  const $unset = {};
  const clearOrSet = (path, value) => {
    if (value == null) $unset[path] = "";
    else $set[path] = value;
  };

  if (input.storeName !== undefined) {
    if (isBlankBrandValue(input.storeName)) {
      $set["settings.storeName"] = null;
    } else {
      const name = String(input.storeName).trim();
      if (name.length < STORE_NAME_MIN_LENGTH || name.length > STORE_NAME_MAX_LENGTH) {
        throw new APIError(
          `Store name must be ${STORE_NAME_MIN_LENGTH}–${STORE_NAME_MAX_LENGTH} characters`,
          400
        );
      }
      $set["settings.storeName"] = name;
    }
  }

  if (input.logo !== undefined) {
    if (isBlankBrandValue(input.logo)) {
      $set["settings.logo"] = null;
    } else {
      const logo = normalizeBrandImageUrl(input.logo);
      if (!logo) throw new APIError("Logo must be an https:// URL or an uploaded image", 400);
      $set["settings.logo"] = logo;
    }
  }

  const brand = input.brand;
  if (brand && typeof brand === "object") {
    for (const field of BRAND_TEXT_FIELDS) {
      if (brand[field] === undefined) continue;
      const { value, invalid } = normalizeBilingualText(field, brand[field]);
      if (invalid.length) {
        const arabicMissing = invalid.includes("ar") && !value?.ar && typeof brand[field]?.ar !== "string";
        throw new APIError(
          arabicMissing
            ? `Brand ${field} needs an Arabic text (English is optional)`
            : `Invalid brand ${field} (${invalid.join(", ")})`,
          400
        );
      }
      clearOrSet(`settings.brand.${field}`, value);
    }

    if (brand.coverImage !== undefined) {
      let cover = null;
      if (!isBlankBrandValue(brand.coverImage)) {
        cover = normalizeBrandImageUrl(brand.coverImage);
        if (!cover) throw new APIError("Cover image must be an https:// URL or an uploaded image", 400);
      }
      clearOrSet("settings.brand.coverImage", cover);
    }

    if (brand.color !== undefined) {
      let color = null;
      if (!isBlankBrandValue(brand.color)) {
        color = normalizeBrandColor(brand.color);
        if (!color) throw new APIError('Brand colour must look like "#1a2b3c"', 400);
      }
      clearOrSet("settings.brand.color", color);
    }

    if (brand.whatsapp !== undefined) {
      const whatsapp = isBlankBrandValue(brand.whatsapp)
        ? null
        : await normalizeWhatsapp(brand.whatsapp, brand.whatsappCountry);
      clearOrSet("settings.brand.whatsapp", whatsapp);
    }
  }

  if (input.socialLinks && typeof input.socialLinks === "object") {
    const invalid = [];
    for (const key of SOCIAL_PLATFORM_KEYS) {
      const raw = input.socialLinks[key];
      if (raw === undefined) continue;
      if (isBlankBrandValue(raw)) {
        clearOrSet(`settings.socialLinks.${key}`, null);
        continue;
      }
      const link = normalizeSocialLink(key, raw);
      if (link) $set[`settings.socialLinks.${key}`] = link;
      else invalid.push(key);
    }
    if (invalid.length) {
      throw new APIError(`Invalid social link for: ${invalid.join(", ")}`, 400);
    }
  }

  if (input.contact && typeof input.contact === "object") {
    for (const field of STORE_CONTACT_FIELDS) {
      if (input.contact[field] === undefined) continue;
      $set[`settings.contact.${field}`] = normalizeStoreContactField(field, input.contact[field]);
    }
  }

  if (!Object.keys($set).length && !Object.keys($unset).length) {
    throw new APIError("Nothing to update", 400);
  }
  return { $set, $unset };
}

export async function getStoreProfileService(tenantId) {
  const tenant = await getATenantRepo(PROFILE_SELECT, { _id: tenantId });
  if (!tenant) throw new APIError("Tenant not found", 404);
  return toStoreProfile(tenant);
}

/**
 * Apply a partial profile update. A single-document update is atomic, so no
 * transaction is needed. Returns the normalised profile plus the applied
 * update (for the audit log).
 */
export async function updateStoreProfileService(tenantId, input) {
  const update = await buildStoreProfileUpdate(input);
  const mongoUpdate = {};
  if (Object.keys(update.$set).length) mongoUpdate.$set = update.$set;
  if (Object.keys(update.$unset).length) mongoUpdate.$unset = update.$unset;

  const result = await updateATenantRepo({ _id: tenantId }, mongoUpdate);
  if (!result.matchedCount) throw new APIError("Tenant not found", 404);

  const profile = await getStoreProfileService(tenantId);
  return { profile, changes: update };
}
