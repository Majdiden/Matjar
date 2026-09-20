/**
 * Storefront operations for the platform console: the Domain registry across
 * tenants, the theme catalog (with per-theme store counts), and storefront
 * health probes.
 *
 * Probe safety: the target host is always taken from the platform's own
 * Domain registry / tenant subdomain (never from a request), redirects are
 * not followed (a redirect to another host is reported, not fetched), and
 * every request has a hard timeout.
 */
import mongoose from "mongoose";
import http from "http";
import https from "https";
import dns from "dns/promises";
import net from "net";
import { escapeRegExp } from "../../utils/misc.js";
import config from "../../config/index.js";
import logger from "../../utils/logger.js";
import { APIError } from "../../middlewares/errorHandler.js";
import { provisionVerifiedDomain, setPrimaryDomainRow } from "../domainRegistry.js";
import { DOMAIN_STATUSES } from "../../schemas/domain.js";
import { removeCustomDomainService } from "../domain.js";
import { updateThemeStatusService } from "../theme.js";
import { getThemeManifest } from "../themeManifestRegistry.js";

const oid = (v) => new mongoose.Types.ObjectId(String(v));

// --- Domains -----------------------------------------------------------

const DOMAIN_PROJECT = {
  $project: {
    tenantId: 1,
    tenant: { name: "$tenant.name", slug: "$tenant.slug" },
    hostname: 1,
    kind: 1,
    status: 1,
    isPrimary: 1,
    dns: { targetType: 1, expectedTarget: 1, lastResolved: 1, lastCheckedAt: 1, error: 1 },
    ssl: { provider: 1, status: 1, issuedAt: 1, expiresAt: 1, lastAttemptAt: 1, error: 1 },
    verification: { checkedAt: 1, verifiedAt: 1, failureReason: 1 },
    disabledAt: 1,
    disabledReason: 1,
    createdAt: 1,
    updatedAt: 1,
  },
};

export async function listDomains(q) {
  const match = {};
  if (q.status) match.status = q.status;
  if (q.kind) match.kind = q.kind;
  if (q.tenantId) match.tenantId = oid(q.tenantId);
  if (q.q) match.hostname = new RegExp(escapeRegExp(q.q.toLowerCase()), "i");
  const Domain = mongoose.model("Domain");
  const skip = (q.page - 1) * q.limit;
  const [rows, countRes] = await Promise.all([
    Domain.aggregate([
      { $match: match },
      { $sort: { updatedAt: -1 } },
      { $skip: skip },
      { $limit: q.limit },
      { $lookup: { from: "tenants", localField: "tenantId", foreignField: "_id", pipeline: [{ $project: { name: 1, slug: 1 } }], as: "tenant" } },
      { $unwind: { path: "$tenant", preserveNullAndEmptyArrays: true } },
      DOMAIN_PROJECT,
    ]),
    Domain.aggregate([{ $match: match }, { $count: "n" }]),
  ]);
  const total = countRes[0]?.n || 0;
  return { rows, pagination: { total, page: q.page, pages: Math.ceil(total / q.limit) || 1, limit: q.limit } };
}

export async function domainStatusCounts() {
  const Domain = mongoose.model("Domain");
  const rows = await Domain.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]);
  return Object.fromEntries(rows.map((r) => [r._id, r.n]));
}

async function loadCustomDomain(domainId) {
  const Domain = mongoose.model("Domain");
  const row = await Domain.findById(domainId).lean();
  if (!row) throw new APIError("Domain not found", 404);
  if (row.kind === "platform_subdomain") {
    throw new APIError("Platform subdomains are managed automatically and cannot be changed here", 400);
  }
  return row;
}

/** Re-run DNS → SSL provisioning for a custom domain whose ownership is proven. */
export async function retryDomainVerification(domainId) {
  const before = await loadCustomDomain(domainId);
  if (before.status === DOMAIN_STATUSES.PENDING_DNS) {
    throw new APIError("Ownership (TXT) has not been verified yet — the merchant must complete that step first", 409);
  }
  if (before.status === DOMAIN_STATUSES.DISABLED) {
    throw new APIError("Domain is disabled", 409);
  }
  const after = await provisionVerifiedDomain(domainId);
  return { before, after: after?.toObject ? after.toObject() : after };
}

export async function setDomainPrimary(domainId) {
  const before = await loadCustomDomain(domainId);
  if (before.status !== DOMAIN_STATUSES.ACTIVE) {
    throw new APIError("Only an active (serving) domain can be made primary", 409);
  }
  const after = await setPrimaryDomainRow(before.tenantId, before.hostname);
  // Keep the legacy tenant.domains.primaryDomain pointer in sync so the
  // storefront canonical-redirect logic and the dashboard agree.
  await mongoose.model("Tenant").updateOne({ _id: before.tenantId }, { $set: { "domains.primaryDomain": "custom" } });
  return { before, after: after?.toObject ? after.toObject() : after };
}

