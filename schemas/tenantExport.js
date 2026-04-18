/**
 * Admin-DB tracking row for an async tenant-data export job.
 *
 * Each row is the single source of truth for one export request:
 *   - "pending"/"running" while a worker is processing;
 *   - "ready" when the dump was uploaded and the download URL is live;
 *   - "failed" with `error` populated;
 *   - "expired" once `expiresAt` passes and the file is purged.
 *
 * Stored in the admin DB (not per-tenant) because platform admins can
 * export any tenant; keeping it cross-tenant avoids reaching through
 * 10k scoped connections to find "where is Alice's export?".
 */
import { Schema, Types } from "mongoose";

const tenantExportSchema = new Schema({
  tenantId: { type: Types.ObjectId, ref: "Tenant", required: true, index: true },
  requestedBy: { type: String, default: null },
  status: {
    type: String,
    enum: ["pending", "running", "ready", "failed", "expired"],
    default: "pending",
    index: true,
  },
  // Intentionally no `url` field. Access is reconstructed at download
  // time from storageKey + provider via storage.streamFile(); persisting
  // the raw URL would be a second source of truth and a leak risk.
  storageKey: { type: String, default: null },
  // Which storage adapter owns this file (cloudinary | local). Needed
  // by the proxy so it can stream from the right source.
  provider: { type: String, default: null },
  bytes: { type: Number, default: 0 },
  error: { type: String, default: null },
  expiresAt: { type: Date, default: null, index: true },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

export default tenantExportSchema;
