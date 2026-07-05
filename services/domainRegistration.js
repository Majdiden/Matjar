import config from "../config/index.js";
import { exec } from "child_process";
import { promisify } from "util";
import logger from "../utils/logger.js";

const execAsync = promisify(exec);

/**
 * Domain Registration Service
 * ---------------------------
 * Used by `services/storeSetup.js` when a new tenant is created to
 * register the tenant's **platform subdomain** (e.g. `mystore.matjar.to`).
 *
 * This is NOT the custom-domain flow — custom hostnames (merchant's
 * own domain) go through `services/domain.js` → `services/domainRegistry.js`
 * → `services/sslProviders/cloudflare.js`. The two flows are separate:
 *
 *   Platform subdomain  → wildcard DNS on the parent zone handles
 *                         routing + TLS for every tenant subdomain.
 *                         No per-tenant DNS or cert provisioning is
 *                         required.
 *   Custom hostname     → Cloudflare for SaaS Custom Hostnames API
 *                         issues per-hostname DV certs after the
 *                         merchant CNAMEs their domain to our edge.
 *
 * In development, platform subdomains use `.localhost` which browsers
 * resolve automatically without /etc/hosts edits.
 *
 * In production, the wildcard record + SAN cert on the parent zone
 * covers every tenant subdomain — this service validates that the
 * platform edge config is set and returns the resolved subdomain. It
 * does NOT fabricate fake DNS instructions for the dashboard to show;
 * merchants never need to touch DNS for their platform subdomain.
 */

const SUBDOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

function isValidSubdomainLabel(label) {
  return typeof label === "string" && SUBDOMAIN_REGEX.test(label);
}

/**
 * Register domain locally for development.
 *
 * Browsers resolve `*.localhost` to 127.0.0.1 automatically. No
 * /etc/hosts edits are needed for the default `.localhost` case.
 */
async function registerLocalDomain(subdomain, baseDomain = "localhost") {
  const fullDomain = `${subdomain}.${baseDomain}`;

  if (baseDomain === "localhost") {
    logger.info("Local domain ready", { domain: fullDomain });
    return {
      success: true,
      domain: fullDomain,
      environment: "development",
      provider: "browser-localhost",
      message: "Local domain ready — browsers resolve .localhost automatically.",
    };
  }

  logger.info(
    "Custom local base domain detected — manual /etc/hosts entry required",
    { domain: fullDomain }
  );
  return {
    success: true,
    domain: fullDomain,
    environment: "development",
    provider: "hosts-file",
    message:
      "Local domain configured. Add a /etc/hosts entry if your base domain is not `.localhost`.",
    instructions: [
      `Add this line to your /etc/hosts file:`,
      `127.0.0.1 ${fullDomain}`,
      `Or run: sudo sh -c 'echo "127.0.0.1 ${fullDomain}" >> /etc/hosts'`,
    ],
  };
}

/**
 * Register a platform subdomain in production.
 *
 * Dispatches on SSL_PROVIDER:
 *   - `cloudflare` — assume the parent zone has a wildcard DNS record
 *                    and SAN cert covering `*.<baseDomain>`. Validate
 *                    that CLOUDFLARE_* creds and PLATFORM_EDGE_CNAME
 *                    are present, then return the resolved subdomain.
 *                    No per-tenant Cloudflare call is made — the
 *                    wildcard makes it unnecessary and would just
 *                    inflate zone record count + API spend.
 *   - `stub` / unset — treat as dev-style passthrough. Surfaced for
 *                    operators running prod against the stub provider
 *                    intentionally (smoke tests, internal staging).
 */
