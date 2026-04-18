/**
 * Check if a tenant resource count is within plan limits.
 * @param {string} resource - "products", "orders", or "users"
 */
export const checkPlanLimit = (resource) => {
  return async (req, res, next) => {
    try {
      if (!req.tenant) return next();

      const limitKey = `max${resource.charAt(0).toUpperCase() + resource.slice(1)}`;
      const limit = req.tenant.limits?.[limitKey];

      if (limit == null) return next(); // No limit configured

      // Count current usage from DB (authoritative, not from cached usage field)
      const modelName = resource === "products" ? "Product" : resource === "orders" ? "Order" : "User";
      const count = await req.models[modelName].countDocuments({});

      if (count >= limit) {
        return res.status(403).json({
          success: false,
          message: `Plan limit reached: maximum ${limit} ${resource} allowed on your ${req.tenant.subscriptionPlan} plan.`,
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
