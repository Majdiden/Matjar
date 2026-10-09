/**
 * Store contact info (`tenant.settings.contact`) — one rule set shared by the
 * bulk settings PUT (controllers/settings.js) and the store profile API
 * (services/storeProfile.js). Plain strings, trimmed and length-capped;
 * address may contain newlines.
 */

/** Contact field → max stored length. */
export const STORE_CONTACT_MAX_LENGTH = Object.freeze({
  email: 200,
  phone: 60,
  address: 500,
});

export const STORE_CONTACT_FIELDS = Object.freeze(Object.keys(STORE_CONTACT_MAX_LENGTH));

/** Normalise one contact value; null/undefined become "". */
export const normalizeStoreContactField = (field, raw) =>
  String(raw || "").trim().slice(0, STORE_CONTACT_MAX_LENGTH[field]);
