/**
 * Platform announcement email (PBI 10-46): the email copy of a notification
 * the Matjar team sends to stores. A message, not an alert: title, the text in
 * paragraphs, an optional button into the dashboard, and why the merchant got
 * it with a link to switch it off.
 *
 * Pure: returns `{ subject, text, html }` for services/providers/email.js.
 */
import { escapeHtml } from "../generatedPages.js";

const COPY = {
  ar: {
    open: "افتح لوحة التحكم",
    why: (store) => `وصلتك هذه الرسالة لأنك تدير متجر «${store}» على Matjar.`,
    manage: "إعدادات الإشعارات",
  },
  en: {
    open: "Open your dashboard",
    why: (store) => `You are receiving this because you run “${store}” on Matjar.`,
    manage: "Notification settings",
  },
};

/** Text → HTML paragraphs: blank lines split paragraphs, single newlines break lines. */
function paragraphsHtml(text, align) {
  return String(text || "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px 0;line-height:1.7;text-align:${align}">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`
    )
    .join("");
}

/**
 * @param {object} o
 * @param {string} o.title
 * @param {string} o.body
 * @param {string|null} [o.linkUrl]   absolute URL for the button (tracked)
 * @param {string|null} [o.pixelUrl]  tracking image that counts the open
 * @param {string} o.prefsUrl         absolute URL of the notification settings
 * @param {string} o.storeName
 * @param {"ar"|"en"} [o.language]
 */
export function buildAnnouncementEmail({ title, body, linkUrl, pixelUrl, prefsUrl, storeName, language }) {
  const lang = String(language || "").toLowerCase().startsWith("ar") ? "ar" : "en";
  const c = COPY[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";
  const align = lang === "ar" ? "right" : "left";
  const store = storeName || "Matjar";

  const text = [
    title,
    "",
    String(body || "").trim(),
    ...(linkUrl ? ["", `${c.open}: ${linkUrl}`] : []),
    "",
    "—",
    c.why(store),
    `${c.manage}: ${prefsUrl}`,
  ].join("\n");

  const button = linkUrl
    ? `<p style="margin:8px 0 24px 0;text-align:${align}"><a href="${escapeHtml(linkUrl)}" style="background:#111827;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">${c.open}</a></p>`
    : "";

  const html =
    `<div dir="${dir}" style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:8px 4px;color:#111;text-align:${align}">` +
    `<div style="font-size:13px;font-weight:700;letter-spacing:.04em;color:#6b7280;margin:0 0 12px 0">Matjar</div>` +
    `<h1 style="margin:0 0 16px 0;font-size:22px;line-height:1.4;text-align:${align}">${escapeHtml(title)}</h1>` +
    paragraphsHtml(body, align) +
    button +
    `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px 0" />` +
    `<p style="margin:0;color:#6b7280;font-size:12px;line-height:1.7;text-align:${align}">${escapeHtml(c.why(store))}<br>` +
    `<a href="${escapeHtml(prefsUrl)}" style="color:#6b7280">${c.manage}</a></p>` +
    (pixelUrl ? `<img src="${escapeHtml(pixelUrl)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" />` : "") +
    `</div>`;

  return { subject: title, text, html };
}

export default buildAnnouncementEmail;
