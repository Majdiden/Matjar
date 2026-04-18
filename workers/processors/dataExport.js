/**
 * Tenant-export processor.
 *
 * Walks every tenant-scoped collection, serializes into JSON, and
 * hands the buffer to the storage adapter (Cloudinary in prod, local
 * disk in dev). Updates the TenantExport admin row with the resulting
 * URL + byte count so the requester can poll /api/platform/tenants/
 * :id/exports/:exportId to grab the download link.
 *
 * Kept async so very large tenants don't block the web dyno. The
 * resulting URL has a 7-day expiry; the sweep job purges rows past
 * their expiresAt.
 */

import mongoose from "mongoose";
import logger from "../../utils/logger.js";
import { exportTenantData } from "../../services/dataExport.js";
import { uploadFile } from "../../services/providers/storage.js";

const EXPORT_TTL_MS = 7 * 24 * 3600 * 1000;

export async function processTenantExport(job) {
  const { tenantId, exportId } = job.data || {};
  if (!tenantId || !exportId) throw new Error("processTenantExport requires tenantId + exportId");

  const TenantExport = mongoose.model("TenantExport");
  await TenantExport.findByIdAndUpdate(exportId, {
    $set: { status: "running", startedAt: new Date() },
  });

  try {
    const dump = await exportTenantData(tenantId);
    const json = JSON.stringify(dump);
    const buffer = Buffer.from(json, "utf8");
    const filename = `tenant-${tenantId}-${exportId}.json`;
    const upload = await uploadFile({
      buffer,
      filename,
      mimetype: "application/json",
      folder: "tenant-exports",
    });
    const now = new Date();
    await TenantExport.findByIdAndUpdate(exportId, {
      $set: {
        status: "ready",
        storageKey: upload.publicId,
        provider: upload.provider,
        bytes: buffer.length,
        completedAt: now,
        expiresAt: new Date(now.getTime() + EXPORT_TTL_MS),
      },
    });
    logger.info("Tenant export ready", { tenantId, exportId, bytes: buffer.length });
    return { exportId, bytes: buffer.length };
  } catch (err) {
    await TenantExport.findByIdAndUpdate(exportId, {
      $set: { status: "failed", error: err.message, completedAt: new Date() },
    });
    logger.error("Tenant export failed", { tenantId, exportId, error: err.message });
    throw err;
  }
}
