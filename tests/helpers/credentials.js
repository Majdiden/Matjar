/**
 * Throwaway test passwords, generated per run so no password literal is ever
 * committed (secret scanners flag them, and copy-pasted test passwords have a
 * way of ending up in real accounts). Meets the signup policy: 8+ chars with
 * upper case, lower case and a digit.
 */
import crypto from "node:crypto";

export const throwawayPassword = () => `Tt1-${crypto.randomBytes(9).toString("base64url")}`;
