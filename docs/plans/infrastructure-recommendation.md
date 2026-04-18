# Infrastructure Recommendation

## Goal

Build a production foundation with minimal capital, low operational overhead, and a clear path to scale. The priority is not complex infrastructure on day one. The priority is reliable deployments, managed data storage, safe tenant isolation, backups, observability, and predictable merchant onboarding.

## Recommended Starting Architecture

Use a modular monolith: one backend codebase with separate `web` and `worker` process types, plus static frontend/theme hosting.

```text
Users / Merchants / Shoppers
        |
     Cloudflare
 DNS + SSL + WAF + CDN + rate limits
        |
        +--> Dashboard frontend
        |      Vercel / Cloudflare Pages
        |
        +--> Storefront static theme assets
        |      Cloudflare Pages / R2 / CDN
        |
        +--> Backend API
               Render / Fly.io / Railway
               |
               +--> MongoDB Atlas
               +--> Redis
               +--> Worker process
               +--> Cloudinary or R2 assets
               +--> Resend/Postmark email
               +--> Payment providers
               +--> Fulfillment providers
               +--> Sentry/logging/uptime checks
```

## Minimal-Capital Stack

- Cloudflare for DNS, CDN, SSL/TLS, WAF, bot protection, custom domains, and edge rate limiting.
- Render, Fly.io, Railway, or DigitalOcean App Platform for the backend API.
- MongoDB Atlas for the database. Avoid self-hosted MongoDB for production unless you are ready to own backups, upgrades, failover, and restore procedures.
- Redis as a managed service for sessions, caching, and queues.
- Cloudinary for the simplest image pipeline, or Cloudflare R2/S3 if lower storage cost is more important than image transformation convenience.
- Vercel, Netlify, or Cloudflare Pages for the dashboard and static storefront theme assets.
- Resend, Postmark, or AWS SES for transactional email.
- Sentry for application errors.
- Better Stack, UptimeRobot, or similar for uptime checks.
- GitHub Actions for CI/CD.

## Backend Process Model

Start with two process types:

- `web`: Express API, auth, dashboard APIs, storefront APIs, domain APIs, checkout, orders, uploads.
- `worker`: async jobs for store setup, emails, webhook retries, domain verification, SSL checks, imports/migrations, theme builds, fulfillment sync, and payment reconciliation.

Keep both process types in the same repo at first. This gives reliability without microservice complexity.

## Database

Use MongoDB Atlas with:

- Separate staging and production databases or clusters.
- Automated backups.
- Point-in-time recovery if budget allows.
- Restore drills before launch.
- Tenant-aware indexes reviewed before production.
- Slow query monitoring enabled.
- No production use of local/self-hosted MongoDB unless there is a real ops plan.

The database is the one area where being too cheap creates existential risk. Losing order, customer, or tenant data is not recoverable by good UX.

## Domains And SSL

Use Cloudflare as the public edge.

The platform should track:

- Tenant subdomain.
- Custom domain.
- Verification status.
- DNS target status.
- SSL provisioning status.
- Primary domain.
- Canonical redirect behavior.
- Last verification/provisioning error.

Domain mutation should always bind to tenant identity, not parsed hostname strings. Hostname resolution should map host to tenant, then tenant mutations should use tenant ID.

## Storefront Themes

For React themes, prefer CDN-served static bundles that call your storefront API at runtime.

Recommended flow:

- Build theme assets in CI or a controlled build job.
- Store or publish built assets to CDN/object storage.
- Serve static assets with aggressive immutable cache headers.
- Keep cart, checkout, customer account, inventory, and pricing dynamic through APIs.
- Keep a safe fallback theme available for every tenant.

Avoid making the backend filesystem the long-term source of theme artifacts. It can work for early deployments, but object storage/CDN is a better production artifact model.

## Queue And Jobs

Use a queue before launch. E-commerce has too many tasks that should not run inside request/response.

Queue-backed jobs should include:

- Store setup.
- Theme build and publish.
- Transactional emails.
- Webhook delivery retries.
- Domain verification.
- SSL checks and renewals.
- Store migration/import jobs.
- Fulfillment sync.
- Payment reconciliation.
- Inventory sync.

BullMQ with Redis is a pragmatic starting point. A managed queue can replace it later if needed.

## Security Baseline

Minimum production security controls:

- Cloudflare WAF and edge rate limits.
- App-level rate limits for auth, registration, order lookup, checkout, uploads, and domain checks.
- Strict production CORS allowlist.
- Helmet/security headers.
- Secure cookies if cookies are used.
- Strong environment validation on boot.
- No default secrets in production.
- Upload file type and size limits.
- Dependency audit in CI.
- Sentry/error logging with PII redaction.
- Separate staging and production secrets.
- Backup and restore access restricted.

