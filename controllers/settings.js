import { APIError } from "../middlewares/errorHandler.js";
import mongoose from "mongoose";
import { logAudit } from "../utils/audit.js";

const ALLOWED_CURRENCIES = ["SDG", "USD", "EUR", "GBP", "AED", "SAR", "EGP", "CAD", "AUD", "JPY", "INR"];
const ALLOWED_TIMEZONES_PATTERN = /^[A-Za-z_\/]+$/;
// ISO 4217 codes are three uppercase letters; we don't gate by the
// ALLOWED_CURRENCIES whitelist for markets/FX because merchants legitimately
// want to add long-tail codes (e.g. NGN, ZAR, BRL) without us shipping a
// bigger list. Validation is structural only.
const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const MARKET_CODE_PATTERN = /^[a-z0-9-]{2,32}$/;

// Validate a single market payload. Used by both the bulk PUT and the
// per-market CRUD endpoints.
function validateMarket(market) {
  if (!market || typeof market !== "object") {
    throw new APIError("Market must be an object", 400);
  }
  const code = String(market.code || "").toLowerCase().trim();
  if (!MARKET_CODE_PATTERN.test(code)) {
    throw new APIError("Market code must match [a-z0-9-]{2,32}", 400);
  }
  if (typeof market.name !== "string" || market.name.trim().length === 0) {
    throw new APIError("Market name is required", 400);
  }
  if (!Array.isArray(market.countries)) {
    throw new APIError("Market countries must be an array", 400);
  }
  const countries = market.countries.map((c) => String(c).toUpperCase());
  for (const c of countries) {
    if (!COUNTRY_CODE_PATTERN.test(c)) {
      throw new APIError(`Invalid country code: ${c}`, 400);
    }
  }
  const currency = String(market.currency || "").toUpperCase();
  if (!CURRENCY_CODE_PATTERN.test(currency)) {
    throw new APIError("Market currency must be a 3-letter ISO code", 400);
  }
  const adjustment = market.priceAdjustmentPct;
  if (adjustment !== undefined && adjustment !== null) {
    if (typeof adjustment !== "number" || adjustment < -0.95 || adjustment > 5) {
      throw new APIError("priceAdjustmentPct must be a number between -0.95 and 5", 400);
    }
  }
  return {
    code,
    name: market.name.trim(),
    countries,
    currency,
    language: market.language ? String(market.language).toLowerCase().trim() : "en",
    priceAdjustmentPct: typeof adjustment === "number" ? adjustment : 0,
    enabled: market.enabled !== false,
    isDefault: !!market.isDefault,
  };
}

// Validate the currencies block (base + rates table).
function validateCurrencies(input) {
  if (!input || typeof input !== "object") {
    throw new APIError("Currencies must be an object", 400);
  }
  const out = {};
  if (input.base !== undefined) {
    const base = String(input.base).toUpperCase();
    if (!CURRENCY_CODE_PATTERN.test(base)) {
      throw new APIError("Base currency must be a 3-letter ISO code", 400);
    }
    out.base = base;
  }
  if (input.rates !== undefined) {
    if (!input.rates || typeof input.rates !== "object" || Array.isArray(input.rates)) {
      throw new APIError("Currency rates must be an object map", 400);
    }
    const rates = {};
    for (const [code, rate] of Object.entries(input.rates)) {
      const upper = code.toUpperCase();
      if (!CURRENCY_CODE_PATTERN.test(upper)) {
        throw new APIError(`Invalid currency code in rates: ${code}`, 400);
      }
      if (typeof rate !== "number" || !(rate > 0) || rate > 1e6) {
        throw new APIError(`Rate for ${upper} must be a positive number`, 400);
      }
      rates[upper] = rate;
    }
    out.rates = rates;
  }
  return out;
}

