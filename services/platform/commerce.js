/**
 * Cross-store commerce inspection for the platform console (read-only).
 *
 * Orders/products/inventory search runs as bounded aggregations over the
 * shared collections joined to the tenant name/slug. Customers are always
 * tenant-scoped (a mandatory tenantId) — there is deliberately no
 * cross-tenant customer search. Every projection is an explicit whitelist:
 * no payment details, no addresses beyond city/country in lists, no user
 * credentials.
 */
import mongoose from "mongoose";
import { escapeRegExp } from "../../utils/misc.js";
import { createScopedModels } from "../../utils/scopedModel.js";

const oid = (v) => new mongoose.Types.ObjectId(String(v));

const TENANT_LOOKUP = [
  {
    $lookup: {
      from: "tenants",
      localField: "tenantId",
      foreignField: "_id",
      pipeline: [{ $project: { name: 1, slug: 1, "settings.currency": 1 } }],
      as: "tenant",
    },
  },
  { $unwind: { path: "$tenant", preserveNullAndEmptyArrays: true } },
];

async function paginate(Model, matchStages, projectStage, sort, page, limit, aggOptions = {}) {
  const skip = (page - 1) * limit;
  const [rows, countRes] = await Promise.all([
    Model.aggregate([...matchStages, { $sort: sort }, { $skip: skip }, { $limit: limit }, ...TENANT_LOOKUP, projectStage], aggOptions),
    Model.aggregate([...matchStages, { $count: "n" }], aggOptions),
  ]);
  const total = countRes[0]?.n || 0;
  return { rows, pagination: { total, page, pages: Math.ceil(total / limit) || 1, limit } };
}

// --- Orders ----------------------------------------------------------

const ORDER_LIST_PROJECT = {
  $project: {
    tenantId: 1,
    tenant: { name: "$tenant.name", slug: "$tenant.slug" },
    orderNumber: 1,
    status: 1,
    paymentStatus: 1,
    fulfillmentStatus: 1,
    paymentMethod: 1,
    totalAmount: 1,
    refundedAmount: 1,
    currency: { $ifNull: ["$baseCurrency", "$tenant.settings.currency"] },
    itemCount: { $size: { $ifNull: ["$products", []] } },
    customer: {
      name: {
        $trim: {
          input: {
            $concat: [
              { $ifNull: ["$customerSnapshot.firstName", ""] },
              " ",
              { $ifNull: ["$customerSnapshot.lastName", ""] },
            ],
          },
        },
      },
      email: "$customerSnapshot.email",
    },
    shipTo: { city: "$shippingAddress.city", country: "$shippingAddress.country" },
    createdAt: 1,
    updatedAt: 1,
  },
};

