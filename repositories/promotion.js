export const createPromotionRepo = async (models, promotionData) => {
  const data = await models.Promotion.create(promotionData);
  return Array.isArray(data) ? data[0] : data;
};

export const getPromotionRepo = async (models, filters, projection = {}) => {
  return await models.Promotion.findOne(filters, projection)
    .populate("applicableProducts", "name price");
};

export const getPromotionsRepo = async (models, filters = {}, options = {}) => {
  const { page = 1, limit = 10, sort = "-createdAt" } = options;
  const skip = (page - 1) * limit;

  const [promotions, total] = await Promise.all([
    models.Promotion.find(filters)
      .populate("applicableProducts", "name price")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    models.Promotion.countDocuments(filters),
  ]);

  return { promotions, pagination: { total, page, pages: Math.ceil(total / limit), limit } };
};

export const updatePromotionRepo = async (models, promotionId, updateData) => {
  return await models.Promotion.findByIdAndUpdate(promotionId, updateData, {
    new: true,
    runValidators: true,
  });
};

export const deletePromotionRepo = async (models, promotionId) => {
  return await models.Promotion.findByIdAndDelete(promotionId);
};

export const getActivePromotionsRepo = async (models) => {
  const now = new Date();
  return await models.Promotion.find({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
  }).populate("applicableProducts", "name price");
};
