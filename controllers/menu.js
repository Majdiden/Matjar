import * as MenuService from "../services/menu.js";
import { asyncHandler } from "../middlewares/errorHandler.js";

// ─── Admin handlers ──────────────────────────────────────────────────────────

export const list = asyncHandler(async (req, res) => {
  const menus = await MenuService.listMenus(req.models);
  res.json({ success: true, data: { menus } });
});

export const get = asyncHandler(async (req, res) => {
  const menu = await MenuService.getMenu(req.models, req.params.id);
  res.json({ success: true, data: menu });
});

export const getByLocation = asyncHandler(async (req, res) => {
  const menu = await MenuService.getMenuByLocation(req.models, req.params.location);
  res.json({ success: true, data: menu });
});

export const create = asyncHandler(async (req, res) => {
  const menu = await MenuService.createMenu(req.models, req.tenantId, req.body || {});
  res.status(201).json({ success: true, data: menu });
});

export const update = asyncHandler(async (req, res) => {
  const menu = await MenuService.updateMenu(req.models, req.params.id, req.body || {});
  res.json({ success: true, data: menu });
});

export const remove = asyncHandler(async (req, res) => {
  await MenuService.deleteMenu(req.models, req.params.id);
  res.json({ success: true });
});

// ─── Storefront handler (public) ─────────────────────────────────────────────

export const storefrontGetMenu = asyncHandler(async (req, res) => {
  const menu = await MenuService.getActiveMenuByHandle(req.models, req.params.handle);
  const resolved = await MenuService.resolveMenu(req.models, menu);
  res.json({ success: true, data: resolved });
});
