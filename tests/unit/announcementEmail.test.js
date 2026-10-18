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

describe("announcement email", () => {
  it("leads with the Matjar logo, names the store only in the footer, and tracks the open", () => {
    const { html, subject } = buildAnnouncementEmail(base);
    assert.equal(subject, "أضف منتجاتك");
    assert.ok(html.indexOf("pwa-192x192.png") < html.indexOf("<h1"), "Matjar logo above the message");
    assert.match(html, /رسالة من فريق Matjar/);
    assert.match(html, /dir="rtl"/);
    assert.ok(html.indexOf("بيتنا") > html.indexOf("<h1"), "store named only after the message");
    assert.match(html, /\/e\/o\/t/);
    assert.match(html, /href="https:\/\/app\.matjar\.to\/e\/c\/t"/);
  });

  it("escapes the merchant's text", () => {
    const { html } = buildAnnouncementEmail({ ...base, storeName: "<b>x</b>", title: "<script>" });
    assert.ok(!html.includes("<script>") && !html.includes("<b>x</b>"));
  });
});
