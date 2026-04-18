import { z } from "zod";

/**
 * Validation schemas for product endpoints
 */

// Single option axis (Color, Size, …) with its allowed values.
const optionSchema = z.object({
  name: z.string().min(1, "Option name is required"),
  values: z.array(z.string().min(1)).min(1, "Each option needs at least one value"),
});

// Pre-order configuration block. Used by both product- and variant-level
// preorder fields. All sub-fields optional so partial updates are allowed.
const preorderSchema = z.object({
  enabled: z.boolean().optional(),
  expectedShipDate: z.union([z.string(), z.date()]).nullable().optional(),
  maxUnits: z.number().int().min(0).nullable().optional(),
  unitsReserved: z.number().int().min(0).optional(),
  maxPerCustomer: z.number().int().min(1).nullable().optional(),
  chargePolicy: z.enum(["now", "on_ship"]).optional(),
});

// A concrete variant — one row in the option matrix.
const variantSchema = z.object({
  _id: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  optionValues: z
    .array(
      z.object({
        name: z.string().min(1),
        value: z.string().min(1),
      })
    )
    .min(1, "Variant must have at least one option value"),
  // Override of product price; undefined/null means inherit
  price: z.number().min(0).nullable().optional(),
  compareAtPrice: z.number().min(0).nullable().optional(),
  stock: z.number().int().min(0, "Stock must be a non-negative integer"),
  image: z.string().optional(),
  weight: z.number().min(0).optional(),
  position: z.number().int().optional(),
  preorder: preorderSchema.optional(),
});

// Slug accepted from the client when explicitly provided; otherwise the
// service auto-generates it from the name. Strict alphabet so a hostile
// client cannot inject query operators or path segments.
const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, digits, and dashes")
  .optional();

const optionAxisSchema = z.object({
  name: z.string().min(1, "Option name is required"),
  values: z.array(z.string().min(1)).min(1, "Each option needs at least one value"),
});

const specSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
});

const productStatusSchema = z.enum(["active", "draft", "archived"]);
const weightUnitSchema = z.enum(["kg", "lb", "g", "oz"]);

export const createProductSchema = z.object({
  body: z.object({
    // Required — matches schema
    name: z
      .string({ required_error: "Product name is required" })
      .min(1, "Product name cannot be empty")
      .max(200, "Product name must be less than 200 characters"),
    description: z
      .string({ required_error: "Description is required" })
      .min(10, "Description must be at least 10 characters")
      .max(5000, "Description must be less than 5000 characters"),
    price: z
      .number({ required_error: "Price is required" })
      .positive("Price must be a positive number"),
    // Required in schema — was previously optional in the validator,
    // which let bad requests fall through and crash Mongoose with a 500.
    category: z.string({ required_error: "Category is required" }).min(1),
    stock: z
      .number({ required_error: "Stock is required" })
      .int("Stock must be an integer")
      .min(0, "Stock cannot be negative"),

    // Optional pass-through fields the schema accepts
    slug: slugSchema,
    shortDescription: z.string().max(500).optional(),
    specifications: z.array(specSchema).optional(),
    compareAtPrice: z.number().min(0).nullable().optional(),
    sku: z.string().max(100).optional(),
    status: productStatusSchema.optional(),
    featured: z.boolean().optional(),
    onSale: z.boolean().optional(),
    newArrival: z.boolean().optional(),
    weight: z.number().min(0).optional(),
    weightUnit: weightUnitSchema.optional(),
    tags: z.array(z.string()).optional(),
    hasVariants: z.boolean().optional(),
    options: z.array(optionAxisSchema).optional(),
    variants: z.array(variantSchema).optional(),
    preorder: preorderSchema.optional(),
    images: z.array(z.string().url("Each image must be a valid URL")).optional(),
    frequentlyBoughtWith: z.array(z.string()).optional(),
    seoTitle: z.string().max(60, "SEO title must be less than 60 characters").optional(),
    seoDescription: z.string().max(160, "SEO description must be less than 160 characters").optional(),
    seoKeywords: z.array(z.string()).optional(),
  }),
});

export const updateProductSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().min(10).max(5000).optional(),
    price: z.number().positive().optional(),
    category: z.string().min(1).optional(),
    stock: z.number().int().min(0).optional(),
    slug: slugSchema,
    shortDescription: z.string().max(500).optional(),
    specifications: z.array(specSchema).optional(),
    compareAtPrice: z.number().min(0).nullable().optional(),
    sku: z.string().max(100).optional(),
    status: productStatusSchema.optional(),
    featured: z.boolean().optional(),
    onSale: z.boolean().optional(),
    newArrival: z.boolean().optional(),
    weight: z.number().min(0).optional(),
    weightUnit: weightUnitSchema.optional(),
    tags: z.array(z.string()).optional(),
    hasVariants: z.boolean().optional(),
    options: z.array(optionAxisSchema).optional(),
    variants: z.array(variantSchema).optional(),
    preorder: preorderSchema.optional(),
    images: z.array(z.string().url()).optional(),
    frequentlyBoughtWith: z.array(z.string()).optional(),
    seoTitle: z.string().max(60).optional(),
    seoDescription: z.string().max(160).optional(),
    seoKeywords: z.array(z.string()).optional(),
  }),
  params: z.object({
    id: z.string().min(1, "Product ID is required"),
  }),
});

export const getProductSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Product ID is required"),
  }),
});

export const getProductsSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional(),
    limit: z.string().regex(/^\d+$/).optional(),
    category: z.string().optional(),
    minPrice: z.string().regex(/^\d+(\.\d+)?$/).optional(),
    maxPrice: z.string().regex(/^\d+(\.\d+)?$/).optional(),
    search: z.string().optional(),
    sort: z.enum(["price", "-price", "name", "-name", "createdAt", "-createdAt"]).optional(),
  }),
});
