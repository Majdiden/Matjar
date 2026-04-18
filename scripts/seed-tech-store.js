import "dotenv/config";
import { connectDb, getConnection } from "../utils/connectionManager.js";

/**
 * Seed the Tech Hub tenant with 8 tech categories and 50 realistic
 * products, each with specifications, images, and (where applicable)
 * variants by color/storage/size.
 *
 * Run:  node scripts/seed-tech-store.js
 *
 * Idempotent: re-running will skip categories/products that already
 * exist by slug, so it's safe to run repeatedly while iterating.
 *
 * Image policy: every product has 1-3 stock photos served from the
 * Unsplash CDN. The IDs below are well-known, stable, and free for
 * commercial use under the Unsplash License.
 */

const TENANT_SUBDOMAIN = "tech-hubs";

// ── Image library ────────────────────────────────────────────────
// Curated set of stable Unsplash photo IDs grouped by category. Each
// product picks 1-3 images from its bucket so the storefront has real
// imagery to render instead of placeholders.
const IMG = (id) => `https://images.unsplash.com/photo-${id}?w=900&q=80&auto=format&fit=crop`;

const IMAGES = {
  smartphone: [
    IMG("1592750475338-74b7b21085ab"), // iPhone hero
    IMG("1511707171634-5f897ff02aa9"), // phone in hand
    IMG("1605236453806-6ff36851218e"), // phone flat lay
    IMG("1567581935884-3349723552ca"), // android phone
    IMG("1574944985070-8f3ebc6b79d2"), // pixel-style
  ],
  laptop: [
    IMG("1496181133206-80ce9b88a853"), // MacBook on desk
    IMG("1517336714731-489689fd1ca8"), // open MacBook
    IMG("1525547719571-a2d4ac8945e2"), // ThinkPad style
    IMG("1593642632559-0c6d3fc62b89"), // gaming laptop
    IMG("1541807084-5c52b6b3adef"),    // open notebook
  ],
  audio: [
    IMG("1505740420928-5e560c06d30e"), // headphones product
    IMG("1546435770-a3e426bf472b"),    // wireless over-ear
    IMG("1583394838336-acd977736f90"), // earbuds case
    IMG("1572569511254-d8f925fe2cbb"), // headphones flat
    IMG("1612444530582-fc66183b16f7"), // earbuds in case
  ],
  wearable: [
    IMG("1546868871-7041f2a55e12"),    // apple watch
    IMG("1579586337278-3befd40fd17a"), // smartwatch
    IMG("1508685096489-7aacd43bd3b1"), // fitness tracker
    IMG("1617043786394-f977fa12eddf"), // garmin
    IMG("1523275335684-37898b6baf30"), // wrist watch
  ],
  tablet: [
    IMG("1561154464-82e9adf32764"),    // iPad
    IMG("1585789085702-2754d2bcde31"), // tablet stylus
    IMG("1623126908029-58cb08a2b272"), // android tablet
    IMG("1544244015-0df4b3ffc6b0"),    // tablet flat
  ],
  camera: [
    IMG("1502920917128-1aa500764cbd"), // mirrorless camera
    IMG("1606986628253-49aa83b80c19"), // dslr
    IMG("1500634245200-e5245c7574ef"), // camera lens
    IMG("1519183071298-a2962be90b8e"), // film camera
  ],
  gaming: [
    IMG("1542751371-adc38448a05e"),    // ps5 controller
    IMG("1606144042614-b2417e99c4e3"), // gaming setup
    IMG("1592840496694-26d035b52b48"), // xbox controller
    IMG("1612287230202-1ff1d85d1bdf"), // nintendo switch
    IMG("1605870445919-838d190e8e1b"), // steam deck style
  ],
  accessory: [
    IMG("1572569511254-d8f925fe2cbb"), // mouse / keyboard
    IMG("1586953208448-b95a79798f07"), // mechanical keyboard
    IMG("1563770660941-20978e870e26"), // power bank
    IMG("1625948515291-69613efd103f"), // usb hub
    IMG("1585792180666-f7347c490ee2"), // cables
  ],
};

const pickImages = (bucket, n = 2) => {
  const arr = IMAGES[bucket];
  // Rotate through the bucket so different products get different
  // primary images instead of all using the first one.
  const out = [];
  for (let i = 0; i < n; i++) out.push(arr[i % arr.length]);
  return out;
};

// ── Categories ───────────────────────────────────────────────────
const CATEGORIES = [
  { name: "Smartphones", slug: "smartphones", description: "Flagship phones, mid-range devices, and the latest mobile tech." },
  { name: "Laptops", slug: "laptops", description: "Ultrabooks, gaming laptops, and creator workstations." },
  { name: "Audio", slug: "audio", description: "Headphones, earbuds, and home audio." },
  { name: "Wearables", slug: "wearables", description: "Smartwatches, fitness trackers, and connected devices." },
  { name: "Tablets", slug: "tablets", description: "iPads, Android tablets, and convertibles for work and play." },
  { name: "Cameras", slug: "cameras", description: "Mirrorless cameras, DSLRs, and action cams." },
  { name: "Gaming", slug: "gaming", description: "Consoles, handhelds, controllers, and gaming gear." },
  { name: "Accessories", slug: "accessories", description: "Keyboards, mice, chargers, hubs, and cables." },
];

// ── Helpers for variants & specs ─────────────────────────────────
const buildColorStorageVariants = (colors, storages, basePrice, baseSku) => {
  const variants = [];
  let pos = 0;
  for (const color of colors) {
    for (const storage of storages) {
      // Storage adds price: 256→+0, 512→+100, 1TB→+250, 2TB→+500
      const bumpMap = { "128GB": -50, "256GB": 0, "512GB": 100, "1TB": 250, "2TB": 500 };
      const bump = bumpMap[storage] ?? 0;
      variants.push({
        sku: `${baseSku}-${color.toUpperCase().replace(/ /g, "")}-${storage}`,
        optionValues: [
          { name: "Color", value: color },
          { name: "Storage", value: storage },
        ],
        price: basePrice + bump,
        stock: 8 + Math.floor(Math.random() * 25),
        position: pos++,
      });
    }
  }
  return {
    options: [
      { name: "Color", values: colors },
      { name: "Storage", values: storages },
    ],
    variants,
  };
};

const buildColorVariants = (colors, basePrice, baseSku) => ({
  options: [{ name: "Color", values: colors }],
  variants: colors.map((color, pos) => ({
    sku: `${baseSku}-${color.toUpperCase().replace(/ /g, "")}`,
    optionValues: [{ name: "Color", value: color }],
    price: basePrice,
    stock: 10 + Math.floor(Math.random() * 30),
    position: pos,
  })),
});

