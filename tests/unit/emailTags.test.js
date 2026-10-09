/**
 * Email tags (services/providers/email.js → toResendTags).
 *
 * Resend rejects the WHOLE email when a tag is a bare string or contains a
 * character outside [A-Za-z0-9_-]. Platform alerts passed
 * ["platform-alert", "tenant.signup"], so every alert (including the
 * new-store email) failed in production. Pins the normalisation.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toResendTags } from "../../services/providers/email.js";

const VALID = /^[A-Za-z0-9_-]{1,256}$/;

describe("toResendTags", () => {
  it("turns a name→value map into Resend tag objects with safe characters", () => {
    assert.deepEqual(toResendTags({ category: "platform-alert", event: "tenant.signup" }), [
      { name: "category", value: "platform-alert" },
      { name: "event", value: "tenant_signup" },
    ]);
  });

  it("accepts the legacy list-of-labels form", () => {
    assert.deepEqual(toResendTags(["platform-alert", "tenant.signup"]), [
      { name: "tag0", value: "platform-alert" },
      { name: "tag1", value: "tenant_signup" },
    ]);
  });

  it("sanitises existing tag objects and drops empty ones", () => {
    const out = toResendTags([{ name: "event key", value: "a/b" }, { name: "", value: "x" }, { name: "y", value: "" }]);
    assert.deepEqual(out, [{ name: "event_key", value: "a_b" }]);
  });

  it("returns undefined when there is nothing to send", () => {
    for (const v of [undefined, null, [], {}, "text", [{ name: "", value: "" }]]) assert.equal(toResendTags(v), undefined);
  });

  it("always yields names and values Resend accepts", () => {
    const out = toResendTags({ ["ä".repeat(300)]: "تجربة.مع.نقاط", "x-ok_1": "v".repeat(400) });
    for (const t of out) {
      assert.match(t.name, VALID);
      assert.match(t.value, VALID);
    }
  });
});
