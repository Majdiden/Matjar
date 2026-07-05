#!/usr/bin/env node
/**
 * Rewrite tenant platform-subdomain hostnames from a retired platform domain
 * to the current one (invoila.io → matjar.to).
 *
 *   # preview every change without writing:
 *   node scripts/migrate-legacy-domain-hosts.js --dry-run
 *
 *   # apply:
 *   node scripts/migrate-legacy-domain-hosts.js
 *
 *   # override the domains (defaults: --from = config.legacyDomains,
 *   #                                 --to   = config.platformDomain):
 *   node scripts/migrate-legacy-domain-hosts.js --from invoila.io,old.io --to matjar.to
 *
 * What it touches (only hosts still under a retired suffix — nothing else):
 *   1. Tenant.domains.subdomain.fullDomain   (mystore.invoila.io → mystore.matjar.to)
 *   2. Tenant.domain                         (legacy mirror field, if set)
 *   3. Domain.hostname                       (registry rows, kind=platform_subdomain)
 *
 * It deliberately does NOT touch merchant-owned custom domains
 * (Tenant.domains.customDomain.name, Domain kind=custom_*) — those are the
 * merchant's own hostnames, unrelated to our platform domain move.
 *
 * Idempotent: a second run finds nothing left on the old suffix and is a
 * no-op. The redirect middleware keeps old links working until (and after)
 * this runs, so it is safe to run at any time.
 */

import "dotenv/config";
import mongoose from "mongoose";
import { connectDb, gracefulShutdown } from "../utils/connectionManager.js";
import config from "../config/index.js";

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[key] = val;
    }
  }
  return out;
}

const normDomain = (s) =>
  String(s || "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");

/**
 * If `host` equals or is a subdomain of any retired suffix in `fromList`,
 * return it re-based onto `to` (label preserved). Otherwise return null.
 *   swapSuffix("mystore.invoila.io", ["invoila.io"], "matjar.to")
 *     → "mystore.matjar.to"
 *   swapSuffix("invoila.io", ["invoila.io"], "matjar.to") → "matjar.to"
 */
function swapSuffix(host, fromList, to) {
  const h = normDomain(host);
  if (!h) return null;
  for (const from of fromList) {
    if (h === from) return to;
    if (h.endsWith(`.${from}`)) return h.slice(0, h.length - from.length) + to;
  }
  return null;
}

async function main() {
  const args = parseArgs(process.argv);
  const dryRun = args["dry-run"] === "true" || args.dry === "true";

  const fromList = (args.from
    ? args.from.split(",")
    : config.legacyDomains
  )
    .map(normDomain)
    .filter(Boolean);
  const to = normDomain(args.to || config.platformDomain);

  if (!fromList.length) {
    console.error("No source domains — pass --from or set LEGACY_DOMAINS.");
    process.exit(1);
  }
  if (!to || to.endsWith(".local") || to === "localhost") {
    console.error(
      `Refusing to migrate to a non-routable target domain "${to}". ` +
        "Set PLATFORM_DOMAIN (or pass --to) to the real domain."
    );
    process.exit(1);
  }

  console.log(
    `${dryRun ? "[DRY RUN] " : ""}Migrating platform hosts: ${fromList
      .map((f) => `*.${f}`)
      .join(", ")}  →  *.${to}\n`
  );

  await connectDb();
  const Tenant = mongoose.model("Tenant");
  const Domain = mongoose.model("Domain");

  const stats = {
    tenantFullDomain: 0,
    tenantLegacyDomain: 0,
    domainRegistry: 0,
  };

  // ── 1 + 2. Tenant embedded hosts ─────────────────────────────────────
  const tenants = await Tenant.find(
    {},
    { name: 1, "domains.subdomain": 1, domain: 1 }
  ).lean();

  for (const tnt of tenants) {
    const updates = {};

    const full = tnt?.domains?.subdomain?.fullDomain;
    const newFull = swapSuffix(full, fromList, to);
    if (newFull && newFull !== full) {
      updates["domains.subdomain.fullDomain"] = newFull;
      stats.tenantFullDomain++;
    }

    const legacy = tnt?.domain;
    const newLegacy = swapSuffix(legacy, fromList, to);
    if (newLegacy && newLegacy !== legacy) {
      updates.domain = newLegacy;
      stats.tenantLegacyDomain++;
    }

    if (Object.keys(updates).length) {
      console.log(
        `  Tenant ${tnt.name} (${tnt._id})` +
          (updates["domains.subdomain.fullDomain"]
            ? `\n    fullDomain: ${full} → ${updates["domains.subdomain.fullDomain"]}`
            : "") +
          (updates.domain ? `\n    domain:     ${legacy} → ${updates.domain}` : "")
      );
      if (!dryRun) await Tenant.updateOne({ _id: tnt._id }, { $set: updates });
    }
  }

  // ── 3. Domain registry rows ──────────────────────────────────────────
  const domainRows = await Domain.find(
    {},
    { hostname: 1, kind: 1, tenantId: 1 }
  ).lean();

  for (const row of domainRows) {
    const newHost = swapSuffix(row.hostname, fromList, to);
    if (newHost && newHost !== row.hostname) {
      stats.domainRegistry++;
      console.log(
        `  Domain[${row.kind}] ${row.hostname} → ${newHost} (tenant ${row.tenantId})`
      );
      if (!dryRun) {
        await Domain.updateOne({ _id: row._id }, { $set: { hostname: newHost } });
      }
    }
  }

  console.log(
    `\n${dryRun ? "[DRY RUN] would update" : "Updated"}:\n` +
      `  Tenant.domains.subdomain.fullDomain : ${stats.tenantFullDomain}\n` +
      `  Tenant.domain (legacy field)        : ${stats.tenantLegacyDomain}\n` +
      `  Domain.hostname (registry)          : ${stats.domainRegistry}\n`
  );
  if (dryRun) console.log("No changes written. Re-run without --dry-run to apply.");

  await gracefulShutdown();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("Migration failed:", err);
  try {
    await gracefulShutdown();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
