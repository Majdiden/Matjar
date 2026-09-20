#!/usr/bin/env node
/**
 * Bootstrap a platform-admin user.
 *
 *   node scripts/create-platform-admin.js \
 *     --email ops@matjar.to --name "Ops" --password "..." \
 *     --scopes all
 *
 *   --role owner|admin|operations|support|finance|developer
 *                 (default: owner when --scopes is "all"/omitted, else none)
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
import { PLATFORM_ROLES, isValidRole } from "../config/platformRoles.js";

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

  // Named role → effective scopes are role ∪ explicit scopes (see
  // config/platformRoles.js). Defaults to OWNER for a full-access bootstrap.
  const fullAccess = raw === undefined || raw.trim().toLowerCase() === "all";
  const roleGiven = args.role !== undefined;
  const scopesGiven = raw !== undefined;
  let role = roleGiven ? String(args.role).toLowerCase().trim() : fullAccess ? PLATFORM_ROLES.OWNER : null;
  if (role && !isValidRole(role)) {
    console.error(`Unknown role: ${role}. Valid roles: ${Object.values(PLATFORM_ROLES).join(", ")}`);
    process.exit(1);
  }

  await connectDb();
  const TenantUser = mongoose.model("TenantUser");
  const hash = await generateHash(password);
  const existing = await TenantUser.findOne({ email, platformAdmin: true }).select("platformRole platformScopes");
  // Existing account: rotating the password must NOT silently promote it.
  // Role/scopes only change when passed explicitly on the command line.
  const $set = {
    name,
    email,
    platformAdmin: true,
    platformPasswordHash: hash,
    platformStatus: "active",
    platformMustResetPassword: false,
  };
  if (!existing || roleGiven) $set.platformRole = role;
  if (!existing || scopesGiven) $set.platformScopes = scopes;
  // Never promote a merchant's directory row: an existing platform row is
  // updated in place; otherwise a DEDICATED tenantId:null row is upserted
  // (matching a free tenant-less row if one exists, else inserting one).
  const filter = existing
    ? { email, platformAdmin: true }
    : { email, tenantId: null, platformAdmin: { $ne: true } };
  const result = await TenantUser.findOneAndUpdate(
    filter,
    {
      $set,
      ...(existing ? {} : { $setOnInsert: { tenantId: null, createdAt: new Date() } }),
      // Revoke any existing sessions when credentials are reset from the CLI.
      $inc: { platformTokenVersion: 1 },
    },
    { upsert: !existing, new: true }
  );
  console.log(`Platform admin ${existing ? "updated" : "created"}: ${result.email} (${result._id})`);
  console.log(`Role: ${result.platformRole || "(none)"}${existing && !roleGiven ? " (unchanged — pass --role to change)" : ""}`);
  const finalScopes = result.platformScopes || [];
  console.log(`Scopes: ${finalScopes.length ? finalScopes.join(", ") : "(none)"}${existing && !scopesGiven ? " (unchanged — pass --scopes to change)" : ""}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Failed:", err.message);
  mongoose.disconnect().finally(() => process.exit(1));
});