export async function removeDomain(domainId) {
  const before = await loadCustomDomain(domainId);
  await removeCustomDomainService(before.tenantId, String(before._id));
  return { before };
}

// --- Themes ------------------------------------------------------------

export async function listThemes() {
  const Theme = mongoose.model("Theme");
  const Tenant = mongoose.model("Tenant");
  const [themes, usage] = await Promise.all([
    Theme.find({}).select("name slug version description status isDefault previewImage categories statistics catalogSync createdAt updatedAt").sort({ name: 1 }).lean(),
    Tenant.aggregate([
      { $match: { deletedAt: null } },
      { $group: { _id: "$settings.activeTheme", n: { $sum: 1 } } },
    ]),
  ]);
  const usingBy = new Map(usage.map((u) => [u._id, u.n]));
  return themes.map((t) => {
    const manifest = getThemeManifest(t.slug);
    return {
      ...t,
      manifestVersion: manifest?.version || null,
      storesUsing: usingBy.get(t.slug) || 0,
    };
  });
}

export async function listThemeStores(slug, { page, limit }) {
  const Tenant = mongoose.model("Tenant");
  const filter = { "settings.activeTheme": slug, deletedAt: null };
  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    Tenant.find(filter)
      .select("name slug email lifecycle.state subscriptionPlan domains.subdomain.fullDomain themeCustomization.published.version themeCustomization.lastPublishedAt createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Tenant.countDocuments(filter),
  ]);
  return { rows, pagination: { total, page, pages: Math.ceil(total / limit) || 1, limit } };
}

export async function setThemeStatus(themeId, status) {
  const Theme = mongoose.model("Theme");
  const before = await Theme.findById(themeId).select("slug name status isDefault").lean();
  if (!before) throw new APIError("Theme not found", 404);
  if (before.isDefault && status !== "active") {
    throw new APIError("The default theme must stay active — pick another default first", 409);
  }
  const after = await updateThemeStatusService(themeId, status);
  return { before, after: { slug: after.slug, name: after.name, status: after.status } };
}

// --- Health probe ------------------------------------------------------

const PROBE_TIMEOUT_MS = 5000;
const isLocalHost = (host) => host === "localhost" || host.endsWith(".localhost") || /^localhost:\d+$/.test(host) || /\.localhost:\d+$/.test(host);

/** Mirror of TenantDetail.tsx: local hosts are http on :3000, everything else https. */
export function storefrontBaseUrl(host) {
  if (!host) return null;
  const bare = String(host).replace(/^[a-z]+:\/\//i, "").replace(/\/.*$/, "");
  if (isLocalHost(bare)) {
    const withPort = /:\d+$/.test(bare) ? bare : `${bare}:${config.port || 3000}`;
    return `http://${withPort}`;
  }
  return `https://${bare.replace(/:\d+$/, "")}`;
}

const PROBE_MAX_BODY = 64 * 1024;

/**
 * Loopback / private / link-local / metadata ranges a custom-domain probe must
 * never dial (defence in depth: the hostname comes from our own registry, but
 * a merchant controls where THEIR DNS points). Dev `*.localhost` hosts are
 * exempt because loopback is exactly where they live.
 */
export function isForbiddenAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("fe80") || v.startsWith("fc") || v.startsWith("fd")) return true;
    if (v.startsWith("::ffff:")) return isForbiddenAddress(v.slice(7));
    return false;
  }
  return true;
}

/**
 * Resolve a public host and refuse anything that lands on a private/internal
 * address. Raced against the probe timeout so a slow resolver can never hold
 * a check open longer than PROBE_TIMEOUT_MS.
 */
async function assertPublicHost(hostname) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("DNS: timeout")), PROBE_TIMEOUT_MS); });
  try {
    const addrs = await Promise.race([dns.lookup(hostname, { all: true }), timeout]);
    if (!addrs.length) throw new Error("DNS: no address");
    for (const a of addrs) {
      if (isForbiddenAddress(a.address)) throw new Error("host resolves to a non-public address");
    }
  } finally {
    clearTimeout(timer);
  }
}

const isDevHost = (hostname) => hostname === "localhost" || hostname.endsWith(".localhost");

/**
 * Dev-only request: Node's resolver does not treat `*.localhost` as loopback
 * the way browsers do, and undici's fetch drops a user-supplied Host header,
 * so we dial 127.0.0.1 with node:http and set Host explicitly. The tenant
 * resolver keys on Host, so the probe still reaches the right store.
 */
