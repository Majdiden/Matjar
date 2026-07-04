// Sentry MUST be initialized before any other module is imported so that
// the OpenTelemetry-based auto-instrumentation (express, mongoose, http)
// can patch those libraries at require-time. Loading any instrumented
// module first means Sentry never sees its spans. `initSentry()` is a
// no-op when SENTRY_DSN is unset, so this is safe in dev.
import { initSentry, sentryTagMiddleware, sentryErrorHandler, captureException, Sentry } from "./utils/sentry.js";
initSentry();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import morgan from "morgan";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import { RedisStore } from "connect-redis";
import config from "./config/index.js";
import { connectDb } from "./utils/connectionManager.js";
import { syncThemeCatalog, auditTenantThemeManifests } from "./services/themeCatalogSync.js";
import { initRedis } from "./config/redis.js";
import { initWebPush } from "./utils/webPush.js";
import RouteConfig from "./server/route.config.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";
import {
  createRateLimiter,
  loginLimiter,
  signupLimiter,
} from "./middlewares/rateLimiters.js";
import logger from "./utils/logger.js";

// Initialize Express app
const app = express();

// Security Headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://images.unsplash.com"],
        // `data:` is required because the SPA + storefront themes inline
        // fonts as base64 `data:font/...` URIs (bundled/self-hosted web fonts).
        // Without it every inlined font is blocked by CSP — flooding the
        // console with font-src violations and falling back to system fonts.
        // Same rationale as imgSrc allowing data:/blob: above.
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        connectSrc: ["'self'", "https://api.stripe.com"],
        frameSrc: ["'self'", "https://js.stripe.com"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginResourcePolicy: { policy: "same-site" },
  })
);

// Trust proxy (for rate limiting behind reverse proxy).
//
// Render terminates TLS at its edge and forwards via a single proxy hop,
// so `1` (trust the first hop only) is the correct setting: express-rate-limit
// and `req.ip` will read the client IP from X-Forwarded-For without trusting
// attacker-supplied values further down the chain. Setting this to `true`
// would trust the entire XFF header, which lets clients spoof their IP and
// evade IP-keyed rate limits. Do NOT change this to `true`.
app.set("trust proxy", 1);

// Request logging
if (config.isDevelopment) {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Stripe webhook needs raw body BEFORE json parser
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  (req, res, next) => next()
);

// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// CORS configuration.
//
// `config.corsOrigin` already throws in production if "*" is left unset, so
// by the time we get here the wildcard branch is dev-only. In production we
// receive a comma-separated allowlist and turn it into a strict array.
let corsOrigins;
if (config.corsOrigin === "*") {
  // Dev only — reflect the request origin so localhost/multi-port setups work.
  // Production never reaches this branch (config throws at boot).
  corsOrigins = true;
} else {
  corsOrigins = config.corsOrigin.split(",").map((s) => s.trim()).filter(Boolean);
}
const corsOptions = {
  origin: corsOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
};
app.use(cors(corsOptions));

// NoSQL injection prevention — strips $ and . from req.body/query/params
app.use(mongoSanitize());

// HTTP parameter pollution protection
app.use(hpp());

