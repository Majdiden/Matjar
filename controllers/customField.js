import { asyncHandler } from "../middlewares/errorHandler.js";
import { APIError } from "../middlewares/errorHandler.js";

const VALID_RESOURCES = ["Product", "Order", "User", "Category", "Company"];

export const setCustomField = asyncHandler(async (req, res) => {
  const { resource, resourceId, namespace, key, type, value } = req.body;

  if (!VALID_RESOURCES.includes(resource)) {
    throw new APIError(`Invalid resource. Must be one of: ${VALID_RESOURCES.join(", ")}`, 400);
  }

  const field = await req.models.CustomField.findOneAndUpdate(
    { resource, resourceId, namespace, key },
    { type, value },
    { upsert: true, new: true, runValidators: true }
  );

  res.json({ success: true, data: field });
});

export const getCustomFields = asyncHandler(async (req, res) => {
  const { resource, resourceId, namespace } = req.query;
  const filter = {};
  if (resource) filter.resource = resource;
  if (resourceId) filter.resourceId = resourceId;
  if (namespace) filter.namespace = namespace;

  const fields = await req.models.CustomField.find(filter).sort({ namespace: 1, key: 1 });
  res.json({ success: true, data: fields });
});

export const deleteCustomField = asyncHandler(async (req, res) => {
  const field = await req.models.CustomField.findByIdAndDelete(req.params.id);
  if (!field) throw new APIError("Custom field not found", 404);
  res.json({ success: true, message: "Custom field deleted" });
});
