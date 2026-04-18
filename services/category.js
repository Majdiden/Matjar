import {
  addCategoryRepo,
  getCategoryRepo,
  getCategoriesRepo,
  updateCategoryRepo,
  deleteCategoryRepo,
} from "../repositories/category.js";

export const addCategory = async (req, res) => {
  try {
    const data = await addCategoryRepo(req.models, req.body);
    return {
      success: true,
      statusCode: 201,
      message: "Category added successfully",
      responseObject: { data },
    };
  } catch (error) {
    throw error;
  }
};

export const getCategory = async (req, res) => {
  try {
    const data = await getCategoryRepo(req.models, req.query);
    return {
      success: true,
      statusCode: 200,
      responseObject: { data },
    };
  } catch (error) {
    throw error;
  }
};

export const getCategories = async (req, res) => {
  try {
    const data = await getCategoriesRepo(req.models, req.query);
    return {
      success: true,
      statusCode: 200,
      responseObject: { data },
    };
  } catch (error) {
    throw error;
  }
};

export const updateCategory = async (req, res) => {
  try {
    const data = updateCategoryRepo(req.models, req.path.id, req.body);
    return {
      success: true,
      statusCode: 201,
      message: "Category updated successfully",
      responseObject: { data },
    };
  } catch (error) {
    throw error;
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const data = deleteCategoryRepo(req.models, req.path.id, req.body);
    return {
      success: true,
      statusCode: 201,
      message: "Category deleted successfully",
      responseObject: { data },
    };
  } catch (error) {
    throw error;
  }
};
