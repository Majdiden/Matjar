P0: Must Close Before Production
These are direct launch blockers.

1. Fix production start/deploy contract

Current issue: package.json:7 uses nodemon for start. That is development tooling, not production.

Required changes:

- Change start to node ./index.js.
- Add dev or dev:api for nodemon ./index.js.
- Keep dashboard build separate.
- Add clear scripts for test, build, build:dashboard, and eventually worker.

Suggested scripts:

{
"scripts": {
"start": "node ./index.js",
"dev:api": "nodemon ./index.js",
"dev:dashboard": "cd dashboard && npm run dev",
"build:dashboard": "cd dashboard && npm run build",
"test": "node --test --test-concurrency=1 tests/\*_/_.test.js",
"worker": "node ./workers/index.js"
}
}

Acceptance criteria:

- Production host can run npm start without nodemon.
- Local development still supports auto-reload.
- Staging and production deploy docs use the same command.
- App boots successfully with NODE_ENV=production.

2. Add a real worker/queue process

Current issue: Redis exists, but there is no actual job queue or worker process. E-commerce cannot safely
depend on long request/response work for setup, emails, retries, domains, SSL, imports, or sync.

Required jobs:

- Store setup.
- Sample data seeding.
- Theme install/build/publish.
- Email notifications.
- Webhook delivery retries.
- Domain DNS verification.
- SSL provisioning checks.
- Store migration/import jobs.
- Payment reconciliation if payments are enabled.
- Fulfillment sync when integrations are added.

Recommended implementation:

- Use BullMQ or another Redis-backed queue.
- Add workers/index.js.
- Add reusable queue helpers under services/jobs or queues.
- Add retry policies and dead-letter handling.
- Add job status storage where merchants/admins need visibility.
- Make jobs idempotent.

Acceptance criteria:

- Store setup runs as a background job.
- Failed setup can be retried safely.
- Email/webhook/domain/SSL jobs retry without duplicate side effects.
- Worker can run separately from web process.
- Worker shutdown handles in-flight jobs safely.
- Job failures are logged with tenant ID, job ID, attempt count, and error.

3. Stabilize store setup/onboarding

Current issue: test runs still log failures around default theme, product slug validation, sample data seeding,
and setupStatus.

Known symptoms from test output:

- Theme installation failed: No default theme available
- Product validation failed: slug: Path 'slug' is required
- Cannot read properties of null (reading 'setupStatus')

Required changes:

- Guarantee a default theme exists in every environment.
- Ensure setup does not assume sample product fields that violate schema.
- Generate slugs for seeded products.
- Make setup idempotent: running it twice should not corrupt tenant state.
- Make setup transactional where possible or resumable where not.
- Ensure setupStatus is always updated safely, even on partial failure.
- Add a recovery path for tenants stuck in in_progress.

Acceptance criteria:

- New tenant registration completes without setup error logs.
- Default theme is installed or a safe fallback is assigned.
- Sample products/categories validate successfully.
- Setup failure stores a clear reason and can be retried.
- Setup status moves through predictable states: pending, in_progress, completed, failed.
- E2E registration/setup test passes cleanly with no background errors.

4. Make full E2E stable

Current issue: focused role-boundary tests pass, but broad E2E previously had lock/test-harness noise.
Production needs a clean release gate.

Required suites:

- Auth/session/logout/refresh.
- Tenant isolation.
- Business roles.
- Store setup.
- Products/categories.
- Cart.
- Checkout.
- Orders.
- Discounts.
- Shipping.
- Tax.
- Inventory.
- Customer segments.
- Domains.
- Themes/customization.
- Uploads.
- Notifications.
- Webhooks/jobs.

Required changes:

- Run E2E with --test-concurrency=1 if Mongo memory server is lock-sensitive.
- Avoid parallel tenant setup collisions.
- Stop background setup jobs before test teardown.
- Ensure every async setup task is awaited or isolated.
- Remove noisy expected failures from normal test output.
- Add CI-friendly test commands: smoke, focused, full.

