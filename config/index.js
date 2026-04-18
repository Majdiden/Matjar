import "dotenv/config";

/**
 * Configuration manager for environment variables
 * Validates required variables and provides typed access
 */
class Config {
  constructor() {
    this.validateRequiredVars();
  }

  // Server Configuration
  get port() {
    return parseInt(process.env.PORT || "3000", 10);
  }

  get nodeEnv() {
    return process.env.NODE_ENV || "development";
  }

  get isProduction() {
    return this.nodeEnv === "production";
  }

  get isDevelopment() {
    return this.nodeEnv === "development";
  }

  get isTest() {
    return this.nodeEnv === "test";
  }

  // Database Configuration — single shared database
  get dbUri() {
    return process.env.DB_URI;
  }

  // JWT Configuration
  get jwtSecret() {
    return process.env.JWT_SECRET;
  }

  get jwtRefreshSecret() {
    return process.env.JWT_REFRESH_SECRET;
  }

  get jwtExpiresIn() {
    return process.env.JWT_EXPIRES_IN || "1h";
  }

  get jwtRefreshExpiresIn() {
    return process.env.JWT_REFRESH_EXPIRES_IN || "7d";
  }

  // Password Hashing
  get bcryptSaltRounds() {
    return parseInt(process.env.BCRYPT_SALT_ROUNDS || "10", 10);
  }

  // CORS Configuration
  //
  // In development we fall back to "*" for ergonomics (local subdomains,
  // multiple frontends on different ports). In production we *require* an
  // explicit comma-separated allowlist via CORS_ORIGIN — if it's missing or
  // set to "*" we throw at boot rather than silently allow any origin.
  // Reflecting the request origin under credentials is functionally equivalent
  // to a wildcard for an attacker, so we refuse to start in that state.
  get corsOrigin() {
    const value = process.env.CORS_ORIGIN;
    if (this.isProduction) {
      if (!value || value.trim() === "*" || value.trim() === "") {
        throw new Error(
          "CORS_ORIGIN must be set to an explicit comma-separated allowlist " +
            "in production. Wildcard origins are not permitted with credentialed requests."
        );
      }
      return value;
    }
    return value || "*";
  }