// Validate a single tax rate payload. Used by both the bulk PUT and the
// per-rate CRUD endpoints so the rules stay in one place.
function validateTaxRate(rate) {
  if (!rate || typeof rate !== "object") {
    throw new APIError("Tax rate must be an object", 400);
  }
  if (typeof rate.rate !== "number" || rate.rate < 0 || rate.rate > 1) {
    throw new APIError("Tax rate must be a number between 0 and 1", 400);
  }
  if (rate.country !== undefined && typeof rate.country !== "string") {
    throw new APIError("Tax rate country must be a string", 400);
  }
  if (rate.state !== undefined && rate.state !== null && typeof rate.state !== "string") {
    throw new APIError("Tax rate state must be a string", 400);
  }
  if (rate.productClass !== undefined && rate.productClass !== null && typeof rate.productClass !== "string") {
    throw new APIError("Tax rate productClass must be a string", 400);
  }
  return {
    country: (rate.country || "default").toUpperCase() === "DEFAULT" ? "default" : rate.country.toUpperCase(),
    state: rate.state ? rate.state.toUpperCase() : "*",
    rate: rate.rate,
    name: rate.name || null,
    productClass: rate.productClass || null,
  };
}

// Validate a single shipping zone payload. Throws APIError on bad shape.
// Used by both the bulk PUT and the per-zone CRUD endpoints so the rules
// stay in one place.
function validateZone(zone) {
  if (!zone || typeof zone !== "object") {
    throw new APIError("Zone must be an object", 400);
  }
  if (typeof zone.name !== "string" || zone.name.trim().length === 0) {
    throw new APIError("Zone name is required", 400);
  }
  if (!Array.isArray(zone.countries) || zone.countries.length === 0) {
    throw new APIError("Zone must list at least one country", 400);
  }
  if (!Array.isArray(zone.rates) || zone.rates.length === 0) {
    throw new APIError("Zone must define at least one rate", 400);
  }
  for (const rate of zone.rates) {
    if (!rate || typeof rate !== "object") {
      throw new APIError("Rate must be an object", 400);
    }
    if (typeof rate.name !== "string" || rate.name.trim().length === 0) {
      throw new APIError("Rate name is required", 400);
    }
    if (typeof rate.price !== "number" || rate.price < 0) {
      throw new APIError("Rate price must be a non-negative number", 400);
    }
    if (rate.minWeight !== undefined && (typeof rate.minWeight !== "number" || rate.minWeight < 0)) {
      throw new APIError("Rate minWeight must be a non-negative number", 400);
    }
    if (rate.maxWeight !== undefined && rate.maxWeight !== null && (typeof rate.maxWeight !== "number" || rate.maxWeight < 0)) {
      throw new APIError("Rate maxWeight must be a non-negative number", 400);
    }
    if (
      rate.minWeight !== undefined &&
      rate.maxWeight !== undefined &&
      rate.maxWeight !== null &&
      rate.maxWeight < rate.minWeight
    ) {
      throw new APIError("Rate maxWeight must be >= minWeight", 400);
    }
  }
  return {
    name: zone.name.trim(),
    countries: zone.countries.map((c) => String(c).toUpperCase()),
    rates: zone.rates.map((r) => ({
      name: r.name.trim(),
      price: r.price,
      minWeight: r.minWeight,
      maxWeight: r.maxWeight,
      estimatedDays: r.estimatedDays,
    })),
  };
}

