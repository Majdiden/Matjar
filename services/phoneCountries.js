/**
 * Effective phone-country resolution + operator config.
 *
 * Effective config = the code catalog defaults (Sudan enabled + default)
 * merged with the operator's stored config in `platformconfigs._id:
 * "phoneCountries"` (same raw-collection pattern as services/featureFlags.js).
 * A 30s per-process cache keeps the public signup endpoint cheap; on any DB
 * error we fall back to the catalog defaults so signup never breaks.
 *
 * Stored shape:
 *   { _id: "phoneCountries",
 *     countries: [{ iso2, name, nameAr, dialCode, minDigits, maxDigits, enabled }],
 *     defaultCountry: "SD", updatedAt, updatedBy }
 *
 * `countries` is the operator's full list (catalog picks and custom entries
 * alike) — the catalog is only a convenience for the admin UI and for the
 * fresh-platform defaults.
 */
import mongoose from "mongoose";
import {
  PHONE_COUNTRY_CATALOG,
  DEFAULT_PHONE_COUNTRY,
  DEFAULT_ENABLED_PHONE_COUNTRIES,
  PHONE_DIGIT_BOUNDS,
} from "../config/phoneCountries.js";
import { normalizePhone } from "../utils/phone.js";
import { APIError } from "../middlewares/errorHandler.js";
import logger from "../utils/logger.js";

const CONFIG_ID = "phoneCountries";
const CACHE_TTL_MS = 30_000;

let cache = { config: null, at: 0 };

function col() {
  return mongoose.connection?.db?.collection("platformconfigs") || null;
}

function defaultConfig() {
  return {
    countries: PHONE_COUNTRY_CATALOG.filter((c) =>
      DEFAULT_ENABLED_PHONE_COUNTRIES.includes(c.iso2)
    ).map((c) => ({ ...c, enabled: true })),
    defaultCountry: DEFAULT_PHONE_COUNTRY,
  };
}

/**
 * Validate + normalise one country row. Throws APIError(400) on bad input so
 * the platform-admin PUT surfaces a precise message.
 */
function sanitizeCountry(raw, index) {
  const where = `countries[${index}]`;
  const iso2 = String(raw?.iso2 || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(iso2)) throw new APIError(`${where}: iso2 must be two letters`, 400);
  const name = String(raw?.name || "").trim();
  if (!name || name.length > 80) throw new APIError(`${where}: name is required (max 80 chars)`, 400);
  const nameAr = String(raw?.nameAr || "").trim().slice(0, 80);
  let dialCode = String(raw?.dialCode || "").trim().replace(/\s+/g, "");
  if (/^\d+$/.test(dialCode)) dialCode = `+${dialCode}`;
  if (!/^\+[1-9]\d{0,3}$/.test(dialCode)) {
    throw new APIError(`${where}: dialCode must be "+" followed by 1–4 digits`, 400);
  }
  const minDigits = Number(raw?.minDigits);
  const maxDigits = Number(raw?.maxDigits);
  const { min, max } = PHONE_DIGIT_BOUNDS;
  if (!Number.isInteger(minDigits) || !Number.isInteger(maxDigits)) {
    throw new APIError(`${where}: minDigits/maxDigits must be integers`, 400);
  }
  if (minDigits < min || maxDigits > max || minDigits > maxDigits) {
    throw new APIError(`${where}: digit bounds must satisfy ${min} ≤ min ≤ max ≤ ${max}`, 400);
  }
  return { iso2, name, nameAr, dialCode, minDigits, maxDigits, enabled: raw?.enabled !== false };
}

