/**
 * Asset Repository (audit 6.6 — media library)
 *
 * All DB access for the Asset model goes through here. Receives the
 * tenant-scoped `models` bag so tenantId is auto-injected — callers
 * never pass tenantId explicitly.
 */

export const listAssetsRepo = async (
  models,
  { page = 1, limit = 24, preset, search } = {}
) => {
  const filter = {};
  if (preset) filter.preset = preset;
  if (search) {
    filter.$or = [
      { filename: { $regex: search, $options: "i" } },
      { alt: { $regex: search, $options: "i" } },
    ];
  }
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 24));
  const skip = (pageNum - 1) * limitNum;

  const [assets, total] = await Promise.all([
    models.Asset.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    models.Asset.countDocuments(filter),
  ]);
  return { assets, total, page: pageNum, limit: limitNum };
};

export const getAssetRepo = async (models, id) =>
  models.Asset.findById(id).lean();

export const updateAssetAltRepo = async (models, id, alt) =>
  models.Asset.findByIdAndUpdate(
    id,
    { $set: { alt } },
    { new: true }
  ).lean();