function devRequest(url, signal) {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port: u.port || 80, path: u.pathname + u.search, method: "GET", signal,
        headers: { host: u.host, "user-agent": "Matjar-StorefrontHealth/1.0", accept: "text/html" } },
      (res) => {
        // Drain (capped) so the socket is released.
        let seen = 0;
        res.on("data", (c) => { seen += c.length; if (seen > PROBE_MAX_BODY) res.destroy(); });
        res.on("end", () => resolve({ status: res.statusCode || 0, location: res.headers.location || "" }));
        res.on("close", () => resolve({ status: res.statusCode || 0, location: res.headers.location || "" }));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function probe(url) {
  const started = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), PROBE_TIMEOUT_MS);
  try {
    const u = new URL(url);
    let status;
    let location = "";
    if (isDevHost(u.hostname)) {
      ({ status, location } = await devRequest(url, ac.signal));
    } else {
      // Host already vetted once per check in checkTenantStorefront.
      const res = await fetch(url, {
        method: "GET",
        redirect: "manual",
        signal: ac.signal,
        headers: { "user-agent": "Matjar-StorefrontHealth/1.0", accept: "text/html" },
      });
      status = res.status;
      location = res.headers.get("location") || "";
      // Release the socket: read at most PROBE_MAX_BODY, then cancel.
      try {
        const reader = res.body?.getReader();
        if (reader) {
          let seen = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            seen += value?.length || 0;
            if (seen > PROBE_MAX_BODY) { await reader.cancel(); break; }
          }
        }
      } catch { /* body already gone */ }
    }
    const ms = Date.now() - started;
    // Same-host redirects (http→https, apex→www) are fine; we report but do
    // not follow, so the probe can never be steered to a third-party host.
    if (status >= 300 && status < 400) {
      let sameHost = false;
      try { sameHost = new URL(location, url).host === u.host; } catch { sameHost = false; }
      return { status: sameHost ? "ok" : "error", httpStatus: status, ms, url, error: sameHost ? null : `redirects off-host to ${location.slice(0, 120)}` };
    }
    const ok = status >= 200 && status < 400;
    return { status: ok ? "ok" : "error", httpStatus: status, ms, url, error: ok ? null : `HTTP ${status}` };
  } catch (err) {
    return { status: "error", httpStatus: null, ms: Date.now() - started, url, error: err?.name === "AbortError" ? "timeout" : String(err?.message || err).slice(0, 160) };
  } finally {
    clearTimeout(timer);
  }
}

/** TLS certificate expiry for an https host (null for local http). */
function checkSsl(baseUrl) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(baseUrl); } catch { return resolve({ ok: null, expiresAt: null, error: null }); }
    if (u.protocol !== "https:") return resolve({ ok: null, expiresAt: null, error: null });
    const req = https.request({ host: u.hostname, port: 443, method: "HEAD", path: "/", servername: u.hostname, timeout: PROBE_TIMEOUT_MS }, (res) => {
      const cert = res.socket?.getPeerCertificate?.();
      const expiresAt = cert?.valid_to ? new Date(cert.valid_to) : null;
      const authorized = res.socket?.authorized !== false;
      resolve({ ok: authorized && (!expiresAt || expiresAt > new Date()), expiresAt, error: authorized ? null : (res.socket?.authorizationError || "unauthorized") });
      res.resume();
    });
    req.on("timeout", () => { req.destroy(new Error("timeout")); });
    req.on("error", (err) => resolve({ ok: false, expiresAt: null, error: String(err?.message || err).slice(0, 160) }));
    req.end();
  });
}

function primaryHostOf(tenant, domainRows) {
  const primary = domainRows.find((d) => d.isPrimary && d.status === DOMAIN_STATUSES.ACTIVE);
  if (primary) return primary.hostname;
  const sub = domainRows.find((d) => d.kind === "platform_subdomain");
  if (sub) return sub.hostname;
  return tenant.domains?.subdomain?.fullDomain || null;
}

/** Probe one tenant's storefront and upsert the StorefrontHealth row. */
const MANUAL_CHECK_REUSE_MS = 30 * 1000;

