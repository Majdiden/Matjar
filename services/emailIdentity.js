/**
 * Email sender identities + branded customer-email template.
 *
 * Two sender classes (per product spec):
 *   - Matjar → store owners (account/ops): "Matjar <noreply@invoila.io>"
 *     → use `platformFrom()` (config.emailFrom).
 *   - Store → customers: "StoreName <noreply@<store-host>>" where store-host
 *     is the verified custom domain, else the platform subdomain
 *     (e.g. mystore.invoila.io) → use `storeFrom(tenant)`.
 *
 * Customer emails are wrapped in a branded envelope with the store logo
 * (when uploaded) and store details in the footer via `wrapStoreEmail`.
 */
import config from "../config/index.js";

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Platform (Matjar) sender for owner/account emails. */
export function platformFrom() {
  return config.emailFrom;
}

/** The host a store sends customer mail from (custom domain if verified). */
export function storeMailHost(tenant) {
  const d = tenant?.domains || {};
  if (d.primaryDomain === "custom" && d.customDomain?.isVerified && d.customDomain?.domain) {
    return String(d.customDomain.domain).toLowerCase();
  }
  if (d.customDomain?.isVerified && d.customDomain?.domain) {
    return String(d.customDomain.domain).toLowerCase();
  }
  return (
    d.subdomain?.fullDomain ||
    `${tenant?.slug || "store"}.${config.platformDomain}`
  ).toLowerCase();
}

/**
 * Store→customer "From" header. Honors a merchant-set fromEmail override;
 * otherwise "StoreName <noreply@<store-host>>".
 */
export function storeFrom(tenant) {
  const storeName = tenant?.settings?.storeName || tenant?.name || "Store";
  const override = tenant?.settings?.notifications?.fromEmail;
  const addr = override || `noreply@${storeMailHost(tenant)}`;
  return `${storeName} <${addr}>`;
}

/** Reply-to a store's real contact email when available. */
export function storeReplyTo(tenant) {
  return (
    tenant?.settings?.notifications?.replyTo ||
    tenant?.settings?.supportEmail ||
    tenant?.email ||
    undefined
  );
}

/**
 * Wrap plain content HTML in a branded store envelope: store logo header
 * (if uploaded) + footer with store name and details. `dir` flips for RTL.
 *
 * @param {object} o
 * @param {object} o.tenant
 * @param {string} o.contentHtml  the email body (already-rendered HTML)
 * @param {string} [o.language]   'ar' → RTL
 */
export function wrapStoreEmail({ tenant, contentHtml, language }) {
  const s = tenant?.settings || {};
  const storeName = s.storeName || tenant?.name || "Store";
  const logo = s.logo;
  const host = storeMailHost(tenant);
  const isAr = String(language || s.language || "").toLowerCase().startsWith("ar");
  const dir = isAr ? "rtl" : "ltr";
  const align = isAr ? "right" : "left";

  const footerBits = [
    escapeHtml(storeName),
    s.supportEmail ? escapeHtml(s.supportEmail) : "",
    s.phone ? escapeHtml(s.phone) : "",
    s.address ? escapeHtml(s.address) : "",
  ].filter(Boolean);

  const header = logo
    ? `<div style="text-align:center;padding:8px 0 4px"><img src="${escapeHtml(logo)}" alt="${escapeHtml(storeName)}" style="max-height:48px;max-width:180px;height:auto;width:auto"></div>`
    : `<div style="text-align:center;padding:8px 0 4px;font-size:20px;font-weight:700;color:#111">${escapeHtml(storeName)}</div>`;

  return (
    `<div dir="${dir}" style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;color:#111;text-align:${align}">` +
    header +
    `<div style="border-top:1px solid #eee;margin:12px 0"></div>` +
    `<div style="font-size:15px;line-height:1.6">${contentHtml}</div>` +
    `<div style="border-top:1px solid #eee;margin:20px 0 12px"></div>` +
    `<div style="color:#888;font-size:12px;line-height:1.6">${footerBits.join(" · ")}` +
    `<br><span style="color:#aaa">${escapeHtml(host)}</span></div>` +
    `</div>`
  );
}
