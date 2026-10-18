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

const BRAND_BLUE = "#2563eb";
const FONT = "-apple-system,'Segoe UI',Tahoma,Arial,sans-serif";

/**
 * Design (PBI 10-55, "brand banner"): a blue Matjar band with the Matjar logo
 * on a white tile (so the blue logo stands out from the blue band) and the
 * name; a white card with the title, the text and a rounded button, all
 * centred; the footer stacks the Matjar logo above its name, then says which
 * store the person runs and links to the notification settings. Table layout
 * and inline styles only (bgcolor as the band's fallback), so Gmail, Outlook
 * and phone mail apps render it the same.
 *
 * @param {object} o
 * @param {string} o.title
 * @param {string} o.body
 * @param {string|null} [o.linkUrl]       absolute URL for the button (tracked)
 * @param {string|null} [o.pixelUrl]      tracking image that counts the open
 * @param {string} o.prefsUrl             absolute URL of the notification settings
 * @param {string} o.storeName
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
  matjarLogoUrl,
  language,
}) {
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

  const img = (size, radius) =>
    matjarLogoUrl
      ? `<img src="${escapeHtml(matjarLogoUrl)}" width="${size}" height="${size}" alt="Matjar" style="display:block;width:${size}px;height:${size}px;border-radius:${radius}px;border:0" />`
      : "";

  // The logo on a white tile: the logo itself is blue, like the band.
  const bandLogo = matjarLogoUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto"><tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:18px;padding:6px">${img(52, 13)}</td></tr></table>`
    : "";

  const button = linkUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:10px auto 0"><tr><td align="center" bgcolor="${BRAND_BLUE}" style="border-radius:999px;background:${BRAND_BLUE}"><a href="${escapeHtml(linkUrl)}" style="display:inline-block;padding:14px 34px;font-family:${FONT};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px">${c.open}</a></td></tr></table>`
    : "";

  const html =
    `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>` +
    `<body style="margin:0;padding:0;background:#eef2ff">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#eef2ff" style="background:#eef2ff"><tr><td align="center" style="padding:24px 12px">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${dir}" style="max-width:560px;font-family:${FONT};background:#ffffff;border-radius:18px;overflow:hidden">` +
    // Blue Matjar band
    `<tr><td align="center" bgcolor="${BRAND_BLUE}" style="background:${BRAND_BLUE};background-image:linear-gradient(135deg,#2563eb,#1d4ed8);padding:26px 24px 22px">` +
    bandLogo +
    `<div style="margin-top:10px;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:.3px">Matjar</div>` +
    `<div style="margin-top:4px;font-size:13px;color:#dbeafe">${c.from}</div>` +
    `</td></tr>` +
    // Message
    `<tr><td align="center" style="padding:28px 32px 30px;text-align:center">` +
    `<h1 style="margin:0 0 14px 0;font-size:23px;line-height:1.5;color:#111827;text-align:center">${escapeHtml(title)}</h1>` +
    `<div style="font-size:16px;color:#374151">${paragraphsHtml(body, "center")}</div>` +
    button +
    `</td></tr></table>` +
    // Footer: logo above the name
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${dir}" style="max-width:560px;font-family:${FONT}">` +
    `<tr><td align="center" style="padding:22px 16px 8px;font-size:12px;line-height:1.8;color:#6b7280;text-align:center">` +
    (matjarLogoUrl ? `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto"><tr><td>${img(32, 8)}</td></tr></table>` : "") +
    `<div style="margin:4px 0 8px;font-size:13px;font-weight:700;color:#111827">Matjar</div>` +
    `${escapeHtml(c.why(store))}<br><a href="${escapeHtml(prefsUrl)}" style="color:#6b7280">${c.manage}</a>` +
    (pixelUrl ? `<img src="${escapeHtml(pixelUrl)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" />` : "") +
    `</td></tr></table></td></tr></table></body></html>`;

  return { subject: title, text, html };
}

export default buildAnnouncementEmail;
