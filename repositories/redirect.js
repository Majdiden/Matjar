/**
 * Redirect Repository (audit 6.7)
 *
 * All DB access for the Redirect model. Receives the tenant-scoped
 * `models` bag so tenantId is auto-injected — callers never pass it.
 * The one exception is the storefront hot-path lookup + hit increment
 * (see middlewares/storefrontServe.js), which runs on the raw model
 * with an explicit tenantId because there is no request-scoped `models`
 * bag on a public storefront request.
 */

export const listRedirectsRepo = async (
  models,
  { page = 1, limit = 50, search } = {}
) => {
  const filter = {};
  if (search) {
    filter.$or = [
      { fromPath: { $regex: search, $options: "i" } },
      { toPath: { $regex: search, $options: "i" } },
    ];
  }
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
  const skip = (pageNum - 1) * limitNum;

  const [redirects, total] = await Promise.all([
    models.Redirect.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    models.Redirect.countDocuments(filter),
  ]);
  return { redirects, total, page: pageNum, limit: limitNum };
};

export const getRedirectRepo = async (models, id) =>
  models.Redirect.findById(id).lean();

export const findRedirectByFromPathRepo = async (models, fromPath) =>
  models.Redirect.findOne({ fromPath }).lean();

export const createRedirectRepo = async (models, data) =>
  models.Redirect.create(data);

export const updateRedirectRepo = async (models, id, patch) =>
  models.Redirect.findByIdAndUpdate(
    id,
    { $set: { ...patch, updatedAt: new Date() } },
    { new: true }
  ).lean();

export const deleteRedirectRepo = async (models, id) =>
  models.Redirect.findByIdAndDelete(id);
