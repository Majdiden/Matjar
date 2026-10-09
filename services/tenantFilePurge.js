/**
 * Delete every stored file that belongs to one store — used by the platform
 * "Delete store permanently" action (services/tenantDeletion.js).
 *
 * Where a store's files live:
 *   - Cloudinary (production): images are uploaded under
 *     `${cloudinaryFolder}/${tenant.domain}/…` (config/cloudinary.js →
 *     getTenantFolder). Removed by prefix, so files that were never recorded
 *     as an Asset (product/category/branding images) go too.
 *   - Asset rows: the media library records each upload's publicId. Deleted
 *     one by one as a safety net for files outside the folder (e.g. a store
 *     whose domain changed after upload).
 *   - Local disk (development): `public/uploads/<preset>/<file>`, found via
 *     the Asset row's root-relative url.
 *   - Data exports: `TenantExport.storageKey` (+ provider).
 *
 * SAFETY: prefix deletion is the dangerous primitive here — an empty or
 * malformed folder name would wipe every store's files. Prefixes are only
 * built by `tenantStoragePrefixes`, which accepts nothing but a hostname-like
 * identifier and always appends a trailing "/".
 *
 * Every step is best-effort and reported: a storage outage must not leave
 * the database half-deleted, and the caller records what failed.
 */
import fs from "fs/promises";
import path from "path";
import config from "../config/index.js";
import logger from "../utils/logger.js";

/** Cloudinary returns at most 1000 deletions per call (`partial: true` when more remain). */
const MAX_PREFIX_ROUNDS = 100;
/** Cloudinary's delete_resources accepts up to 100 public ids per call. */
const DELETE_BATCH_SIZE = 100;
const CLOUDINARY_RESOURCE_TYPES = ["image", "video", "raw"];
/** A store folder name: a hostname or slug — never empty, never a path. */
const STORE_FOLDER_ID = /^[a-z0-9](?:[a-z0-9.-]{1,251}[a-z0-9])$/;
const LOCAL_UPLOADS_ROOT = path.resolve(process.cwd(), "public", "uploads");

const isCloudinaryConfigured = () =>
  !!(config.cloudinaryCloudName && config.cloudinaryApiKey && config.cloudinaryApiSecret);

/**
 * Cloudinary folder prefixes ("<base>/<identifier>/") that can hold this
 * store's files. Pure; exported for tests.
 */
export function tenantStoragePrefixes(tenant, baseFolder = config.cloudinaryFolder) {
  const base = String(baseFolder || "").replace(/^\/+|\/+$/g, "");
  if (!base) return [];
  const ids = new Set(
    [
      tenant?.domain,
      tenant?.slug,
      tenant?.domains?.subdomain?.fullDomain,
      tenant?.domains?.customDomain?.domain,
    ]
      .filter((v) => typeof v === "string")
      .map((v) => v.trim().toLowerCase())
      .filter((v) => STORE_FOLDER_ID.test(v) && !v.includes(".."))
  );
  return [...ids].map((id) => `${base}/${id}/`);
}

/**
 * Absolute path of a dev-mode local upload from its root-relative url
 * ("/uploads/product/x.jpg"), or null when it would escape the uploads root.
 * Pure; exported for tests.
 */
export function localUploadPath(url, root = LOCAL_UPLOADS_ROOT) {
  if (typeof url !== "string" || !url.startsWith("/uploads/")) return null;
  const full = path.resolve(root, url.slice("/uploads/".length));
  return full.startsWith(root + path.sep) ? full : null;
}

async function getCloudinary() {
  const { default: cloudinary } = await import("../config/cloudinary.js");
  return cloudinary;
}

async function deletePrefix(cld, prefix, report) {
  for (const resourceType of CLOUDINARY_RESOURCE_TYPES) {
    for (let round = 0; round < MAX_PREFIX_ROUNDS; round += 1) {
      const res = await cld.api.delete_resources_by_prefix(prefix, { resource_type: resourceType, type: "upload" });
      report.deleted += Object.keys(res?.deleted || {}).length;
      if (!res?.partial) break;
    }
  }
  await deleteFolderTree(cld, prefix.replace(/\/$/, ""));
}

/** Remove the (now empty) folder and its sub-folders, deepest first. Best-effort. */
async function deleteFolderTree(cld, folder) {
  try {
    const { folders = [] } = await cld.api.sub_folders(folder);
    for (const f of folders) await deleteFolderTree(cld, f.path);
    await cld.api.delete_folder(folder);
  } catch {
    // Missing/non-empty folders are harmless; files are what matter.
  }
}

async function deleteCloudinaryIds(cld, publicIds, resourceType, report) {
  for (let i = 0; i < publicIds.length; i += DELETE_BATCH_SIZE) {
    const batch = publicIds.slice(i, i + DELETE_BATCH_SIZE);
    const res = await cld.api.delete_resources(batch, { resource_type: resourceType, type: "upload" });
    report.deleted += Object.values(res?.deleted || {}).filter((v) => v === "deleted").length;
  }
}

/**
 * Delete all files of a store.
 *
 * @param {object} tenant   Tenant document (domain/slug/domains).
 * @param {object} inputs
 * @param {Array<{publicId:string, url:string, storage:string}>} inputs.assets
 * @param {Array<{storageKey:string, provider:string}>} inputs.exports
 * @returns {Promise<{deleted:number, failed:string[]}>}
 */
export async function purgeTenantFiles(tenant, { assets = [], exports = [] } = {}) {
  const report = { deleted: 0, failed: [] };
  const fail = (what, err) => {
    report.failed.push(what);
    logger.warn("purgeTenantFiles: step failed", { tenantId: String(tenant?._id), what, error: err?.message });
  };

  const cloudAssetIds = assets.filter((a) => a.storage === "cloudinary" && a.publicId).map((a) => a.publicId);
  const cloudExportIds = exports.filter((e) => e.provider === "cloudinary" && e.storageKey).map((e) => e.storageKey);
  const needsCloudinary = cloudAssetIds.length > 0 || cloudExportIds.length > 0 || isCloudinaryConfigured();

  if (needsCloudinary) {
    if (!isCloudinaryConfigured()) {
      fail("cloudinary:not-configured", new Error("Cloudinary credentials missing"));
    } else {
      const cld = await getCloudinary();
      for (const prefix of tenantStoragePrefixes(tenant)) {
        try { await deletePrefix(cld, prefix, report); } catch (err) { fail(`cloudinary:prefix:${prefix}`, err); }
      }
      try { await deleteCloudinaryIds(cld, cloudAssetIds, "image", report); } catch (err) { fail("cloudinary:assets", err); }
      try { await deleteCloudinaryIds(cld, cloudExportIds, "raw", report); } catch (err) { fail("cloudinary:exports", err); }
    }
  }

  for (const asset of assets.filter((a) => a.storage === "local")) {
    const file = localUploadPath(asset.url);
    if (!file) continue;
    try {
      await fs.unlink(file);
      report.deleted += 1;
    } catch (err) {
      if (err.code !== "ENOENT") fail(`local:${asset.url}`, err);
    }
  }

  const localExports = exports.filter((e) => e.provider === "local" && e.storageKey);
  if (localExports.length) {
    const { deleteFile } = await import("./providers/storage.js");
    for (const e of localExports) {
      try { await deleteFile(e.storageKey); report.deleted += 1; } catch (err) { fail(`local-export:${e.storageKey}`, err); }
    }
  }

  return report;
}
