#!/usr/bin/env node
/**
 * Bootstrap a platform-admin user.
 *
 *   node scripts/create-platform-admin.js \
 *     --email ops@matjar.com --name "Ops" --password "..." \
 *     --scopes all
 *
 *   --scopes all  → grants every scope (full access)
 *   --scopes support.read,support.impersonate,queue.retry  → explicit CSV
 *   --scopes ""   → empty array (can log in, but every gated route 403s)
 *
 * Idempotent: running twice with the same email updates the password,
 * scopes, and ensures `platformAdmin: true`. Writes to the admin DB
 * configured by DB_URI. Fails fast if password is weaker than 12 chars.
 *
 * Only way in for the first admin — there is deliberately NO public
 * endpoint to self-promote because platform-admin access means "can
 * log into any tenant and exfiltrate their data".
 */

import "dotenv/config";
import mongoose from "mongoose";
import { connectDb } from "../utils/connectionManager.js";
import { generateHash } from "../utils/misc.js";
import { ALL_PLATFORM_SCOPES } from "../middlewares/platformAdmin.js";

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

async function main() {
  const args = parseArgs(process.argv);
  const email = (args.email || "").toLowerCase().trim();
  const name = args.name || "Platform Admin";
  const password = args.password || "";

  if (!email || !password) {
    console.error("Usage: create-platform-admin.js --email <email> --name <name> --password <password>");
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("Password must be at least 12 characters.");
    process.exit(1);
  }

  // Scopes. `--scopes all` expands to every known scope; CSV picks the
  // named ones. Any unknown scope aborts so typos don't silently grant
  // zero permission. Default when omitted: all scopes (backwards-
  // compatible with pre-scope admins).
  let scopes;
  const raw = args.scopes;
  if (raw === undefined) {
    scopes = [...ALL_PLATFORM_SCOPES];
  } else if (raw.trim().toLowerCase() === "all") {
    scopes = [...ALL_PLATFORM_SCOPES];
  } else if (raw.trim() === "") {
    scopes = [];
  } else {
    const requested = raw.split(",").map((s) => s.trim()).filter(Boolean);
    const unknown = requested.filter((s) => !ALL_PLATFORM_SCOPES.includes(s));
    if (unknown.length) {
      console.error(`Unknown scope(s): ${unknown.join(", ")}`);
      console.error(`Valid scopes: ${ALL_PLATFORM_SCOPES.join(", ")}`);
      process.exit(1);
    }
    scopes = requested;
  }

  await connectDb();
  const TenantUser = mongoose.model("TenantUser");
  const hash = await generateHash(password);
  const result = await TenantUser.findOneAndUpdate(
    { email },
    {
      $set: {
        name,
        email,
        platformAdmin: true,
        platformPasswordHash: hash,
        platformScopes: scopes,
      },
    },
    { upsert: true, new: true }
  );
  console.log(`Platform admin ready: ${result.email} (${result._id})`);
  console.log(`Scopes: ${scopes.length ? scopes.join(", ") : "(none)"}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Failed:", err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});
