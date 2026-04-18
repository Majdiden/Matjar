import * as DiscountService from "../services/discount.js";
import { APIError } from "../middlewares/errorHandler.js";

export const createDiscount = async (req, res, next) => {
  try {
    const discount = await DiscountService.createDiscount(
      req.models,
      req.body
    );
    res.status(201).json({ success: true, data: discount });
  } catch (error) {
    next(error);
  }
};

export const validateDiscount = async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) {
      throw new APIError("Discount code is required", 400);
    }

    // Build cart lines from server-side data — never trust client-supplied totals
    const userId = req.user?.userId;
    const sessionId = req.session?.cartSessionId;

    let cart;
    if (userId) {
      cart = await req.models.Cart.findOne({ user: userId }).populate("items.product");
    } else if (sessionId) {
      cart = await req.models.Cart.findOne({ sessionId }).populate("items.product");
    }

    if (!cart || !cart.items || !cart.items.length) {
      throw new APIError("Cart is empty", 400);
    }

    const cartLines = cart.items.map((item) => ({
      product: item.product._id,
      category: item.product.category,
      quantity: item.quantity,
      unitPrice: item.product.price,
      lineTotal: item.product.price * item.quantity,
    }));

    const result = await DiscountService.validateDiscount(
      req.models,
      code,
      cartLines,
      userId
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getDiscounts = async (req, res, next) => {
  try {
    const Discount = req.models.Discount;
    const { page = 1, limit = 20, search, status } = req.query;

    const filter = {};
    if (search) {
      const raw = String(search).trim();
      // Escape regex metacharacters so user-supplied input can't break the query.
      const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = { $regex: escape(raw), $options: "i" };
      filter.$or = [{ code: rx }, { description: rx }];
    }
    if (status === "active") filter.isActive = true;
    else if (status === "inactive") filter.isActive = false;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Discount.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Discount.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        items,
        total,
        pages: Math.ceil(total / limitNum) || 1,
        page: pageNum,
        limit: limitNum,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateDiscount = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await DiscountService.updateDiscount(req.models, id, req.body);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const deleteDiscount = async (req, res, next) => {
  try {
    const { id } = req.params;
    const Discount = req.models.Discount;
    await Discount.findByIdAndDelete(id);
    res.json({ success: true, message: "Discount deleted successfully" });
  } catch (error) {
    next(error);
  }
};