export const updateSettings = async (req, res, next) => {
  try {
    if (!req.tenant || !req.tenant._id) {
      throw new APIError("Tenant context not found", 400);
    }

    const settings = req.body;
    const updateData = {};

    // Validate and set each field explicitly
    if (settings.storeName !== undefined) {
      if (typeof settings.storeName !== "string" || settings.storeName.trim().length < 1) {
        throw new APIError("Store name must be a non-empty string", 400);
      }
      updateData["settings.storeName"] = settings.storeName.trim();
    }

    if (settings.storeDescription !== undefined) {
      updateData["settings.storeDescription"] = String(settings.storeDescription).slice(0, 500);
    }

    if (settings.logo !== undefined) updateData["settings.logo"] = settings.logo;
    if (settings.favicon !== undefined) updateData["settings.favicon"] = settings.favicon;

    if (settings.currency !== undefined) {
      if (!ALLOWED_CURRENCIES.includes(settings.currency)) {
        throw new APIError(`Invalid currency. Allowed: ${ALLOWED_CURRENCIES.join(", ")}`, 400);
      }
      updateData["settings.currency"] = settings.currency;
    }

    if (settings.timezone !== undefined) {
      if (!ALLOWED_TIMEZONES_PATTERN.test(settings.timezone)) {
        throw new APIError("Invalid timezone format", 400);
      }
      updateData["settings.timezone"] = settings.timezone;
    }

    if (settings.language !== undefined) {
      updateData["settings.language"] = settings.language;
    }

    // Shipping settings — structured
    if (settings.shipping !== undefined) {
      const s = settings.shipping;
      if (s.type && !["flat", "weight", "zone", "free"].includes(s.type)) {
        throw new APIError("Invalid shipping type", 400);
      }
      if (s.rate !== undefined && (typeof s.rate !== "number" || s.rate < 0)) {
        throw new APIError("Shipping rate must be a non-negative number", 400);
      }
      if (s.zones !== undefined) {
        if (!Array.isArray(s.zones)) {
          throw new APIError("shipping.zones must be an array", 400);
        }
        updateData["settings.shipping.zones"] = s.zones.map(validateZone);
      }
      if (s.type) updateData["settings.shipping.type"] = s.type;
      if (s.rate !== undefined) updateData["settings.shipping.rate"] = s.rate;
      if (s.freeShippingThreshold !== undefined) updateData["settings.shipping.freeShippingThreshold"] = s.freeShippingThreshold;
      if (s.baseRate !== undefined) updateData["settings.shipping.baseRate"] = s.baseRate;
      if (s.perKgRate !== undefined) updateData["settings.shipping.perKgRate"] = s.perKgRate;
    }
    // Legacy flat fields
    if (settings.shippingRate !== undefined) {
      updateData["settings.shipping.rate"] = Number(settings.shippingRate);
    }

    // Markets — bulk replace via PUT. Granular CRUD lives below for the
    // dashboard's per-row UX.
    if (settings.markets !== undefined) {
      if (!Array.isArray(settings.markets)) {
        throw new APIError("markets must be an array", 400);
      }
      const validated = settings.markets.map(validateMarket);
      const defaults = validated.filter((m) => m.isDefault);
      if (defaults.length > 1) {
        throw new APIError("Only one market may be marked as default", 400);
      }
      updateData["settings.markets"] = validated;
    }
    if (settings.currencies !== undefined) {
      const c = validateCurrencies(settings.currencies);
      if (c.base !== undefined) updateData["settings.currencies.base"] = c.base;
      if (c.rates !== undefined) {
        updateData["settings.currencies.rates"] = c.rates;
        updateData["settings.currencies.ratesUpdatedAt"] = new Date();
      }
    }

    // Tax settings — structured
    if (settings.tax !== undefined) {
      const t = settings.tax;
      if (t.enabled !== undefined) updateData["settings.tax.enabled"] = !!t.enabled;
      if (t.includeInPrice !== undefined) updateData["settings.tax.includeInPrice"] = !!t.includeInPrice;
      if (t.taxShipping !== undefined) updateData["settings.tax.taxShipping"] = !!t.taxShipping;
      if (Array.isArray(t.rates)) {
        updateData["settings.tax.rates"] = t.rates.map(validateTaxRate);
      }
    }
    // Gift cards — only the global feature toggle lives here; per-card
    // coverage flags (coverShipping/coverTax) are set at issue time on
    // each gift card, not tenant-wide.
    if (settings.giftCards !== undefined) {
      const g = settings.giftCards;
      if (g && typeof g === "object") {
        if (g.enabled !== undefined) updateData["settings.giftCards.enabled"] = !!g.enabled;
      }
    }

    // Legacy flat field
    if (settings.taxRate !== undefined) {
      updateData["settings.tax.rates"] = [{ rate: Number(settings.taxRate), country: "default" }];
      updateData["settings.tax.enabled"] = true;
    }

    if (Object.keys(updateData).length === 0) {
      throw new APIError("No valid settings provided", 400);
    }

    const Tenant = mongoose.model("Tenant");
    const tenant = await Tenant.findByIdAndUpdate(
      req.tenant._id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!tenant) throw new APIError("Tenant not found", 404);
    logAudit(req.models, {
      action: "settings.updated",
      resource: "Settings",
      resourceId: tenant._id,
      changes: updateData,
      req,
    });
    res.json({ success: true, data: tenant.settings });
  } catch (error) {
    next(error);
  }
};

