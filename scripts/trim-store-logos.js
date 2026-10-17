#!/usr/bin/env node
/**
 * Crop the logos stores already uploaded to the logo itself (PBI 10-45).
 *
 * New uploads are cropped by POST /api/upload/logo (services/logoTrim.js).
 * This applies the same crop to logos uploaded before that: margins, white or
 * black backgrounds and phone-screenshot bars are cut away, the cropped copy
 * is uploaded as a new image and `settings.logo` points at it. The old image
 * is left in place (nothing is deleted).
 *
 *   # list what would change, write nothing:
 *   node scripts/trim-store-logos.js --dry-run
 *
 *   # apply to every store / to one store:
 *   node scripts/trim-store-logos.js
 *   node scripts/trim-store-logos.js --tenant <tenantId>
 *
 * Idempotent: a cropped logo has no margin left, so a second run skips it.
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { connectDb, gracefulShutdown } from "../utils/connectionManager.js";
import { trimLogo } from "../services/logoTrim.js";
import { uploadImage } from "../services/upload.js";

const FETCH_TIMEOUT_MS = 15000;

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    out[a.slice(2)] = val;
  }
  return out;
}

/** The logo's bytes: a local /uploads file or a remote URL. */
async function readLogo(url) {
  if (url.startsWith("/uploads/")) {
    const file = path.join(process.cwd(), "public", path.normalize(url).replace(/^(\.\.[/\\])+/, ""));
    return fs.readFileSync(file);
  }
  if (!/^https:\/\//i.test(url)) throw new Error("not an https or /uploads URL");
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const args = parseArgs(process.argv);
  const dryRun = args["dry-run"] === "true";
  await connectDb();
  const Tenant = mongoose.model("Tenant");
  const filter = { "settings.logo": { $type: "string", $ne: "" } };
  if (args.tenant) filter._id = args.tenant;
  const tenants = await Tenant.find(filter).select("name domain slug settings.logo").lean();

  const stats = { checked: 0, cropped: 0, unchanged: 0, failed: 0 };
  // Why logos were left as they are, so a short "cropped" count is explainable.
  const why = {};
  const REASON_TEXT = {
    "no-background": "no plain or single-colour border (photo, gradient, busy edges)",
    "fills-square": "the mark already fills its coloured square",
    "small-margin": "already tight: less than 8% margin",
    "no-content": "nothing found inside the border",
    tiny: "the logo would be a tiny piece of the image",
    unreadable: "the image could not be read",
  };
  for (const t of tenants) {
    stats.checked++;
    const label = `${t.name} (${t._id})`;
    try {
      const { buffer, trimmed, reason } = await trimLogo(await readLogo(t.settings.logo));
      if (!trimmed) {
        stats.unchanged++;
        why[reason] = (why[reason] || 0) + 1;
        console.log(`  unchanged   ${label}: ${REASON_TEXT[reason] || reason}`);
        continue;
      }
      stats.cropped++;
      if (dryRun) {
        console.log(`  would crop  ${label}`);
        continue;
      }
      const domain = t.domain || t.slug || String(t._id);
      const result = await uploadImage(`data:image/png;base64,${buffer.toString("base64")}`, domain, "logo");
      await Tenant.updateOne({ _id: t._id }, { $set: { "settings.logo": result.url } });
      console.log(`  cropped     ${label} -> ${result.url}`);
    } catch (e) {
      stats.failed++;
      console.warn(`  failed      ${label}: ${e.message}`);
    }
  }

  console.log(
    `\n${dryRun ? "[dry run] " : ""}checked ${stats.checked}, cropped ${stats.cropped}, ` +
      `unchanged ${stats.unchanged}, failed ${stats.failed}`
  );
  for (const [reason, n] of Object.entries(why)) console.log(`  unchanged — ${REASON_TEXT[reason] || reason}: ${n}`);
  await gracefulShutdown();
}

main().catch(async (e) => {
  console.error(e);
  await gracefulShutdown();
  process.exit(1);
});
