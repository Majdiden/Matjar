/**
 * Invitation codes (PBI 10-47): the code format shared by the server
 * (services/signupAccess.js) and the signup form (dashboard/src/lib/invitationCode.ts).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateCode, normalizeCode, formatCode } from "../../services/signupAccess.js";
import { INVITE_CODE_ALPHABET, INVITE_CODE_LENGTH } from "../../schemas/inviteCode.js";
import { normalizeInvitationCode, formatInvitationCode } from "../../dashboard/src/lib/invitationCode.ts";

describe("invitation codes", () => {
  it("are 8 unambiguous characters, and different every time", () => {
    const seen = new Set();
    for (let i = 0; i < 500; i++) {
      const c = generateCode();
      assert.equal(c.length, INVITE_CODE_LENGTH);
      for (const ch of c) assert.ok(INVITE_CODE_ALPHABET.includes(ch), ch);
      seen.add(c);
    }
    assert.equal(seen.size, 500);
    assert.ok(!/[01ILO]/.test(INVITE_CODE_ALPHABET));
  });

  it("read the same however they are typed, on both sides", () => {
    for (const typed of ["abcd-ef23", " ABCD EF23 ", "abcdef23", "ABCD—EF23"]) {
      assert.equal(normalizeCode(typed), "ABCDEF23");
      assert.equal(normalizeInvitationCode(typed), "ABCDEF23");
    }
    assert.equal(formatCode("abcdef23"), "ABCD-EF23");
    assert.equal(formatInvitationCode("abcdef23xyz"), "ABCD-EF23");
    assert.equal(formatInvitationCode("ab"), "AB");
  });
});
