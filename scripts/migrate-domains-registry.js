/* =========================================================================
 * MIGRATED TO migrations/002_backfill_domains_registry.js on 2026-04-18
 * — kept for reference, do NOT run directly.
 *
 * The logic here has been ported to the tracked migration runner
 * (scripts/migrate.js). Running this script directly will bypass the
 * `_migrations` bookkeeping and can cause the tracked migration to
 * re-run or skip incorrectly on a future deploy. Use:
 *
 *     npm run migrate:status
 *     npm run migrate
 *
 * instead. This file is retained for historical context and to make
 * the origin of migration 002 traceable.
 * ========================================================================= */

import mongoose from "mongoose";
import config from "../config/index.js";
import { registerAllModels } from "../utils/initDbConnection.js";
import { DOMAIN_KINDS, DOMAIN_STATUSES } from "../schemas/domain.js";
import { normalizeHostname } from "../utils/hostnameNormalize.js";

/**
 * One-shot backfill: read every tenant's embedded `domains.subdomain`
 * and `domains.customDomain` subtree and write corresponding rows into
 * the new Domain registry collection.
 *
 * Idempotent — safe to re-run. Uses upsert by hostname so a second
 * invocation updates the existing row in place rather than failing
 * on the unique index.
 *
 * Run once after deploying D1–D3:
 *   node scripts/migrate-domains-registry.js
 *
 * Does NOT touch the embedded fields. They remain the legacy read
 * path until D5 migrates all call sites off them, at which point
 * a follow-up script can strip them.
 */
async function main() {
  console.log("Connecting to database…");
  await mongoose.connect(config.dbUri);
  registerAllModels(mongoose.connection);

  const Tenant = mongoose.model("Tenant");
  const Domain = mongoose.model("Domain");

  const tenants = await Tenant.find({}).lean();
  console.log(`Found ${tenants.length} tenants.`);

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
      await Domain.findOneAndUpdate(
        { hostname: subHostname },
        {
          $setOnInsert: {
            tenantId,
            hostname: subHostname,
            kind: DOMAIN_KINDS.PLATFORM_SUBDOMAIN,
            status: DOMAIN_STATUSES.ACTIVE,
            isPrimary: isSubPrimary,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      platformRows++;
    } else {
      console.warn(`  ⚠ Tenant ${tenant.name || tenant._id} has no subdomain, skipping platform row`);
      skipped++;
    }

    // --- Custom domain (optional) ---
    const customHostname = normalizeHostname(custom?.name);
    if (customHostname) {
      const verified = !!custom?.isVerified;
      const isCustomPrimary =
        tenant.domains?.primaryDomain === "custom" && verified;
      // Classify apex vs subdomain by label count (same heuristic as
      // classifyCustomHostname). Done inline to avoid importing util
      // just for this call site.
      const kind =
        customHostname.split(".").length === 2
          ? DOMAIN_KINDS.CUSTOM_APEX
          : DOMAIN_KINDS.CUSTOM_SUBDOMAIN;
      const status = verified
        ? DOMAIN_STATUSES.ACTIVE
        : DOMAIN_STATUSES.PENDING_DNS;

      await Domain.findOneAndUpdate(
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
              // Legacy embedded rows stored the plaintext code; we
              // do NOT copy it into tokenHash because sha256-ing the
              // old plaintext then comparing against a freshly-issued
              // token would always mismatch. Leave verification empty
              // on already-verified rows and let the merchant re-add
              // if they ever need to re-verify.
              tokenHash: null,
              recordName: `_matjar-verification.${customHostname}`,
              recordValue: null,
              verifiedAt: custom?.verifiedAt || null,
              checkedAt: custom?.verifiedAt || null,
              failureReason: null,
            },
            ssl: verified && custom?.sslEnabled
              ? {
                  provider: null,
                  status: "issued",
                  issuedAt: custom?.sslIssuedAt || null,
                  expiresAt: null,
                  lastAttemptAt: null,
                  error: null,
                }
              : undefined,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      customRows++;
    }
  }

  console.log("\nMigration complete.");
  console.log(`  Platform subdomain rows upserted: ${platformRows}`);
  console.log(`  Custom domain rows upserted:      ${customRows}`);
  console.log(`  Tenants skipped:                  ${skipped}`);

  await mongoose.connection.close();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
