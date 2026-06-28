import { Schema } from "mongoose";
import { applyTenantScope } from "../../utils/tenantScope.js";

const productSchema = new Schema({
  tenantId: {
    type: Schema.Types.ObjectId,
    ref: "Tenant",
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, lowercase: true, trim: true },
  description: { type: String, required: true },
  shortDescription: { type: String, trim: true },
  /**
   * Key/value product specifications rendered on the PDP.
   * e.g. [{ key: "Material", value: "100% Cotton" }, { key: "Weight", value: "250g" }]
   */
  specifications: [
    {
      key: { type: String, required: true, trim: true },
      value: { type: String, required: true, trim: true },
      _id: false,
    },
  ],
  /**
   * Curated "frequently bought with" pairings. If empty, the storefront falls
   * back to top-selling products in the same category.
   */
  frequentlyBoughtWith: [{ type: Schema.Types.ObjectId, ref: "Product" }],
  price: { type: Number, required: true, min: [0, "Price cannot be negative"] },
  compareAtPrice: { type: Number, min: 0 },
  category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
  sku: { type: String, sparse: true, trim: true },
  stock: {
    type: Number,
    required: true,
    default: 0,
    min: [0, "Stock cannot be negative"],
  },
  // When false, stock is not decremented on order and the product can be
  // sold indefinitely (digital goods, services, made-to-order items).
  // The atomic stock guard in services/order.js short-circuits when this
  // is false, so a tenant flipping it does not cause a check-then-act race.
  trackInventory: { type: Boolean, default: true },
  // Threshold below which the product is reported in the low-stock report
  // and the inventory dashboard. Purely informational — the cart/checkout
  // path doesn't gate on it.
  lowStockThreshold: { type: Number, min: 0, default: 5 },

  // ── Pre-orders ────────────────────────────────────────────────
  // Lets a merchant accept orders for products that aren't in stock yet.
  // When `enabled` and the on-hand `stock` is exhausted, the cart and
  // checkout fall through to the pre-order counter (`unitsReserved`)
  // instead of refusing the line. Cancellation reverses whichever
  // counter (real stock or pre-order reservation) the order consumed.
  preorder: {
    enabled: { type: Boolean, default: false },
    expectedShipDate: { type: Date },
    // Cap on simultaneous pre-order reservations. `null` = unlimited.
    maxUnits: { type: Number, min: 0 },
    // Atomically incremented when a pre-order line is placed.
    unitsReserved: { type: Number, default: 0, min: 0 },
    // Per-customer purchase cap (enforced at checkout). `null` = unlimited.
    maxPerCustomer: { type: Number, min: 1 },
    // Whether to charge immediately or defer until ship. UI hint only —
    // payment-gateway integration enforces it later.
    chargePolicy: {
      type: String,
      enum: ["now", "on_ship"],
      default: "now",
    },
  },

  status: {
    type: String,
    enum: ["active", "draft", "archived"],
    default: "active",
  },

  // Product flags
  featured: { type: Boolean, default: false },
  onSale: { type: Boolean, default: false },
  newArrival: { type: Boolean, default: false },

  // Marks a storefront demo product auto-seeded when a tenant activates a
  // theme (see services/themeDemoData.js). Demo docs are removed/replaced on
  // the next theme switch and are never created once the store has any real
  // merchant products, so this flag is how we find them again.
  isDemo: { type: Boolean, default: false },

  // Social proof
  rating: { type: Number, min: 0, max: 5, default: 0 },
  reviewCount: { type: Number, default: 0 },

  // Weight for shipping
  weight: { type: Number, min: 0 },
  weightUnit: { type: String, enum: ["kg", "lb", "g", "oz"], default: "kg" },

  // Tax classification. Strings (not enum) so merchants can declare
  // arbitrary classes — the tax service matches against settings.tax.rates
  // by `productClass`. Default "standard" maps to the generic rate when
  // no class-specific rate is configured. `taxExempt` short-circuits the
  // calculation entirely (e.g. medical equipment, gift cards).
  taxClass: { type: String, default: "standard", trim: true },
  taxExempt: { type: Boolean, default: false },

  // ── Variants ───────────────────────────────────────────────────
  // A variant-enabled product declares one or more option *axes*
  // (Color, Size, Material, …) and a list of concrete *variants*,
  // each one a unique combination of values across the axes with its
  // own SKU, stock, optional price override and optional dedicated
  // image. When `hasVariants` is false the cart/checkout code
  // ignores `options`/`variants` entirely and treats the top-level
  // price/stock/sku as the single source of truth.
  hasVariants: { type: Boolean, default: false },
  options: [
    {
      name: { type: String, required: true, trim: true }, // e.g. "Color"
      values: [{ type: String, trim: true }],             // e.g. ["Red","Blue"]
      _id: false,
    },
  ],
  variants: [
    {
      // _id auto-generated by Mongoose — used as the stable identifier
      // referenced by cart items and order line items.
      sku: { type: String, trim: true },
      barcode: { type: String, trim: true },
      // Concrete option values for this variant. Stored as an array of
      // {name,value} (rather than a Map) so we keep ordering, get
      // straightforward queries, and serialise cleanly to the client.
      // e.g. [{name:"Color",value:"Red"},{name:"Size",value:"M"}]
      optionValues: [
        {
          name: { type: String, required: true, trim: true },
          value: { type: String, required: true, trim: true },
          _id: false,
        },
      ],
      // Price override. `null`/`undefined` means inherit `product.price`.
      price: { type: Number, min: 0 },
      compareAtPrice: { type: Number, min: 0 },
      stock: { type: Number, default: 0, min: 0 },
      // Optional per-variant image URL. Should generally be one of the
      // entries in `product.images` so the gallery stays consistent.
      image: { type: String },
      // Weight override for shipping
      weight: { type: Number, min: 0 },
      position: { type: Number, default: 0 },
      // Per-variant pre-order config. Mirrors `product.preorder` but
      // applies to this variant only. When unset, the variant inherits
      // the product-level preorder block.
      preorder: {
        enabled: { type: Boolean, default: false },
        expectedShipDate: { type: Date },
        maxUnits: { type: Number, min: 0 },
        unitsReserved: { type: Number, default: 0, min: 0 },
        maxPerCustomer: { type: Number, min: 1 },
        chargePolicy: {
          type: String,
          enum: ["now", "on_ship"],
        },
      },
    },
  ],

  // Media
  images: [String],

  // SEO
  seoTitle: String,
  seoDescription: String,
  seoKeywords: [String],

  // Tags for search and filtering
  tags: [String],

  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Compound indexes for tenant isolation
productSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
productSchema.index({ tenantId: 1, sku: 1 }, { unique: true, sparse: true });
productSchema.index({ tenantId: 1, category: 1, status: 1 });
productSchema.index({ tenantId: 1, featured: 1, status: 1 });
productSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
productSchema.index({ tenantId: 1, tags: 1 });
productSchema.index({ tenantId: 1, price: 1 });
productSchema.index(
  { name: "text", description: "text", tags: "text" },
  { name: "product_text_search" }
);

// Pre-save: update timestamps
productSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

applyTenantScope(productSchema);

export default productSchema;
