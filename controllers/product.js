import {
  addProduct,
  getProduct,
  getProducts,
  updateProduct,
  deleteProduct,
} from "../services/product.js";
import { logAudit } from "../utils/audit.js";

export const createProductController = async (req, res) => {
  const response = await addProduct(req);
  if (response.success) {
    logAudit(req.models, {
      action: "product.created",
      resource: "Product",
      resourceId: response.responseObject?.data?._id,
      changes: { name: req.body?.name, price: req.body?.price },
      req,
    });
  }
  res.status(response.statusCode).json({ ...response });
};

export const getProductController = async (req, res) => {
  const response = await getProduct(req);
  res.status(response.statusCode).json({ ...response });
};

export const getProductsController = async (req, res) => {
  const response = await getProducts(req);
  res.status(response.statusCode).json({ ...response });
};

export const updateProductController = async (req, res) => {
  const response = await updateProduct(req);
  if (response.success) {
    logAudit(req.models, {
      action: "product.updated",
      resource: "Product",
      resourceId: req.params.id,
      changes: req.body,
      req,
    });
  }
  res.status(response.statusCode).json({ ...response });
};

export const deleteProductController = async (req, res) => {
  const response = await deleteProduct(req);
  if (response.success) {
    logAudit(req.models, {
      action: "product.deleted",
      resource: "Product",
      resourceId: req.params.id,
      req,
    });
  }
  res.status(response.statusCode).json({ ...response });
};
