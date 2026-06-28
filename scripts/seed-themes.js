import "dotenv/config";
import mongoose from "mongoose";
import themeSchema from "../schemas/store/theme.js";

/**
 * Seed the 10 built-in React storefront themes into the database.
 *
 * Usage:  node scripts/seed-themes.js
 *
 * Connects via MONGODB_URI / MONGO_URI env var (falls back to localhost).
 * Upserts by slug so it's safe to run repeatedly.
 */

const MONGO_URI =
  process.env.DB_URI ||
  process.env.MONGODB_URI ||
  "mongodb://localhost:27017/matjar";

export const themes = [
  {
    name: "Modern",
    slug: "modern",
    version: "1.0.0",
    description:
      "A clean, minimal e-commerce theme with a gradient hero, category grid, and featured products. Perfect for any store type.",
    author: { name: "Matjar", email: "themes@matjar.io", website: "" },
    status: "active",
    isDefault: true,
    isPublished: true,
    storagePath: "storefront-themes/modern",
    categories: ["general"],
    tags: ["minimal", "clean", "modern", "responsive"],
    features: ["responsive-design", "ajax-cart", "live-search", "reviews-ratings"],
    settings: {
      colors: { primary: "#2563eb", secondary: "#1e40af", accent: "#f59e0b", background: "#f9fafb", text: "#111827" },
      typography: { fontFamily: "'Inter', sans-serif", fontSizeBase: "16px", headingFontFamily: "'Inter', sans-serif" },
    },
    statistics: { installCount: 150, activeInstalls: 80, rating: 4.8, reviewCount: 24 },
  },
  {
    name: "Elegance",
    slug: "elegance",
    version: "1.0.0",
    description:
      "A dark luxury theme with gold accents and serif typography. Ideal for jewelry, fashion, and premium brands.",
    author: { name: "Matjar", email: "themes@matjar.io", website: "" },
    status: "active",
    isDefault: false,
    isPublished: true,
    storagePath: "storefront-themes/elegance",
    categories: ["fashion", "apparel"],
    tags: ["luxury", "dark", "gold", "serif", "premium"],
    features: ["responsive-design", "ajax-cart", "reviews-ratings", "product-zoom"],
    settings: {
      colors: { primary: "#1a1a2e", secondary: "#c9a96e", accent: "#e8d5b7", background: "#faf8f5", text: "#1a1a2e" },
      typography: { fontFamily: "'Playfair Display', serif", fontSizeBase: "16px", headingFontFamily: "'Playfair Display', serif" },
    },
    statistics: { installCount: 95, activeInstalls: 42, rating: 4.7, reviewCount: 18 },
  },
  {
    name: "TechHub",
    slug: "techhub",
    version: "1.0.0",
    description:
      "A sleek, dark-mode-ready theme for electronics, gadgets, and tech products. Bold CTAs with a modern grid layout.",
    author: { name: "Matjar", email: "themes@matjar.io", website: "" },
    status: "active",
    isDefault: false,
    isPublished: true,
    storagePath: "storefront-themes/techhub",
    categories: ["electronics"],
    tags: ["tech", "dark", "gadgets", "modern"],
    features: ["responsive-design", "ajax-cart", "live-search", "dark-mode", "product-zoom"],
    settings: {
      colors: { primary: "#0ea5e9", secondary: "#0f172a", accent: "#38bdf8", background: "#f8fafc", text: "#0f172a" },
      typography: { fontFamily: "'Space Grotesk', sans-serif", fontSizeBase: "16px", headingFontFamily: "'Space Grotesk', sans-serif" },
    },
    statistics: { installCount: 72, activeInstalls: 35, rating: 4.6, reviewCount: 12 },
  },
  {
    name: "FreshMart",
    slug: "freshmart",
    version: "1.0.0",
    description:
      "A vibrant green theme for grocery, organic food, and fresh produce stores. Friendly rounded UI with trust badges.",
    author: { name: "Matjar", email: "themes@matjar.io", website: "" },
    status: "active",
    isDefault: false,
    isPublished: true,
    storagePath: "storefront-themes/freshmart",
    categories: ["food"],
    tags: ["grocery", "organic", "fresh", "green", "food"],
    features: ["responsive-design", "ajax-cart", "live-search"],
    settings: {
      colors: { primary: "#16a34a", secondary: "#166534", accent: "#f59e0b", background: "#fafff5", text: "#1f2937" },
      typography: { fontFamily: "'Nunito', sans-serif", fontSizeBase: "16px", headingFontFamily: "'Nunito', sans-serif" },
    },
    statistics: { installCount: 58, activeInstalls: 28, rating: 4.5, reviewCount: 9 },
  },
  {
    name: "Starter",
    slug: "starter",
    version: "1.0.0",
    description:
      "An ultra-simple, no-frills theme. Clean hero and product grid. The perfect starting point for any store.",
    author: { name: "Matjar", email: "themes@matjar.io", website: "" },
    status: "active",
    isDefault: false,
    isPublished: true,
    storagePath: "storefront-themes/starter",
    categories: ["general"],
    tags: ["simple", "starter", "minimal", "basic"],
    features: ["responsive-design", "ajax-cart"],
    settings: {
      colors: { primary: "#3b82f6", secondary: "#1d4ed8", accent: "#f59e0b", background: "#f9fafb", text: "#111827" },
      typography: { fontFamily: "'Inter', sans-serif", fontSizeBase: "16px", headingFontFamily: "'Inter', sans-serif" },
    },
    statistics: { installCount: 200, activeInstalls: 110, rating: 4.4, reviewCount: 30 },
  },
  {
    name: "Artisan",
    slug: "artisan",
    version: "1.0.0",
    description:
      "A warm, earthy theme with serif typography for handmade goods, crafts, and artisan products.",
    author: { name: "Matjar", email: "themes@matjar.io", website: "" },
    status: "active",
    isDefault: false,
    isPublished: true,
    storagePath: "storefront-themes/artisan",
    categories: ["general"],
    tags: ["handmade", "crafts", "artisan", "warm", "earthy"],
    features: ["responsive-design", "ajax-cart", "reviews-ratings"],
    settings: {
      colors: { primary: "#92400e", secondary: "#d97706", accent: "#f5e6d3", background: "#fffbf5", text: "#292524" },
      typography: { fontFamily: "'Cormorant Garamond', serif", fontSizeBase: "16px", headingFontFamily: "'Cormorant Garamond', serif" },
    },
    statistics: { installCount: 45, activeInstalls: 20, rating: 4.7, reviewCount: 8 },
  },
  {
    name: "SportZone",
    slug: "sportzone",
    version: "1.0.0",
    description:
      "A bold, high-energy theme for sports, fitness, and athletic gear. Black and red with uppercase typography.",
    author: { name: "Matjar", email: "themes@matjar.io", website: "" },
    status: "active",
    isDefault: false,
    isPublished: true,
    storagePath: "storefront-themes/sportzone",
    categories: ["sports"],
    tags: ["sports", "fitness", "bold", "athletic", "red"],
    features: ["responsive-design", "ajax-cart", "live-search", "size-guide"],
    settings: {
      colors: { primary: "#dc2626", secondary: "#111827", accent: "#f59e0b", background: "#ffffff", text: "#111827" },
      typography: { fontFamily: "'Oswald', sans-serif", fontSizeBase: "16px", headingFontFamily: "'Oswald', sans-serif" },
    },
    statistics: { installCount: 62, activeInstalls: 30, rating: 4.5, reviewCount: 11 },
  },
  {
    name: "BookShelf",
    slug: "bookshelf",
    version: "1.0.0",
    description:
      "A serene violet theme for bookstores and literary shops. Serif typography with a calm, intellectual aesthetic.",
    author: { name: "Matjar", email: "themes@matjar.io", website: "" },
    status: "active",
    isDefault: false,
    isPublished: true,
    storagePath: "storefront-themes/bookshelf",
    categories: ["books"],
    tags: ["books", "literary", "violet", "serif", "calm"],
    features: ["responsive-design", "ajax-cart", "reviews-ratings", "live-search"],
    settings: {
      colors: { primary: "#7c3aed", secondary: "#4c1d95", accent: "#a78bfa", background: "#faf5ff", text: "#1f2937" },
      typography: { fontFamily: "'Merriweather', serif", fontSizeBase: "16px", headingFontFamily: "'Merriweather', serif" },
    },
    statistics: { installCount: 38, activeInstalls: 18, rating: 4.6, reviewCount: 7 },
  },
  {
    name: "KidsWorld",
    slug: "kidsworld",
    version: "1.0.0",
    description:
      "A playful, colorful theme for toy stores and children's products. Pink, purple, and yellow with fun rounded design.",
    author: { name: "Matjar", email: "themes@matjar.io", website: "" },
    status: "active",
    isDefault: false,
    isPublished: true,
    storagePath: "storefront-themes/kidsworld",
    categories: ["toys"],
    tags: ["kids", "toys", "playful", "colorful", "fun"],
    features: ["responsive-design", "ajax-cart", "wishlist"],
    settings: {
      colors: { primary: "#ec4899", secondary: "#8b5cf6", accent: "#fbbf24", background: "#fffbf0", text: "#1f2937" },
      typography: { fontFamily: "'Quicksand', sans-serif", fontSizeBase: "16px", headingFontFamily: "'Quicksand', sans-serif" },
    },
    statistics: { installCount: 42, activeInstalls: 22, rating: 4.8, reviewCount: 10 },
  },
  {
    name: "HomeDecor",
    slug: "homedecor",
    version: "1.0.0",
    description:
      "A sophisticated neutral theme for home furnishings, furniture, and interior decor. Warm gold accents on a muted palette.",
    author: { name: "Matjar", email: "themes@matjar.io", website: "" },
    status: "active",
    isDefault: false,
    isPublished: true,
    storagePath: "storefront-themes/homedecor",
    categories: ["home"],
    tags: ["home", "furniture", "decor", "neutral", "sophisticated"],
    features: ["responsive-design", "ajax-cart", "product-zoom", "reviews-ratings"],
    settings: {
      colors: { primary: "#6b7280", secondary: "#2d2d2d", accent: "#d4a76a", background: "#f9f7f4", text: "#1f2937" },
      typography: { fontFamily: "'DM Sans', sans-serif", fontSizeBase: "16px", headingFontFamily: "'DM Sans', sans-serif" },
    },
    statistics: { installCount: 55, activeInstalls: 25, rating: 4.6, reviewCount: 9 },
  },
  {
    name: "Glowing",
    slug: "glowing",
    version: "1.0.0",
    description:
      "A minimalist editorial theme for cosmetics and skincare. Black serif headlines on white with leaf imagery and pastel promo cards.",
    author: { name: "Matjar", email: "themes@matjar.io", website: "" },
    status: "active",
    isDefault: false,
    isPublished: true,
    storagePath: "storefront-themes/glowing",
    categories: ["beauty", "cosmetics"],
    tags: ["cosmetics", "skincare", "minimal", "editorial", "serif"],
    features: ["responsive-design", "ajax-cart", "live-search", "product-zoom", "reviews-ratings"],
    settings: {
      colors: { primary: "#0a0a0a", secondary: "#f5f1ea", accent: "#d4a574", background: "#ffffff", text: "#0a0a0a" },
      typography: { fontFamily: "'Inter', sans-serif", fontSizeBase: "16px", headingFontFamily: "'Playfair Display', serif" },
    },
    statistics: { installCount: 68, activeInstalls: 31, rating: 4.8, reviewCount: 14 },
  },
  {
    name: "Beauxe",
    slug: "beauxe",
    version: "1.0.0",
    description:
      "A model-led cosmetics theme with navy top bar, pink and cream palette, rounded pink product cards, and best-seller sidebar. Built for beauty brands.",
    author: { name: "Matjar", email: "themes@matjar.io", website: "" },
    status: "active",
    isDefault: false,
    isPublished: true,
    storagePath: "storefront-themes/beauxe",
    categories: ["beauty", "cosmetics"],
    tags: ["cosmetics", "beauty", "pink", "model", "serif"],
    features: ["responsive-design", "ajax-cart", "live-search", "wishlist", "reviews-ratings"],
    settings: {
      colors: { primary: "#1d1d3b", secondary: "#d4a8b3", accent: "#f5ebe4", background: "#fdf8f4", text: "#1d1d3b" },
      typography: { fontFamily: "'Inter', sans-serif", fontSizeBase: "16px", headingFontFamily: "'Fraunces', serif" },
    },
    statistics: { installCount: 52, activeInstalls: 24, rating: 4.7, reviewCount: 11 },
  },
  {
    name: "Nutreko",
    slug: "nutreko",
    version: "1.0.0",
    description:
      "A bold black and lime sports-nutrition theme for supplements and fitness products. Chunky uppercase typography with max-potency panels and top-seller rails.",
    author: { name: "Matjar", email: "themes@matjar.io", website: "" },
    status: "active",
    isDefault: false,
    isPublished: true,
    storagePath: "storefront-themes/nutreko",
    categories: ["health", "supplements", "sports"],
    tags: ["supplements", "sports", "nutrition", "bold", "fitness"],
    features: ["responsive-design", "ajax-cart", "live-search", "size-guide", "reviews-ratings"],
    settings: {
      colors: { primary: "#a3e635", secondary: "#0a0a0a", accent: "#ff6a13", background: "#ffffff", text: "#0a0a0a" },
      typography: { fontFamily: "'Inter', sans-serif", fontSizeBase: "16px", headingFontFamily: "'Archivo Black', sans-serif" },
    },
    statistics: { installCount: 48, activeInstalls: 22, rating: 4.6, reviewCount: 10 },
  },
  {
    name: "Milmaa",
    slug: "milmaa",
    version: "1.0.0",
    description:
      "A pastel single-product theme for plant-based milk and beverage brands. Teal, cream, and pink palette with Fraunces serif and rounded organic shapes.",
    author: { name: "Matjar", email: "themes@matjar.io", website: "" },
    status: "active",
    isDefault: false,
    isPublished: true,
    storagePath: "storefront-themes/milmaa",
    categories: ["food", "beverages"],
    tags: ["milk", "plant-based", "pastel", "single-product", "organic"],
    features: ["responsive-design", "ajax-cart", "reviews-ratings", "blog"],
    settings: {
      colors: { primary: "#5eaaa8", secondary: "#2c4a4a", accent: "#f7c1b7", background: "#fdf6ed", text: "#2c4a4a" },
      typography: { fontFamily: "'DM Sans', sans-serif", fontSizeBase: "16px", headingFontFamily: "'Fraunces', serif" },
    },
    statistics: { installCount: 40, activeInstalls: 18, rating: 4.9, reviewCount: 8 },
  },
];

async function seedThemes() {
  console.log("=".repeat(50));
  console.log("Seeding React Storefront Themes");
  console.log("=".repeat(50));

  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB\n");

    const Theme = mongoose.connection.models.Theme || mongoose.connection.model("Theme", themeSchema);

    for (const themeData of themes) {
      const result = await Theme.findOneAndUpdate(
        { slug: themeData.slug },
        { $set: themeData },
        { upsert: true, new: true }
      );
      const marker = result.isDefault ? " (DEFAULT)" : "";
      console.log(`  ✓ ${result.name}${marker} — ${result.slug}`);
    }

    // Clean up old legacy themes
    const oldSlugs = ["tech-store", "elegance-jewelry", "fashion-apparel"];
    const removed = await Theme.deleteMany({ slug: { $in: oldSlugs } });
    if (removed.deletedCount > 0) {
      console.log(`\n  Removed ${removed.deletedCount} legacy theme(s)`);
    }

    console.log(`\n✅ Seeded ${themes.length} themes successfully.`);
  } catch (err) {
    console.error("Error seeding themes:", err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

seedThemes();