export async function searchOrders(q) {
  const match = {};
  if (q.tenantId) match.tenantId = oid(q.tenantId);
  if (q.status) match.status = q.status;
  else match.status = { $ne: "Draft" };
  if (q.paymentStatus) match.paymentStatus = q.paymentStatus;
  if (q.currency) match.baseCurrency = q.currency;
  if (q.from || q.to) {
    match.createdAt = {};
    if (q.from) match.createdAt.$gte = q.from;
    if (q.to) match.createdAt.$lte = q.to;
  }
  if (q.min != null || q.max != null) {
    match.totalAmount = {};
    if (q.min != null) match.totalAmount.$gte = q.min;
    if (q.max != null) match.totalAmount.$lte = q.max;
  }
  if (q.q) {
    const raw = q.q.trim();
    const lower = raw.toLowerCase();
    // Order numbers are stored as "#1001" — exact match on both spellings so
    // the {orderNumber:1} index is used. Email/phone are prefix-anchored with
    // no case flag: the snapshot email is lowercased by the schema at write
    // time, so the {customerSnapshot.email:1} index serves the prefix scan.
    const num = raw.replace(/^#/, "");
    match.$or = [
      { orderNumber: { $in: [num, `#${num}`] } },
      { "customerSnapshot.email": new RegExp("^" + escapeRegExp(lower)) },
      { "customerSnapshot.phone": new RegExp("^" + escapeRegExp(raw.replace(/[\s-]/g, ""))) },
    ];
    if (mongoose.Types.ObjectId.isValid(raw)) match.$or.push({ _id: oid(raw) });
  }
  const Order = mongoose.model("Order");
  return paginate(Order, [{ $match: match }], ORDER_LIST_PROJECT, { createdAt: -1 }, q.page, q.limit);
}

const HISTORY_LABELS = {
  created: "Order placed",
  status_changed: (h) => `Status → ${h.status}`,
  payment_status_changed: (h) => `Payment → ${h.status}`,
  tracking_updated: "Tracking updated",
  cancelled: "Order cancelled",
  note_added: "Internal note added",
  refunded: "Refund recorded",
  fulfillment_created: "Fulfillment created",
  replacement_created: "Replacement order created",
};

function labelFor(h) {
  const l = HISTORY_LABELS[h.event];
  if (typeof l === "function") return l(h);
  if (l) return l;
  return String(h.event || "event").replace(/[_.]/g, " ");
}

/** Build a human-readable timeline from order.history + fulfillment/return history. */
export function buildOrderTimeline(order) {
  const items = [];
  items.push({ at: order.createdAt, label: "Order placed", details: { status: order.status } });
  for (const h of order.history || []) {
    items.push({
      at: h.at,
      label: labelFor(h),
      actor: h.byName || null,
      details: {
        ...(h.previousStatus ? { from: h.previousStatus } : {}),
        ...(h.status ? { to: h.status } : {}),
        ...(h.note ? { note: String(h.note).slice(0, 300) } : {}),
      },
    });
  }
  for (const f of order.fulfillments || []) {
    for (const h of f.history || []) {
      items.push({ at: h.at, label: `Fulfillment: ${labelFor(h)}`, actor: h.byName || null, details: h.note ? { note: String(h.note).slice(0, 300) } : {} });
    }
  }
  for (const r of order.returns || []) {
    for (const h of r.history || []) {
      items.push({ at: h.at, label: `Return: ${labelFor(h)}`, actor: h.byName || null, details: h.note ? { note: String(h.note).slice(0, 300) } : {} });
    }
  }
  return items
    .filter((i) => i.at)
    .sort((a, b) => new Date(a.at) - new Date(b.at));
}

/**
 * Operator-safe projection of a single order: an explicit WHITELIST. Nothing
 * else on the document (payment details, billing address, idempotency keys,
 * internal notes, raw history) ever reaches the console; history/fulfillments/
 * returns are consumed only by buildOrderTimeline.
 */
export function projectOrder(o, fallbackCurrency = null) {
  const cs = o.customerSnapshot || {};
  return {
    _id: o._id,
    orderNumber: o.orderNumber ?? null,
    status: o.status ?? null,
    paymentStatus: o.paymentStatus ?? null,
    fulfillmentStatus: o.fulfillmentStatus ?? null,
    paymentMethod: o.paymentMethod ?? null,
    paymentMethodCode: o.paymentMethodCode ?? null,
    totalAmount: o.totalAmount ?? null,
    subtotal: o.subtotal ?? null,
    shippingCost: o.shippingCost ?? null,
    tax: o.tax ?? null,
    discount: o.discount ?? null,
    refundedAmount: o.refundedAmount ?? 0,
    baseCurrency: o.baseCurrency ?? null,
    currency: o.baseCurrency || fallbackCurrency || null,
    trackingNumber: o.trackingNumber ?? null,
    trackingCarrier: o.trackingCarrier ?? null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt ?? null,
    customer: {
      name: [cs.firstName, cs.lastName].filter(Boolean).join(" ") || null,
      email: cs.email ?? null,
      phone: cs.phone ?? null,
    },
    shipTo: { city: o.shippingAddress?.city ?? null, country: o.shippingAddress?.country ?? null },
    items: (o.products || []).map((p) => ({
      name: p.name ?? null,
      sku: p.sku ?? null,
      quantity: p.quantity,
      price: p.price,
      variantOptions: Array.isArray(p.variantOptions) ? p.variantOptions.map((v) => ({ name: v.name, value: v.value })) : [],
    })),
  };
}

export async function getOrderDetail(tenantId, orderId) {
  const models = createScopedModels(mongoose.connection, tenantId);
  const order = await models.Order.findById(orderId).lean();
  if (!order) return null;
  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findById(tenantId).select("name slug settings.currency").lean();
  return {
    order: projectOrder(order, tenant?.settings?.currency || null),
    tenant: tenant ? { _id: tenant._id, name: tenant.name, slug: tenant.slug } : null,
    timeline: buildOrderTimeline(order),
  };
}

// --- Products --------------------------------------------------------

const PRODUCT_LIST_PROJECT = {
  $project: {
    tenantId: 1,
    tenant: { name: "$tenant.name", slug: "$tenant.slug" },
    currency: "$tenant.settings.currency",
    name: 1,
    slug: 1,
    sku: 1,
    status: 1,
    price: 1,
    compareAtPrice: 1,
    stock: 1,
    hasVariants: 1,
    variantCount: { $size: { $ifNull: ["$variants", []] } },
    variantStock: { $sum: { $ifNull: ["$variants.stock", []] } },
    trackInventory: 1,
    lowStockThreshold: 1,
    isDemo: 1,
    image: { $arrayElemAt: ["$images", 0] },
    createdAt: 1,
    updatedAt: 1,
  },
};

export async function searchProducts(q) {
  const match = {};
  if (q.tenantId) match.tenantId = oid(q.tenantId);
  if (q.status) match.status = q.status;
  const ands = [];
  if (q.sku) {
    // SKUs are stored as entered (no lowercase transform) — exact match on the
    // indexed fields in both raw and upper-cased forms.
    const raw = q.sku.trim();
    const forms = Array.from(new Set([raw, raw.toUpperCase(), raw.toLowerCase()]));
    ands.push({ $or: [{ sku: { $in: forms } }, { "variants.sku": { $in: forms } }] });
  }
  if (q.q) {
    const raw = q.q.trim();
    const or = [{ slug: new RegExp("^" + escapeRegExp(raw.toLowerCase())) }, { sku: { $in: [raw, raw.toUpperCase()] } }];
    if (mongoose.Types.ObjectId.isValid(raw)) or.push({ _id: oid(raw) });
    ands.push({ $or: or });
  }
  const Product = mongoose.model("Product");
  // Name search uses the existing `product_text_search` text index
  // (name/description/tags — words, not substrings). When `q` is present we
  // union those hits with the slug/sku exact/prefix matches.
  let stages;
  if (q.q && q.q.trim().length >= 2) {
    // Deliberately cross-tenant (platform console); `_skipTenantCheck` tells
    // the tenant-scope plugin this is intentional so it does not log a leak.
    const textIds = await Product.find({ $text: { $search: q.q.trim() }, ...match }, { _id: 1 })
      .setOptions({ _skipTenantCheck: true })
      .limit(500)
      .lean();
    ands[ands.length - 1].$or.push({ _id: { $in: textIds.map((d) => d._id) } });
  }
  if (ands.length) match.$and = ands;
  stages = [{ $match: match }];
  return paginate(Product, stages, PRODUCT_LIST_PROJECT, { updatedAt: -1 }, q.page, q.limit);
}

export async function getProductDetail(tenantId, productId) {
  const models = createScopedModels(mongoose.connection, tenantId);
  const product = await models.Product.findById(productId)
    .select("name slug sku status price compareAtPrice stock trackInventory lowStockThreshold hasVariants options variants images category isDemo featured tags createdAt updatedAt")
    .populate("category", "name slug")
    .lean();
  if (!product) return null;
  const collections = await models.Collection.find({ productIds: product._id })
    .select("title handle isPublished")
    .limit(50)
    .lean();
  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findById(tenantId).select("name slug settings.currency").lean();
  return {
    product: {
      ...product,
      currency: tenant?.settings?.currency || null,
      variants: (product.variants || []).map((v) => ({
        _id: v._id,
        sku: v.sku,
        optionValues: v.optionValues,
        price: v.price ?? product.price,
        compareAtPrice: v.compareAtPrice,
        stock: v.stock,
        image: v.image,
      })),
    },
    collections,
    tenant: tenant ? { _id: tenant._id, name: tenant.name, slug: tenant.slug } : null,
  };
}

// --- Customers (tenant-scoped only) ----------------------------------

const CUSTOMER_SELECT = "name firstName lastName email phone customerType totalOrders totalSpent isActive emailVerified lastLoginAt createdAt";

export async function listCustomers(q) {
  const models = createScopedModels(mongoose.connection, q.tenantId);
  const filter = { roles: "customer" };
  if (q.q) {
    const raw = q.q.trim();
    filter.$or = [
      { email: new RegExp("^" + escapeRegExp(raw.toLowerCase())) },
      { name: new RegExp("^" + escapeRegExp(raw), "i") },
      { phone: new RegExp("^" + escapeRegExp(raw.replace(/[\s-]/g, ""))) },
    ];
  }
  const skip = (q.page - 1) * q.limit;
  const [rows, total] = await Promise.all([
    models.User.find(filter).select(CUSTOMER_SELECT).sort({ createdAt: -1 }).skip(skip).limit(q.limit).lean(),
    models.User.countDocuments(filter),
  ]);
  // Last order per customer (single aggregate over this tenant's orders).
  const ids = rows.map((r) => r._id);
  const last = ids.length
    ? await models.Order.aggregate([
        { $match: { user: { $in: ids }, status: { $ne: "Draft" } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: "$user", at: { $first: "$createdAt" }, orderNumber: { $first: "$orderNumber" } } },
      ])
    : [];
  const lastBy = new Map(last.map((l) => [String(l._id), l]));
  const tenant = await mongoose.model("Tenant").findById(q.tenantId).select("name slug settings.currency").lean();
  return {
    rows: rows.map((r) => ({ ...r, lastOrder: lastBy.get(String(r._id)) || null })),
    tenant: tenant ? { _id: tenant._id, name: tenant.name, slug: tenant.slug, currency: tenant.settings?.currency || null } : null,
    pagination: { total, page: q.page, pages: Math.ceil(total / q.limit) || 1, limit: q.limit },
  };
}

// --- Inventory -------------------------------------------------------

export async function listInventory(q) {
  const match = { trackInventory: { $ne: false }, status: { $ne: "archived" } };
  if (q.tenantId) match.tenantId = oid(q.tenantId);
  if (q.q) match.name = new RegExp("^" + escapeRegExp(q.q.trim()), "i");
  // Cross-tenant view defaults to the problem set (low or negative stock) so
  // the aggregate never scans every product on the platform; a tenantId
  // narrows it enough to list everything.
  const lowStock = q.lowStock || (!q.tenantId && !q.negative);
  const negative = q.negative;
  const Product = mongoose.model("Product");
  const stages = [
    { $match: match },
    {
      $addFields: {
        onHand: {
          $cond: [{ $eq: ["$hasVariants", true] }, { $sum: { $ifNull: ["$variants.stock", []] } }, "$stock"],
        },
      },
    },
  ];
  const flags = [];
  if (negative) flags.push({ onHand: { $lt: 0 } });
  if (lowStock) flags.push({ $expr: { $lte: ["$onHand", { $ifNull: ["$lowStockThreshold", 5] }] } });
  if (flags.length) stages.push({ $match: { $or: flags } });
  const project = {
    $project: {
      tenantId: 1,
      tenant: { name: "$tenant.name", slug: "$tenant.slug" },
      name: 1,
      sku: 1,
      status: 1,
      hasVariants: 1,
      onHand: 1,
      lowStockThreshold: 1,
      variants: {
        $map: {
          input: { $ifNull: ["$variants", []] },
          as: "v",
          in: { _id: "$$v._id", sku: "$$v.sku", stock: "$$v.stock", optionValues: "$$v.optionValues" },
        },
      },
      updatedAt: 1,
    },
  };
  return paginate(Product, stages, project, { updatedAt: -1 }, q.page, q.limit, { allowDiskUse: true });
}
