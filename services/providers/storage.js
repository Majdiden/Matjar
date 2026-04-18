/**
 * Storage provider adapter.
 *
 * Upload switch:
 *   - UPLOAD_PROVIDER=cloudinary → CDN-backed uploads (production).
 *   - unset (dev) → writes to ./uploads/ on local disk; the HTTP
 *     layer must expose /uploads statically for the resulting URL to
 *     resolve. Suitable only for a single-node dev laptop.
 *
 * Unified interface: `uploadFile({ buffer, filename, mimetype, folder })`
 * → `{ url, publicId, provider, size, width?, height? }`.
 */

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import config from "../../config/index.js";

let cloudinary = null;

async function getCloudinary() {
  if (cloudinary) return cloudinary;
  const mod = await import("cloudinary");
  cloudinary = mod.v2;
  cloudinary.config({
    cloud_name: config.cloudinaryCloudName,
    api_key: config.cloudinaryApiKey,
    api_secret: config.cloudinaryApiSecret,
  });
  return cloudinary;
}

export async function uploadFile({ buffer, filename, mimetype, folder = "uploads" }) {
  if (!buffer || !buffer.length) throw new Error("uploadFile: buffer is required");

  if (config.uploadProvider === "cloudinary") {
    const cld = await getCloudinary();
    return new Promise((resolve, reject) => {
      const upload = cld.uploader.upload_stream(
        {
          folder: `${config.cloudinaryFolder}/${folder}`,
          resource_type: "auto",
          public_id:
            path
              .parse(filename || "file")
              .name.replace(/[^a-z0-9\-_]/gi, "_") +
            "-" +
            crypto.randomBytes(4).toString("hex"),
        },
        (err, result) => {
          if (err) return reject(err);
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            provider: "cloudinary",
            size: result.bytes,
            width: result.width,
            height: result.height,
          });
        }
      );
      upload.end(buffer);
    });
  }

  // Local-disk fallback for development.
  const root = path.resolve(process.cwd(), "uploads", folder);
  await fs.mkdir(root, { recursive: true });
  const safeName = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${(filename || "file").replace(/[^a-z0-9.\-_]/gi, "_")}`;
  const full = path.join(root, safeName);
  await fs.writeFile(full, buffer);
  return {
    url: `/uploads/${folder}/${safeName}`,
    publicId: safeName,
    provider: "local",
    size: buffer.length,
  };
}

/**
 * Open a readable stream for a previously-uploaded file, given its
 * storage identifier. Used by the tenant-export download proxy so the
 * raw storage URL never needs to be persisted — we reconstruct access
 * from publicId + provider at request time.
 *
 * Returns a Node Readable. Caller pipes to the HTTP response.
 */
export async function streamFile({ publicId, provider, folder = "tenant-exports" }) {
  if (!publicId) throw new Error("streamFile: publicId is required");

  if (provider === "cloudinary") {
    const cld = await getCloudinary();
    // Re-resolve the secure URL from Cloudinary for this public_id.
    // Stored as resource_type "raw" because JSON is non-media.
    const info = await cld.api.resource(publicId, { resource_type: "raw" });
    const url = info.secure_url;
    if (!url) throw new Error("Cloudinary resource missing secure_url");
    const https = await import("https");
    return new Promise((resolve, reject) => {
      https.get(url, (upstream) => {
        if (upstream.statusCode && upstream.statusCode >= 400) {
          return reject(new Error(`Cloudinary returned ${upstream.statusCode}`));
        }
        resolve(upstream);
      }).on("error", reject);
    });
  }

  // Local fallback — publicId IS the safe filename the upload path wrote.
  const full = path.resolve(process.cwd(), "uploads", folder, publicId);
  const fsMod = await import("fs");
  await fs.access(full);
  return fsMod.createReadStream(full);
}

export async function deleteFile(publicId) {
  if (config.uploadProvider === "cloudinary") {
    const cld = await getCloudinary();
    return cld.uploader.destroy(publicId);
  }
  // Local: best-effort unlink under ./uploads.
  try {
    const matches = await fs.readdir(path.resolve(process.cwd(), "uploads"), { withFileTypes: true, recursive: true });
    for (const d of matches) {
      if (d.isFile() && d.name.includes(publicId)) {
        await fs.unlink(path.join(d.parentPath || d.path, d.name)).catch(() => {});
      }
    }
  } catch (_) {}
  return { result: "ok" };
}
