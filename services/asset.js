/**
 * Asset Service (audit 6.6 — media library)
 *
 * Business rules for browsing/editing the media library. Upload +
 * deletion still live in controllers/services/upload.js (the Asset row
 * is written there on every upload); this layer covers list, get, and
 * alt-text editing.
 */
import {
  listAssetsRepo,
  getAssetRepo,
  updateAssetAltRepo,
} from "../repositories/asset.js";
import { APIError } from "../middlewares/errorHandler.js";

const ASSET_PRESETS = ["product", "category", "logo", "favicon", "avatar", "content"];

export const listAssets = async (models, query = {}) => {
  const { preset } = query;
  if (preset && !ASSET_PRESETS.includes(preset)) {
    throw new APIError(`Invalid preset filter. Allowed: ${ASSET_PRESETS.join(", ")}`, 400);
  }
  return listAssetsRepo(models, query);
};

export const updateAssetAlt = async (models, id, alt) => {
  if (alt != null && typeof alt !== "string") {
    throw new APIError("alt must be a string", 400);
  }
  const existing = await getAssetRepo(models, id);
  if (!existing) throw new APIError("Asset not found", 404);
  const trimmed = (alt || "").slice(0, 500);
  const updated = await updateAssetAltRepo(models, id, trimmed);
  if (!updated) throw new APIError("Asset not found", 404);
  return updated;
};
