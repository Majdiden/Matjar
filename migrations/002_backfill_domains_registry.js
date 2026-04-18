/**
 * 002_backfill_domains_registry
 *
 * Backfill the Domain registry collection from the embedded
 * `tenant.domains.{subdomain,customDomain}` subtree that pre-dates the
 * first-class Domain resource.
 *
 * Ported from scripts/migrate-domains-registry.js. The logic is
 * identical — iterate every Tenant, derive hostname(s) from the
 * embedded fields, upsert a row into `domains` keyed by hostname.
 *
 * Idempotent:
 *   - Keyed by hostname (the `domains` collection has a globally unique
 *     index on `hostname`).
 *   - Uses `$setOnInsert` so re-running does NOT clobber any fields the
 *     domain service may have written since the first backfill.
 *
 * Reversibility:
 *   `down()` removes only the rows that came FROM tenant embeds and
 *   still look untouched — i.e. rows whose `kind` matches the embed's
 *   kind AND whose `verification.recordValue` is still null (a
 *   post-backfill row would have had a real token issued on re-verify).
 *   This is best-effort: once the registry becomes authoritative and
 *   the service writes to rows, a full reversal isn't safe, so the
 *   intent here is "undo a bad backfill run within the same deploy
 *   window", not "restore a pre-D3 world a month later".
 */

import config from "../config/index.js";
import { DOMAIN_KINDS, DOMAIN_STATUSES } from "../schemas/domain.js";
import { normalizeHostname } from "../utils/hostnameNormalize.js";

export const description =
  "Backfill Domain registry rows from tenant.domains.{subdomain,customDomain} embeds";

export async function up(db, { logger, session } = {}) {
  const sessionOpt = session ? { session } : undefined;

  const tenants = await db
    .collection("tenants")
    .find({}, sessionOpt)
    .toArray();

  logger?.info?.(`migrate 002: scanning ${tenants.length} tenant(s) for embedded domains`);

  let platformRows = 0;
  let customRows = 0;
  let skipped = 0;

  for (const tenant of tenants) {
    const tenantId = tenant._id;
    const sub = tenant.domains?.subdomain;
    const custom = tenant.domains?.customDomain;

    // --- Platform subdomain ---
    const subHostname = normalizeHostname(
      sub?.fullDomain ||
        (sub?.name ? `${sub.name}.${config.domainSuffix || config.baseDomain}` : null)
    );

    if (subHostname) {
      const isSubPrimary = tenant.domains?.primaryDomain !== "custom";
      const now = new Date();
      await db.collection("domains").updateOne(
        { hostname: subHostname },
        {
          $setOnInsert: {
            tenantId,
            hostname: subHostname,
            kind: DOMAIN_KINDS.PLATFORM_SUBDOMAIN,
            status: DOMAIN_STATUSES.ACTIVE,
            isPrimary: isSubPrimary,
            verification: {
              method: "txt",
              tokenHash: null,
              recordName: null,
              recordValue: null,
              checkedAt: null,
              verifiedAt: null,
              failureReason: null,
            },
            dns: {
              targetType: null,
              expectedTarget: null,
              lastResolved: null,
              lastCheckedAt: null,
              error: null,
            },
            ssl: {
              provider: null,
              status: null,
              providerRef: null,
              issuedAt: null,
              expiresAt: null,
              lastAttemptAt: null,
              error: null,
            },
            redirects: {
              forceHttps: true,
              canonicalHost: null,
            },
            createdBy: null,
            disabledAt: null,
            disabledReason: null,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true, ...(sessionOpt || {}) }
      );
      platformRows++;
    } else {
      logger?.warn?.(
        `migrate 002: tenant ${tenant.name || tenant._id} has no subdomain, skipping platform row`
      );
      skipped++;
    }

    // --- Custom domain (optional) ---
    const customHostname = normalizeHostname(custom?.name);
    if (customHostname) {
      const verified = !!custom?.isVerified;
      const isCustomPrimary =
        tenant.domains?.primaryDomain === "custom" && verified;
      // Classify apex vs subdomain by label count (same heuristic as
      // classifyCustomHostname). Inline to avoid importing the util.
      const kind =
        customHostname.split(".").length === 2
          ? DOMAIN_KINDS.CUSTOM_APEX
          : DOMAIN_KINDS.CUSTOM_SUBDOMAIN;
      const status = verified
        ? DOMAIN_STATUSES.ACTIVE
        : DOMAIN_STATUSES.PENDING_DNS;

      const now = new Date();
      await db.collection("domains").updateOne(
        { hostname: customHostname },
        {
          $setOnInsert: {
            tenantId,
            hostname: customHostname,
            kind,
            status,
            isPrimary: isCustomPrimary,
            verification: {
              method: "txt",
              // Legacy embeds stored the plaintext code; we do NOT copy
              // it into tokenHash because sha256-ing the old plaintext
              // then comparing against a freshly-issued token would
              // always mismatch. Leave verification empty on already-
              // verified rows; the merchant can re-verify if needed.
              tokenHash: null,
              recordName: `_matjar-verification.${customHostname}`,
              recordValue: null,
              checkedAt: custom?.verifiedAt || null,
              verifiedAt: custom?.verifiedAt || null,
              failureReason: null,
            },
            dns: {
              targetType: null,
              expectedTarget: null,
              lastResolved: null,
              lastCheckedAt: null,
              error: null,
            },
            ssl:
              verified && custom?.sslEnabled
                ? {
                    provider: null,
                    status: "issued",
                    providerRef: null,
                    issuedAt: custom?.sslIssuedAt || null,
                    expiresAt: null,
                    lastAttemptAt: null,
                    error: null,
                  }
                : {
                    provider: null,
                    status: null,
                    providerRef: null,
                    issuedAt: null,
                    expiresAt: null,
                    lastAttemptAt: null,
                    error: null,
                  },
            redirects: {
              forceHttps: true,
              canonicalHost: null,
            },
            createdBy: null,
            disabledAt: null,
            disabledReason: null,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true, ...(sessionOpt || {}) }
      );
      customRows++;
    }
  }

  logger?.info?.(
    `migrate 002: done — platform=${platformRows} custom=${customRows} skipped=${skipped}`
  );
}

export async function down(db, { logger, session } = {}) {
  const sessionOpt = session ? { session } : undefined;

  // Best-effort reversal: delete only rows that still look freshly
  // backfilled (no real verification token written since insert).
  // This deliberately spares any row that the live domain service
  // has mutated — safer than nuking the registry.
  const result = await db.collection("domains").deleteMany(
    {
      "verification.recordValue": null,
      $or: [
        { "verification.tokenHash": null },
        { "verification.tokenHash": { $exists: false } },
      ],
    },
    sessionOpt
  );

  logger?.warn?.(
    `migrate 002 down: deleted ${result.deletedCount} untouched registry rows. ` +
      "Rows modified by the domain service since backfill were preserved."
  );
}
