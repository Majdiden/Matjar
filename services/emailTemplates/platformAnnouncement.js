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
    from: "رسالة من فريق Matjar",
    why: (store) => `وصلتك هذه الرسالة لأنك تدير متجر «${store}» على Matjar.`,
    manage: "إعدادات الإشعارات",
  },
  en: {
    open: "Open your dashboard",
    from: "A message from the Matjar team",
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
        `<p style="margin:0 0 14px 0;line-height:1.8;text-align:${align}">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`
    )
    .join("");
}

/** First letter of the store name, for the tile shown when it has no logo. */
const initialOf = (name) => (Array.from(String(name || "").trim())[0] || "M").toUpperCase();

const BRAND_BLUE = "#2563eb";
const FONT = "-apple-system,'Segoe UI',Tahoma,Arial,sans-serif";

/**
 * Design "store first" (PBI 10-55): the store's logo and name lead, with a
 * "message from the Matjar team" label; the message sits in a white card with
 * a blue top line and a full-width button that is easy to tap on a phone;
 * Matjar signs off in the footer with its icon. Table layout and inline
 * styles only, so Gmail, Outlook and phone mail apps render it the same.
 *
 * @param {object} o
 * @param {string} o.title
 * @param {string} o.body
 * @param {string|null} [o.linkUrl]       absolute URL for the button (tracked)
 * @param {string|null} [o.pixelUrl]      tracking image that counts the open
 * @param {string} o.prefsUrl             absolute URL of the notification settings
 * @param {string} o.storeName
 * @param {string|null} [o.storeLogoUrl]  absolute URL of the store's logo
 * @param {string|null} [o.brandColor]    store colour for the no-logo tile (#rrggbb)
 * @param {string|null} [o.matjarLogoUrl] absolute URL of the Matjar icon
 * @param {"ar"|"en"} [o.language]
 */
export function buildAnnouncementEmail({
  title,
  body,
  linkUrl,
  pixelUrl,
  prefsUrl,
  storeName,
  storeLogoUrl,
  brandColor,
  matjarLogoUrl,
  language,
}) {
  const lang = String(language || "").toLowerCase().startsWith("ar") ? "ar" : "en";
  const c = COPY[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";
  const align = lang === "ar" ? "right" : "left";
  const store = storeName || "Matjar";
  const tile = /^#[0-9a-f]{6}$/i.test(brandColor || "") ? brandColor : BRAND_BLUE;

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

  const logo = storeLogoUrl
    ? `<img src="${escapeHtml(storeLogoUrl)}" width="88" height="88" alt="${escapeHtml(store)}" style="display:block;margin:0 auto;width:88px;height:88px;border-radius:20px;object-fit:contain;background:#ffffff;border:0" />`
    : `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto"><tr><td width="88" height="88" align="center" valign="middle" style="width:88px;height:88px;border-radius:20px;background:${tile};color:#ffffff;font-family:${FONT};font-size:40px;font-weight:700;line-height:88px">${escapeHtml(initialOf(store))}</td></tr></table>`;

  const button = linkUrl
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px"><tr><td align="center" style="border-radius:12px;background:${BRAND_BLUE}"><a href="${escapeHtml(linkUrl)}" style="display:block;padding:15px 20px;font-family:${FONT};font-size:17px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px">${c.open}</a></td></tr></table>`
    : "";

  const matjarMark = matjarLogoUrl
    ? `<img src="${escapeHtml(matjarLogoUrl)}" width="24" height="24" alt="Matjar" style="display:inline-block;width:24px;height:24px;border-radius:6px;vertical-align:middle;border:0" /> `
    : "";

  const html =
    `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>` +
    `<body style="margin:0;padding:0;background:#faf7f2">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f2"><tr><td align="center" style="padding:28px 12px">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${dir}" style="max-width:560px;font-family:${FONT}">` +
    // Store header
    `<tr><td align="center" style="padding:0 0 18px">${logo}` +
    `<div style="margin-top:10px;font-size:16px;font-weight:700;color:#111827">${escapeHtml(store)}</div>` +
    `<div style="display:inline-block;margin-top:6px;padding:3px 12px;border-radius:999px;background:#eff6ff;color:${BRAND_BLUE};font-size:12px">${c.from}</div>` +
    `</td></tr>` +
    // Message card
    `<tr><td style="background:#ffffff;border-radius:18px;border-top:4px solid ${BRAND_BLUE};padding:28px 28px 24px;text-align:${align}">` +
    `<h1 style="margin:0 0 16px 0;font-size:23px;line-height:1.5;color:#111827;text-align:${align}">${escapeHtml(title)}</h1>` +
    `<div style="font-size:16px;color:#374151">${paragraphsHtml(body, align)}</div>` +
    button +
    `</td></tr>` +
    // Footer
    `<tr><td align="center" style="padding:20px 16px 8px;font-size:12px;line-height:1.8;color:#6b7280">` +
    `${matjarMark}<span style="font-weight:700;color:#111827;vertical-align:middle">Matjar</span><br>` +
    `${escapeHtml(c.why(store))}<br><a href="${escapeHtml(prefsUrl)}" style="color:#6b7280">${c.manage}</a>` +
    (pixelUrl ? `<img src="${escapeHtml(pixelUrl)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" />` : "") +
    `</td></tr></table></td></tr></table></body></html>`;

  return { subject: title, text, html };
}

export default buildAnnouncementEmail;
