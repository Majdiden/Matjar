/**
 * Merchant text keeps its own reading order (storefront-themes/_shared/utils/bidi.ts).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isolateBidi, stripBidi } from "../../storefront-themes/_shared/utils/bidi.ts";

describe("isolateBidi", () => {
  it("isolates text with Arabic letters, once, and leaves Latin alone", () => {
    const name = "1000جرام بخور عنبر ملكي";
    const iso = isolateBidi(name);
    assert.equal(iso, `⁨${name}⁩`);
    assert.equal(isolateBidi(iso), iso);
    assert.equal(stripBidi(iso), name);
    assert.equal(isolateBidi("Glide Mouse 2"), "Glide Mouse 2");
    assert.equal(isolateBidi(""), "");
    assert.equal(isolateBidi(null), null);
  });
});
