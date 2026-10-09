/**
 * Fallback share-menu links (dashboard/src/lib/share.ts) — used when the
 * device has no native share sheet. Pins URL encoding so Arabic messages and
 * store URLs survive intact.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SHARE_TARGETS, shareIntentUrl } from "../../dashboard/src/lib/share.ts";

const URL_ = "https://nile.matjar.to";

describe("shareIntentUrl", () => {
  it("puts message + url in one WhatsApp text, encoded", () => {
    const href = shareIntentUrl("whatsapp", URL_, "شوف متجري من هنا:");
    assert.ok(href.startsWith("https://wa.me/?text="));
    assert.equal(new URL(href).searchParams.get("text"), `شوف متجري من هنا: ${URL_}`);
  });

  it("shares just the url on Facebook (the sharer ignores text)", () => {
    const href = shareIntentUrl("facebook", URL_, "hello");
    assert.equal(new URL(href).searchParams.get("u"), URL_);
  });

  it("passes url and text separately to Telegram, omitting empty text", () => {
    const withText = new URL(shareIntentUrl("telegram", URL_, "hi & bye"));
    assert.equal(withText.searchParams.get("url"), URL_);
    assert.equal(withText.searchParams.get("text"), "hi & bye");
    assert.equal(new URL(shareIntentUrl("telegram", URL_, "")).searchParams.has("text"), false);
  });

  it("offers every target with an https link", () => {
    for (const target of SHARE_TARGETS) {
      assert.equal(new URL(shareIntentUrl(target, URL_, "x")).protocol, "https:");
    }
  });
});