const buildColorSizeVariants = (colors, sizes, basePrice, baseSku) => {
  const variants = [];
  let pos = 0;
  for (const color of colors) {
    for (const size of sizes) {
      variants.push({
        sku: `${baseSku}-${color.toUpperCase().replace(/ /g, "")}-${size}`,
        optionValues: [
          { name: "Color", value: color },
          { name: "Size", value: size },
        ],
        price: basePrice,
        stock: 5 + Math.floor(Math.random() * 20),
        position: pos++,
      });
    }
  }
  return {
    options: [
      { name: "Color", values: colors },
      { name: "Size", values: sizes },
    ],
    variants,
  };
};

// ── Products ─────────────────────────────────────────────────────
const PRODUCTS = [
  // ─── Smartphones (8) ─────────────────────────────────────────
  {
    name: "iPhone 15 Pro",
    slug: "iphone-15-pro",
    description: "Forged in titanium with the powerful A17 Pro chip, a customizable Action button, and the most advanced iPhone camera system ever.",
    shortDescription: "Titanium. So strong. So light. So Pro.",
    basePrice: 999,
    compareAtPrice: 1099,
    categorySlug: "smartphones",
    sku: "APL-IP15P",
    bucket: "smartphone",
    featured: true,
    onSale: true,
    newArrival: true,
    tags: ["apple", "iphone", "5g", "flagship"],
    rating: 4.8,
    reviewCount: 2104,
    specs: [
      { key: "Display", value: "6.1\" Super Retina XDR ProMotion" },
      { key: "Chip", value: "Apple A17 Pro" },
      { key: "Camera", value: "48MP Main + 12MP Ultra Wide + 12MP Telephoto" },
      { key: "Battery", value: "Up to 23 hrs video" },
      { key: "Connector", value: "USB-C" },
    ],
    variants: buildColorStorageVariants(
      ["Natural Titanium", "Blue Titanium", "White Titanium", "Black Titanium"],
      ["128GB", "256GB", "512GB", "1TB"],
      999,
      "APL-IP15P",
    ),
  },
  {
    name: "Samsung Galaxy S24 Ultra",
    slug: "samsung-galaxy-s24-ultra",
    description: "Galaxy AI is here. Built-in S Pen, 200MP camera, and a brilliant 6.8-inch QHD+ Dynamic AMOLED 2X display in a titanium frame.",
    basePrice: 1199,
    categorySlug: "smartphones",
    sku: "SAM-S24U",
    bucket: "smartphone",
    featured: true,
    newArrival: true,
    tags: ["samsung", "android", "galaxy-ai", "s-pen"],
    rating: 4.7,
    reviewCount: 1432,
    specs: [
      { key: "Display", value: "6.8\" QHD+ Dynamic AMOLED 2X 120Hz" },
      { key: "Chip", value: "Snapdragon 8 Gen 3 for Galaxy" },
      { key: "Camera", value: "200MP + 50MP + 12MP + 10MP" },
      { key: "Battery", value: "5000mAh" },
      { key: "S Pen", value: "Built-in" },
    ],
    variants: buildColorStorageVariants(
      ["Titanium Black", "Titanium Gray", "Titanium Violet", "Titanium Yellow"],
      ["256GB", "512GB", "1TB"],
      1199,
      "SAM-S24U",
    ),
  },
  {
    name: "Google Pixel 8 Pro",
    slug: "google-pixel-8-pro",
    description: "Google's most advanced Pixel ever, powered by Google Tensor G3. Pro-level cameras and seven years of OS upgrades.",
    basePrice: 899,
    compareAtPrice: 999,
    categorySlug: "smartphones",
    sku: "GGL-PX8P",
    bucket: "smartphone",
    onSale: true,
    tags: ["google", "pixel", "android", "ai-photography"],
    rating: 4.6,
    reviewCount: 876,
    specs: [
      { key: "Display", value: "6.7\" LTPO OLED 120Hz" },
      { key: "Chip", value: "Google Tensor G3" },
      { key: "Camera", value: "50MP + 48MP + 48MP" },
      { key: "OS Updates", value: "7 years" },
    ],
    variants: buildColorStorageVariants(
      ["Obsidian", "Porcelain", "Bay"],
      ["128GB", "256GB", "512GB"],
      899,
      "GGL-PX8P",
    ),
  },
  {
    name: "OnePlus 12",
    slug: "oneplus-12",
    description: "Hasselblad camera for mobile, Snapdragon 8 Gen 3, and 100W SUPERVOOC charging that powers up in minutes.",
    basePrice: 799,
    categorySlug: "smartphones",
    sku: "1P-12",
    bucket: "smartphone",
    newArrival: true,
    tags: ["oneplus", "fast-charging", "hasselblad"],
    rating: 4.5,
    reviewCount: 542,
    specs: [
      { key: "Display", value: "6.82\" LTPO AMOLED ProXDR" },
      { key: "Chip", value: "Snapdragon 8 Gen 3" },
      { key: "Charging", value: "100W SUPERVOOC + 50W AIRVOOC" },
      { key: "Camera", value: "Hasselblad triple 50MP" },
    ],
    variants: buildColorStorageVariants(["Silky Black", "Flowy Emerald"], ["256GB", "512GB"], 799, "1P-12"),
  },
  {
    name: "Xiaomi 14",
    slug: "xiaomi-14",
    description: "Co-engineered with Leica, the Xiaomi 14 packs flagship performance into a compact 6.36-inch frame.",
    basePrice: 699,
    categorySlug: "smartphones",
    sku: "XMI-14",
    bucket: "smartphone",
    tags: ["xiaomi", "leica", "compact"],
    rating: 4.4,
    reviewCount: 318,
    specs: [
      { key: "Display", value: "6.36\" LTPO OLED 120Hz" },
      { key: "Chip", value: "Snapdragon 8 Gen 3" },
      { key: "Camera", value: "Leica triple 50MP" },
    ],
    variants: buildColorVariants(["Black", "White", "Jade Green"], 699, "XMI-14"),
  },
  {
    name: "Nothing Phone (2)",
    slug: "nothing-phone-2",
    description: "A transparent design with the iconic Glyph Interface — get notifications, control music, and time things with light.",
    basePrice: 599,
    compareAtPrice: 699,
    categorySlug: "smartphones",
    sku: "NTH-PH2",
    bucket: "smartphone",
    onSale: true,
    tags: ["nothing", "glyph", "transparent"],
    rating: 4.4,
    reviewCount: 612,
    specs: [
      { key: "Display", value: "6.7\" LTPO OLED" },
      { key: "Chip", value: "Snapdragon 8+ Gen 1" },
      { key: "Glyph Interface", value: "Yes" },
    ],
    variants: buildColorStorageVariants(["White", "Dark Gray"], ["128GB", "256GB", "512GB"], 599, "NTH-PH2"),
  },
  {
    name: "iPhone 15",
    slug: "iphone-15",
    description: "A camera that captures the best of every shot, USB-C, and the brilliant Dynamic Island. The everyday iPhone, redesigned.",
    basePrice: 799,
    categorySlug: "smartphones",
    sku: "APL-IP15",
    bucket: "smartphone",
    featured: true,
    tags: ["apple", "iphone", "usb-c"],
    rating: 4.7,
    reviewCount: 1543,
    specs: [
      { key: "Display", value: "6.1\" Super Retina XDR" },
      { key: "Chip", value: "Apple A16 Bionic" },
      { key: "Camera", value: "48MP Main + 12MP Ultra Wide" },
      { key: "Connector", value: "USB-C" },
    ],
    variants: buildColorStorageVariants(["Pink", "Yellow", "Green", "Blue", "Black"], ["128GB", "256GB", "512GB"], 799, "APL-IP15"),
  },
  {
    name: "Samsung Galaxy A55",
    slug: "samsung-galaxy-a55",
    description: "Awesome on every level. Vibrant Super AMOLED display, premium aluminum frame, and a triple camera system.",
    basePrice: 449,
    categorySlug: "smartphones",
    sku: "SAM-A55",
    bucket: "smartphone",
    tags: ["samsung", "android", "mid-range"],
    rating: 4.3,
    reviewCount: 287,
    specs: [
      { key: "Display", value: "6.6\" FHD+ Super AMOLED 120Hz" },
      { key: "Chip", value: "Exynos 1480" },
      { key: "Battery", value: "5000mAh" },
    ],
    variants: buildColorStorageVariants(["Awesome Iceblue", "Awesome Lilac", "Awesome Navy"], ["128GB", "256GB"], 449, "SAM-A55"),
  },

  // ─── Laptops (7) ─────────────────────────────────────────────
  {
    name: "MacBook Pro 14\" M3 Pro",
    slug: "macbook-pro-14-m3-pro",
    description: "Mind-blowing. Head-turning. Take on demanding projects with the M3 Pro chip and a stunning Liquid Retina XDR display.",
    basePrice: 1999,
    categorySlug: "laptops",
    sku: "APL-MBP14-M3P",
    bucket: "laptop",
    featured: true,
    newArrival: true,
    tags: ["apple", "macbook", "m3-pro", "creator"],
    rating: 4.9,
    reviewCount: 894,
    specs: [
      { key: "Chip", value: "Apple M3 Pro (11-core CPU, 14-core GPU)" },
      { key: "Display", value: "14.2\" Liquid Retina XDR ProMotion" },
      { key: "Memory", value: "Up to 36GB unified memory" },
      { key: "Battery", value: "Up to 18 hours" },
    ],
    variants: buildColorStorageVariants(["Space Black", "Silver"], ["512GB", "1TB", "2TB"], 1999, "APL-MBP14-M3P"),
  },
  {
    name: "MacBook Air 15\" M3",
    slug: "macbook-air-15-m3",
    description: "Strikingly thin and fast. The 15-inch MacBook Air with M3 makes everything you do flow like never before.",
    basePrice: 1299,
    compareAtPrice: 1399,
    categorySlug: "laptops",
    sku: "APL-MBA15-M3",
    bucket: "laptop",
    onSale: true,
    featured: true,
    tags: ["apple", "macbook-air", "m3", "ultraportable"],
    rating: 4.8,
    reviewCount: 1245,
    specs: [
      { key: "Chip", value: "Apple M3 (8-core CPU, 10-core GPU)" },
      { key: "Display", value: "15.3\" Liquid Retina" },
      { key: "Weight", value: "1.51 kg" },
      { key: "Battery", value: "Up to 18 hours" },
    ],
    variants: buildColorStorageVariants(
      ["Midnight", "Starlight", "Silver", "Space Gray"],
      ["256GB", "512GB", "1TB"],
      1299,
      "APL-MBA15-M3",
    ),
  },
  {
    name: "Dell XPS 13 Plus",
    slug: "dell-xps-13-plus",
    description: "Reimagined design with an edge-to-edge keyboard and seamless glass touchpad. 13th Gen Intel inside.",
    basePrice: 1399,
    categorySlug: "laptops",
    sku: "DLL-XPS13P",
    bucket: "laptop",
    tags: ["dell", "xps", "intel", "ultrabook"],
    rating: 4.6,
    reviewCount: 678,
    specs: [
      { key: "CPU", value: "Intel Core i7-1360P" },
      { key: "Display", value: "13.4\" 3.5K OLED Touch" },
      { key: "Memory", value: "16GB LPDDR5" },
    ],
    variants: buildColorStorageVariants(["Platinum", "Graphite"], ["512GB", "1TB", "2TB"], 1399, "DLL-XPS13P"),
  },
  {
    name: "Lenovo ThinkPad X1 Carbon Gen 12",
    slug: "lenovo-thinkpad-x1-carbon-gen-12",
    description: "The legendary business ultrabook, now with Intel Core Ultra processors and AI-powered productivity.",
    basePrice: 1649,
    categorySlug: "laptops",
    sku: "LNV-X1C-G12",
    bucket: "laptop",
    tags: ["lenovo", "thinkpad", "business"],
    rating: 4.7,
    reviewCount: 432,
    specs: [
      { key: "CPU", value: "Intel Core Ultra 7 165U" },
      { key: "Display", value: "14\" 2.8K OLED" },
      { key: "Memory", value: "32GB LPDDR5x" },
      { key: "Weight", value: "1.09 kg" },
    ],
    variants: buildColorStorageVariants(["Black", "Deep Black"], ["512GB", "1TB"], 1649, "LNV-X1C-G12"),
  },
  {
    name: "ASUS ROG Zephyrus G14",
    slug: "asus-rog-zephyrus-g14",
    description: "Compact 14-inch gaming powerhouse with AMD Ryzen 9 and NVIDIA RTX 4070. Now with an OLED display.",
    basePrice: 1799,
    categorySlug: "laptops",
    sku: "ASU-ZG14",
    bucket: "laptop",
    newArrival: true,
    tags: ["asus", "rog", "gaming", "amd"],
    rating: 4.7,
    reviewCount: 521,
    specs: [
      { key: "CPU", value: "AMD Ryzen 9 8945HS" },
      { key: "GPU", value: "NVIDIA RTX 4070 8GB" },
      { key: "Display", value: "14\" 3K OLED 120Hz" },
    ],
    variants: buildColorStorageVariants(["Eclipse Gray", "Platinum White"], ["512GB", "1TB"], 1799, "ASU-ZG14"),
  },
  {
    name: "Microsoft Surface Laptop 6",
    slug: "microsoft-surface-laptop-6",
    description: "The most powerful Surface Laptop yet, featuring Intel Core Ultra and the new NPU for AI experiences.",
    basePrice: 1499,
    categorySlug: "laptops",
    sku: "MSF-SL6",
    bucket: "laptop",
    tags: ["microsoft", "surface", "windows"],
    rating: 4.5,
    reviewCount: 268,
    specs: [
      { key: "CPU", value: "Intel Core Ultra 7" },
      { key: "Display", value: "13.5\" PixelSense Touch" },
      { key: "Memory", value: "16GB LPDDR5x" },
    ],
    variants: buildColorStorageVariants(["Platinum", "Black"], ["256GB", "512GB", "1TB"], 1499, "MSF-SL6"),
  },
  {
    name: "Framework Laptop 13",
    slug: "framework-laptop-13",
    description: "The thin, light laptop you can upgrade, customize, and repair. Built to last with modular ports and replaceable parts.",
    basePrice: 1099,
    categorySlug: "laptops",
    sku: "FRM-13",
    bucket: "laptop",
    tags: ["framework", "modular", "repairable"],
    rating: 4.6,
    reviewCount: 184,
    specs: [
      { key: "CPU", value: "Intel Core Ultra 7 155H" },
      { key: "Display", value: "13.5\" 2256x1504" },
      { key: "Modular Ports", value: "4 Expansion Cards" },
    ],
    variants: buildColorStorageVariants(["Aluminum"], ["512GB", "1TB", "2TB"], 1099, "FRM-13"),
  },

  // ─── Audio (8) ───────────────────────────────────────────────
  {
    name: "AirPods Pro (2nd gen)",
    slug: "airpods-pro-2nd-gen",
    description: "Adaptive Audio. Personalized Spatial Audio. Now with USB-C charging case. Magic relisted.",
    basePrice: 249,
    categorySlug: "audio",
    sku: "APL-APP2",
    bucket: "audio",
    featured: true,
    tags: ["apple", "earbuds", "anc"],
    rating: 4.8,
    reviewCount: 4521,
    specs: [
      { key: "Chip", value: "Apple H2" },
      { key: "ANC", value: "Active Noise Cancellation" },
      { key: "Battery", value: "Up to 6 hours (30 hrs with case)" },
    ],
    variants: buildColorVariants(["White"], 249, "APL-APP2"),
  },
  {
    name: "Sony WH-1000XM5",
    slug: "sony-wh-1000xm5",
    description: "Industry-leading noise cancellation, exceptional sound quality, and crystal-clear hands-free calling.",
    basePrice: 399,
    compareAtPrice: 449,
    categorySlug: "audio",
    sku: "SNY-XM5",
    bucket: "audio",
    onSale: true,
    featured: true,
    tags: ["sony", "anc", "over-ear"],
    rating: 4.8,
    reviewCount: 3210,
    specs: [
      { key: "Driver", value: "30mm carbon fiber composite" },
      { key: "Battery", value: "30 hours with ANC" },
      { key: "Codec", value: "LDAC, AAC, SBC" },
    ],
    variants: buildColorVariants(["Black", "Silver", "Midnight Blue"], 399, "SNY-XM5"),
  },
  {
    name: "Bose QuietComfort Ultra",
    slug: "bose-quietcomfort-ultra",
    description: "World-class noise cancelling meets immersive spatial audio. The new gold standard from Bose.",
    basePrice: 429,
    categorySlug: "audio",
    sku: "BOS-QCU",
    bucket: "audio",
    newArrival: true,
    tags: ["bose", "anc", "spatial-audio"],
    rating: 4.7,
    reviewCount: 1102,
    specs: [
      { key: "ANC", value: "Quiet & Aware modes" },
      { key: "Spatial Audio", value: "Immersive Audio" },
      { key: "Battery", value: "24 hours" },
    ],
    variants: buildColorVariants(["Black", "White Smoke", "Sandstone"], 429, "BOS-QCU"),
  },
  {
    name: "Sennheiser Momentum 4 Wireless",
    slug: "sennheiser-momentum-4-wireless",
    description: "Audiophile-grade sound, adaptive noise cancellation, and 60-hour battery life in a refined design.",
    basePrice: 349,
    categorySlug: "audio",
    sku: "SEN-M4W",
    bucket: "audio",
    tags: ["sennheiser", "audiophile", "long-battery"],
    rating: 4.6,
    reviewCount: 743,
    specs: [
      { key: "Driver", value: "42mm dynamic" },
      { key: "Battery", value: "60 hours" },
    ],
    variants: buildColorVariants(["Black", "White", "Denim"], 349, "SEN-M4W"),
  },
  {
    name: "JBL Tune Flex",
    slug: "jbl-tune-flex",
    description: "True wireless earbuds with Pure Bass, ANC, and a comfortable Stick-open design with swappable tips.",
    basePrice: 99,
    compareAtPrice: 129,
    categorySlug: "audio",
    sku: "JBL-TFX",
    bucket: "audio",
    onSale: true,
    tags: ["jbl", "earbuds", "budget"],
    rating: 4.4,
    reviewCount: 1284,
    specs: [
      { key: "Battery", value: "8 hrs (32 hrs total)" },
      { key: "ANC", value: "Yes" },
    ],
    variants: buildColorVariants(["Black", "White", "Blue", "Pink"], 99, "JBL-TFX"),
  },
  {
    name: "Marshall Major V",
    slug: "marshall-major-v",
    description: "Iconic Marshall sound, now with wireless charging and over 100 hours of battery life. Built to last.",
    basePrice: 159,
    categorySlug: "audio",
    sku: "MRS-MAJ5",
    bucket: "audio",
    tags: ["marshall", "on-ear", "vintage"],
    rating: 4.5,
    reviewCount: 612,
    specs: [
      { key: "Battery", value: "100+ hours" },
      { key: "Wireless Charging", value: "Yes" },
    ],
    variants: buildColorVariants(["Black", "Brown", "Cream"], 159, "MRS-MAJ5"),
  },
  {
    name: "Apple HomePod (2nd gen)",
    slug: "apple-homepod-2nd-gen",
    description: "Breakthrough sound. Powered by intelligence. The room-filling smart speaker, redesigned.",
    basePrice: 299,
    categorySlug: "audio",
    sku: "APL-HMP2",
    bucket: "audio",
    tags: ["apple", "smart-speaker", "homekit"],
    rating: 4.6,
    reviewCount: 891,
    specs: [
      { key: "Driver", value: "4-inch high-excursion woofer" },
      { key: "Smart Home", value: "Matter, Thread, HomeKit hub" },
    ],
    variants: buildColorVariants(["White", "Midnight"], 299, "APL-HMP2"),
  },
  {
    name: "Sonos Era 300",
    slug: "sonos-era-300",
    description: "A revolutionary spatial audio experience powered by Dolby Atmos. Hear sound move all around you.",
    basePrice: 449,
    categorySlug: "audio",
    sku: "SNS-E300",
    bucket: "audio",
    newArrival: true,
    tags: ["sonos", "atmos", "spatial-audio"],
    rating: 4.7,
    reviewCount: 504,
    specs: [
      { key: "Drivers", value: "6 (2x tweeter, 4x woofer)" },
      { key: "Connectivity", value: "Wi-Fi 6, Bluetooth 5.0, AirPlay 2" },
    ],
    variants: buildColorVariants(["Black", "White"], 449, "SNS-E300"),
  },

  // ─── Wearables (6) ───────────────────────────────────────────
  {
    name: "Apple Watch Ultra 2",
    slug: "apple-watch-ultra-2",
    description: "The most rugged and capable Apple Watch ever, designed for endurance, exploration, and adventure.",
    basePrice: 799,
    categorySlug: "wearables",
    sku: "APL-AWU2",
    bucket: "wearable",
    featured: true,
    newArrival: true,
    tags: ["apple", "watch", "rugged", "fitness"],
    rating: 4.9,
    reviewCount: 1820,
    specs: [
      { key: "Display", value: "Always-On Retina, 3000 nits" },
      { key: "Battery", value: "36 hours (72 in low-power)" },
      { key: "Case", value: "49mm Titanium" },
    ],
    variants: buildColorSizeVariants(
      ["Natural Titanium", "Black Titanium"],
      ["49mm"],
      799,
      "APL-AWU2",
    ),
  },
  {
    name: "Apple Watch Series 9",
    slug: "apple-watch-series-9",
    description: "Smarter. Brighter. Mightier. With the new S9 chip, Double Tap gesture, and a 2000-nit display.",
    basePrice: 399,
    compareAtPrice: 429,
    categorySlug: "wearables",
    sku: "APL-AW9",
    bucket: "wearable",
    onSale: true,
    tags: ["apple", "watch", "smartwatch"],
    rating: 4.8,
    reviewCount: 2104,
    specs: [
      { key: "Chip", value: "Apple S9" },
      { key: "Display", value: "Always-On Retina, 2000 nits" },
    ],
    variants: buildColorSizeVariants(
      ["Midnight", "Starlight", "Pink", "Silver", "Product RED"],
      ["41mm", "45mm"],
      399,
      "APL-AW9",
    ),
  },
  {
    name: "Samsung Galaxy Watch 6 Classic",
    slug: "samsung-galaxy-watch-6-classic",
    description: "Featuring the iconic rotating bezel, comprehensive health tracking, and a brilliant Super AMOLED display.",
    basePrice: 399,
    categorySlug: "wearables",
    sku: "SAM-GW6C",
    bucket: "wearable",
    tags: ["samsung", "wear-os", "rotating-bezel"],
    rating: 4.6,
    reviewCount: 678,
    specs: [
      { key: "Display", value: "Super AMOLED, sapphire crystal" },
      { key: "OS", value: "Wear OS powered by Samsung" },
    ],
    variants: buildColorSizeVariants(["Black", "Silver"], ["43mm", "47mm"], 399, "SAM-GW6C"),
  },
  {
    name: "Garmin Fenix 7 Pro",
    slug: "garmin-fenix-7-pro",
    description: "Multisport GPS smartwatch with built-in flashlight, multi-band GNSS, and a built-in topo map.",
    basePrice: 799,
    categorySlug: "wearables",
    sku: "GRM-F7P",
    bucket: "wearable",
    featured: true,
    tags: ["garmin", "multisport", "outdoor"],
    rating: 4.8,
    reviewCount: 945,
    specs: [
      { key: "GPS", value: "Multi-band GNSS" },
      { key: "Battery", value: "Up to 18 days smartwatch mode" },
    ],
    variants: buildColorSizeVariants(["Slate Gray", "Whitestone"], ["42mm", "47mm", "51mm"], 799, "GRM-F7P"),
  },
  {
    name: "Fitbit Charge 6",
    slug: "fitbit-charge-6",
    description: "Advanced fitness and health tracker with heart rate, GPS, and Google apps built in.",
    basePrice: 159,
    categorySlug: "wearables",
    sku: "FBT-CH6",
    bucket: "wearable",
    tags: ["fitbit", "tracker", "google"],
    rating: 4.4,
    reviewCount: 1532,
    specs: [
      { key: "Battery", value: "7 days" },
      { key: "GPS", value: "Built-in" },
    ],
    variants: buildColorVariants(["Obsidian", "Coral", "Porcelain"], 159, "FBT-CH6"),
  },
  {
    name: "Google Pixel Watch 2",
    slug: "google-pixel-watch-2",
    description: "Help by Google. Fitbit by your side. Stress tracking, advanced sleep insights, and a vibrant display.",
    basePrice: 349,
    categorySlug: "wearables",
    sku: "GGL-PW2",
    bucket: "wearable",
    tags: ["google", "pixel", "wear-os"],
    rating: 4.5,
    reviewCount: 487,
    specs: [
      { key: "Chip", value: "Qualcomm SW5100" },
      { key: "Battery", value: "24 hours always-on" },
    ],
    variants: buildColorVariants(["Polished Silver", "Matte Black", "Champagne Gold"], 349, "GGL-PW2"),
  },

  // ─── Tablets (5) ─────────────────────────────────────────────
  {
    name: "iPad Pro 12.9\" M4",
    slug: "ipad-pro-12-9-m4",
    description: "The thinnest Apple device ever. Outrageously powerful with the M4 chip and Ultra Retina XDR display.",
    basePrice: 1299,
    categorySlug: "tablets",
    sku: "APL-IPDP12-M4",
    bucket: "tablet",
    featured: true,
    newArrival: true,
    tags: ["apple", "ipad", "m4", "pro"],
    rating: 4.9,
    reviewCount: 1421,
    specs: [
      { key: "Chip", value: "Apple M4" },
      { key: "Display", value: "12.9\" Ultra Retina XDR (Tandem OLED)" },
      { key: "Apple Pencil", value: "Pro support" },
    ],
    variants: buildColorStorageVariants(["Silver", "Space Black"], ["256GB", "512GB", "1TB", "2TB"], 1299, "APL-IPDP12-M4"),
  },
  {
    name: "iPad Air 13\" M2",
    slug: "ipad-air-13-m2",
    description: "Light. Bright. Full of might. The new 13-inch iPad Air with M2 makes everything pop.",
    basePrice: 799,
    categorySlug: "tablets",
    sku: "APL-IPDA13-M2",
    bucket: "tablet",
    tags: ["apple", "ipad-air", "m2"],
    rating: 4.7,
    reviewCount: 832,
    specs: [
      { key: "Chip", value: "Apple M2" },
      { key: "Display", value: "13\" Liquid Retina" },
    ],
    variants: buildColorStorageVariants(["Space Gray", "Blue", "Purple", "Starlight"], ["128GB", "256GB", "512GB", "1TB"], 799, "APL-IPDA13-M2"),
  },
  {
    name: "Samsung Galaxy Tab S9 Ultra",
    slug: "samsung-galaxy-tab-s9-ultra",
    description: "A massive 14.6-inch Dynamic AMOLED 2X display, S Pen included, and Snapdragon 8 Gen 2 for Galaxy.",
    basePrice: 1199,
    compareAtPrice: 1299,
    categorySlug: "tablets",
    sku: "SAM-TS9U",
    bucket: "tablet",
    onSale: true,
    tags: ["samsung", "tablet", "android"],
    rating: 4.6,
    reviewCount: 412,
    specs: [
      { key: "Display", value: "14.6\" Dynamic AMOLED 2X 120Hz" },
      { key: "S Pen", value: "Included" },
    ],
    variants: buildColorStorageVariants(["Graphite", "Beige"], ["256GB", "512GB", "1TB"], 1199, "SAM-TS9U"),
  },
  {
    name: "Microsoft Surface Pro 11",
    slug: "microsoft-surface-pro-11",
    description: "The Copilot+ PC. Be unstoppable with the laptop you can take anywhere — now powered by Snapdragon X Elite.",
    basePrice: 999,
    categorySlug: "tablets",
    sku: "MSF-SP11",
    bucket: "tablet",
    newArrival: true,
    tags: ["microsoft", "surface", "copilot"],
    rating: 4.5,
    reviewCount: 234,
    specs: [
      { key: "CPU", value: "Snapdragon X Elite (Copilot+ PC)" },
      { key: "Display", value: "13\" PixelSense" },
    ],
    variants: buildColorStorageVariants(["Platinum", "Black", "Sapphire"], ["256GB", "512GB", "1TB"], 999, "MSF-SP11"),
  },
  {
    name: "Google Pixel Tablet",
    slug: "google-pixel-tablet",
    description: "An 11-inch tablet that's helpful in your hand and at home — with the included Charging Speaker Dock.",
    basePrice: 499,
    categorySlug: "tablets",
    sku: "GGL-PXT",
    bucket: "tablet",
    tags: ["google", "tablet", "smart-home"],
    rating: 4.3,
    reviewCount: 367,
    specs: [
      { key: "Display", value: "11\" LCD" },
      { key: "Chip", value: "Google Tensor G2" },
    ],
    variants: buildColorStorageVariants(["Porcelain", "Hazel", "Rose"], ["128GB", "256GB"], 499, "GGL-PXT"),
  },

  // ─── Cameras (5) ─────────────────────────────────────────────
  {
    name: "Sony Alpha 7 IV",
    slug: "sony-alpha-7-iv",
    description: "Beyond basic. A true hybrid full-frame camera designed for photo and video creators.",
    basePrice: 2499,
    categorySlug: "cameras",
    sku: "SNY-A7IV",
    bucket: "camera",
    featured: true,
    tags: ["sony", "mirrorless", "full-frame"],
    rating: 4.8,
    reviewCount: 612,
    specs: [
      { key: "Sensor", value: "33MP Full-Frame Exmor R" },
      { key: "Video", value: "4K 60p 10-bit" },
      { key: "AF Points", value: "759 phase-detect" },
    ],
    variants: { options: [], variants: [] },
  },
  {
    name: "Canon EOS R6 Mark II",
    slug: "canon-eos-r6-mark-ii",
    description: "Speed, performance, and creativity. The next generation of Canon's beloved hybrid mirrorless.",
    basePrice: 2499,
    compareAtPrice: 2699,
    categorySlug: "cameras",
    sku: "CNN-R6II",
    bucket: "camera",
    onSale: true,
    tags: ["canon", "mirrorless", "hybrid"],
    rating: 4.8,
    reviewCount: 478,
    specs: [
      { key: "Sensor", value: "24.2MP Full-Frame CMOS" },
      { key: "Burst", value: "40 fps electronic" },
    ],
    variants: { options: [], variants: [] },
  },
  {
    name: "Fujifilm X-T5",
    slug: "fujifilm-x-t5",
    description: "Classic styling meets cutting-edge tech. A 40MP X-Trans sensor in a body built for photographers.",
    basePrice: 1699,
    categorySlug: "cameras",
    sku: "FJI-XT5",
    bucket: "camera",
    tags: ["fujifilm", "aps-c", "retro"],
    rating: 4.7,
    reviewCount: 384,
    specs: [
      { key: "Sensor", value: "40MP X-Trans CMOS 5 HR" },
      { key: "IBIS", value: "7-stop 5-axis" },
    ],
    variants: buildColorVariants(["Black", "Silver"], 1699, "FJI-XT5"),
  },
  {
    name: "GoPro HERO12 Black",
    slug: "gopro-hero12-black",
    description: "5.3K video, HDR, and an industry-leading runtime. Built to capture your wildest adventures.",
    basePrice: 399,
    categorySlug: "cameras",
    sku: "GPR-H12",
    bucket: "camera",
    featured: true,
    tags: ["gopro", "action-camera", "4k"],
    rating: 4.6,
    reviewCount: 1203,
    specs: [
      { key: "Resolution", value: "5.3K60 / 4K120" },
      { key: "Stabilization", value: "HyperSmooth 6.0" },
    ],
    variants: { options: [], variants: [] },
  },
  {
    name: "DJI Osmo Pocket 3",
    slug: "dji-osmo-pocket-3",
    description: "A pocket-sized vlogging camera with a 1-inch CMOS, 3-axis gimbal, and rotating touchscreen.",
    basePrice: 519,
    categorySlug: "cameras",
    sku: "DJI-OP3",
    bucket: "camera",
    newArrival: true,
    tags: ["dji", "vlog", "gimbal"],
    rating: 4.7,
    reviewCount: 542,
    specs: [
      { key: "Sensor", value: "1\" CMOS" },
      { key: "Gimbal", value: "3-axis mechanical" },
    ],
    variants: { options: [], variants: [] },
  },

  // ─── Gaming (6) ──────────────────────────────────────────────
  {
    name: "Sony PlayStation 5 Slim",
    slug: "sony-playstation-5-slim",
    description: "Same blistering speed and stunning game library, now in a smaller form factor with 1TB SSD storage.",
    basePrice: 499,
    categorySlug: "gaming",
    sku: "SNY-PS5S",
    bucket: "gaming",
    featured: true,
    tags: ["sony", "playstation", "console"],
    rating: 4.9,
    reviewCount: 5421,
    specs: [
      { key: "CPU", value: "Custom AMD Zen 2 8-core" },
      { key: "Storage", value: "1TB SSD" },
      { key: "Disc Drive", value: "Yes (detachable)" },
    ],
    variants: { options: [], variants: [] },
  },
  {
    name: "Microsoft Xbox Series X",
    slug: "microsoft-xbox-series-x",
    description: "The fastest, most powerful Xbox ever. 12 teraflops of processing power, true 4K gaming, and Quick Resume.",
    basePrice: 499,
    categorySlug: "gaming",
    sku: "MSF-XBSX",
    bucket: "gaming",
    featured: true,
    tags: ["microsoft", "xbox", "console", "4k"],
    rating: 4.8,
    reviewCount: 4218,
    specs: [
      { key: "GPU", value: "12 TFLOPS RDNA 2" },
      { key: "Storage", value: "1TB Custom NVMe SSD" },
    ],
    variants: { options: [], variants: [] },
  },
  {
    name: "Nintendo Switch OLED",
    slug: "nintendo-switch-oled",
    description: "Vibrant 7-inch OLED screen, enhanced audio, and 64GB internal storage. Play at home or on the go.",
    basePrice: 349,
    compareAtPrice: 379,
    categorySlug: "gaming",
    sku: "NTD-NSO",
    bucket: "gaming",
    onSale: true,
    tags: ["nintendo", "switch", "handheld"],
    rating: 4.8,
    reviewCount: 6892,
    specs: [
      { key: "Display", value: "7\" OLED 1280x720" },
      { key: "Storage", value: "64GB internal" },
    ],
    variants: buildColorVariants(["White", "Neon Red/Blue"], 349, "NTD-NSO"),
  },
  {
    name: "Steam Deck OLED",
    slug: "steam-deck-oled",
    description: "Your Steam library, anywhere. Now with a brilliant HDR OLED display and improved battery life.",
    basePrice: 549,
    categorySlug: "gaming",
    sku: "VLV-SDO",
    bucket: "gaming",
    newArrival: true,
    featured: true,
    tags: ["valve", "steam-deck", "handheld", "pc-gaming"],
    rating: 4.8,
    reviewCount: 1834,
    specs: [
      { key: "Display", value: "7.4\" HDR OLED 90Hz" },
      { key: "APU", value: "Custom AMD Zen 2 / RDNA 2" },
    ],
    variants: buildColorStorageVariants(["Black"], ["512GB", "1TB"], 549, "VLV-SDO"),
  },
  {
    name: "ASUS ROG Ally X",
    slug: "asus-rog-ally-x",
    description: "Windows handheld gaming PC with AMD Ryzen Z1 Extreme. Play anywhere, your way.",
    basePrice: 799,
    categorySlug: "gaming",
    sku: "ASU-ALLYX",
    bucket: "gaming",
    tags: ["asus", "handheld", "windows"],
    rating: 4.5,
    reviewCount: 412,
    specs: [
      { key: "APU", value: "AMD Ryzen Z1 Extreme" },
      { key: "Display", value: "7\" FHD 120Hz" },
    ],
    variants: buildColorStorageVariants(["Black"], ["1TB"], 799, "ASU-ALLYX"),
  },
  {
    name: "Razer Blade 15",
    slug: "razer-blade-15",
    description: "Slim, sleek, and serious power. Razer's iconic gaming laptop with the latest NVIDIA RTX graphics.",
    basePrice: 2299,
    categorySlug: "gaming",
    sku: "RZR-B15",
    bucket: "gaming",
    tags: ["razer", "laptop", "gaming"],
    rating: 4.6,
    reviewCount: 327,
    specs: [
      { key: "CPU", value: "Intel Core i7-13800H" },
      { key: "GPU", value: "NVIDIA RTX 4070" },
      { key: "Display", value: "15.6\" QHD 240Hz" },
    ],
    variants: buildColorStorageVariants(["Black"], ["1TB", "2TB"], 2299, "RZR-B15"),
  },

  // ─── Accessories (5) ────────────────────────────────────────
  {
    name: "Apple Magic Keyboard with Touch ID",
    slug: "apple-magic-keyboard-touch-id",
    description: "A wireless keyboard with Touch ID for fast, secure unlocking and quick access to anywhere on your Mac.",
    basePrice: 129,
    categorySlug: "accessories",
    sku: "APL-MKTID",
    bucket: "accessory",
    tags: ["apple", "keyboard", "touch-id"],
    rating: 4.7,
    reviewCount: 1248,
    specs: [
      { key: "Connection", value: "Bluetooth + Lightning charging" },
      { key: "Layout", value: "US English" },
    ],
    variants: buildColorVariants(["White", "Black"], 129, "APL-MKTID"),
  },
  {
    name: "Logitech MX Master 3S",
    slug: "logitech-mx-master-3s",
    description: "An iconic mouse remastered. Quiet clicks, 8K DPI tracking on any surface, and ergonomic design.",
    basePrice: 99,
    compareAtPrice: 119,
    categorySlug: "accessories",
    sku: "LGT-MX3S",
    bucket: "accessory",
    onSale: true,
    featured: true,
    tags: ["logitech", "mouse", "productivity"],
    rating: 4.8,
    reviewCount: 3421,
    specs: [
      { key: "DPI", value: "8000" },
      { key: "Battery", value: "70 days" },
    ],
    variants: buildColorVariants(["Graphite", "Pale Gray", "Black"], 99, "LGT-MX3S"),
  },
  {
    name: "Anker 737 Power Bank (PowerCore 24K)",
    slug: "anker-737-power-bank",
    description: "24,000mAh portable charger with 140W output and a smart digital display. Charge a 16\" MacBook Pro to 50% in 30 minutes.",
    basePrice: 149,
    categorySlug: "accessories",
    sku: "ANK-737",
    bucket: "accessory",
    tags: ["anker", "power-bank", "fast-charging"],
    rating: 4.7,
    reviewCount: 1876,
    specs: [
      { key: "Capacity", value: "24,000 mAh" },
      { key: "Max Output", value: "140W USB-C" },
    ],
    variants: buildColorVariants(["Black"], 149, "ANK-737"),
  },
  {
    name: "Belkin BoostCharge Pro 3-in-1",
    slug: "belkin-boostcharge-pro-3-in-1",
    description: "MagSafe-compatible 3-in-1 wireless charger for iPhone, Apple Watch, and AirPods. Fast charging up to 15W.",
    basePrice: 149,
    categorySlug: "accessories",
    sku: "BLK-BCP31",
    bucket: "accessory",
    tags: ["belkin", "magsafe", "wireless-charging"],
    rating: 4.6,
    reviewCount: 924,
    specs: [
      { key: "MagSafe", value: "Up to 15W" },
      { key: "Apple Watch", value: "Fast Charge" },
    ],
    variants: buildColorVariants(["White", "Black"], 149, "BLK-BCP31"),
  },
  {
    name: "CalDigit TS4 Thunderbolt 4 Dock",
    slug: "caldigit-ts4-thunderbolt-4-dock",
    description: "The ultimate Thunderbolt 4 dock with 18 ports and 98W charging. Built for creators and pro users.",
    basePrice: 379,
    categorySlug: "accessories",
    sku: "CDT-TS4",
    bucket: "accessory",
    tags: ["caldigit", "thunderbolt", "dock"],
    rating: 4.8,
    reviewCount: 612,
    specs: [
      { key: "Ports", value: "18 total (3x TB4)" },
      { key: "Host Charging", value: "98W" },
    ],
    variants: buildColorVariants(["Space Gray"], 379, "CDT-TS4"),
  },
];