async function registerProductionDomain(subdomain, baseDomain) {
  const fullDomain = `${subdomain}.${baseDomain}`;
  const sslProvider = config.sslProvider;

  if (sslProvider === "cloudflare") {
    const hasToken = Boolean(config.cloudflareApiToken);
    const hasZone = Boolean(config.cloudflareZoneId);
    const edge = config.platformEdgeCname;

    // Hard-fail if the provider is set but config is incomplete. A
    // signup that "succeeds" with missing creds would emit a broken
    // subdomain — better to surface the misconfiguration at the first
    // setup attempt than let merchants hit ENOTFOUND later.
    if (!hasToken || !hasZone) {
      const err =
        "CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID must be set when SSL_PROVIDER=cloudflare";
      logger.error("Platform subdomain registration blocked: missing Cloudflare config", {
        domain: fullDomain,
        hasToken,
        hasZone,
      });
      return {
        success: false,
        domain: fullDomain,
        environment: "production",
        provider: "cloudflare",
        error: err,
      };
    }

    if (!edge) {
      logger.warn(
        "PLATFORM_EDGE_CNAME is not set — merchants cannot be told where to CNAME custom domains",
        { domain: fullDomain }
      );
    }

    // Wildcard architecture: the parent zone owns the wildcard DNS
    // record and SAN certificate. The tenant subdomain is covered
    // automatically — no per-tenant DNS API call is needed.
    logger.info("Platform subdomain served by wildcard edge", {
      domain: fullDomain,
      edge,
    });

    return {
      success: true,
      domain: fullDomain,
      environment: "production",
      provider: "cloudflare-wildcard",
      message: `Platform subdomain ${fullDomain} is served via the wildcard edge record on ${baseDomain}. No per-tenant DNS record is required.`,
      // Intentionally NO `dnsRecords` or `requiresManualDNS` — the
      // merchant never has to touch DNS for the platform subdomain.
      // The dashboard should not prompt for DNS setup here.
      edgeTarget: edge,
    };
  }

  // Stub / unset: operator is running prod without a real SSL
  // provider — supported for smoke tests but surfaced loudly.
  logger.warn("Platform subdomain registered without a real SSL provider", {
    domain: fullDomain,
    sslProvider,
  });
  return {
    success: true,
    domain: fullDomain,
    environment: "production",
    provider: sslProvider || "stub",
    message:
      "Platform subdomain registered against stub provider. For real TLS, set SSL_PROVIDER=cloudflare and provide Cloudflare credentials.",
  };
}

/**
 * Public entry point. Routes to local or production based on
 * `config.isProduction`. Validates the subdomain label up front —
 * an invalid label should never hit DNS code paths.
 */
export async function registerDomain(subdomain, customBaseDomain = null) {
  const normalized = String(subdomain || "").toLowerCase().trim();
  if (!isValidSubdomainLabel(normalized)) {
    return {
      success: false,
      domain: null,
      error: `Invalid subdomain label: "${subdomain}"`,
    };
  }

  const baseDomain = customBaseDomain || config.baseDomain;
  const isProduction = config.isProduction;

  logger.debug("Domain registration request", {
    subdomain: normalized,
    environment: isProduction ? "production" : "development",
    baseDomain,
  });

  try {
    if (isProduction) {
      return await registerProductionDomain(normalized, baseDomain);
    }
    // Development always uses `.localhost` for automatic browser support.
    return await registerLocalDomain(normalized, "localhost");
  } catch (error) {
    logger.error("Domain registration failed", {
      subdomain: normalized,
      error: error.message,
    });
    return {
      success: false,
      domain: `${normalized}.${baseDomain}`,
      error: error.message,
    };
  }
}

/**
 * Lightweight accessibility probe — does the hostname answer on HTTP?
 * Used by smoke tests and the dashboard "check DNS" button to confirm
 * a freshly-registered subdomain is actually reachable.
 */
export async function verifyDomainAccessibility(domain) {
  try {
    const { stdout } = await execAsync(
      `curl -s -o /dev/null -w "%{http_code}" http://${domain}`,
      { timeout: 5000 }
    );

    const statusCode = parseInt(stdout.trim(), 10);
    const isAccessible = statusCode >= 200 && statusCode < 500;

    return {
      success: isAccessible,
      domain,
      statusCode,
      accessible: isAccessible,
    };
  } catch (error) {
    return {
      success: false,
      domain,
      error: error.message,
      accessible: false,
    };
  }
}

/**
 * Human-readable setup instructions. In production the platform
 * subdomain is served by the wildcard record on the parent zone —
 * merchants never have to touch DNS for it. This function exists
 * only so the setup progress UI can show a "what just happened"
 * block to the merchant.
 */
export function getDomainSetupInstructions(subdomain, baseDomain) {
  const fullDomain = `${subdomain}.${baseDomain}`;

  if (config.isProduction) {
    return {
      domain: fullDomain,
      environment: "production",
      steps: [
        `1. Your store is live at: https://${fullDomain}`,
        "2. TLS is handled automatically by the platform edge — no DNS changes on your side.",
        "3. To use your own custom domain, add it from the Domains page in the dashboard.",
      ],
    };
  }
  return {
    domain: `${subdomain}.localhost`,
    environment: "development",
    steps: [
      `1. Your store is accessible at: http://${subdomain}.localhost:${config.port}`,
      "2. No additional setup required — browsers handle .localhost automatically.",
      "3. Make sure your backend server is running.",
    ],
  };
}
