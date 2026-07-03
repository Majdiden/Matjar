import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

/**
 * Asset — row-level record of every uploaded image.
 *
 * Why this exists:
 *   The previous deletion authorization was a substring check on the URL
 *   ("does this URL contain `/${tenantDomain}/`?"). That's brittle (relies
 *   on URL conventions), defeated by any tenant whose slug is a substring
 *   of another tenant's slug, and unauditable. We now persist an asset
 *   record on every upload and authorize deletion against the row.
 *
 * The record is intentionally minimal — it tracks ownership and the bits
 * we need to delete the underlying object (publicId for Cloudinary, or
 * the local path in dev). Usage refs still live on the consuming entity
 * (Product.images, Category.image, etc.). Since the media library
 * (audit 6.6) the row also carries the browse/reuse metadata the
 * library UI needs: `alt` (merchant-editable) and `filename` (the
 * original upload name, for search + display).
 */
const assetSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  url: { type: String, required: true, index: true },
  // Cloudinary public_id when in prod, the local-{...} sentinel in dev.
  // Used as the canonical handle for deletion.
  publicId: { type: String, required: true },
  // The upload-preset bucket: product | category | logo | favicon |
  // avatar | content ("content" = media-library uploads destined for
  // page bodies / theme sections; audit 6.6).
  preset: {
    type: String,
    enum: ["product", "category", "logo", "favicon", "avatar", "content"],
    required: true,
  },
  // Merchant-editable alternative text, surfaced by the media library
  // and used when the asset is inserted into page/section content.
  alt: { type: String, default: "", maxlength: 500 },
  // Original filename at upload time (display + search in the library).
  filename: { type: String, default: "", maxlength: 300 },
  // Cloudinary | local — lets the deleter pick the right backend.
  storage: {
    type: String,
    enum: ["cloudinary", "local"],
    required: true,
  },
  // The user that uploaded it. Useful for auditing and for stricter
  // policies later (e.g. only the uploader or an admin can delete).
  uploadedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  bytes: { type: Number, default: 0 },
  format: { type: String, default: null },
  width: { type: Number, default: null },
  height: { type: Number, default: null },
  createdAt: { type: Date, default: Date.now },
});

// Tenants should be able to look up an asset by URL for ownership checks
// without scanning the whole collection. The (tenantId, url) pair is
// effectively unique — same upload twice creates two records, but the
// URLs themselves are unique per upload.
assetSchema.index({ tenantId: 1, url: 1 });
assetSchema.index({ tenantId: 1, publicId: 1 });
assetSchema.index({ tenantId: 1, createdAt: -1 });

applyTenantScope(assetSchema);

export default assetSchema;
