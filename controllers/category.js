import {
  addCategory,
  getCategory,
  getCategories,
  updateCategory,
  deleteCategory,
} from "../services/category.js";

export const createCategoryController = async (req, res) => {
  const response = await addCategory(req);
  res.status(response.statusCode).json({ ...response });
};

export const getCategoryController = async (req, res) => {
  const response = await getCategory(req);
  res.status(response.statusCode).json({ ...response });
};

export const getCategoriesController = async (req, res) => {
  const response = await getCategories(req);
  res.status(response.statusCode).json({ ...response });
};

export const updateCategoryController = async (req, res) => {
  const response = await updateCategory(req);
  res.status(response.statusCode).json({ ...response });
};

export const deleteCategoryController = async (req, res) => {
  const response = await deleteCategory(req);
  res.status(response.statusCode).json({ ...response });
};
