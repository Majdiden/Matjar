import { asyncHandler } from "../middlewares/errorHandler.js";
import { APIError } from "../middlewares/errorHandler.js";

export const createCompany = asyncHandler(async (req, res) => {
  const company = await req.models.Company.create(req.body);
  res.status(201).json({ success: true, data: company });
});

export const getCompanies = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const filter = status ? { status } : {};
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [companies, total] = await Promise.all([
    req.models.Company.find(filter).sort({ name: 1 }).skip(skip).limit(parseInt(limit)),
    req.models.Company.countDocuments(filter),
  ]);

  res.json({ success: true, data: { companies, pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } } });
});

export const getCompany = asyncHandler(async (req, res) => {
  const company = await req.models.Company.findById(req.params.id);
  if (!company) throw new APIError("Company not found", 404);
  res.json({ success: true, data: company });
});

export const updateCompany = asyncHandler(async (req, res) => {
  const company = await req.models.Company.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!company) throw new APIError("Company not found", 404);
  res.json({ success: true, data: company });
});

export const deleteCompany = asyncHandler(async (req, res) => {
  await req.models.Company.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: "Company deleted" });
});
