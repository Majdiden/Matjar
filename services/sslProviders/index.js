import stubProvider from "./stub.js";
import config from "../../config/index.js";

// Real provider adapters are loaded lazily in getSslProvider() so the
// app still boots in environments that don't have provider-specific
// deps installed.
async function loadProvider(name) {
  switch (name) {
    case "stub":
      return stubProvider;
    case "cloudflare":
      return (await import("./cloudflare.js")).default;
    default:
      return null;
  }
}

/**
 * SSL provider adapter registry.
 *
 * Each adapter implements the same small interface:
 *
 *   async issueCertificate({ hostname, domainId }) → {
 *     ok: boolean,
 *     status: "issued" | "pending" | "failed",
 *     issuedAt?: Date,
 *     expiresAt?: Date,
 *     error?: string,
 *   }
 *
 *   async renewCertificate({ hostname, domainId }) → same shape
 *
 *   async revokeCertificate({ hostname, domainId }) → { ok, error? }
 *
 * Implementations currently shipped:
 *   - `stub`       — fakes issuance synchronously, used in dev/tests
 *                    and as the default until SSL_PROVIDER is set
 *   - `cloudflare` — real Cloudflare for SaaS / Custom Hostnames
 *                    adapter, needs CLOUDFLARE_API_TOKEN + CLOUDFLARE_ZONE_ID
 */

const VALID_PROVIDERS = ["stub", "cloudflare"];

// Cache resolved providers so repeated calls don't re-import.
const cache = new Map();

/**
 * Resolve the configured SSL provider. Defaults to "stub" — the
 * in-memory adapter that fakes issuance — so platforms without
 * real provider config still transition domains to active.
 *
 * Synchronous wrapper around a lazy async load — the provision flow
 * is async anyway so callers `await getSslProvider()` directly.
 */
export async function getSslProvider() {
  const rawName = config.sslProvider.trim();
  const isProduction = config.isProduction;

  // In production, `SSL_PROVIDER` MUST be set to a real adapter.
  // An unset or stub provider in prod would hand real merchants a
  // "certificate issued" response without ever talking to a CA —
  // they'd point traffic at us and get TLS errors. Fail loudly at
  // provisioning time instead of silently minting fake certs.
  if (isProduction && (!rawName || rawName === "stub")) {
    throw new Error(
      "SSL_PROVIDER is not configured for production. Set SSL_PROVIDER to a real adapter (e.g. 'cloudflare') and provide the required credentials."
    );
  }

  const name = rawName || "stub";
  if (!VALID_PROVIDERS.includes(name)) {
    throw new Error(
      `Unknown SSL_PROVIDER: ${name}. Valid: ${VALID_PROVIDERS.join(", ")}`
    );
  }
  if (cache.has(name)) return { name, provider: cache.get(name) };
  const provider = await loadProvider(name);
  if (!provider) {
    throw new Error(`SSL provider ${name} failed to load`);
  }
  cache.set(name, provider);
  return { name, provider };
}