export async function checkTenantStorefront(tenantId, { source = "cron" } = {}) {
  const Tenant = mongoose.model("Tenant");
  const Domain = mongoose.model("Domain");
  const Product = mongoose.model("Product");
  const StorefrontHealth = mongoose.model("StorefrontHealth");

  // A manual re-check within 30s returns the stored row instead of probing
  // again (bounds the outbound traffic an operator can trigger).
  if (source === "manual") {
    const recent = await StorefrontHealth.findOne({ tenantId, checkedAt: { $gt: new Date(Date.now() - MANUAL_CHECK_REUSE_MS) } }).lean();
    if (recent) return { ...recent, reused: true };
  }

  const tenant = await Tenant.findById(tenantId).select("domains settings.activeTheme themeCustomization.published.version deletedAt").lean();
  if (!tenant) throw new APIError("Tenant not found", 404);
  const domainRows = await Domain.find({ tenantId: tenant._id }).select("hostname kind status isPrimary").lean();
  const host = primaryHostOf(tenant, domainRows);
  const baseUrl = storefrontBaseUrl(host);
  const checkedAt = new Date();
  const theme = { slug: tenant.settings?.activeTheme || null, version: getThemeManifest(tenant.settings?.activeTheme)?.version || null };

  if (!baseUrl) {
    const skipped = { status: "skipped", httpStatus: null, ms: null, error: "no host", url: null };
    const doc = { tenantId: tenant._id, host: host || "", baseUrl: "", checkedAt, checks: { home: skipped, product: skipped, cart: skipped }, ssl: { ok: null, expiresAt: null, error: null }, overall: "unknown", source, theme };
    await StorefrontHealth.updateOne({ tenantId: tenant._id }, { $set: doc }, { upsert: true });
    return doc;
  }

  // Defence in depth: vet the host ONCE before any of the four dials (probe
  // and TLS check alike). A custom domain a merchant pointed at a private or
  // metadata address is reported, never contacted.
  const hostname = new URL(baseUrl).hostname;
  if (!isDevHost(hostname)) {
    try {
      await assertPublicHost(hostname);
    } catch (err) {
      const msg = String(err?.message || err).slice(0, 160);
      const blocked = { status: "error", httpStatus: null, ms: null, error: msg, url: null };
      const doc = { tenantId: tenant._id, host, baseUrl, checkedAt, checks: { home: blocked, product: blocked, cart: blocked }, ssl: { ok: null, expiresAt: null, error: msg }, overall: "error", source, theme };
      await StorefrontHealth.updateOne({ tenantId: tenant._id }, { $set: doc }, { upsert: true });
      return doc;
    }
  }

  const product = await Product.findOne({ tenantId: tenant._id, status: "active" }).select("slug").sort({ updatedAt: -1 }).lean();
  const [home, productCheck, cart, ssl] = await Promise.all([
    probe(`${baseUrl}/`),
    product ? probe(`${baseUrl}/products/${encodeURIComponent(product.slug)}`) : Promise.resolve({ status: "skipped", httpStatus: null, ms: null, error: "no active product", url: null }),
    probe(`${baseUrl}/cart`),
    checkSsl(baseUrl),
  ]);
  const overall = home.status !== "ok" ? "error" : [productCheck, cart].some((c) => c.status === "error") || ssl.ok === false ? "degraded" : "ok";
  const doc = { tenantId: tenant._id, host, baseUrl, checkedAt, checks: { home, product: productCheck, cart }, ssl, overall, source, theme };
  await StorefrontHealth.updateOne({ tenantId: tenant._id }, { $set: doc }, { upsert: true });
  return doc;
}

/** Probe every live tenant with bounded concurrency. Used by the cron job. */
export async function checkAllStorefronts({ concurrency = 3 } = {}) {
  const Tenant = mongoose.model("Tenant");
  const tenants = await Tenant.find({ deletedAt: null, isActive: true }).select("_id").lean();
  const ids = tenants.map((t) => t._id);
  let i = 0;
  const summary = { checked: 0, ok: 0, degraded: 0, error: 0, unknown: 0, failed: 0 };
  const worker = async () => {
    while (i < ids.length) {
      const id = ids[i++];
      try {
        const r = await checkTenantStorefront(id, { source: "cron" });
        summary.checked++;
        summary[r.overall] = (summary[r.overall] || 0) + 1;
      } catch (err) {
        summary.failed++;
        logger.warn("storefront health probe failed", { tenantId: String(id), error: err?.message });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length || 1) }, worker));
  return summary;
}

export async function listHealth(q) {
  const StorefrontHealth = mongoose.model("StorefrontHealth");
  const match = {};
  if (q.overall) match.overall = q.overall;
  if (q.tenantId) match.tenantId = oid(q.tenantId);
  const skip = (q.page - 1) * q.limit;
  const [rows, total] = await Promise.all([
    StorefrontHealth.aggregate([
      { $match: match },
      { $sort: { overall: 1, checkedAt: -1 } },
      { $skip: skip },
      { $limit: q.limit },
      { $lookup: { from: "tenants", localField: "tenantId", foreignField: "_id", pipeline: [{ $project: { name: 1, slug: 1 } }], as: "tenant" } },
      { $unwind: { path: "$tenant", preserveNullAndEmptyArrays: true } },
    ]),
    StorefrontHealth.countDocuments(match),
  ]);
  return { rows, pagination: { total, page: q.page, pages: Math.ceil(total / q.limit) || 1, limit: q.limit } };
}

export async function getTenantHealth(tenantId) {
  return mongoose.model("StorefrontHealth").findOne({ tenantId: oid(tenantId) }).lean();
}
