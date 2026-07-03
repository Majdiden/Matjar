import * as AssetService from "../services/asset.js";
import { asyncHandler } from "../middlewares/errorHandler.js";

/**
 * Asset controllers (audit 6.6 — media library).
 *
 * GET /assets            → paginated, tenant-scoped, preset filter + search
 * PATCH /assets/:id      → edit alt text
 *
 * Uploads (POST /upload/content) and deletion (DELETE /upload/image)
 * are handled by controllers/upload.js — the same Asset row this
 * library browses is written there.
 */

export const list = asyncHandler(async (req, res) => {
  const { page, limit, preset, search } = req.query;
  const { assets, total, page: pageNum, limit: limitNum } =
    await AssetService.listAssets(req.models, { page, limit, preset, search });
  res.json({
    success: true,
    data: {
      assets,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    },
  });
});

export const updateAlt = asyncHandler(async (req, res) => {
  const asset = await AssetService.updateAssetAlt(
    req.models,
    req.params.id,
    req.body?.alt
  );
  res.json({ success: true, data: asset });
});
