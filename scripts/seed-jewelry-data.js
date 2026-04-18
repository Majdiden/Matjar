import "dotenv/config";
import { connectAllDb, getAdminConnection, getConnectionForTenant } from "../utils/connectionManager.js";

/**
 * Seed jewelry-specific data for stores using the Elegance Jewelry theme
 */

const JEWELRY_CATEGORIES = [
  {
    name: "Rings",
    slug: "rings",
    description: "Engagement rings, wedding bands, and fashion rings",
    status: "active",
    icon: "ring",
    productCount: 0,
  },
  {
    name: "Necklaces",
    slug: "necklaces",
    description: "Elegant necklaces and pendants",
    status: "active",
    icon: "necklace",
    productCount: 0,
  },
  {
    name: "Earrings",
    slug: "earrings",
    description: "Studs, hoops, and drop earrings",
    status: "active",
    icon: "earring",
    productCount: 0,
  },
  {
    name: "Bracelets",
    slug: "bracelets",
    description: "Tennis bracelets, bangles, and chains",
    status: "active",
    icon: "bracelet",
    productCount: 0,
  },
  {
    name: "Engagement Rings",
    slug: "engagement-rings",
    description: "Diamond engagement rings for your special moment",
    status: "active",
    icon: "diamond-ring",
    productCount: 0,
  },
  {
    name: "Wedding Bands",
    slug: "wedding-bands",
    description: "Classic and modern wedding bands",
    status: "active",
    icon: "wedding-ring",
    productCount: 0,
  },
];

