import {
  listMenusRepo,
  getMenuRepo,
  getMenuByHandleRepo,
  getMenuByLocationRepo,
  createMenuRepo,
  updateMenuRepo,
  deleteMenuRepo,
} from "../repositories/menu.js";
import { APIError } from "../middlewares/errorHandler.js";
import logger from "../utils/logger.js";

/**
 * Convert a string into a URL-safe handle.
 * "Main Menu" → "main-menu"
 */
const slugify = (str) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Recursively validate a menu items tree.
 * Throws APIError on the first violation found.
 */
function walkValidate(items, path = "items") {
  if (!Array.isArray(items)) return;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const loc = `${path}[${i}]`;
    if (!item.label || typeof item.label !== "string" || !item.label.trim()) {
      throw new APIError(`${loc}.label is required`, 400);
    }
    const type = item.type || "link";
    if (["link", "external"].includes(type)) {
      if (!item.url || !item.url.trim()) {
        throw new APIError(`${loc}.url is required when type is "${type}"`, 400);
      }
    } else if (["collection", "product", "category", "page"].includes(type)) {
      if (!item.resourceId) {
        throw new APIError(`${loc}.resourceId is required when type is "${type}"`, 400);
      }
    }
    if (item.children && item.children.length > 0) {
      walkValidate(item.children, `${loc}.children`);
    }
  }
}

/**
 * Recursively resolve resourceId references to URLs in an items tree.
 * Returns a new tree with a `resolvedUrl` field on each item.
 */
async function resolveItems(models, items) {
  if (!Array.isArray(items)) return [];
  return Promise.all(
    items.map(async (item) => {
      let resolvedUrl = item.url || "";
      try {
        if (item.type === "collection" && item.resourceId) {
          const doc = await models.Collection.findById(item.resourceId).select("handle").lean();
          if (doc) resolvedUrl = `/collections/${doc.handle || item.resourceId}`;
        } else if (item.type === "category" && item.resourceId) {
          const doc = await models.Category.findById(item.resourceId).select("slug handle").lean();
          if (doc) resolvedUrl = `/categories/${doc.slug || doc.handle || item.resourceId}`;
        } else if (item.type === "product" && item.resourceId) {
          const doc = await models.Product.findById(item.resourceId).select("slug").lean();
          if (doc) resolvedUrl = `/products/${doc.slug || item.resourceId}`;
        } else if (item.type === "page" && item.resourceId) {
          // Pages are addressed by slug on the storefront. Fall back to
          // the raw resourceId if the slug lookup fails so the link at
          // least resolves to something (the storefront renders a 404
          // which is better than a dead anchor).
          if (models.Page) {
            const doc = await models.Page.findById(item.resourceId).select("slug").lean();
            if (doc) resolvedUrl = `/pages/${doc.slug || item.resourceId}`;
          }
        }
      } catch (err) {
        logger.warn("resolveMenu: failed to resolve resourceId", {
          type: item.type,
          resourceId: item.resourceId,
          error: err.message,
        });
      }
      const resolved = { ...item, resolvedUrl };
      if (item.children && item.children.length > 0) {
        resolved.children = await resolveItems(models, item.children);
      }
      return resolved;
    })
  );
}

export const listMenus = async (models) => listMenusRepo(models);

export const getMenu = async (models, id) => {
  const menu = await getMenuRepo(models, id);
  if (!menu) throw new APIError("Menu not found", 404);
  return menu;
};

export const getMenuByHandle = async (models, handle) => {
  const menu = await getMenuByHandleRepo(models, handle);
  if (!menu) throw new APIError("Menu not found", 404);
  return menu;
};

/**
 * Public storefront variant — only returns active menus.
 */
export const getActiveMenuByHandle = async (models, handle) => {
  const menu = await getMenuByHandleRepo(models, handle);
  if (!menu || !menu.isActive) throw new APIError("Menu not found", 404);
  return menu;
};

export const getMenuByLocation = async (models, location) => {
  const menu = await getMenuByLocationRepo(models, location);
  if (!menu) throw new APIError("No active menu for that location", 404);
  return menu;
};

export const createMenu = async (models, tenantId, data) => {
  const { title, location = "custom", items = [], isActive = true } = data;
  if (!title || !title.trim()) throw new APIError("title is required", 400);

  let handle = data.handle ? data.handle : slugify(title);
  handle = slugify(handle); // normalise whatever was passed

  // Uniqueness check (repo would throw duplicate key, but we give a nicer message)
  const existing = await getMenuByHandleRepo(models, handle);
  if (existing) throw new APIError(`A menu with handle "${handle}" already exists`, 409);

  walkValidate(items);

  const doc = await createMenuRepo(models, { tenantId, handle, title: title.trim(), location, items, isActive });
  return doc.toObject();
};

export const updateMenu = async (models, id, patch) => {
  const current = await getMenuRepo(models, id);
  if (!current) throw new APIError("Menu not found", 404);

  const allowed = {};

  if (typeof patch.title === "string") allowed.title = patch.title.trim();
  if (typeof patch.handle === "string") {
    const newHandle = slugify(patch.handle);
    if (newHandle !== current.handle) {
      const conflict = await getMenuByHandleRepo(models, newHandle);
      if (conflict && String(conflict._id) !== String(current._id)) {
        throw new APIError(`A menu with handle "${newHandle}" already exists`, 409);
      }
      allowed.handle = newHandle;
    }
  }
  if (typeof patch.location === "string") allowed.location = patch.location;
  if (typeof patch.isActive === "boolean") allowed.isActive = patch.isActive;
  if (Array.isArray(patch.items)) {
    walkValidate(patch.items);
    allowed.items = patch.items;
  }

  allowed.updatedAt = new Date();
  const updated = await updateMenuRepo(models, id, allowed);
  if (!updated) throw new APIError("Menu not found", 404);
  return updated;
};

export const deleteMenu = async (models, id) => {
  const doc = await deleteMenuRepo(models, id);
  if (!doc) throw new APIError("Menu not found", 404);
  return { id };
};

/**
 * Resolve a menu's item tree — replace resourceId refs with real URLs.
 * Returns a new menu object with `items` fully resolved (including children).
 */
export const resolveMenu = async (models, menu) => {
  const resolvedItems = await resolveItems(models, menu.items || []);
  return { ...menu, items: resolvedItems };
};
