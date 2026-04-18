import { asyncHandler } from "../middlewares/errorHandler.js";

/**
 * @route   GET /api/reviews
 * @desc    List all reviews with pagination and filters
 * @access  Private (admin)
 */
export const getReviewsController = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, product, search, sort = "-createdAt" } = req.query;
  const filter = {};

  if (status === "approved") filter.isApproved = true;
  else if (status === "pending") filter.isApproved = false;
  if (product) filter.product = product;

  if (search) {
    const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = { $regex: escape(String(search).trim()), $options: "i" };
    filter.$or = [{ title: rx }, { comment: rx }];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [reviews, total] = await Promise.all([
    req.models.Review.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("user", "firstName lastName email")
      .populate("product", "name slug images")
      .lean(),
    req.models.Review.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: {
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    },
  });
});

/**
 * @route   PATCH /api/reviews/:id/approve
 * @desc    Approve a review
 * @access  Private (admin)
 */
export const approveReviewController = asyncHandler(async (req, res) => {
  const review = await req.models.Review.findByIdAndUpdate(
    req.params.id,
    { isApproved: true },
    { new: true }
  ).populate("user", "firstName lastName email").populate("product", "name slug");

  if (!review) {
    return res.status(404).json({ success: false, message: "Review not found" });
  }

  res.json({ success: true, data: { review } });
});

/**
 * @route   PATCH /api/reviews/:id/reject
 * @desc    Reject (unapprove) a review
 * @access  Private (admin)
 */
export const rejectReviewController = asyncHandler(async (req, res) => {
  const review = await req.models.Review.findByIdAndUpdate(
    req.params.id,
    { isApproved: false },
    { new: true }
  ).populate("user", "firstName lastName email").populate("product", "name slug");

  if (!review) {
    return res.status(404).json({ success: false, message: "Review not found" });
  }

  res.json({ success: true, data: { review } });
});

/**
 * @route   DELETE /api/reviews/:id
 * @desc    Delete a review
 * @access  Private (admin)
 */
export const deleteReviewController = asyncHandler(async (req, res) => {
  const review = await req.models.Review.findByIdAndDelete(req.params.id);

  if (!review) {
    return res.status(404).json({ success: false, message: "Review not found" });
  }

  res.json({ success: true, message: "Review deleted" });
});
