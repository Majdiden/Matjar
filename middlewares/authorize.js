/**
 * Authorization — role + permission gating.
 *
 * There are two layers:
 *   1. Built-in roles (admin/manager/staff/customer) — their permission
 *      sets are hardcoded in ROLE_PERMISSIONS below. Every user carries
 *      at least one built-in role.
 *   2. Custom roles — stored in the tenant's Role collection, referenced
 *      from user.customRoleIds. Additive: a user's effective permissions
 *      are the union of built-in role perms and every custom role.
 *
 * Routes should prefer `requirePermission("foo.bar")` over role-based
 * gates. Role gates are kept for routes where the distinction is truly
 * structural (admin-only: staff management, audit logs, etc.).
 */

export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please login first.",
      });
    }

    const userRoles = req.user.roles || [];
    const hasRole = allowedRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You do not have permission to perform this action.",
        requiredRoles: allowedRoles,
      });
    }

    next();
  };
};

export const isAdmin = authorize("admin");
export const isManager = authorize("admin", "manager");

/**
 * Canonical permission catalog. Single source of truth for what keys
 * the frontend role editor can choose from and what the backend will
 * recognize on custom roles. Grouped for UI rendering.
 */
export const PERMISSION_CATALOG = [
  {
    key: "products",
    label: "Products",
    permissions: [
      { key: "products.read", label: "View products" },
      { key: "products.write", label: "Create, edit, and delete products" },
    ],
  },
  {
    key: "orders",
    label: "Orders",
    permissions: [
      { key: "orders.read", label: "View orders" },
      { key: "orders.write", label: "Update order status and fulfillment" },
      { key: "orders.cancel", label: "Cancel orders" },
    ],
  },
  {
    key: "payments",
    label: "Payments",
    permissions: [
      { key: "payments.read", label: "View payments and transactions" },
      { key: "payments.verify", label: "Verify manual payments" },
      { key: "payments.refund", label: "Record refunds" },
    ],
  },
  {
    key: "customers",
    label: "Customers",
    permissions: [
      { key: "customers.read", label: "View customers" },
      { key: "customers.write", label: "Edit customers and segments" },
    ],
  },
  {
    key: "inventory",
    label: "Inventory",
    permissions: [
      { key: "inventory.read", label: "View inventory" },
      { key: "inventory.write", label: "Adjust stock levels" },
    ],
  },
  {
    key: "discounts",
    label: "Discounts & Gift cards",
    permissions: [
      { key: "discounts.read", label: "View discounts and gift cards" },
      { key: "discounts.write", label: "Create and edit discounts" },
    ],
  },
  {
    key: "fulfillments",
    label: "Fulfillment",
    permissions: [
      { key: "fulfillments.read", label: "View fulfillments" },
      { key: "fulfillments.write", label: "Create and update fulfillments" },
    ],
  },
  {
    key: "content",
    label: "Content & Themes",
    permissions: [
      { key: "themes.read", label: "View themes" },
      { key: "themes.write", label: "Customize and install themes" },
      { key: "uploads.write", label: "Upload images and assets" },
    ],
  },
  {
    key: "analytics",
    label: "Analytics & Reports",
    permissions: [
      { key: "analytics.read", label: "View analytics" },
      { key: "reviews.read", label: "View reviews" },
      { key: "reviews.moderate", label: "Moderate reviews" },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    permissions: [
      { key: "settings.read", label: "View store settings" },
      { key: "settings.write", label: "Edit store settings (shipping, tax, markets)" },
      { key: "domains.read", label: "View domains" },
      { key: "domains.write", label: "Manage domains" },
    ],
  },
  {
    key: "team",
    label: "Team & Security",
    permissions: [
      { key: "team.manage", label: "Manage staff invites and roles" },
      { key: "audit.read", label: "View audit logs" },
    ],
  },
  {
    key: "dashboard",
    label: "Dashboard",
    permissions: [
      { key: "dashboard.read", label: "Access the dashboard" },
    ],
  },
];

const ALL_PERMISSION_KEYS = new Set(
  PERMISSION_CATALOG.flatMap((g) => g.permissions.map((p) => p.key))
);

/**
 * Built-in role → permission map. "*" means every permission.
 */
const ROLE_PERMISSIONS = {
  admin: ["*"],
  manager: [
    "dashboard.read",
    "products.read", "products.write",
    "orders.read", "orders.write", "orders.cancel",
    "payments.read", "payments.verify", "payments.refund",
    "customers.read", "customers.write",
    "inventory.read", "inventory.write",
    "discounts.read", "discounts.write",
    "fulfillments.read", "fulfillments.write",
    "themes.read", "themes.write",
    "uploads.write",
    "analytics.read",
    "reviews.read", "reviews.moderate",
    "settings.read", "settings.write",
    "domains.read", "domains.write",
  ],
  staff: [
    "dashboard.read",
    "products.read",
    "orders.read",
    "payments.read",
    "customers.read",
    "inventory.read",
    "fulfillments.read", "fulfillments.write",
    "reviews.read",
  ],
  customer: [
    "orders.read.own",
    "profile.read.own", "profile.write.own",
    "reviews.write.own",
    "wishlist.read.own", "wishlist.write.own",
  ],
};

export { ROLE_PERMISSIONS, ALL_PERMISSION_KEYS };

export const BUILT_IN_ROLES = Object.keys(ROLE_PERMISSIONS).map((r) => ({
  code: r,
  name: r.charAt(0).toUpperCase() + r.slice(1),
  permissions: ROLE_PERMISSIONS[r],
  isSystem: true,
}));

/**
 * Resolve a user's effective permissions from their built-in roles +
 * attached custom roles. Returns a Set for O(1) includes.
 *
 * Caches the result on req._permissionCache so multiple requirePermission
 * middlewares on the same request don't each re-query custom roles.
 */
export async function getEffectivePermissions(req) {
  if (req._permissionCache) return req._permissionCache;

  const perms = new Set();
  const userRoles = req.user?.roles || [];

  for (const role of userRoles) {
    const rolePerms = ROLE_PERMISSIONS[role] || [];
    if (rolePerms.includes("*")) {
      req._permissionCache = new Set(["*"]);
      return req._permissionCache;
    }
    for (const p of rolePerms) perms.add(p);
  }

  const customRoleIds = req.user?.customRoleIds || [];
  if (customRoleIds.length > 0 && req.models?.Role) {
    const customRoles = await req.models.Role.find({
      _id: { $in: customRoleIds },
    }).select("permissions").lean();
    for (const r of customRoles) {
      for (const p of r.permissions || []) {
        // Custom roles can only grant known, non-wildcard permissions.
        if (p === "*") continue;
        perms.add(p);
      }
    }
  }

  req._permissionCache = perms;
  return perms;
}

/**
 * Middleware: require that the authenticated user holds ANY of the
 * listed permissions (OR semantics — matching the pre-refactor behavior).
 */
export const requirePermission = (...requiredPermissions) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    try {
      const perms = await getEffectivePermissions(req);
      if (perms.has("*")) return next();
      const ok = requiredPermissions.some((p) => perms.has(p));
      if (!ok) {
        return res.status(403).json({
          success: false,
          message: "Insufficient permissions for this action.",
          required: requiredPermissions,
        });
      }
      next();
    } catch (err) {
      return res.status(500).json({ success: false, message: "Permission check failed." });
    }
  };
};

export const isSelfOrAdmin = (userIdParam = "userId") => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please login first.",
      });
    }

    const targetUserId = req.params[userIdParam] || req.body[userIdParam];
    const isOwnResource = req.user.userId === targetUserId;
    const isAdminRole = req.user.roles.includes("admin");

    if (!isOwnResource && !isAdminRole) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only access your own resources.",
      });
    }

    next();
  };
};
