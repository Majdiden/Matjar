import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildAnnouncementEmail } from "../../services/emailTemplates/platformAnnouncement.js";

const base = {
  title: "أضف منتجاتك",
  body: "سطر أول.\n\nفقرة ثانية.",
  linkUrl: "https://app.matjar.to/e/c/t",
  pixelUrl: "https://app.matjar.to/e/o/t",
  prefsUrl: "https://app.matjar.to/dashboard/settings?tab=notifications",
  storeName: "بيتنا",
  matjarLogoUrl: "https://app.matjar.to/dashboard/pwa-192x192.png",
  language: "ar",
};

describe("announcement email (store-first design)", () => {
  it("leads with the store's logo, signs off with Matjar's, and tracks the open", () => {
    const { html, subject } = buildAnnouncementEmail({ ...base, storeLogoUrl: "https://res.cloudinary.com/x/logo.png" });
    assert.equal(subject, "أضف منتجاتك");
    assert.ok(html.indexOf("res.cloudinary.com/x/logo.png") < html.indexOf("<h1"), "store logo above the message");
    assert.match(html, /pwa-192x192\.png/);
    assert.match(html, /رسالة من فريق Matjar/);
    assert.match(html, /dir="rtl"/);
    assert.match(html, /\/e\/o\/t/);
    assert.match(html, /href="https:\/\/app\.matjar\.to\/e\/c\/t"/);
  });

  it("without a logo shows the store's first letter in its colour", () => {
    const { html } = buildAnnouncementEmail({ ...base, brandColor: "#5e3049" });
    assert.match(html, /background:#5e3049[^>]*>ب</);
    const blue = buildAnnouncementEmail({ ...base, brandColor: "not-a-colour" }).html;
    assert.match(blue, /background:#2563eb[^>]*>ب</);
  });

  it("escapes the merchant's text", () => {
    const { html } = buildAnnouncementEmail({ ...base, storeName: "<b>x</b>", title: "<script>" });
    assert.ok(!html.includes("<script>") && !html.includes("<b>x</b>"));
  });
});
