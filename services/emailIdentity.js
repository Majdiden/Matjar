/**
 * Email sender identities + branded customer-email template.
 *
 * Two sender classes (per product spec):
 *   - Matjar → store owners (account/ops): "Matjar <noreply@matjar.to>"
 *     → use `platformFrom()` (config.emailFrom).
 *   - Store → customers: "StoreName <noreply@<store-host>>" where store-host
 *     is the verified custom domain, else the platform subdomain
 *     (e.g. mystore.matjar.to) → use `storeFrom(tenant)`.
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

/** A store's verified custom domain, or null if it doesn't have one. */
function verifiedCustomDomain(tenant) {
  const d = tenant?.domains || {};
  if (d.customDomain?.isVerified && d.customDomain?.domain) {
    return String(d.customDomain.domain).toLowerCase();
  }
  return null;
}

/** The verified platform sender address, parsed from config.emailFrom
 *  ("Matjar <noreply@matjar.to>" → "noreply@matjar.to"). */
function platformSenderAddress() {
  const raw = String(config.emailFrom || "");
  const m = raw.match(/<([^>]+)>/);
  return (m ? m[1] : raw).trim() || "noreply@matjar.to";
}

/** The host a store's customer mail appears to come from. */
export function storeMailHost(tenant) {
  return (
    verifiedCustomDomain(tenant) ||
    platformSenderAddress().split("@")[1] ||
    config.platformDomain
  ).toLowerCase();
}

/**
 * Store→customer "From" header.
 *
 * DELIVERABILITY: the address domain MUST be verified with the email provider
 * (Resend) or the send is rejected. Per-store platform subdomains
 * (store.matjar.to) are NOT individually verified, so sending from them
 * silently fails. We therefore send from the VERIFIED platform address
 * (e.g. noreply@matjar.to) with the STORE NAME as the display name, and only
 * use the store's own domain when it's a VERIFIED CUSTOM domain. Reply-To
 * carries the store's real contact so replies still reach the merchant.
 *
 * The merchant's configured `settings.notifications.fromName` is ALWAYS honored
 * as the display name. Their `fromEmail` (defaulted to no-reply@<subdomain> at
 * store creation) is honored as the address ONLY when its domain is actually
 * sendable — a verified custom domain or the platform root domain — otherwise
 * we keep the deliverability-safe platform sender. So the stored default shows
 * in settings and "just works" the moment the domain becomes sendable, without
 * breaking delivery in the meantime.
 */
export function storeFrom(tenant) {
  const notif = tenant?.settings?.notifications || {};
  const storeName =
    notif.fromName || tenant?.settings?.storeName || tenant?.name || "Store";

  const custom = verifiedCustomDomain(tenant);
  let addr = custom ? `noreply@${custom}` : platformSenderAddress();

  // Domains we can actually send from (verified with the provider): a verified
  // custom domain, or the platform root domain. A per-store subdomain
  // (mystore.matjar.to) is NOT individually verified → never send from it.
  const platformDomain = platformSenderAddress().split("@")[1];
  const sendable = [custom, platformDomain]
    .filter(Boolean)
    .map((d) => String(d).toLowerCase());
  const configured = String(notif.fromEmail || "").trim().toLowerCase();
  const configuredDomain = configured.includes("@") ? configured.split("@")[1] : "";
  if (configured && sendable.includes(configuredDomain)) {
    addr = configured;
  }

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