  // Rate Limiting
  // Default window is 1 minute. The dashboard fires bursts of requests on page
  // loads (analytics, products, customers, etc.) so the per-window cap must be
  // generous in development.
  get rateLimitWindowMs() {
    return parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10);
  }

  get rateLimitMaxRequests() {
    const fallback = this.isDevelopment ? "5000" : "1000";
    return parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || fallback, 10);
  }

  // Logging
  get logLevel() {
    return process.env.LOG_LEVEL || "info";
  }

  // Domain Configuration
  //
  // `platformDomain` is the single canonical source for the platform's
  // base hostname — the suffix applied to every tenant's platform
  // subdomain (`<slug>.<platformDomain>`). Historically this was split
  // between `DOMAIN_SUFFIX` and `BASE_DOMAIN`; those are now aliases
  // for the same value so staging/white-label deploys can't land with
  // the two envs pointing at different hosts. Readers should prefer
  // `config.platformDomain`; `domainSuffix` / `baseDomain` are kept
  // as back-compat aliases.
  get platformDomain() {
    return (
      process.env.PLATFORM_DOMAIN ||
      process.env.DOMAIN_SUFFIX ||
      process.env.BASE_DOMAIN ||
      "matjar.local"
    );
  }

  get domainSuffix() {
    return this.platformDomain;
  }

  get baseDomain() {
    return this.platformDomain;
  }

  // Session Configuration
  get sessionSecret() {
    return process.env.SESSION_SECRET || this.jwtSecret;
  }

  // Cloudinary Configuration
  get cloudinaryCloudName() {
    return process.env.CLOUDINARY_CLOUD_NAME;
  }

  get cloudinaryApiKey() {
    return process.env.CLOUDINARY_API_KEY;
  }

  get cloudinaryApiSecret() {
    return process.env.CLOUDINARY_API_SECRET;
  }

  get cloudinaryFolder() {
    return process.env.CLOUDINARY_FOLDER || "matjar";
  }

  // Upload Configuration
  get maxFileSize() {
    return parseInt(process.env.MAX_FILE_SIZE || "5242880", 10); // 5MB default
  }

  get maxFilesPerUpload() {
    return parseInt(process.env.MAX_FILES_PER_UPLOAD || "10", 10);
  }

  // Payment Gateway Flags
  //
  // `PAYMENTS_ENABLED` turns on the manual payment rails (cash on
  // delivery, bank transfer, Fawry, etc.) — the soft-launch default.
  // Gateway integrations (Stripe) are parked behind their own
  // per-provider flag. Defaults to `false` so a deploy without
  // gateway credentials can't accidentally expose broken checkout
  // routes.
  get paymentsEnabled() {
    return (process.env.PAYMENTS_ENABLED || "").toLowerCase() === "true";
  }

  get stripeEnabled() {
    return (process.env.STRIPE_ENABLED || "").toLowerCase() === "true";
  }

  // Email feature flag — single source of truth for "should we actually
  // send mail?". Mirrors the gate inside services/providers/email.js so
  // callers (e.g. the notification fan-out) can skip the work cheaply
  // when the platform has email turned off.
  get emailEnabled() {
    return (process.env.EMAIL_ENABLED || "").toLowerCase() === "true";
  }

  // Public URL of the merchant dashboard SPA. Used to build absolute
  // deep-links in outbound notification emails. Empty string means
  // "fall back to relative /dashboard/... paths" (fine for dev).
  get publicDashboardUrl() {
    return (
      process.env.PUBLIC_DASHBOARD_URL ||
      process.env.DASHBOARD_URL ||
      ""
    );
  }

  // Upload provider switch. Lowercased for case-insensitive comparison;
  // callers compare against the string "cloudinary".
  get uploadProvider() {
    return (process.env.UPLOAD_PROVIDER || "").toLowerCase();
  }

  // Redis — single source for the connection URL. Dev falls back to a
  // local loopback so `npm start` works without a REDIS_URL set; prod
  // validation rejects the missing value (see validateRequiredVars).
  get redisUrl() {
    return process.env.REDIS_URL || "redis://localhost:6379";
  }

  // Stripe — secrets are only read when `stripeEnabled` is true. The
  // getters are null-safe so "enabled but not yet configured" deploys
  // surface a descriptive error at first checkout rather than NPE.
  get stripeSecretKey() {
    return process.env.STRIPE_SECRET_KEY;
  }

  get stripeWebhookSecret() {
    return process.env.STRIPE_WEBHOOK_SECRET;
  }

  // Email (Resend). `EMAIL_ENABLED=true` is the gate that actually puts
  // mail on the wire — see `emailEnabled`. These just surface the
  // Resend credentials when we do.
  get resendApiKey() {
    return process.env.RESEND_API_KEY;
  }

  get emailFrom() {
    return process.env.EMAIL_FROM;
  }

  // SSL / custom-domain rails.
  //
  // `sslProvider` is lowercased and defaults to "stub" — the fake
  // adapter used in dev/test. Production MUST flip this to a real
  // adapter (`cloudflare`); the ssl-providers registry refuses to
  // boot with a stub provider in prod.
  get sslProvider() {
    return (process.env.SSL_PROVIDER || "stub").toLowerCase();
  }

  get platformEdgeCname() {
    return process.env.PLATFORM_EDGE_CNAME || null;
  }

  // A-record targets for apex custom hostnames, returned as a trimmed
  // array. Empty array means "apex custom domains not supported in
  // this deploy" — we still serve subdomain-style custom hostnames.
  get platformEdgeIps() {
    return (process.env.PLATFORM_EDGE_IP || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  get cloudflareApiToken() {
    return process.env.CLOUDFLARE_API_TOKEN;
  }

  get cloudflareZoneId() {
    return process.env.CLOUDFLARE_ZONE_ID;
  }

  // Backups — `BACKUP_ENABLED=true` gates the worker's daily cron.
  // All other BACKUP_* vars are required when enabled; see
  // validateRequiredVars for the prod-boot check.
  get backupEnabled() {
    return (process.env.BACKUP_ENABLED || "").toLowerCase() === "true";
  }

  get backupS3Endpoint() {
    return process.env.BACKUP_S3_ENDPOINT;
  }

  get backupS3AccessKeyId() {
    return process.env.BACKUP_S3_ACCESS_KEY_ID;
  }

  get backupS3SecretAccessKey() {
    return process.env.BACKUP_S3_SECRET_ACCESS_KEY;
  }

  get backupS3Bucket() {
    return process.env.BACKUP_S3_BUCKET;
  }

  get backupS3Region() {
    return process.env.BACKUP_S3_REGION || "auto";
  }

  // Sentry runtime config (backend). SPAs read `VITE_SENTRY_*` via
  // import.meta.env; this getter set is for Node only.
  get sentryDsn() {
    return process.env.SENTRY_DSN;
  }

  get sentryEnvironment() {
    return process.env.SENTRY_ENVIRONMENT || this.nodeEnv;
  }

  // Release tag. On Render, `RENDER_GIT_COMMIT` is populated
  // automatically so unversioned deploys still pin source-maps.
  get sentryRelease() {
    return process.env.SENTRY_RELEASE || process.env.RENDER_GIT_COMMIT || undefined;
  }

  // Performance tracing sample rate. Defaults to 0.1 in prod (10%),
  // 1.0 elsewhere so local debugging sees every span.
  get sentryTracesSampleRate() {
    if (process.env.SENTRY_TRACES_SAMPLE_RATE) {
      const n = Number(process.env.SENTRY_TRACES_SAMPLE_RATE);
      return Number.isFinite(n) ? n : (this.isProduction ? 0.1 : 1.0);
    }
    return this.isProduction ? 0.1 : 1.0;
  }

  // Platform-admin escape hatch: allow the synchronous export endpoint
  // in production. Off by default — operators must explicitly opt in
  // per-deploy for one-off data pulls.
  get allowSyncExport() {
    return process.env.ALLOW_SYNC_EXPORT === "1";
  }

  /**
   * Validate that required environment variables are set
   */
  validateRequiredVars() {
    const required = [
      "DB_URI",
      "JWT_SECRET",
      "JWT_REFRESH_SECRET",
      "REDIS_URL",
    ];

    const missing = required.filter((varName) => !process.env[varName]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(", ")}\n` +
          `Please check your .env file and ensure all required variables are set.`
      );
    }

    // Production-only hardening. Everything below is noise in dev — the
    // defaults are fine for a laptop — but is a launch blocker in prod.
    if (this.isProduction) {
      const errors = [];

      // Refuse to boot against a local database in prod. A container that
      // starts with DB_URI=mongodb://localhost after a bad deploy would
      // silently isolate itself from every other instance and accept
      // writes nobody else can read.
      const dbUri = process.env.DB_URI || "";
      if (/\b(localhost|127\.0\.0\.1|::1)\b/.test(dbUri)) {
        errors.push("DB_URI must not point to localhost in production.");
      }

      const redisUrl = process.env.REDIS_URL || "";
      if (/\b(localhost|127\.0\.0\.1|::1)\b/.test(redisUrl)) {
        errors.push("REDIS_URL must not point to localhost in production.");
      }

      // PLATFORM_DOMAIN must be explicitly set in prod. The `platformDomain`
      // getter falls back to "matjar.local" for dev ergonomics — a prod
      // process landing on that fallback would stamp every tenant's
      // subdomain URL and SSL cert against a non-routable hostname.
      // Reject missing / obviously-local values at boot so the failure
      // mode is a startup crash, not silently-broken tenant links.
      const platformDomainRaw = (
        process.env.PLATFORM_DOMAIN ||
        process.env.DOMAIN_SUFFIX ||
        process.env.BASE_DOMAIN ||
        ""
      ).trim().toLowerCase();
      if (!platformDomainRaw) {
        errors.push("PLATFORM_DOMAIN must be set in production (no dev fallback permitted).");
      } else if (
        platformDomainRaw === "matjar.local" ||
        platformDomainRaw === "localhost" ||
        platformDomainRaw.endsWith(".local") ||
        platformDomainRaw.endsWith(".localhost") ||
        /\b(127\.0\.0\.1|::1)\b/.test(platformDomainRaw)
      ) {
        errors.push(
          `PLATFORM_DOMAIN="${platformDomainRaw}" is a development-only value; ` +
            "set a real public hostname in production."
        );
      }

      // Secret strength. 32 chars of random = 128 bits of entropy (approx).
      // Also reject well-known placeholder strings people paste from examples.
      const PLACEHOLDER = /^(change[-_]?me|secret|password|changeme|test|dev|default|your[-_]?(secret|key))/i;
      const weakSecret = (name) => {
        const v = process.env[name] || "";
        if (v.length < 32) return `${name} must be at least 32 characters in production (got ${v.length}).`;
        if (PLACEHOLDER.test(v)) return `${name} looks like a placeholder — replace with a strong random value.`;
        return null;
      };
      for (const name of ["JWT_SECRET", "JWT_REFRESH_SECRET"]) {
        const msg = weakSecret(name);
        if (msg) errors.push(msg);
      }
      // SESSION_SECRET falls back to JWT_SECRET by design (see `sessionSecret`
      // getter); only validate if an explicit value was supplied.
      if (process.env.SESSION_SECRET) {
        const msg = weakSecret("SESSION_SECRET");
        if (msg) errors.push(msg);
      }

      // Secrets must be distinct so compromise of one token class doesn't
      // forge the other. A deploy that copy-pastes the same value into
      // both envs silently removes that separation.
      const jwt = process.env.JWT_SECRET;
      const jwtR = process.env.JWT_REFRESH_SECRET;
      const sess = process.env.SESSION_SECRET;
      if (jwt && jwtR && jwt === jwtR) {
        errors.push("JWT_SECRET and JWT_REFRESH_SECRET must be distinct.");
      }
      if (sess && jwt && sess === jwt) {
        errors.push("SESSION_SECRET must be distinct from JWT_SECRET.");
      }

      // Provider-gated requirements. If a provider is enabled via its
      // flag/mode env, the downstream integration will explode at first
      // request with a confusing error — surface it at boot instead.
      const cloudinaryProvider = (process.env.UPLOAD_PROVIDER || "").toLowerCase();
      if (cloudinaryProvider === "cloudinary") {
        for (const k of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]) {
          if (!process.env[k]) errors.push(`${k} is required when UPLOAD_PROVIDER=cloudinary.`);
        }
      }
      if ((process.env.EMAIL_ENABLED || "").toLowerCase() === "true") {
        // Resend is the current email provider per package.json dependency.
        if (!process.env.RESEND_API_KEY) errors.push("RESEND_API_KEY is required when EMAIL_ENABLED=true.");
        if (!process.env.EMAIL_FROM) errors.push("EMAIL_FROM is required when EMAIL_ENABLED=true.");
      }
      // `PAYMENTS_ENABLED` gates the manual payment rails (COD, bank
      // transfer, Fawry, …) — those need no platform secrets, so there's
      // nothing to validate here. Gateway credentials are gated on their
      // own per-provider flag so an operator can turn on manual payments
      // without also committing to Stripe.
      if ((process.env.STRIPE_ENABLED || "").toLowerCase() === "true") {
        if (!process.env.STRIPE_SECRET_KEY) errors.push("STRIPE_SECRET_KEY is required when STRIPE_ENABLED=true.");
        if (!process.env.STRIPE_WEBHOOK_SECRET) errors.push("STRIPE_WEBHOOK_SECRET is required when STRIPE_ENABLED=true.");
      }
      if ((process.env.SSL_PROVIDER || "").toLowerCase() === "cloudflare") {
        if (!process.env.CLOUDFLARE_API_TOKEN) errors.push("CLOUDFLARE_API_TOKEN is required when SSL_PROVIDER=cloudflare.");
        if (!process.env.CLOUDFLARE_ZONE_ID) errors.push("CLOUDFLARE_ZONE_ID is required when SSL_PROVIDER=cloudflare.");
      }
      if ((process.env.BACKUP_ENABLED || "").toLowerCase() === "true") {
        for (const k of [
          "BACKUP_S3_ENDPOINT",
          "BACKUP_S3_ACCESS_KEY_ID",
          "BACKUP_S3_SECRET_ACCESS_KEY",
          "BACKUP_S3_BUCKET",
        ]) {
          if (!process.env[k]) errors.push(`${k} is required when BACKUP_ENABLED=true.`);
        }
      }

      if (errors.length) {
        throw new Error(
          `Production environment validation failed:\n  - ${errors.join("\n  - ")}`
        );
      }
    }
  }
}

export default new Config();
