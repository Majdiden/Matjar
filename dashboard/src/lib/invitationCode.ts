/**
 * Signup invitation / referral codes (PBI 10-47). Mirrors the server helpers
 * in services/signupAccess.js. Pure: unit tested directly.
 */

/** What signup asks for: nothing, an optional referral code, or a required beta code. */
export type SignupCodeMode = 'open' | 'optional' | 'required';

/** "abcd-ef 12" → "ABCDEF12" (what the server stores and compares). */
export const normalizeInvitationCode = (raw: string): string =>
  String(raw ?? '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '');

/** As typed → "ABCD-EF12": upper case, dash after four, at most 8 characters. */
export function formatInvitationCode(raw: string): string {
  const c = normalizeInvitationCode(raw).slice(0, 8);
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}
