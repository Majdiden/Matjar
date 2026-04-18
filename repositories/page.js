/**
 * Page Repository
 * All database access for the Page model goes through here.
 * Receives `models` (tenant-scoped) so tenantId is auto-injected by the
 * scoped model layer — callers never pass tenantId explicitly.
 */

export const listPagesRepo = async (
  models,
  { page = 1, limit = 20, search, published, locale } = {}
) => {
  const filter = {};
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { slug: { $regex: search, $options: "i" } },
    ];
  }
  if (published !== undefined) filter.isPublished = published;
  if (locale) filter.locale = locale;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [pages, total] = await Promise.all([
    models.Page.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    models.Page.countDocuments(filter),
  ]);
  return { pages, total };
};

export const getPageRepo = async (models, id) =>
  models.Page.findById(id).lean();

export const getPageBySlugRepo = async (models, slug, locale) => {
  const filter = { slug: String(slug).toLowerCase().trim() };
  if (locale) filter.locale = String(locale).toLowerCase().trim();
  return models.Page.findOne(filter).lean();
};

export const createPageRepo = async (models, data) =>
  models.Page.create(data);

export const updatePageRepo = async (models, id, patch) =>
  models.Page.findByIdAndUpdate(
    id,
    { $set: { ...patch, updatedAt: new Date() } },
    { new: true }
  ).lean();

export const deletePageRepo = async (models, id) =>
  models.Page.findByIdAndDelete(id);
