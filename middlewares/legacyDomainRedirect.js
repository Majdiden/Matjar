/**
 * Permanent (301) redirect from retired platform domains to the current one.
 *
 * When the platform moved off `invoila.io` to `matjar.to`, every old link —
 * the apex (`invoila.io`), the dashboard host (`app.invoila.io`), and every
 * merchant subdomain (`<slug>.invoila.io`) — must keep working. This
 * middleware catches any request whose Host is a retired domain (or a
 * subdomain of one, per `config.legacyDomains`) and 301s it to the SAME label
 * under `config.platformDomain`, preserving the full path + query string:
 *
 *     invoila.io/pricing            → https://matjar.to/pricing
 *     app.invoila.io/dashboard/...  → https://app.matjar.to/dashboard/...
 *     acme.invoila.io/products/42   → https://acme.matjar.to/products/42
 *
 * Mounted as one of the very first middlewares so retired-domain traffic is
 * bounced before any tenant resolution / auth work happens.
 *
 * NOTE (infra): for this to fire, DNS + TLS for the retired domain must still
 * resolve to this app (a valid cert for `invoila.io` + `*.invoila.io` at the
 * edge). The redirect itself is HTTP-level only.
 */
import config from "../config/index.js";

export function legacyDomainRedirect(req, res, next) {
  const legacy = config.legacyDomains;
  if (!legacy.length) return next();

  const host = String(req.hostname || "")
    .toLowerCase()
    .replace(/\.$/, "");
  if (!host) return next();

  // Match the retired domain itself or any of its subdomains.
  const match = legacy.find((d) => host === d || host.endsWith(`.${d}`));
  if (!match) return next();

  // Swap the retired suffix for the current platform domain, keeping any
  // leading label (store slug, `app`, `www`, …) intact.
  const newHost = host.slice(0, host.length - match.length) + config.platformDomain;

  // Always redirect to https — retired domains are external prod hosts and the
  // new domain is the canonical, TLS-terminated origin.
  return res.redirect(301, `https://${newHost}${req.originalUrl}`);
}

export default legacyDomainRedirect;