Acceptance criteria:

- npm test passes locally.
- CI full suite passes repeatedly.
- Test output has no unrelated setup errors.
- Tenant isolation suite runs consistently.
- Release is blocked on test failure.

5. Finalize production environment validation

Current config already validates required env vars in config/index.js:157, but production readiness needs
stricter validation.

Required validations:

- NODE_ENV=production.
- DB_URI must not point to localhost.
- REDIS_URL must not point to localhost.
- JWT_SECRET, JWT_REFRESH_SECRET, and SESSION_SECRET must be strong and distinct.
- CORS_ORIGIN must not be \*.
- Cloudinary envs required if upload storage is Cloudinary.
- Email envs required if notifications are enabled.
- Stripe/payment envs required only if payment providers are enabled.
- SSL provider envs required if SSL_PROVIDER=cloudflare.

Acceptance criteria:

- App refuses to boot in production with weak/default secrets.
- App refuses wildcard CORS in production.
- App refuses missing required provider envs when provider is enabled.
- .env.example reflects all required variables.
- Staging and production env checklists exist.

P1: Should Close Before Public Self-Serve Launch
These may not block a closed beta, but they should block a broad public launch.

6. Move theme artifact strategy out of local filesystem dependency

Current issue: middlewares/storefrontServe.js:11 serves from local storefront-themes, and middlewares/
storefrontServe.js:133 returns 500 if the theme is not built.

Short-term acceptable path:

- Build themes during CI/deploy.
- Ensure storefront-themes/\*/dist exists in production artifact.
- Add startup check for default theme dist.
- Never let a tenant select a theme without a valid built artifact.

Better path:

- Build theme artifacts in CI.
- Publish to Cloudflare Pages, R2, S3, or CDN.
- Store artifact version/URL in DB.
- Serve assets from CDN.
- Keep backend only for API and fallback routing.

Acceptance criteria:

- Default theme always exists in production.
- Publishing a theme cannot break active stores.
- Rollback points to a previous known-good artifact.
- Missing theme artifact falls back safely, not 500 for shoppers.
- CDN cache headers are correct for immutable assets.

7. Add observability

Required services:

- Error tracking: Sentry or equivalent.
- Centralized logs: provider logs, Better Stack, Datadog, Logtail, etc.
- Uptime checks.
- Alerting.
- Slow query monitoring.
- Job failure monitoring.
- Webhook failure monitoring.

Required app fields in logs:

- requestId
- tenantId
- userId when available
- route
- method
- status
- durationMs
- jobId for workers
- provider for integrations
- sanitized error metadata

Acceptance criteria:

- Production errors create alerts.
- Failed jobs create alerts.
- High 5xx rate creates alerts.
- Slow API responses are visible.
- Domain/SSL failures are visible.
- You can trace a merchant support issue by tenant ID.

8. Backups and restore drills

MongoDB Atlas backups are necessary but not sufficient. You need an operational restore process.

Required work:

- Enable automated backups.
- Enable point-in-time recovery if budget allows.
- Document restore steps.
- Test restoring staging from backup.
- Define retention policy.
- Restrict backup access.
- Decide how to handle accidental tenant deletion/corruption.

Acceptance criteria:

- You can restore a backup into a staging database.
- Restore procedure is documented.
- Restore has been tested at least once.
- Backup status is monitored.
- You know your RPO and RTO.

9. Deployment manifests

Required files depend on provider, but you should codify deployment.

For Render:

- render.yaml with web and worker services.
- Mongo/Redis env vars configured externally.
- Health check path /health.

For Fly.io:

- fly.toml.
- Separate process groups for web and worker.
- Volume-free deployment if using managed Mongo/Redis/assets.

For Railway:

- Service definitions or documented deploy config.
- Separate web/worker services.

Acceptance criteria:

