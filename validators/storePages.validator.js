import { z } from "zod";
import {
  ABOUT_TEXT_MAX_LENGTH,
  GENERATED_LANGS,
  POLICY_TEXT_MAX_LENGTH,
} from "../services/generatedPages.js";
import { BRAND_IMAGE_URL_MAX_LENGTH } from "../utils/brandKit.js";

/**
 * /store-pages (PBI 10 — generated About, Contact and policy pages).
 *
 * Shape and length only; the rules that need more than a schema (Arabic is
 * required whenever a text is given, the year range, image URL schemes,
 * areas required when the store has no shipping zones) live in
 * services/generatedPages.js so tests and every caller share them.
 */

// `{ ar, en }` answer, or null/"" when left empty.
const answerText = (max) =>
  z
    .union([
      z.literal(""),
      z
        .object(
          Object.fromEntries(
            GENERATED_LANGS.map((lang) => [lang, z.string().trim().max(max).nullable().optional()])
          )
        )
        .strict(),
    ])
    .nullable()
    .optional();

const overwrite = z.boolean().optional();

export const saveAboutSchema = z.object({
  body: z
    .object({
      answers: z
        .object({
          products: answerText(ABOUT_TEXT_MAX_LENGTH.products),
          since: z.union([z.number().int(), z.string().trim().max(4)]).nullable().optional(),
          city: answerText(ABOUT_TEXT_MAX_LENGTH.city),
          different: answerText(ABOUT_TEXT_MAX_LENGTH.different),
          photo: z.string().max(BRAND_IMAGE_URL_MAX_LENGTH).nullable().optional(),
        })
        .strict(),
      overwrite,
    })
    .strict(),
});

export const setContactSchema = z.object({
  body: z.object({ enabled: z.boolean() }).strict(),
});

export const savePoliciesSchema = z.object({
  body: z
    .object({
      answers: z
        .object({
          delivery: z
            .object({
              areas: answerText(POLICY_TEXT_MAX_LENGTH.areas),
              fee: answerText(POLICY_TEXT_MAX_LENGTH.fee),
              time: answerText(POLICY_TEXT_MAX_LENGTH.time),
            })
            .strict(),
          returns: z
            .object({
              accepted: z.boolean(),
              days: z.number().int().nullable().optional(),
              conditions: answerText(POLICY_TEXT_MAX_LENGTH.conditions),
            })
            .strict(),
        })
        .strict(),
      overwrite,
    })
    .strict(),
});
