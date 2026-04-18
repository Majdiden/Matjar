import { asyncHandler } from "../middlewares/errorHandler.js";

/**
 * The customer API manages shoppers only — staff accounts (admin,
 * manager) are out of scope and must be invisible to these endpoints.
 * Applied as a filter on every list / detail / mutation query so a
 * manager cannot list, read, or deactivate another staff member via
 * `/api/customers`. Staff user management, if we ever expose it over
 * HTTP, belongs on a separate admin-only staff route.
 *
 * "role = customer" is defined as: the user's roles array contains
 * "customer" AND does NOT contain "admin" or "manager". A user with
 * both "admin" and "customer" roles is staff and excluded.
 */
// A user is a "customer" for this endpoint if they are NOT staff. We used
// to additionally require `roles` to contain "customer", but legacy users
// created before the roles default landed (or via older guest-checkout
// paths) have missing/empty `roles` and were being hidden from the
// customers list. Excluding staff is sufficient — anyone else is a
// shopper.
const CUSTOMER_ONLY_MATCH = {
  roles: { $nin: ["admin", "manager", "staff"] },
};

/**
 * @route   GET /api/customers
 * @desc    List all customers with pagination and search
 * @access  Private (admin)
 */
export const getCustomersController = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, sort = "-createdAt" } = req.query;
  const filter = { ...CUSTOMER_ONLY_MATCH };

  if (search) {
    const raw = String(search).trim();
    // Escape regex metacharacters — a user pasting a "+" or "." from a
    // phone/email into the search box should not blow up the query.
    const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = raw.split(/\s+/).filter(Boolean);
    const ors = [
      { firstName: { $regex: escape(raw), $options: "i" } },
      { lastName: { $regex: escape(raw), $options: "i" } },
      { email: { $regex: escape(raw), $options: "i" } },
      { phone: { $regex: escape(raw), $options: "i" } },
      { name: { $regex: escape(raw), $options: "i" } },
    ];
    // "firstName lastName" combined query — match either half of a
    // space-separated input against either name field so "Jane Doe"
    // finds a record whose firstName is "Jane" and lastName is "Doe".
    if (parts.length > 1) {
      const [first, ...rest] = parts;
      const last = rest.join(" ");
      ors.push({
        $and: [
          { firstName: { $regex: escape(first), $options: "i" } },
          { lastName: { $regex: escape(last), $options: "i" } },
        ],
      });
    }
    filter.$or = ors;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [customers, total] = await Promise.all([
    req.models.User.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select("-password -refreshToken")
      .lean(),
    req.models.User.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: {
      customers,
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
 * @route   GET /api/customers/:id
 * @desc    Get customer details with order history
 * @access  Private (admin)
 */
export const getCustomerController = asyncHandler(async (req, res) => {
  // findOne with the customer-only filter — findById would bypass the
  // role filter and expose staff accounts if an id happens to match.
  const customer = await req.models.User.findOne({
    _id: req.params.id,
    ...CUSTOMER_ONLY_MATCH,
  })
    .select("-password -refreshToken")
    .lean();

  if (!customer) {
    return res.status(404).json({ success: false, message: "Customer not found" });
  }

  // Get order stats
  const orders = await req.models.Order.find({ user: customer._id })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const orderStats = await req.models.Order.aggregate([
    { $match: { tenantId: req.tenantId, user: customer._id } },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: "$totalAmount" },
        avgOrderValue: { $avg: "$totalAmount" },
      },
    },
  ]);

  res.json({
    success: true,
    data: {
      customer,
      recentOrders: orders,
      stats: orderStats[0] || { totalOrders: 0, totalSpent: 0, avgOrderValue: 0 },
    },
  });
});

/**
 * @route   PATCH /api/customers/:id
 * @desc    Update customer details
 * @access  Private (admin)
 */
export const updateCustomerController = asyncHandler(async (req, res) => {
  const { firstName, lastName, phone, isActive } = req.body;
  const update = {};
  if (firstName !== undefined) update.firstName = firstName;
  if (lastName !== undefined) update.lastName = lastName;
  if (phone !== undefined) update.phone = phone;
  if (isActive !== undefined) update.isActive = isActive;

  // findOneAndUpdate with the customer-only filter so the mutation
  // cannot touch a staff user (admin/manager) even if the id matches.
  const customer = await req.models.User.findOneAndUpdate(
    { _id: req.params.id, ...CUSTOMER_ONLY_MATCH },
    update,
    { new: true }
  ).select("-password -refreshToken");

  if (!customer) {
    return res.status(404).json({ success: false, message: "Customer not found" });
  }

  res.json({ success: true, data: { customer } });
});
