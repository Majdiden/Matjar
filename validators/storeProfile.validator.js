import { z } from "zod";
import { SOCIAL_PLATFORM_KEYS, SOCIAL_LINK_MAX_LENGTH } from "../utils/socialLinks.js";
import {
  BRAND_TEXT_LANGS,
  BRAND_TEXT_MAX_LENGTH,
  BRAND_IMAGE_URL_MAX_LENGTH,
} from "../utils/brandKit.js";
import { STORE_CONTACT_FIELDS } from "../utils/storeContact.js";

/**
 * PUT /store-profile — the merchant's brand kit (PBI 10).
 *
 * Partial update: only keys present in the body change; null or "" clears a
 * field. Shape and length are pinned here; scheme/host/colour/phone rules are
 * applied in services/storeProfile.js (utils/brandKit.js, utils/socialLinks.js,
 * services/phoneCountries.js) so every write path shares one rule set.
 */

export const STORE_NAME_MIN_LENGTH = 2;
export const STORE_NAME_MAX_LENGTH = 100;

/** Upper bound for raw contact input; the service caps each field further. */
const CONTACT_INPUT_MAX_LENGTH = 1000;
/** A WhatsApp value may be a pasted wa.me link, so allow more than a number. */
const WHATSAPP_INPUT_MAX_LENGTH = 200;
/** "#rrggbb" plus room for surrounding whitespace the service trims. */
const COLOR_INPUT_MAX_LENGTH = 32;

const clearable = (schema) => schema.nullable().optional();

// `{ ar, en }`, or null/"" to clear the whole field.
const bilingualText = (max) =>
  clearable(
    z.union([
      z.literal(""),
      z
        .object(
          Object.fromEntries(BRAND_TEXT_LANGS.map((lang) => [lang, clearable(z.string().trim().max(max))]))
        )
        .strict(),
    ])
  );

const brandSchema = z
  .object({
    tagline: bilingualText(BRAND_TEXT_MAX_LENGTH.tagline),
    city: bilingualText(BRAND_TEXT_MAX_LENGTH.city),
    hours: bilingualText(BRAND_TEXT_MAX_LENGTH.hours),
    coverImage: clearable(z.string().max(BRAND_IMAGE_URL_MAX_LENGTH)),
    color: clearable(z.string().max(COLOR_INPUT_MAX_LENGTH)),
    whatsapp: clearable(z.string().max(WHATSAPP_INPUT_MAX_LENGTH)),
    // ISO-3166 alpha-2 the WhatsApp number was typed for; input only (the
    // stored E.164 carries the country). Defaults to the platform default.
    whatsappCountry: z.string().length(2).optional(),
  })
  .strict()
  .optional();

const socialLinksSchema = z
  .object(
    Object.fromEntries(
      SOCIAL_PLATFORM_KEYS.map((key) => [key, clearable(z.string().max(SOCIAL_LINK_MAX_LENGTH))])
    )
  )
  .strict()
  .optional();

const contactSchema = z
  .object(
    Object.fromEntries(
      STORE_CONTACT_FIELDS.map((field) => [field, clearable(z.string().max(CONTACT_INPUT_MAX_LENGTH))])
    )
  )
  .strict()
  .optional();

export const updateStoreProfileSchema = z.object({
  body: z
    .object({
      storeName: clearable(
        z
          .string()
          .trim()
          .max(STORE_NAME_MAX_LENGTH)
          .refine((v) => v === "" || v.length >= STORE_NAME_MIN_LENGTH, {
            message: `Store name must be at least ${STORE_NAME_MIN_LENGTH} characters`,
          })
      ),
      logo: clearable(z.string().max(BRAND_IMAGE_URL_MAX_LENGTH)),
      brand: brandSchema,
      socialLinks: socialLinksSchema,
      contact: contactSchema,
    })
    .strict()
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to update" }),
});
