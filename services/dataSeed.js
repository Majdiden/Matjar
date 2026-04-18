/**
 * Data Seeding Service
 * Creates sample data for new stores
 */

import { addCategoryRepo, getCategoriesRepo } from "../repositories/category.js";
import { addAProductRepo, getProductsRepo } from "../repositories/product.js";
import logger from "../utils/logger.js";

const SAMPLE_CATEGORIES = [
  { name: "Electronics", description: "Electronic devices and accessories", slug: "electronics" },
  { name: "Clothing", description: "Fashion and apparel", slug: "clothing" },
  { name: "Home & Garden", description: "Home decor and garden supplies", slug: "home-garden" },
];

const SAMPLE_PRODUCTS = [
  { name: "Wireless Bluetooth Headphones", slug: "wireless-bluetooth-headphones", description: "Premium wireless headphones with active noise cancellation.", price: 79.99, sku: "WBH-001", categorySlug: "electronics", stock: 50, status: "active", featured: true, tags: ["audio", "wireless", "bluetooth"], images: [] },
  { name: "Classic Cotton T-Shirt", slug: "classic-cotton-t-shirt", description: "Comfortable 100% cotton t-shirt.", price: 24.99, sku: "CCT-001", categorySlug: "clothing", stock: 100, status: "active", tags: ["clothing", "tshirt", "cotton"], images: [] },
  { name: "Ceramic Plant Pot Set", slug: "ceramic-plant-pot-set", description: "Set of 3 elegant ceramic plant pots.", price: 34.99, sku: "CPP-SET-001", categorySlug: "home-garden", stock: 30, status: "active", featured: true, tags: ["home", "garden", "plants"], images: [] },
  { name: "Smart Watch Pro", slug: "smart-watch-pro", description: "Advanced fitness tracker and smartwatch.", price: 199.99, sku: "SWP-001", categorySlug: "electronics", stock: 25, status: "active", featured: true, tags: ["smartwatch", "fitness", "wearable"], images: [] },
  { name: "Denim Jacket", slug: "denim-jacket", description: "Classic blue denim jacket with modern fit.", price: 89.99, sku: "DJ-001", categorySlug: "clothing", stock: 40, status: "active", tags: ["clothing", "jacket", "denim"], images: [] },
];

/**
 * Defensive slug generator used when a seed row somehow lacks one.
 * Matches the storefront's URL conventions: lowercase, hyphenated,
 * ASCII-only, no leading/trailing dashes. Bounded to 80 chars so it
 * fits well under the schema's string limits.
 */
const slugify = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

async function seedCategories(models) {
  const existingCategories = await getCategoriesRepo(models);
  if (existingCategories && existingCategories.length > 0) {
    logger.debug("Categories already exist, skipping seed", { count: existingCategories.length });
    return existingCategories;
  }

  logger.info("Seeding sample categories", { count: SAMPLE_CATEGORIES.length });
  const categories = [];
  for (const catData of SAMPLE_CATEGORIES) {
    const category = await addCategoryRepo(models, catData);
    categories.push(category);
  }
  return categories;
}

async function seedProducts(models, categories) {
  const existingProducts = await getProductsRepo(models);
  if (existingProducts && existingProducts.length > 0) {
    logger.debug("Products already exist, skipping seed", { count: existingProducts.length });
    return existingProducts;
  }

  const categoryMap = {};
  categories.forEach((cat) => { categoryMap[cat.slug] = cat._id; });

  const products = [];
  for (const prodData of SAMPLE_PRODUCTS) {
    const categoryId = categoryMap[prodData.categorySlug];
    if (!categoryId) continue;
    const productData = { ...prodData, category: categoryId };
    delete productData.categorySlug;
    // Final defensive fallback: every seed row declares a slug but if a
    // contributor ever adds one without, don't let the whole setup fail —
    // the schema requires `slug` so we must emit something valid.
    if (!productData.slug) productData.slug = slugify(productData.name);
    try {
      const product = await addAProductRepo(models, productData);
      products.push(product);
    } catch (err) {
      // Duplicate slug/sku across re-runs is not a setup failure — log,
      // skip, continue so the tenant still ends up with categories +
      // whatever products did succeed rather than zero of either.
      if (err?.code === 11000) {
        logger.debug("Skipping duplicate sample product", { name: productData.name });
        continue;
      }
      throw err;
    }
  }
  return products;
}

export async function seedSampleData(models, tenant) {
  try {
    logger.info("Starting sample data seeding", { tenant: tenant.name });
    const categories = await seedCategories(models);
    const products = await seedProducts(models, categories);
    logger.info("Sample data seeding completed", { tenant: tenant.name });
    return { success: true, categoriesCreated: categories.length, productsCreated: products.length, categories, products };
  } catch (error) {
    logger.error("Sample data seeding failed", { error: error.message });
    return { success: false, error: error.message };
  }
}

export async function clearSampleData(models) {
  try {
    await models.Product.deleteMany({});
    await models.Category.deleteMany({});
    logger.info("Sample data cleared");
    return { success: true };
  } catch (error) {
    logger.error("Error clearing sample data", { error: error.message });
    return { success: false, error: error.message };
  }
}
