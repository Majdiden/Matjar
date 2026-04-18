/**
 * Collection Repository
 * All database access for the Collection model goes through here.
 * Receives `models` (tenant-scoped) so tenantId is auto-injected by the scoped model layer.
 */

export const listCollectionsRepo = async (models, { page = 1, limit = 20, search, published } = {}) => {
  const filter = {};
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { handle: { $regex: search, $options: "i" } },
    ];
  }
  if (published !== undefined) filter.isPublished = published;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [collections, total] = await Promise.all([
    models.Collection.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
    models.Collection.countDocuments(filter),
  ]);
  return { collections, total };
};

export const getCollectionRepo = async (models, id) =>
  models.Collection.findById(id).lean();

export const getCollectionByHandleRepo = async (models, handle) =>
  models.Collection.findOne({ handle: handle.toLowerCase() }).lean();

export const createCollectionRepo = async (models, tenantId, data) =>
  models.Collection.create({ ...data, tenantId });

export const updateCollectionRepo = async (models, id, patch) =>
  models.Collection.findByIdAndUpdate(id, { $set: { ...patch, updatedAt: new Date() } }, { new: true }).lean();

export const deleteCollectionRepo = async (models, id) =>
  models.Collection.findByIdAndDelete(id);

export const addProductsRepo = async (models, id, productIds) =>
  models.Collection.findByIdAndUpdate(
    id,
    { $addToSet: { productIds: { $each: productIds } }, $set: { updatedAt: new Date() } },
    { new: true }
  ).lean();

export const removeProductsRepo = async (models, id, productIds) =>
  models.Collection.findByIdAndUpdate(
    id,
    { $pullAll: { productIds }, $set: { updatedAt: new Date() } },
    { new: true }
  ).lean();

export const reorderProductsRepo = async (models, id, productIds) =>
  models.Collection.findByIdAndUpdate(
    id,
    { $set: { productIds, updatedAt: new Date() } },
    { new: true }
  ).lean();
