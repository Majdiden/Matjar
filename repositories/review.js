export const createReviewRepo = async (models, reviewData) => {
  const data = await models.Review.create(reviewData);
  return Array.isArray(data) ? data[0] : data;
};

export const getReviewsRepo = async (models, filters = {}, options = {}) => {
  const { page = 1, limit = 10, sort = "-createdAt" } = options;
  const skip = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    models.Review.find(filters)
      .populate("user", "name")
      .populate("product", "name")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    models.Review.countDocuments(filters),
  ]);

  return { reviews, pagination: { total, page, pages: Math.ceil(total / limit), limit } };
};

export const updateReviewRepo = async (models, reviewId, updateData) => {
  return await models.Review.findByIdAndUpdate(reviewId, updateData, {
    new: true,
    runValidators: true,
  });
};

export const deleteReviewRepo = async (models, reviewId) => {
  return await models.Review.findByIdAndDelete(reviewId);
};

export const getProductAverageRatingRepo = async (models, productId) => {
  const result = await models.Review.aggregate([
    { $match: { product: productId } },
    { $group: { _id: "$product", avgRating: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  return result[0] || { avgRating: 0, count: 0 };
};