/** The effective config `{ countries, defaultCountry }` (all rows, enabled flag intact). */
export async function getPhoneCountryConfig() {
  if (cache.config && Date.now() - cache.at < CACHE_TTL_MS) return cache.config;
  let config = defaultConfig();
  try {
    const c = col();
    if (c) {
      const doc = await c.findOne({ _id: CONFIG_ID });
      if (doc && Array.isArray(doc.countries) && doc.countries.length) {
        const countries = [];
        doc.countries.forEach((row, i) => {
          try {
            countries.push(sanitizeCountry(row, i));
          } catch (err) {
            logger.warn("phoneCountries: skipping invalid stored row", { index: i, error: err.message });
          }
        });
        if (countries.length) {
          const enabled = countries.filter((x) => x.enabled);
          const wanted = String(doc.defaultCountry || "").toUpperCase();
          const defaultCountry = enabled.some((x) => x.iso2 === wanted)
            ? wanted
            : enabled[0]?.iso2 || DEFAULT_PHONE_COUNTRY;
          config = { countries, defaultCountry };
        }
      }
    }
    cache = { config, at: Date.now() };
    return config;
  } catch (err) {
    logger.error("phoneCountries: failed to load config; using defaults", { error: err?.message });
    return cache.config || config;
  }
}

/** Enabled countries only + the default — what signup/profile forms consume. */
export async function getEnabledPhoneCountries() {
  const cfg = await getPhoneCountryConfig();
  const countries = cfg.countries.filter((c) => c.enabled);
  // Fail-safe: never hand the UI an empty list.
  const list = countries.length ? countries : defaultConfig().countries;
  const defaultCountry = list.some((c) => c.iso2 === cfg.defaultCountry)
    ? cfg.defaultCountry
    : list[0].iso2;
  return { countries: list, defaultCountry };
}

/**
 * Persist the operator's full country list + default. Validates every row,
 * rejects duplicates, and requires at least one enabled country so signup can
 * never be left without a selectable dial code.
 */
export async function setPhoneCountryConfig({ countries, defaultCountry }, updatedBy) {
  if (!Array.isArray(countries) || countries.length === 0) {
    throw new APIError("At least one country is required", 400);
  }
  if (countries.length > 300) throw new APIError("Too many countries (max 300)", 400);
  const rows = countries.map(sanitizeCountry);
  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.iso2)) throw new APIError(`Duplicate country: ${r.iso2}`, 400);
    seen.add(r.iso2);
  }
  const enabled = rows.filter((r) => r.enabled);
  if (!enabled.length) throw new APIError("At least one country must be enabled", 400);
  const def = String(defaultCountry || "").toUpperCase();
  if (!enabled.some((r) => r.iso2 === def)) {
    throw new APIError("defaultCountry must be one of the enabled countries", 400);
  }
  const c = col();
  if (!c) throw new APIError("Platform config store unavailable", 503);
  await c.updateOne(
    { _id: CONFIG_ID },
    {
      $set: {
        countries: rows,
        defaultCountry: def,
        updatedAt: new Date(),
        updatedBy: updatedBy || null,
      },
    },
    { upsert: true }
  );
  invalidatePhoneCountryCache();
  return getPhoneCountryConfig();
}

export function invalidatePhoneCountryCache() {
  cache = { config: null, at: 0 };
}

/**
 * Validate a merchant-entered phone against the ENABLED countries and return
 * `{ phone: "+249912345678", phoneCountry: "SD" }`. Throws APIError(400) with
 * a human-readable message on any problem. `phoneCountry` falls back to the
 * platform default when omitted.
 */
export async function resolveMerchantPhone(rawPhone, rawCountry) {
  const { countries, defaultCountry } = await getEnabledPhoneCountries();
  const iso2 = String(rawCountry || defaultCountry).trim().toUpperCase();
  const country = countries.find((c) => c.iso2 === iso2);
  if (!country) throw new APIError(`Phone country "${iso2}" is not available`, 400);
  const result = normalizePhone(rawPhone, country);
  if (!result.ok) {
    const messages = {
      empty: "Phone number is required",
      "invalid-characters": "Phone number may only contain digits",
      "wrong-country": `Phone number does not match the ${country.name} dial code (${country.dialCode})`,
      "too-short": `Phone number is too short for ${country.name} (${country.minDigits} digits)`,
      "too-long": `Phone number is too long for ${country.name} (max ${country.maxDigits} digits)`,
    };
    throw new APIError(messages[result.reason] || "Invalid phone number", 400);
  }
  return { phone: result.e164, phoneCountry: country.iso2 };
}