- Staging deploy is reproducible.
- Production deploy is reproducible.
- Web and worker are separate process types.
- Health checks are configured.
- Rollback process is documented.

10. Security hardening

Already present foundations:

- Helmet in index.js:23.
- CORS restrictions in index.js:69.
- Mongo sanitize in index.js:85.
- HPP in index.js:88.
- Global API rate limit in index.js:93.
- Auth-specific rate limit in index.js:109.

Still needed:

- Separate stricter rate limits for order lookup, checkout, uploads, domain checks, password reset, and
  webhooks.
- CSP review for React themes and merchant customization.
- Upload MIME sniffing and file extension validation.
- Malware scanning policy if merchants upload arbitrary files later.
- Dependency audit in CI.
- Secret scanning in CI.
- Production security headers verified externally.
- PII redaction in logs and errors.

Acceptance criteria:

- npm audit or equivalent runs in CI.
- Secrets are not logged.
- Uploads reject invalid MIME/types.
- Auth/order lookup/domain check endpoints are abuse-resistant.
- CSP does not break themes but blocks obvious injection vectors.
- Production cookies are secure and scoped correctly.

P2: Enterprise Readiness
These become important as merchants, revenue, and integrations grow.

11. Business correctness test pass

Required areas:

- Checkout totals.
- Discount stacking/exclusions.
- Shipping rate selection.
- Tax inclusive/exclusive pricing.
- Inventory reservation/deduction/restock.
- Partial fulfillment.
- Returns and replacements.
- Cancellation rules.
- Notification triggers.
- Order state machine.
- Multi-currency/markets.
- Customer segments.

Acceptance criteria:

- Each business rule has tests.
- Order totals are reproducible and auditable.
- Inventory cannot go negative unless explicitly allowed.
- Cancel/return/refund/fulfill transitions are state-machine controlled.
- Tax/shipping/discount calculations store snapshots on the order.

12. Admin/support tooling

You need safe internal tools before real merchants depend on you.

Required tools:

- View tenant status.
- View setup status.
- Retry failed setup.
- View domain/SSL status.
- Retry domain verification.
- View failed jobs.
- View failed webhooks.
- Inspect order/payment/fulfillment state.
- Suspend/unsuspend tenant.
- Impersonation or support access, if implemented, must be audited and tightly controlled.

Acceptance criteria:

- Support can diagnose common merchant issues without database access.
- Dangerous support actions are admin-only.
- Every support action creates an audit log.
- Tenant data access is minimized and logged.

13. Data lifecycle

Required decisions:

- Tenant suspension behavior.
- Tenant deletion behavior.
- Data export.
- Data retention.
- Backup retention.
- Customer deletion/anonymization.
- Merchant store migration import/export.

Acceptance criteria:

- Suspended tenants cannot sell but data remains intact.
- Deleted tenants follow a documented retention window.
- Merchants can export core data.
- PII deletion/anonymization behavior is defined.

14. Provider integration posture

For future fulfillment/payment/provider integrations:

- Provider config should be platform-level.
- Merchant connection/enablement should be tenant-level.
- Webhooks should terminate at platform endpoints.
- Events should be normalized internally.
- Provider retries should be idempotent.
- Provider secrets should not be merchant-editable unless intentionally supporting custom provider accounts.

Acceptance criteria:

- One provider integration can serve many tenants.
- Tenant-provider mapping is explicit.
- Webhook events cannot cross tenants.
- Failed provider events are retryable and inspectable.

My Priority Order
If you want the shortest practical sequence:

1. Fix package.json production scripts.
2. Stabilize store setup and default theme/sample data.
3. Add worker/queue.
4. Make full E2E clean and CI-enforced.
5. Add deployment manifests for your chosen host.
6. Add Sentry/logging/uptime/alerts.
7. Validate production env and secrets.
8. Prove backups and restore.
9. Decide theme artifact/CDN strategy.
10. Finish business correctness tests.
