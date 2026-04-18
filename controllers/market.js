import { asyncHandler } from "../middlewares/errorHandler.js";
import { APIError } from "../middlewares/errorHandler.js";

// Slugify for the `handle` field — kebab-case, ASCII-only, deduped against
// the tenant's existing markets so two "North America" entries don't collide.
const slugifyHandle = (str) =>
  String(str || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export const createMarket = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  // Auto-derive `handle` from name if the dashboard didn't supply one.
  if (!body.handle && body.name) {
    let base = slugifyHandle(body.name) || "market";
    let candidate = base;
    let n = 1;
    // The tenant+handle index is unique — keep bumping until free.
    // eslint-disable-next-line no-await-in-loop
    while (await req.models.Market.exists({ handle: candidate })) {
      n += 1;
      candidate = `${base}-${n}`;
    }
    body.handle = candidate;
  }
  const market = await req.models.Market.create(body);
  res.status(201).json({ success: true, data: market });
});

export const getMarkets = asyncHandler(async (req, res) => {
  const markets = await req.models.Market.find({}).sort({ isPrimary: -1, name: 1 });
  res.json({ success: true, data: markets });
});

export const updateMarket = asyncHandler(async (req, res) => {
  const market = await req.models.Market.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!market) throw new APIError("Market not found", 404);
  res.json({ success: true, data: market });
});

export const deleteMarket = asyncHandler(async (req, res) => {
  const market = await req.models.Market.findByIdAndDelete(req.params.id);
  if (!market) throw new APIError("Market not found", 404);
  res.json({ success: true, message: "Market deleted" });
});

// Resolve market for a storefront request based on country/IP
export const resolveMarket = asyncHandler(async (req, res) => {
  const { country } = req.query;
  if (!country) {
    // Return primary market
    const primary = await req.models.Market.findOne({ isPrimary: true });
    return res.json({ success: true, data: primary });
  }
  const market = await req.models.Market.findOne({ countries: country, isActive: true });
  const fallback = market || await req.models.Market.findOne({ isPrimary: true });
  res.json({ success: true, data: fallback });
});