// ---- Shipping zone CRUD ----
// These exist alongside the bulk PUT so the dashboard can edit one zone
// at a time without round-tripping the entire settings blob.

export const listShippingZones = async (req, res, next) => {
  try {
    if (!req.tenant?._id) throw new APIError("Tenant context not found", 400);
    const Tenant = mongoose.model("Tenant");
    const tenant = await Tenant.findById(req.tenant._id).select("settings.shipping.zones").lean();
    if (!tenant) throw new APIError("Tenant not found", 404);
    res.json({ success: true, data: tenant.settings?.shipping?.zones || [] });
  } catch (error) {
    next(error);
  }
};

export const createShippingZone = async (req, res, next) => {
  try {
    if (!req.tenant?._id) throw new APIError("Tenant context not found", 400);
    const zone = validateZone(req.body);
    const Tenant = mongoose.model("Tenant");
    const tenant = await Tenant.findByIdAndUpdate(
      req.tenant._id,
      { $push: { "settings.shipping.zones": zone } },
      { new: true, runValidators: true }
    );
    if (!tenant) throw new APIError("Tenant not found", 404);
    const created = tenant.settings.shipping.zones[tenant.settings.shipping.zones.length - 1];
    logAudit(req.models, {
      action: "settings.shipping.zone.created",
      resource: "ShippingZone",
      resourceId: created._id,
      changes: zone,
      req,
    });
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
};

export const updateShippingZone = async (req, res, next) => {
  try {
    if (!req.tenant?._id) throw new APIError("Tenant context not found", 400);
    const { zoneId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(zoneId)) {
      throw new APIError("Invalid zone id", 400);
    }
    const zone = validateZone(req.body);
    const Tenant = mongoose.model("Tenant");
    const tenant = await Tenant.findOneAndUpdate(
      { _id: req.tenant._id, "settings.shipping.zones._id": zoneId },
      {
        $set: {
          "settings.shipping.zones.$.name": zone.name,
          "settings.shipping.zones.$.countries": zone.countries,
          "settings.shipping.zones.$.rates": zone.rates,
        },
      },
      { new: true, runValidators: true }
    );
    if (!tenant) throw new APIError("Zone not found", 404);
    const updated = tenant.settings.shipping.zones.id(zoneId);
    logAudit(req.models, {
      action: "settings.shipping.zone.updated",
      resource: "ShippingZone",
      resourceId: zoneId,
      changes: zone,
      req,
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

// ---- Tax rate CRUD ----

export const listTaxRates = async (req, res, next) => {
  try {
    if (!req.tenant?._id) throw new APIError("Tenant context not found", 400);
    const Tenant = mongoose.model("Tenant");
    const tenant = await Tenant.findById(req.tenant._id).select("settings.tax").lean();
    if (!tenant) throw new APIError("Tenant not found", 404);
    res.json({
      success: true,
      data: {
        enabled: tenant.settings?.tax?.enabled || false,
        includeInPrice: tenant.settings?.tax?.includeInPrice || false,
        taxShipping: tenant.settings?.tax?.taxShipping || false,
        rates: tenant.settings?.tax?.rates || [],
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createTaxRate = async (req, res, next) => {
  try {
    if (!req.tenant?._id) throw new APIError("Tenant context not found", 400);
    const rate = validateTaxRate(req.body);
    const Tenant = mongoose.model("Tenant");
    const tenant = await Tenant.findByIdAndUpdate(
      req.tenant._id,
      { $push: { "settings.tax.rates": rate } },
      { new: true, runValidators: true }
    );
    if (!tenant) throw new APIError("Tenant not found", 404);
    const created = tenant.settings.tax.rates[tenant.settings.tax.rates.length - 1];
    logAudit(req.models, {
      action: "settings.tax.rate.created",
      resource: "TaxRate",
      resourceId: created._id,
      changes: rate,
      req,
    });
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
};

export const updateTaxRate = async (req, res, next) => {
  try {
    if (!req.tenant?._id) throw new APIError("Tenant context not found", 400);
    const { rateId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(rateId)) {
      throw new APIError("Invalid rate id", 400);
    }
    const rate = validateTaxRate(req.body);
    const Tenant = mongoose.model("Tenant");
    const tenant = await Tenant.findOneAndUpdate(
      { _id: req.tenant._id, "settings.tax.rates._id": rateId },
      {
        $set: {
          "settings.tax.rates.$.country": rate.country,
          "settings.tax.rates.$.state": rate.state,
          "settings.tax.rates.$.rate": rate.rate,
          "settings.tax.rates.$.name": rate.name,
          "settings.tax.rates.$.productClass": rate.productClass,
        },
      },
      { new: true, runValidators: true }
    );
    if (!tenant) throw new APIError("Tax rate not found", 404);
    const updated = tenant.settings.tax.rates.id(rateId);
    logAudit(req.models, {
      action: "settings.tax.rate.updated",
      resource: "TaxRate",
      resourceId: rateId,
      changes: rate,
      req,
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const deleteTaxRate = async (req, res, next) => {
  try {
    if (!req.tenant?._id) throw new APIError("Tenant context not found", 400);
    const { rateId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(rateId)) {
      throw new APIError("Invalid rate id", 400);
    }
    const Tenant = mongoose.model("Tenant");
    const tenant = await Tenant.findByIdAndUpdate(
      req.tenant._id,
      { $pull: { "settings.tax.rates": { _id: rateId } } },
      { new: true }
    );
    if (!tenant) throw new APIError("Tenant not found", 404);
    logAudit(req.models, {
      action: "settings.tax.rate.deleted",
      resource: "TaxRate",
      resourceId: rateId,
      req,
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// ---- Markets CRUD ----
//
// The bulk PUT supports markets too, but the dashboard edits one market
// at a time and the granular endpoints let it avoid round-tripping the
// full list (which races other admins).

export const listMarkets = async (req, res, next) => {
  try {
    if (!req.tenant?._id) throw new APIError("Tenant context not found", 400);
    const Tenant = mongoose.model("Tenant");
    const tenant = await Tenant.findById(req.tenant._id)
      .select("settings.markets settings.currencies")
      .lean();
    if (!tenant) throw new APIError("Tenant not found", 404);
    res.json({
      success: true,
      data: {
        markets: tenant.settings?.markets || [],
        currencies: tenant.settings?.currencies || { base: tenant.settings?.currency || "SDG", rates: {} },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createMarket = async (req, res, next) => {
  try {
    if (!req.tenant?._id) throw new APIError("Tenant context not found", 400);
    const market = validateMarket(req.body);
    const Tenant = mongoose.model("Tenant");
    // If the new market claims default, demote any existing default first.
    // We do this in two writes rather than a transaction because the global
    // settings doc is small and the window is harmless — at worst the
    // dashboard sees two defaults for ~1ms and the storefront's
    // resolveMarket picks the first.
    if (market.isDefault) {
      await Tenant.updateOne(
        { _id: req.tenant._id },
        { $set: { "settings.markets.$[m].isDefault": false } },
        { arrayFilters: [{ "m.isDefault": true }] }
      );
    }
    const tenant = await Tenant.findByIdAndUpdate(
      req.tenant._id,
      { $push: { "settings.markets": market } },
      { new: true, runValidators: true }
    );
    if (!tenant) throw new APIError("Tenant not found", 404);
    const created = tenant.settings.markets[tenant.settings.markets.length - 1];
    logAudit(req.models, {
      action: "settings.market.created",
      resource: "Market",
      resourceId: created._id,
      changes: market,
      req,
    });
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
};

export const updateMarket = async (req, res, next) => {
  try {
    if (!req.tenant?._id) throw new APIError("Tenant context not found", 400);
    const { marketId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(marketId)) {
      throw new APIError("Invalid market id", 400);
    }
    const market = validateMarket(req.body);
    const Tenant = mongoose.model("Tenant");
    if (market.isDefault) {
      await Tenant.updateOne(
        { _id: req.tenant._id },
        { $set: { "settings.markets.$[m].isDefault": false } },
        { arrayFilters: [{ "m.isDefault": true, "m._id": { $ne: new mongoose.Types.ObjectId(marketId) } }] }
      );
    }
    const tenant = await Tenant.findOneAndUpdate(
      { _id: req.tenant._id, "settings.markets._id": marketId },
      {
        $set: {
          "settings.markets.$.code": market.code,
          "settings.markets.$.name": market.name,
          "settings.markets.$.countries": market.countries,
          "settings.markets.$.currency": market.currency,
          "settings.markets.$.language": market.language,
          "settings.markets.$.priceAdjustmentPct": market.priceAdjustmentPct,
          "settings.markets.$.enabled": market.enabled,
          "settings.markets.$.isDefault": market.isDefault,
        },
      },
      { new: true, runValidators: true }
    );
    if (!tenant) throw new APIError("Market not found", 404);
    const updated = tenant.settings.markets.id(marketId);
    logAudit(req.models, {
      action: "settings.market.updated",
      resource: "Market",
      resourceId: marketId,
      changes: market,
      req,
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

export const deleteMarket = async (req, res, next) => {
  try {
    if (!req.tenant?._id) throw new APIError("Tenant context not found", 400);
    const { marketId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(marketId)) {
      throw new APIError("Invalid market id", 400);
    }
    const Tenant = mongoose.model("Tenant");
    const tenant = await Tenant.findByIdAndUpdate(
      req.tenant._id,
      { $pull: { "settings.markets": { _id: marketId } } },
      { new: true }
    );
    if (!tenant) throw new APIError("Tenant not found", 404);
    logAudit(req.models, {
      action: "settings.market.deleted",
      resource: "Market",
      resourceId: marketId,
      req,
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// ---- Currencies (base + FX rates table) ----
//
// PUT replaces the rates map wholesale because partial-merge semantics on a
// Mixed map are confusing for merchants ("did I just unset GBP or not?").
// The dashboard always sends the full table.

export const updateCurrencies = async (req, res, next) => {
  try {
    if (!req.tenant?._id) throw new APIError("Tenant context not found", 400);
    const c = validateCurrencies(req.body);
    const update = {};
    if (c.base !== undefined) update["settings.currencies.base"] = c.base;
    if (c.rates !== undefined) {
      update["settings.currencies.rates"] = c.rates;
      update["settings.currencies.ratesUpdatedAt"] = new Date();
    }
    if (Object.keys(update).length === 0) {
      throw new APIError("No currency fields provided", 400);
    }
    const Tenant = mongoose.model("Tenant");
    const tenant = await Tenant.findByIdAndUpdate(
      req.tenant._id,
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!tenant) throw new APIError("Tenant not found", 404);
    logAudit(req.models, {
      action: "settings.currencies.updated",
      resource: "Currencies",
      resourceId: tenant._id,
      changes: update,
      req,
    });
    res.json({ success: true, data: tenant.settings.currencies });
  } catch (error) {
    next(error);
  }
};

// ---- Order status notifications ----
//
// Per-status email templates for the six order lifecycle states. The
// dashboard PUTs the entire notifications block; partial-merge would
// confuse a merchant who can't tell whether they just unset a template
// or wiped one. The service layer falls back to the built-in defaults
// for any status the merchant has not customised.

const NOTIFICATION_STATUSES = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Refunded"];
// Liberal email regex — RFC 5322 compliance is a rabbit hole. We just
// want to reject obvious typos like "alice@" or "alice.example.com".
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateNotifications(input) {
  if (!input || typeof input !== "object") {
    throw new APIError("Notifications payload must be an object", 400);
  }
  const out = {};
  if (input.fromName !== undefined) {
    if (input.fromName !== null && typeof input.fromName !== "string") {
      throw new APIError("notifications.fromName must be a string", 400);
    }
    out.fromName = input.fromName ? input.fromName.trim().slice(0, 120) : null;
  }
  if (input.fromEmail !== undefined) {
    if (input.fromEmail !== null) {
      if (typeof input.fromEmail !== "string" || !EMAIL_PATTERN.test(input.fromEmail.trim())) {
        throw new APIError("notifications.fromEmail must be a valid email", 400);
      }
      out.fromEmail = input.fromEmail.trim();
    } else {
      out.fromEmail = null;
    }
  }
  if (input.templates !== undefined) {
    if (!input.templates || typeof input.templates !== "object" || Array.isArray(input.templates)) {
      throw new APIError("notifications.templates must be an object", 400);
    }
    const templates = {};
    for (const [status, tpl] of Object.entries(input.templates)) {
      if (!NOTIFICATION_STATUSES.includes(status)) {
        throw new APIError(`Unknown notification status: ${status}`, 400);
      }
      if (!tpl || typeof tpl !== "object") {
        throw new APIError(`Template for ${status} must be an object`, 400);
      }
      const t = {};
      if (tpl.enabled !== undefined) {
        if (typeof tpl.enabled !== "boolean") {
          throw new APIError(`templates.${status}.enabled must be a boolean`, 400);
        }
        t.enabled = tpl.enabled;
      }
      if (tpl.subject !== undefined) {
        if (tpl.subject !== null && (typeof tpl.subject !== "string" || tpl.subject.length > 200)) {
          throw new APIError(`templates.${status}.subject must be a string ≤200 chars`, 400);
        }
        t.subject = tpl.subject;
      }
      if (tpl.body !== undefined) {
        if (tpl.body !== null && (typeof tpl.body !== "string" || tpl.body.length > 10000)) {
          throw new APIError(`templates.${status}.body must be a string ≤10000 chars`, 400);
        }
        t.body = tpl.body;
      }
      templates[status] = t;
    }
    out.templates = templates;
  }
  return out;
}

export const getNotifications = async (req, res, next) => {
  try {
    if (!req.tenant?._id) throw new APIError("Tenant context not found", 400);
    const Tenant = mongoose.model("Tenant");
    const tenant = await Tenant.findById(req.tenant._id).select("settings.notifications").lean();
    if (!tenant) throw new APIError("Tenant not found", 404);
    res.json({ success: true, data: tenant.settings?.notifications || { fromName: null, fromEmail: null, templates: {} } });
  } catch (error) {
    next(error);
  }
};

export const updateNotifications = async (req, res, next) => {
  try {
    if (!req.tenant?._id) throw new APIError("Tenant context not found", 400);
    const validated = validateNotifications(req.body);
    const update = {};
    if (validated.fromName !== undefined) update["settings.notifications.fromName"] = validated.fromName;
    if (validated.fromEmail !== undefined) update["settings.notifications.fromEmail"] = validated.fromEmail;
    if (validated.templates !== undefined) {
      // Set per-status to preserve any statuses the merchant didn't include
      // in the payload. PUT /notifications is "merge templates"; an explicit
      // wipe is "send the status with empty enabled:true subject:null body:null".
      for (const [status, tpl] of Object.entries(validated.templates)) {
        if (tpl.enabled !== undefined) update[`settings.notifications.templates.${status}.enabled`] = tpl.enabled;
        if (tpl.subject !== undefined) update[`settings.notifications.templates.${status}.subject`] = tpl.subject;
        if (tpl.body !== undefined) update[`settings.notifications.templates.${status}.body`] = tpl.body;
      }
    }
    if (Object.keys(update).length === 0) {
      throw new APIError("No notification fields provided", 400);
    }
    const Tenant = mongoose.model("Tenant");
    const tenant = await Tenant.findByIdAndUpdate(
      req.tenant._id,
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!tenant) throw new APIError("Tenant not found", 404);
    logAudit(req.models, {
      action: "settings.notifications.updated",
      resource: "Notifications",
      resourceId: tenant._id,
      changes: update,
      req,
    });
    res.json({ success: true, data: tenant.settings.notifications });
  } catch (error) {
    next(error);
  }
};

export const deleteShippingZone = async (req, res, next) => {
  try {
    if (!req.tenant?._id) throw new APIError("Tenant context not found", 400);
    const { zoneId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(zoneId)) {
      throw new APIError("Invalid zone id", 400);
    }
    const Tenant = mongoose.model("Tenant");
    const tenant = await Tenant.findByIdAndUpdate(
      req.tenant._id,
      { $pull: { "settings.shipping.zones": { _id: zoneId } } },
      { new: true }
    );
    if (!tenant) throw new APIError("Tenant not found", 404);
    logAudit(req.models, {
      action: "settings.shipping.zone.deleted",
      resource: "ShippingZone",
      resourceId: zoneId,
      req,
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