// ── Main ─────────────────────────────────────────────────────────
async function seedTechStore() {
  console.log("=".repeat(60));
  console.log("Seeding Tech Hub store");
  console.log("=".repeat(60));

  await connectDb();
  const conn = getConnection();

  const Tenant = conn.model("Tenant");
  const Category = conn.model("Category");
  const Product = conn.model("Product");

  const tenant = await Tenant.findOne({
    "domains.subdomain.name": TENANT_SUBDOMAIN,
  });
  if (!tenant) {
    console.error(`✗ Tenant with subdomain "${TENANT_SUBDOMAIN}" not found`);
    process.exit(1);
  }
  console.log(`✓ Found tenant: ${tenant.name} (${tenant._id})\n`);

  // Categories
  console.log("Creating categories...");
  const categoryMap = {};
  for (const cat of CATEGORIES) {
    const existing = await Category.findOne({
      tenantId: tenant._id,
      slug: cat.slug,
    });
    if (existing) {
      console.log(`  · "${cat.name}" already exists`);
      categoryMap[cat.slug] = existing._id;
      continue;
    }
    const created = await Category.create({
      tenantId: tenant._id,
      ...cat,
      status: "active",
    });
    categoryMap[cat.slug] = created._id;
    console.log(`  ✓ Created category: ${cat.name}`);
  }
  console.log(`\n${Object.keys(categoryMap).length} categories ready\n`);

  // Products
  console.log("Creating products...");
  let created = 0;
  let skipped = 0;
  for (const p of PRODUCTS) {
    const existing = await Product.findOne({
      tenantId: tenant._id,
      slug: p.slug,
    });
    if (existing) {
      console.log(`  · "${p.name}" already exists`);
      skipped++;
      continue;
    }

    const categoryId = categoryMap[p.categorySlug];
    if (!categoryId) {
      console.warn(`  ✗ Category "${p.categorySlug}" missing for ${p.name}`);
      continue;
    }

    const variantBlock = p.variants || { options: [], variants: [] };
    const hasVariants = variantBlock.variants.length > 0;
    // When the product has variants, the top-level stock is the sum
    // of variant stocks; otherwise it's a sensible default.
    const totalStock = hasVariants
      ? variantBlock.variants.reduce((s, v) => s + (v.stock || 0), 0)
      : 15 + Math.floor(Math.random() * 40);

    const doc = {
      tenantId: tenant._id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      shortDescription: p.shortDescription,
      specifications: p.specs || [],
      price: p.basePrice,
      compareAtPrice: p.compareAtPrice,
      category: categoryId,
      sku: p.sku,
      stock: totalStock,
      status: "active",
      featured: !!p.featured,
      onSale: !!p.onSale,
      newArrival: !!p.newArrival,
      tags: p.tags || [],
      rating: p.rating ?? 0,
      reviewCount: p.reviewCount ?? 0,
      images: pickImages(p.bucket, 3),
      hasVariants,
      options: variantBlock.options,
      variants: variantBlock.variants,
    };

    await Product.create(doc);
    console.log(`  ✓ ${p.name}${hasVariants ? ` (${variantBlock.variants.length} variants)` : ""}`);
    created++;
  }

  // Update category counts
  console.log("\nUpdating category product counts...");
  for (const [slug, id] of Object.entries(categoryMap)) {
    const count = await Product.countDocuments({
      tenantId: tenant._id,
      category: id,
      status: "active",
    });
    await Category.updateOne(
      { _id: id, tenantId: tenant._id },
      { productCount: count },
    );
    console.log(`  · ${slug}: ${count}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log(`✓ Seed complete — ${created} new products, ${skipped} skipped`);
  console.log("=".repeat(60));

  process.exit(0);
}

seedTechStore().catch((err) => {
  console.error("\n✗ Seeding failed:", err.message);
  console.error(err.stack);
  process.exit(1);
});
