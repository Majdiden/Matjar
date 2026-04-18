import { z } from "zod";

// ─── Auth ────────────────────────────────────────────────────────

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
    domain: z.string().min(1, "Domain is required"),
  }),
});

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100),
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[a-z]/, "Must contain a lowercase letter")
      .regex(/[0-9]/, "Must contain a number"),
    subdomain: z
      .string()
      .min(3)
      .max(50)
      .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens")
      .optional(),
    subscriptionPlan: z.enum(["free", "basic", "pro", "enterprise"]).optional(),
  }),
});

// ─── Product ─────────────────────────────────────────────────────

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required").max(200),
    description: z.string().max(5000).optional(),
    price: z.number().min(0, "Price cannot be negative"),
    compareAtPrice: z.number().min(0).optional().nullable(),
    sku: z.string().max(100).optional(),
    stock: z.number().int().min(0).default(0),
    category: z.string().optional(),
    status: z.enum(["draft", "active", "archived"]).default("draft"),
    featured: z.boolean().default(false),
    images: z.array(z.string()).optional(),
    tags: z.array(z.string().max(50)).optional(),
    weight: z.number().min(0).optional(),
    variants: z
      .array(
        z.object({
          name: z.string(),
          sku: z.string().optional(),
          price: z.number().min(0),
          stock: z.number().int().min(0).default(0),
          attributes: z.record(z.string()).optional(),
        })
      )
      .optional(),
  }),
});

export const updateProductSchema = z.object({
  body: createProductSchema.shape.body.partial(),
  params: z.object({ id: z.string().min(1) }),
});

// ─── Category ────────────────────────────────────────────────────

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(1, "Name is required").max(100),
    description: z.string().max(1000).optional(),
    slug: z.string().max(100).optional(),
    parentCategory: z.string().optional().nullable(),
    image: z.string().optional(),
    isActive: z.boolean().default(true),
  }),
});

// ─── Order ───────────────────────────────────────────────────────

const addressSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  addressLine1: z.string().min(1, "Address is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().optional(),
  postalCode: z.string().min(1, "Postal code is required"),
  country: z.string().min(1, "Country is required"),
  phone: z.string().optional(),
});

export const createOrderSchema = z.object({
  body: z.object({
    shippingAddress: addressSchema,
    billingAddress: addressSchema.optional(),
    paymentMethod: z.string().min(1, "Payment method is required"),
    notes: z.string().max(1000).optional(),
    discountCode: z.string().max(50).optional(),
    shippingMethod: z
      .object({
        id: z.string().optional(),
        name: z.string().optional(),
        price: z.number().min(0).optional(),
      })
      .optional(),
    customerEmail: z.string().email().optional(),
    customerPhone: z.string().optional(),
    acceptsMarketing: z.boolean().optional(),
    saveAddress: z.boolean().optional(),
  }),
});

export const checkoutQuoteSchema = z.object({
  body: z.object({
    shippingAddress: addressSchema.partial().optional(),
    discountCode: z.string().max(50).optional(),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    firstName: z.string().max(100).optional(),
    lastName: z.string().max(100).optional(),
    phone: z.string().max(30).optional(),
    acceptsMarketing: z.boolean().optional(),
  }),
});

export const addAddressSchema = z.object({
  body: addressSchema.extend({
    label: z.string().max(50).optional(),
    isDefault: z.boolean().optional(),
  }),
});

export const updateOrderStatusSchema = z.object({
  body: z.object({
    status: z.enum([
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
      "Refunded",
    ]),
  }),
  params: z.object({ id: z.string().min(1) }),
});

// ─── Discount ────────────────────────────────────────────────────

export const createDiscountSchema = z.object({
  body: z.object({
    code: z
      .string()
      .min(3)
      .max(30)
      .regex(/^[A-Z0-9_-]+$/i, "Only letters, numbers, hyphens, underscores"),
    type: z.enum(["percentage", "fixed"]),
    value: z.number().min(0),
    minOrderAmount: z.number().min(0).optional(),
    maxUsage: z.number().int().min(1).optional(),
    perUserLimit: z.number().int().min(1).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    isActive: z.boolean().default(true),
    applicableProducts: z.array(z.string()).optional(),
    applicableCategories: z.array(z.string()).optional(),
  }),
});

// ─── Cart ────────────────────────────────────────────────────────

export const addToCartSchema = z.object({
  body: z.object({
    productId: z.string().min(1, "Product ID is required"),
    quantity: z.coerce.number().int().min(1).default(1),
    variantId: z.string().optional(),
  }),
});

export const updateCartItemSchema = z.object({
  body: z.object({
    productId: z.string().min(1, "Product ID is required"),
    quantity: z.coerce.number().int().min(0),
    variantId: z.string().optional(),
  }),
});

// ─── Page (CMS static content) ───────────────────────────────────

// Slug: lowercase ascii + digits, hyphen-separated segments. Must match
// the backend's normaliseSlug regex in services/page.js — keep both in
// lockstep when you loosen or tighten the spec.
const pageSlug = z
  .string()
  .min(1, "Slug is required")
  .max(100, "Slug must be 100 characters or fewer")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must contain only lowercase letters, numbers, and hyphens"
  );

// 100KB cap on the HTML body. Matches the schema's maxlength and the
// service's assertContentSize() so all three layers agree on the limit.
const PAGE_CONTENT_MAX = 100 * 1024;

export const createPageSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Title is required").max(200),
    slug: pageSlug.optional(),
    content: z
      .string()
      .max(PAGE_CONTENT_MAX, "Content exceeds 100KB limit")
      .optional(),
    metaTitle: z.string().max(200).optional(),
    metaDescription: z.string().max(500).optional(),
    locale: z.string().max(10).optional(),
    isPublished: z.boolean().optional(),
  }),
});

export const updatePageSchema = z.object({
  body: createPageSchema.shape.body.partial(),
  params: z.object({ id: z.string().min(1) }),
});

// ─── Pagination query (reusable) ─────────────────────────────────

export const paginationQuery = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.string().optional(),
    search: z.string().optional(),
  }),
});