## CI/CD

Recommended pipeline:

- Pull request: lint, unit tests, focused E2E tests.
- Main branch: full E2E tests, build dashboard, build themes, package artifacts.
- Staging deploy: automatic after main passes.
- Production deploy: manual promotion.
- Rollback: documented and tested.
- Database scripts: explicit, logged, and reversible where possible.

Do not auto-deploy to production until the E2E suite is stable and non-flaky.

## What Not To Do Yet

- Do not start with Kubernetes.
- Do not split into microservices yet.
- Do not self-host MongoDB unless you have a real operations plan.
- Do not build a custom image pipeline before Cloudinary/R2 is insufficient.
- Do not add Kafka/event streaming before a simple queue is exhausted.
- Do not build multi-region active-active before single-region reliability is proven.

## Is The Current Platform Ready For This Infrastructure?

Partially. The codebase has many of the right foundations, but it is not fully ready for the recommended production shape yet.

### Ready Or Close

- The backend is already a deployable Express application.
- Configuration supports managed MongoDB through `DB_URI`.
- Redis configuration exists through `REDIS_URL`.
- Cloudinary upload support exists.
- Domain and SSL provider abstractions exist, including Cloudflare-oriented configuration.
- Static React theme serving exists through the storefront middleware.
- Production CORS validation exists.
- Helmet, request sanitization, HPP protection, global API rate limiting, and auth-specific rate limiting exist.
- A `/health` endpoint exists.
- Tenant resolution and scoped model usage are now much stronger than earlier scans.

### Not Ready Yet

- The production start script currently uses `nodemon`. Production should use `node ./index.js`, with `nodemon` limited to development.
- There is Redis support, but no real worker/queue process is implemented yet. A production e-commerce platform needs background jobs for setup, emails, domains, SSL, retries, imports, and syncs.
- Theme serving currently depends on local `storefront-themes/*/dist` folders. That can work for simple deployments, but production should move toward CI-built artifacts served through CDN/object storage.
- Store setup still logs failures around missing default theme, sample data seeding, product slug validation, and `setupStatus`. Onboarding must be deterministic before public launch.
- Full E2E execution has shown instability/noise. The platform needs stable CI before production promotion.
- Observability is incomplete unless external services are configured: Sentry/error tracking, log aggregation, uptime checks, alerting, and slow query monitoring.
- Backup and restore drills are not visible in code. Atlas backups are necessary, but you still need a documented restore procedure.
- Deployment manifests are not present for Render/Fly/Railway/DigitalOcean. The app can likely run there, but the deploy contract is not codified yet.

## Minimum Work Before Using This In Production

1. Add production-safe scripts:
   - `start`: `node ./index.js`
   - `dev`: `nodemon ./index.js`
   - `test`: keep single-concurrency E2E if Mongo memory server needs it.

2. Add a worker process:
   - Add BullMQ or equivalent.
   - Add `worker` script.
   - Move setup/domain/email/retry/import work out of request paths.

3. Stabilize setup:
   - Ensure default theme exists and is available.
   - Fix sample product slug validation.
   - Make `setupStatus` updates deterministic and idempotent.
   - Add setup recovery/retry behavior.

4. Decide theme artifact strategy:
   - Short term: commit or build `storefront-themes/*/dist` during deploy.
   - Better: build in CI and publish artifacts to CDN/object storage.

5. Add deployment config:
   - Render/Fly/Railway service definition.
   - Separate web and worker process definitions.
   - Staging and production environment variable checklists.

6. Add operational basics:
   - Sentry or equivalent.
   - Uptime checks.
   - Centralized logs.
   - Alerting.
   - Backup restore drill.

7. Require a clean release gate:
   - Full E2E pass.
   - Tenant isolation tests.
   - Checkout/orders/shipping/tax/inventory correctness tests.
   - Domain/theme setup tests.
   - Security smoke tests.

## Practical Recommendation

The platform is ready to be adapted to this infrastructure, but I would not call it production-ready on this infrastructure yet. The architecture fits the project well, and the code already has several necessary foundations. The next step is to formalize deployment, add a real worker/queue, clean store setup, and make CI stable.

Best next infrastructure path:

```text
Cloudflare
Render/Fly/Railway web service
Render/Fly/Railway worker service
MongoDB Atlas
Managed Redis
Cloudinary
Resend/Postmark
Sentry
GitHub Actions
Cloudflare Pages or Vercel for dashboard/theme assets
```

This is the lowest-complexity architecture I would trust for an early SaaS launch, provided the readiness gaps above are closed first.