const JEWELRY_PRODUCTS = [
  // Rings
  {
    name: "Classic Diamond Solitaire Ring",
    slug: "classic-diamond-solitaire-ring",
    description: "Timeless 1-carat diamond solitaire set in 14k white gold. The perfect engagement ring featuring a round brilliant-cut diamond.",
    price: 2999.99,
    compareAtPrice: 3499.99,
    categorySlug: "engagement-rings",
    sku: "EDR-001",
    stock: 10,
    status: "active",
    featured: true,
    onSale: true,
    newArrival: false,
    tags: ["diamond", "engagement", "white-gold", "solitaire"],
    rating: 4.9,
    reviewCount: 127,
    images: ["/assets/images/products/diamond-solitaire-ring.jpg"],
  },
  {
    name: "Rose Gold Halo Engagement Ring",
    slug: "rose-gold-halo-engagement-ring",
    description: "Stunning halo engagement ring in 18k rose gold with 0.75ct center stone surrounded by micro pavé diamonds.",
    price: 3499.99,
    categorySlug: "engagement-rings",
    sku: "EDR-002",
    stock: 8,
    status: "active",
    featured: true,
    onSale: false,
    newArrival: true,
    tags: ["diamond", "engagement", "rose-gold", "halo"],
    rating: 5.0,
    reviewCount: 89,
    images: [],
  },
  {
    name: "Platinum Wedding Band",
    slug: "platinum-wedding-band",
    description: "Classic 4mm platinum wedding band with comfort fit. Timeless design that will last a lifetime.",
    price: 1299.99,
    categorySlug: "wedding-bands",
    sku: "WB-001",
    stock: 15,
    status: "active",
    featured: false,
    onSale: false,
    newArrival: false,
    tags: ["platinum", "wedding-band", "classic"],
    rating: 4.8,
    reviewCount: 56,
    images: [],
  },
  {
    name: "Diamond Eternity Band",
    slug: "diamond-eternity-band",
    description: "14k white gold eternity band featuring 1.5 carats of round brilliant diamonds. Perfect anniversary gift.",
    price: 2199.99,
    compareAtPrice: 2599.99,
    categorySlug: "wedding-bands",
    sku: "WB-002",
    stock: 12,
    status: "active",
    featured: true,
    onSale: true,
    newArrival: false,
    tags: ["diamond", "eternity", "white-gold", "anniversary"],
    rating: 4.9,
    reviewCount: 73,
    images: [],
  },

  // Necklaces
  {
    name: "Diamond Pendant Necklace",
    slug: "diamond-pendant-necklace",
    description: "Elegant 0.5ct diamond pendant on 18-inch 14k yellow gold chain. Classic and versatile design.",
    price: 899.99,
    categorySlug: "necklaces",
    sku: "NK-001",
    stock: 20,
    status: "active",
    featured: true,
    onSale: false,
    newArrival: true,
    tags: ["diamond", "pendant", "yellow-gold", "necklace"],
    rating: 4.7,
    reviewCount: 94,
    images: [],
  },
  {
    name: "Pearl Strand Necklace",
    slug: "pearl-strand-necklace",
    description: "Classic 18-inch strand of cultured freshwater pearls with 14k gold clasp. Timeless elegance.",
    price: 599.99,
    compareAtPrice: 749.99,
    categorySlug: "necklaces",
    sku: "NK-002",
    stock: 18,
    status: "active",
    featured: true,
    onSale: true,
    newArrival: false,
    tags: ["pearl", "classic", "formal"],
    rating: 4.6,
    reviewCount: 62,
    images: [],
  },
  {
    name: "Rose Gold Heart Necklace",
    slug: "rose-gold-heart-necklace",
    description: "Delicate heart pendant in 14k rose gold on 16-inch chain. Perfect gift for someone special.",
    price: 449.99,
    categorySlug: "necklaces",
    sku: "NK-003",
    stock: 25,
    status: "active",
    featured: false,
    onSale: false,
    newArrival: true,
    tags: ["rose-gold", "heart", "gift", "romantic"],
    rating: 4.8,
    reviewCount: 118,
    images: [],
  },

  // Earrings
  {
    name: "Diamond Stud Earrings",
    slug: "diamond-stud-earrings",
    description: "Classic 0.50ct total weight diamond stud earrings in 14k white gold. Four-prong setting.",
    price: 1299.99,
    categorySlug: "earrings",
    sku: "ER-001",
    stock: 30,
    status: "active",
    featured: true,
    onSale: false,
    newArrival: false,
    tags: ["diamond", "studs", "white-gold", "classic"],
    rating: 4.9,
    reviewCount: 156,
    images: [],
  },
  {
    name: "Pearl Drop Earrings",
    slug: "pearl-drop-earrings",
    description: "Elegant cultured pearl drop earrings in 14k yellow gold. Perfect for formal occasions.",
    price: 379.99,
    compareAtPrice: 449.99,
    categorySlug: "earrings",
    sku: "ER-002",
    stock: 22,
    status: "active",
    featured: true,
    onSale: true,
    newArrival: false,
    tags: ["pearl", "drop", "yellow-gold", "formal"],
    rating: 4.7,
    reviewCount: 81,
    images: [],
  },
  {
    name: "Gold Hoop Earrings",
    slug: "gold-hoop-earrings",
    description: "Classic 14k yellow gold hoop earrings, 25mm diameter. Timeless and versatile.",
    price: 299.99,
    categorySlug: "earrings",
    sku: "ER-003",
    stock: 35,
    status: "active",
    featured: false,
    onSale: false,
    newArrival: true,
    tags: ["gold", "hoops", "classic", "everyday"],
    rating: 4.8,
    reviewCount: 93,
    images: [],
  },

  // Bracelets
  {
    name: "Diamond Tennis Bracelet",
    slug: "diamond-tennis-bracelet",
    description: "Classic tennis bracelet featuring 3 carats of round brilliant diamonds in 14k white gold.",
    price: 4999.99,
    compareAtPrice: 5999.99,
    categorySlug: "bracelets",
    sku: "BR-001",
    stock: 8,
    status: "active",
    featured: true,
    onSale: true,
    newArrival: false,
    tags: ["diamond", "tennis", "white-gold", "luxury"],
    rating: 5.0,
    reviewCount: 64,
    images: [],
  },
  {
    name: "Gold Bangle Bracelet",
    slug: "gold-bangle-bracelet",
    description: "Elegant 14k yellow gold bangle with polished finish. Classic design that never goes out of style.",
    price: 699.99,
    categorySlug: "bracelets",
    sku: "BR-002",
    stock: 15,
    status: "active",
    featured: false,
    onSale: false,
    newArrival: true,
    tags: ["gold", "bangle", "classic"],
    rating: 4.7,
    reviewCount: 47,
    images: [],
  },
  {
    name: "Rose Gold Chain Bracelet",
    slug: "rose-gold-chain-bracelet",
    description: "Delicate 14k rose gold chain bracelet, 7.5 inches. Perfect for layering or wearing alone.",
    price: 399.99,
    categorySlug: "bracelets",
    sku: "BR-003",
    stock: 20,
    status: "active",
    featured: true,
    onSale: false,
    newArrival: true,
    tags: ["rose-gold", "chain", "delicate", "everyday"],
    rating: 4.6,
    reviewCount: 52,
    images: [],
  },
];