// Rate limiting — generous global cap so the dashboard's burst loads don't
// trip it. Backed by Redis (see middlewares/rateLimiters.js) so counts are
// shared across the 2 web dynos. Auth endpoints get dedicated stricter
// limiters mounted separately — `loginLimiter` and `signupLimiter` handle
// brute-force / signup-spam, and the route-class limiters in
// middlewares/rateLimiters.js cover upload/checkout/webhook/etc.
const limiter = createRateLimiter({
  prefix: "api",
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api", limiter);

// Strict rate limiting for auth endpoints (brute-force / signup-spam).
// Login only counts FAILED attempts (skipSuccessfulRequests inside limiter).
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/register", signupLimiter);
// Platform-admin login needs the same brute-force protection; it
// authenticates against TenantUser.platformPasswordHash and was
// previously only covered by the global `limiter` above.
app.use("/api/platform/login", loginLimiter);

// Theme assets (/assets/*) are served by the storefront middleware out
// of each tenant's active theme's built `dist/` folder — see
// middlewares/storefrontServe.js. There is no longer a separate
// `/assets` resolver because the old legacy-themes one intercepted
// Vite-built asset URLs and mis-resolved them against the wrong dir.

// Serve uploaded files locally in development
if (config.isDevelopment) {
  app.use("/uploads", express.static("public/uploads"));
}

// Sentry tag-setter — mounted globally so any route that has already
// been through `authenticate` (which populates `req.user` / `req.tenantId`
// before calling next()) surfaces those tags on breadcrumbs and errors.
// For errors that bubble out of auth'd routes we also re-run tagging
// inside the error pipeline below, so both paths are covered.
app.use(sentryTagMiddleware);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// Start server
const startServer = async () => {
  try {
    // 1. Connect to shared database and register all models
    await connectDb();

    // 1b. Converge the theme catalog onto the manifests the registry
    // discovered at module load (services/themeManifestRegistry.js scans
    // storefront-themes/*/dist/manifest.json at import time). Upserts one
    // Theme row per manifest, deactivates rows whose manifest vanished.
    // Non-fatal: a sync failure must not keep the platform down — the
    // existing catalog rows continue to serve.
    try {
      await syncThemeCatalog();
      // Loudly surface any tenant whose active theme has no built manifest
      // (audit 1.6c) — otherwise the only symptom is a silent fall back to
      // the default theme at request time.
      await auditTenantThemeManifests();
    } catch (err) {
      logger.error("Theme catalog sync failed at boot", { error: err.message });
      captureException(err, { extra: { scope: "themeCatalogSync.boot" } });
    }

    // 1c. Configure Web Push (VAPID). Prefers env vars; otherwise loads (or
    // generates + persists) a stable keypair in the admin DB so background
    // push works without env configuration. Non-fatal — if it can't be
    // configured, background push is disabled and in-app notifications
    // continue to work.
    try {
      await initWebPush();
    } catch (err) {
      logger.error("Web Push init failed at boot", { error: err.message });
    }

    // 2. Connect to Redis
    const redisClient = await initRedis();

    // 3. Initialize Session with Redis Store
    app.use(
      session({
        store: new RedisStore({
          client: redisClient,
          prefix: "matjar:sess:",
        }),
        secret: config.sessionSecret || config.jwtSecret,
        resave: false,
        saveUninitialized: false, // Don't save empty sessions
        cookie: {
          secure: config.nodeEnv === "production",
          httpOnly: true,
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
          sameSite: config.nodeEnv === "production" ? "none" : "lax",
        },
      })
    );

    // 4. Register Routes (must be after session middleware)
    RouteConfig(app);

    // Debug-only smoke test endpoint for verifying Sentry wiring. Never
    // exposed in production — gated on NODE_ENV so a stray request can't
    // cause a real 500 on the live site.
    if (config.nodeEnv !== "production") {
      app.get("/debug/sentry", (_req, _res) => {
        throw new Error("Sentry smoke test — intentional error");
      });
    }

    // 404 handler
    app.use(notFoundHandler);

    // Sentry error middleware — runs BEFORE the app's errorHandler so
    // unhandled exceptions are shipped to Sentry (with tenant/user tags
    // pulled from `req` via sentryTagMiddleware mounted earlier). When
    // SENTRY_DSN is unset this is still a valid Express middleware that
    // just forwards to `next(err)`.
    //
    // We set scope tags right before handing off so the scrubbed event
    // carries `tenantId` / `userId` populated by the per-route auth
    // middleware, which runs after the global middleware chain.
    app.use((err, req, _res, next) => {
      try {
        sentryTagMiddleware(req, _res, () => {});
      } catch {
        // never let tagging mask the original error
      }
      next(err);
    });
    app.use(sentryErrorHandler);

    // Global error handler
    app.use(errorHandler);

    // Start listening
    app.listen(config.port, () => {
      console.log(`
╔════════════════════════════════════════╗
║   Multi-Tenant E-commerce Platform    ║
╠════════════════════════════════════════╣
║  Environment: ${config.nodeEnv.padEnd(24)} ║
║  Port: ${String(config.port).padEnd(31)} ║
║  Status: Running                       ║
╚════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error("Failed to start server", { error: error.message, stack: error.stack });
    // Startup failures (DB/Redis/config) are exactly the class of error
    // on-call needs to page on — don't let them slip past Sentry just
    // because they happen before the first request can reach the
    // expressErrorHandler.
    captureException(error, { extra: { scope: "server.startup" } });
    // Give Sentry a moment to flush the event before the process exits.
    await Sentry.close(2000).catch(() => {});
    process.exit(1);
  }
};

startServer();
