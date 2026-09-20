/**
 * Cross-store commerce inspection (platform console). Read-only; every route
 * is gated on support.read at the router. Customers are tenant-scoped only.
 */
import { asyncHandler } from "../../middlewares/errorHandler.js";
import {
  searchOrders,
  getOrderDetail,
  searchProducts,
  getProductDetail,
  listCustomers,
  listInventory,
} from "../../services/platform/commerce.js";

export const listOrders = asyncHandler(async (req, res) => {
  const { rows, pagination } = await searchOrders(req.query);
  res.json({ success: true, data: { orders: rows, pagination } });
});

export const getOrder = asyncHandler(async (req, res) => {
  const data = await getOrderDetail(req.params.tenantId, req.params.orderId);
  if (!data) return res.status(404).json({ success: false, message: "Order not found." });
  res.json({ success: true, data });
});

export const listProducts = asyncHandler(async (req, res) => {
  const { rows, pagination } = await searchProducts(req.query);
  res.json({ success: true, data: { products: rows, pagination } });
});

export const getProduct = asyncHandler(async (req, res) => {
  const data = await getProductDetail(req.params.tenantId, req.params.productId);
  if (!data) return res.status(404).json({ success: false, message: "Product not found." });
  res.json({ success: true, data });
});

export const listTenantCustomers = asyncHandler(async (req, res) => {
  const { rows, tenant, pagination } = await listCustomers(req.query);
  res.json({ success: true, data: { customers: rows, tenant, pagination } });
});

export const listInventoryRows = asyncHandler(async (req, res) => {
  const { rows, pagination } = await listInventory(req.query);
  res.json({ success: true, data: { items: rows, pagination } });
});