async function seedJewelryData() {
  console.log("=" .repeat(60));
  console.log("Seeding Jewelry Data for Fresh Store");
  console.log("=".repeat(60));

  try {
    // Initialize database connections
    console.log("\nInitializing database connections...");
    await connectAllDb();

    const adminDb = getAdminConnection();
    const Tenant = adminDb.model("Tenant");

    // Find Fresh tenant
    const tenant = await Tenant.findOne({ "domains.subdomain.name": "fresh" });

    if (!tenant) {
      console.error("✗ Fresh tenant not found!");
      process.exit(1);
    }

    console.log(`✓ Found tenant: ${tenant.name} (${tenant._id})\n`);

    // Get tenant database connection
    const tenantDb = await getConnectionForTenant(tenant.domains.subdomain.fullDomain);

    if (!tenantDb) {
      console.error("✗ Could not get tenant database connection!");
      process.exit(1);
    }

    const Category = tenantDb.model("Category");
    const Product = tenantDb.model("Product");

    // Seed Categories
    console.log("Creating categories...");
    const categoryMap = {};

    for (const catData of JEWELRY_CATEGORIES) {
      const existing = await Category.findOne({ slug: catData.slug });

      if (existing) {
        console.log(`  ✓ Category "${catData.name}" already exists, skipping`);
        categoryMap[catData.slug] = existing._id;
      } else {
        const category = await Category.create(catData);
        categoryMap[catData.slug] = category._id;
        console.log(`  ✓ Created category: ${catData.name}`);
      }
    }

    console.log(`\n✓ Created/verified ${Object.keys(categoryMap).length} categories\n`);

    // Seed Products
    console.log("Creating products...");
    let createdCount = 0;
    let skippedCount = 0;

    for (const prodData of JEWELRY_PRODUCTS) {
      const existing = await Product.findOne({ slug: prodData.slug });

      if (existing) {
        console.log(`  - Product "${prodData.name}" already exists, skipping`);
        skippedCount++;
        continue;
      }

      const categoryId = categoryMap[prodData.categorySlug];

      if (!categoryId) {
        console.warn(`  ✗ Category not found for: ${prodData.categorySlug}, skipping product: ${prodData.name}`);
        continue;
      }

      const productData = {
        ...prodData,
        category: categoryId,
      };
      delete productData.categorySlug;

      await Product.create(productData);
      console.log(`  ✓ Created product: ${prodData.name}`);
      createdCount++;
    }

    console.log(`\n✓ Created ${createdCount} products (${skippedCount} skipped)\n`);

    // Update category product counts
    console.log("Updating category product counts...");
    for (const [slug, categoryId] of Object.entries(categoryMap)) {
      const count = await Product.countDocuments({ category: categoryId, status: "active" });
      await Category.findByIdAndUpdate(categoryId, { productCount: count });
      console.log(`  ✓ Updated ${slug}: ${count} products`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("✓ Jewelry data seeding completed successfully!");
    console.log("=".repeat(60));

    process.exit(0);
  } catch (error) {
    console.error("\n✗ Error seeding jewelry data:");
    console.error("   ", error.message);
    if (error.stack) {
      console.error("\n", error.stack);
    }
    process.exit(1);
  }
}

// Run the seeder
seedJewelryData();
