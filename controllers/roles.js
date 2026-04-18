import { asyncHandler } from "../middlewares/errorHandler.js";
import {
  BUILT_IN_ROLES,
  PERMISSION_CATALOG,
  ALL_PERMISSION_KEYS,
} from "../middlewares/authorize.js";

/**
 * GET /api/roles — returns the permission catalog plus every role the
 * tenant can assign:
 *   - Built-in roles (admin/manager/staff/customer) are synthesized from
 *     ROLE_PERMISSIONS. They're flagged `isSystem: true` so the UI can
 *     render them read-only.
 *   - Custom roles come from the tenant's Role collection.
 */
export const listRolesController = asyncHandler(async (req, res) => {
  const customRoles = await req.models.Role.find({}).sort({ name: 1 }).lean();
  const builtIn = BUILT_IN_ROLES.map((r) => ({
    _id: `system:${r.code}`,
    code: r.code,
    name: r.name,
    description: `Built-in ${r.code} role`,
    permissions: r.permissions,
    isSystem: true,
  }));
  res.json({
    success: true,
    data: {
      catalog: PERMISSION_CATALOG,
      roles: [...builtIn, ...customRoles.map((r) => ({ ...r, isSystem: false }))],
    },
  });
});

/**
 * POST /api/roles — create a custom role.
 * Body: { name, description?, permissions: string[] }
 */
export const createRoleController = asyncHandler(async (req, res) => {
  const { name, description, permissions } = req.body || {};
  if (!name || typeof name !== "string") {
    return res.status(400).json({ success: false, message: "`name` is required." });
  }
  if (!Array.isArray(permissions)) {
    return res
      .status(400)
      .json({ success: false, message: "`permissions` must be an array of permission keys." });
  }
  // Block unknown permission keys — prevents typos from becoming silent
  // no-op permissions that look granted in the UI but match no backend
  // check. Also blocks wildcard grants via custom roles.
  const unknown = permissions.filter((p) => !ALL_PERMISSION_KEYS.has(p));
  if (unknown.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Unknown permission keys: ${unknown.join(", ")}`,
    });
  }
  // Reserve the "system:" id prefix and built-in role names so a custom
  // role can't shadow a built-in one in the merged list.
  const reservedNames = new Set(["admin", "manager", "staff", "customer"]);
  if (reservedNames.has(name.trim().toLowerCase())) {
    return res.status(400).json({
      success: false,
      message: "That name is reserved for a built-in role.",
    });
  }
  const role = await req.models.Role.create({
    name: name.trim(),
    description: (description || "").trim(),
    permissions: [...new Set(permissions)],
  });
  res.status(201).json({ success: true, data: { role } });
});

/**
 * PATCH /api/roles/:id — update a custom role. System roles can't be edited.
 */
export const updateRoleController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (typeof id === "string" && id.startsWith("system:")) {
    return res.status(400).json({
      success: false,
      message: "Built-in roles cannot be edited.",
    });
  }
  const { name, description, permissions } = req.body || {};
  const update = {};
  if (name !== undefined) update.name = String(name).trim();
  if (description !== undefined) update.description = String(description).trim();
  if (permissions !== undefined) {
    if (!Array.isArray(permissions)) {
      return res
        .status(400)
        .json({ success: false, message: "`permissions` must be an array." });
    }
    const unknown = permissions.filter((p) => !ALL_PERMISSION_KEYS.has(p));
    if (unknown.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Unknown permission keys: ${unknown.join(", ")}`,
      });
    }
    update.permissions = [...new Set(permissions)];
  }
  update.updatedAt = new Date();
  const role = await req.models.Role.findOneAndUpdate({ _id: id }, { $set: update }, { new: true });
  if (!role) {
    return res.status(404).json({ success: false, message: "Role not found." });
  }
  res.json({ success: true, data: { role } });
});

/**
 * DELETE /api/roles/:id — delete a custom role. Users referencing it
 * have the reference pulled atomically so no one is left with a dangling
 * customRoleId pointing at a missing role.
 */
export const deleteRoleController = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (typeof id === "string" && id.startsWith("system:")) {
    return res.status(400).json({
      success: false,
      message: "Built-in roles cannot be deleted.",
    });
  }
  const role = await req.models.Role.findOneAndDelete({ _id: id });
  if (!role) {
    return res.status(404).json({ success: false, message: "Role not found." });
  }
  await req.models.User.updateMany(
    { customRoleIds: id },
    { $pull: { customRoleIds: id } }
  );
  res.json({ success: true, data: { deleted: true } });
});
