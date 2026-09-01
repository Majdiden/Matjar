/**
 * Theme demo data
 * ----------------
 * When a tenant activates/installs a storefront theme we seed a small set of
 * niche-appropriate demo products + categories so the storefront immediately
 * looks populated with content that *matches* the theme (a toy store for
 * `kidsworld`, skincare for `glowing`, etc.) instead of rendering an empty
 * catalog.
 *
 * Everything created here is tagged `isDemo: true` (a boolean added to the
 * Product/Category schemas) so it is:
 *   - findable + removable when the tenant switches themes, and
 *   - distinguishable from real merchant products (we never touch those).
 *
 * Images are Unsplash CDN URLs in the same format the canonical
 * `scripts/seed-tech-store.js` uses. The storefront has a CSP-safe placeholder
 * fallback for any image that fails to load, so a stale/imperfect photo id
 * degrades gracefully rather than breaking the page.
 *
 * Products/categories live in the single shared DB scoped by `tenantId`, so we
 * use the default-connection models exactly like `installThemeService` uses
 * `mongoose.model("Tenant")`.
 */

import mongoose from "mongoose";
import logger from "../utils/logger.js";
import { getThemeManifest } from "./themeManifestRegistry.js";

// Same image-url shape as scripts/seed-tech-store.js.
const IMG = (id) =>
  `https://images.unsplash.com/photo-${id}?w=900&q=80&auto=format&fit=crop`;

// Wider variant for hero/banner artwork — these render full-bleed, so we ask
// Unsplash for a larger source (the storefront still degrades to its gradient
// fallback if the photo id is stale).
const WIDE = (id) =>
  `https://images.unsplash.com/photo-${id}?w=1600&q=80&auto=format&fit=crop`;

/**
 * THEME_DEMO_DATA: theme slug -> { categories: [...], products: [...] }
 *
 * category: { name, slug, description, image? }
 * product:  { name, slug, description, shortDescription?, price, compareAtPrice?,
 *             categorySlug, stock, rating, reviewCount, tags?, featured?,
 *             newArrival?, images: [url] }
 *
 * Slugs/SKUs are namespaced with a `demo-`/`DEMO-` prefix at insert time so
 * they can never collide with a real merchant's own slugs/SKUs.
 */
export const THEME_DEMO_DATA = {
  // ── techhub → electronics (verified Unsplash ids reused from seed-tech-store) ──
  techhub: {
    categories: [
      { name: "Smartphones", slug: "smartphones", description: "Flagship phones and the latest mobile tech.", image: IMG("1592750475338-74b7b21085ab"), ar: { name: "الهواتف الذكية" } },
      { name: "Laptops", slug: "laptops", description: "Ultrabooks, creator machines and everyday notebooks.", image: IMG("1496181133206-80ce9b88a853"), ar: { name: "أجهزة اللابتوب" } },
      { name: "Audio", slug: "audio", description: "Headphones, earbuds and speakers.", image: IMG("1505740420928-5e560c06d30e"), ar: { name: "الصوتيات" } },
      { name: "Wearables", slug: "wearables", description: "Smartwatches and fitness trackers.", image: IMG("1546868871-7041f2a55e12"), ar: { name: "الأجهزة القابلة للارتداء" } },
    ],
    products: [
      { name: "Aurora Pro 5G Smartphone", slug: "aurora-pro-5g", description: "A titanium-framed flagship with a 6.1\" ProMotion display, triple 48MP camera system and all-day battery.", shortDescription: "Titanium. Fast. Pro camera.", price: 999, compareAtPrice: 1099, categorySlug: "smartphones", stock: 40, rating: 4.8, reviewCount: 2104, featured: true, newArrival: true, tags: ["5g", "flagship"], images: [IMG("1592750475338-74b7b21085ab"), IMG("1511707171634-5f897ff02aa9")], ar: { name: "هاتف أورورا برو 5G", description: "هاتف رائد بإطار من التيتانيوم وشاشة 6.1 بوصة بتقنية ProMotion ونظام كاميرا ثلاثي بدقة 48 ميجابكسل وبطارية تدوم طوال اليوم.", shortDescription: "تيتانيوم. سرعة فائقة. كاميرا احترافية." } },
      { name: "Stratus Air 13 Laptop", slug: "stratus-air-13", description: "Strikingly thin 13\" ultrabook with a fanless chip, Liquid-Retina-class panel and 18-hour battery.", price: 1199, categorySlug: "laptops", stock: 25, rating: 4.7, reviewCount: 832, featured: true, tags: ["ultrabook"], images: [IMG("1496181133206-80ce9b88a853"), IMG("1517336714731-489689fd1ca8")], ar: { name: "لابتوب ستراتوس إير 13", description: "لابتوب فائق النحافة بشاشة 13 بوصة، بمعالج يعمل دون مروحة وشاشة فائقة الوضوح وبطارية تدوم 18 ساعة." } },
      { name: "Pulse Pro Wireless Earbuds", slug: "pulse-pro-earbuds", description: "Adaptive active noise cancellation, spatial audio and 30 hours of total playtime in a pocketable case.", price: 249, categorySlug: "audio", stock: 120, rating: 4.8, reviewCount: 4521, featured: true, tags: ["anc", "earbuds"], images: [IMG("1505740420928-5e560c06d30e"), IMG("1583394838336-acd977736f90")], ar: { name: "سماعات بالس برو اللاسلكية", description: "إلغاء ضوضاء نشط متكيف وصوت محيطي و30 ساعة من التشغيل الكامل مع علبة شحن بحجم الجيب." } },
      { name: "Halo Over-Ear Headphones", slug: "halo-over-ear", description: "Industry-leading noise cancellation with plush memory-foam cups and 30-hour battery.", price: 399, compareAtPrice: 449, categorySlug: "audio", stock: 60, rating: 4.8, reviewCount: 3210, tags: ["anc", "over-ear"], images: [IMG("1546435770-a3e426bf472b")], ar: { name: "سماعات هيلو الرأسية", description: "إلغاء ضوضاء رائد في فئته مع وسائد إسفنجية فائقة الراحة وبطارية تدوم 30 ساعة." } },
      { name: "Vita Smartwatch Series 9", slug: "vita-smartwatch-9", description: "Always-on retina display, advanced health sensors and a brighter screen for the outdoors.", price: 399, compareAtPrice: 429, categorySlug: "wearables", stock: 80, rating: 4.8, reviewCount: 2104, newArrival: true, tags: ["smartwatch", "fitness"], images: [IMG("1546868871-7041f2a55e12"), IMG("1579586337278-3befd40fd17a")], ar: { name: "ساعة فيتا الذكية الإصدار 9", description: "شاشة ريتينا تعمل دائمًا ومستشعرات صحية متقدمة وسطوع أعلى يناسب الأجواء الخارجية." } },
      { name: "Nimbus Tab 11", slug: "nimbus-tab-11", description: "An 11\" tablet with a laminated display and all-day battery — perfect for work and play.", price: 599, categorySlug: "laptops", stock: 35, rating: 4.6, reviewCount: 412, tags: ["tablet"], images: [IMG("1561154464-82e9adf32764")], ar: { name: "جهاز نيمبوس تاب 11 اللوحي", description: "جهاز لوحي بشاشة 11 بوصة مصفّحة وبطارية تدوم طوال اليوم — مثالي للعمل والترفيه معًا." } },
    ],
    collections: [
      { title: "New Arrivals", handle: "new-arrivals", description: "The latest drops in tech.", image: IMG("1517336714731-489689fd1ca8"), productSlugs: ["aurora-pro-5g", "vita-smartwatch-9", "nimbus-tab-11"] },
      { title: "Best Sellers", handle: "best-sellers", description: "Our most-loved gadgets.", image: IMG("1583394838336-acd977736f90"), productSlugs: ["pulse-pro-earbuds", "halo-over-ear", "stratus-air-13"] },
      { title: "On Sale", handle: "on-sale", description: "Limited-time deals on top tech.", image: IMG("1546435770-a3e426bf472b"), productSlugs: ["aurora-pro-5g", "halo-over-ear"] },
    ],
    media: { heroImage: WIDE("1498049794561-7780e7231661"), bannerImages: [WIDE("1593344484962-796055d4a3a4"), WIDE("1517336714731-489689fd1ca8")] },
  },

  // ── modern → gadgets / electronics (verified ids) ──
  modern: {
    categories: [
      { name: "Gadgets", slug: "gadgets", description: "Smart everyday tech.", image: IMG("1625948515291-69613efd103f"), ar: { name: "الأجهزة الذكية" } },
      { name: "Audio", slug: "audio", description: "Speakers and personal audio.", image: IMG("1505740420928-5e560c06d30e"), ar: { name: "الصوتيات" } },
      { name: "Accessories", slug: "accessories", description: "Keyboards, hubs and chargers.", image: IMG("1586953208448-b95a79798f07"), ar: { name: "الملحقات" } },
    ],
    products: [
      { name: "Echo Mini Smart Speaker", slug: "echo-mini-speaker", description: "Room-filling 360° sound and a built-in voice assistant in a compact, fabric-wrapped design.", price: 99, compareAtPrice: 129, categorySlug: "audio", stock: 90, rating: 4.6, reviewCount: 891, featured: true, onSale: true, tags: ["smart-speaker"], images: [IMG("1505740420928-5e560c06d30e")], ar: { name: "مكبر صوت إيكو ميني الذكي", description: "صوت محيطي بزاوية 360 درجة يملأ الغرفة مع مساعد صوتي مدمج، في تصميم أنيق مكسو بالقماش." } },
      { name: "Glide Wireless Earbuds", slug: "glide-earbuds", description: "Lightweight true-wireless earbuds with secure-fit tips and 24-hour battery.", price: 79, categorySlug: "audio", stock: 150, rating: 4.4, reviewCount: 1284, tags: ["earbuds"], images: [IMG("1583394838336-acd977736f90")], ar: { name: "سماعات جلايد اللاسلكية", description: "سماعات لاسلكية خفيفة الوزن بأطراف مريحة ثابتة في الأذن وبطارية تدوم 24 ساعة." } },
      { name: "Click Mechanical Keyboard", slug: "click-mechanical-keyboard", description: "A compact 75% mechanical keyboard with hot-swap switches and per-key RGB.", price: 119, categorySlug: "accessories", stock: 70, rating: 4.7, reviewCount: 624, featured: true, tags: ["keyboard"], images: [IMG("1586953208448-b95a79798f07")], ar: { name: "لوحة مفاتيح كليك الميكانيكية", description: "لوحة مفاتيح ميكانيكية مدمجة بحجم 75% مع مفاتيح قابلة للتبديل وإضاءة RGB لكل زر." } },
      { name: "Volt 20K Power Bank", slug: "volt-20k-power-bank", description: "20,000mAh portable charger with 65W USB-C output and a smart battery display.", price: 59, compareAtPrice: 79, categorySlug: "gadgets", stock: 200, rating: 4.7, reviewCount: 1876, onSale: true, tags: ["charging"], images: [IMG("1625948515291-69613efd103f")], ar: { name: "بطارية فولت المتنقلة 20000", description: "شاحن متنقل بسعة 20,000 مللي أمبير وقدرة 65 واط عبر منفذ USB-C مع شاشة ذكية لمستوى الشحن." } },
      { name: "Orbit Fitness Smartwatch", slug: "orbit-fitness-smartwatch", description: "Heart-rate, GPS and 7-day battery in a slim, swim-proof case.", price: 159, categorySlug: "gadgets", stock: 85, rating: 4.5, reviewCount: 487, newArrival: true, tags: ["smartwatch"], images: [IMG("1579586337278-3befd40fd17a")], ar: { name: "ساعة أوربت الرياضية الذكية", description: "قياس نبض القلب وتحديد المواقع GPS وبطارية تدوم 7 أيام في هيكل نحيف مقاوم للسباحة." } },
      { name: "Stream 4K Webcam", slug: "stream-4k-webcam", description: "Crisp 4K video with auto-framing and dual noise-cancelling mics for calls and streaming.", price: 129, categorySlug: "accessories", stock: 60, rating: 4.5, reviewCount: 268, tags: ["webcam"], images: [IMG("1625948515291-69613efd103f")], ar: { name: "كاميرا ستريم للبث بدقة 4K", description: "فيديو فائق الوضوح بدقة 4K مع تأطير تلقائي وميكروفونين بخاصية عزل الضوضاء للمكالمات والبث المباشر." } },
    ],
    collections: [
      { title: "New Arrivals", handle: "new-arrivals", description: "Fresh tech, just in.", image: IMG("1525547719571-a2d4ac8945e2"), productSlugs: ["orbit-fitness-smartwatch", "stream-4k-webcam"] },
      { title: "On Sale", handle: "on-sale", description: "Save on smart everyday tech.", image: IMG("1505740420928-5e560c06d30e"), productSlugs: ["echo-mini-speaker", "volt-20k-power-bank"] },
      { title: "Editor's Picks", handle: "editors-picks", description: "Staff-favorite gear.", image: IMG("1586953208448-b95a79798f07"), productSlugs: ["click-mechanical-keyboard", "echo-mini-speaker"] },
    ],
    media: { heroImage: WIDE("1531297484001-80022131f5a1"), bannerImages: [WIDE("1498049794561-7780e7231661")] },
  },

  // ── starter → general electronics (verified ids) ──
  starter: {
    categories: [
      { name: "Electronics", slug: "electronics", description: "Everyday consumer electronics.", image: IMG("1505740420928-5e560c06d30e"), ar: { name: "الإلكترونيات" } },
      { name: "Accessories", slug: "accessories", description: "Add-ons for your devices.", image: IMG("1586953208448-b95a79798f07"), ar: { name: "الملحقات" } },
    ],
    products: [
      { name: "Boombox Portable Speaker", slug: "boombox-portable-speaker", description: "A rugged, waterproof Bluetooth speaker with deep bass and 16 hours of playtime.", price: 89, compareAtPrice: 109, categorySlug: "electronics", stock: 110, rating: 4.5, reviewCount: 932, featured: true, onSale: true, tags: ["speaker"], images: [IMG("1505740420928-5e560c06d30e")], ar: { name: "مكبر صوت بومبوكس المحمول", description: "مكبر صوت بلوتوث متين مقاوم للماء بصوت جهير عميق و16 ساعة من التشغيل المتواصل." } },
      { name: "Glide Wireless Mouse", slug: "glide-wireless-mouse", description: "Ergonomic silent-click mouse with 8K DPI tracking on any surface.", price: 39, categorySlug: "accessories", stock: 180, rating: 4.8, reviewCount: 3421, tags: ["mouse"], images: [IMG("1586953208448-b95a79798f07")], ar: { name: "فأرة جلايد اللاسلكية", description: "فأرة مريحة بنقرات صامتة وتتبع دقيق بمعدل 8000 DPI على أي سطح." } },
      { name: "Hub-7 USB-C Adapter", slug: "hub-7-usb-c", description: "7-in-1 USB-C hub with HDMI, card readers and 100W passthrough charging.", price: 49, categorySlug: "accessories", stock: 130, rating: 4.6, reviewCount: 612, tags: ["hub"], images: [IMG("1625948515291-69613efd103f")], ar: { name: "موزع هب-7 بمنفذ USB-C", description: "موزع USB-C يجمع 7 منافذ في واحد مع HDMI وقارئ بطاقات وشحن عابر بقدرة 100 واط." } },
      { name: "Quiet Noise-Cancelling Headphones", slug: "quiet-nc-headphones", description: "Comfortable over-ear headphones with active noise cancelling and 35-hour battery.", price: 149, categorySlug: "electronics", stock: 75, rating: 4.6, reviewCount: 1102, featured: true, tags: ["headphones", "anc"], images: [IMG("1546435770-a3e426bf472b")], ar: { name: "سماعات كوايت العازلة للضوضاء", description: "سماعات رأس مريحة مع خاصية إلغاء الضوضاء النشط وبطارية تدوم 35 ساعة." } },
      { name: "Charge Pad Wireless Charger", slug: "charge-pad-wireless", description: "Slim 15W Qi wireless charging pad with non-slip surface.", price: 29, categorySlug: "accessories", stock: 220, rating: 4.4, reviewCount: 540, tags: ["charging"], images: [IMG("1625948515291-69613efd103f")], ar: { name: "قاعدة تشارج باد للشحن اللاسلكي", description: "قاعدة شحن لاسلكي نحيفة بقدرة 15 واط بتقنية Qi وسطح مانع للانزلاق." } },
    ],
    collections: [
      { title: "New Arrivals", handle: "new-arrivals", description: "Just landed.", image: IMG("1525547719571-a2d4ac8945e2"), productSlugs: ["charge-pad-wireless", "hub-7-usb-c"] },
      { title: "On Sale", handle: "on-sale", description: "Everyday savings.", image: IMG("1505740420928-5e560c06d30e"), productSlugs: ["boombox-portable-speaker", "quiet-nc-headphones"] },
    ],
    media: { heroImage: WIDE("1498049794561-7780e7231661"), bannerImages: [WIDE("1531297484001-80022131f5a1")] },
  },

  // ── elegance → fashion ──
  elegance: {
    categories: [
      { name: "Womenswear", slug: "womenswear", description: "Refined everyday and occasion pieces.", image: IMG("1485462537746-965f33f7f6a7"), ar: { name: "أزياء نسائية" } },
      { name: "Menswear", slug: "menswear", description: "Tailored essentials and modern staples.", image: IMG("1551488831-00ddcb6c6bd3"), ar: { name: "أزياء رجالية" } },
      { name: "Accessories", slug: "accessories", description: "Bags, scarves and finishing touches.", image: IMG("1595777457583-95e059d581b8"), ar: { name: "الإكسسوارات" } },
    ],
    products: [
      { name: "Silk Slip Dress", slug: "silk-slip-dress", description: "A bias-cut silk slip dress with a fluid drape — effortless from desk to dinner.", price: 189, compareAtPrice: 240, categorySlug: "womenswear", stock: 40, rating: 4.7, reviewCount: 218, featured: true, onSale: true, tags: ["dress", "silk"], images: [IMG("1485462537746-965f33f7f6a7")], ar: { name: "فستان حريري انسيابي", description: "فستان حريري بقصّة مائلة وانسدال انسيابي — أناقة تلائم يومك من العمل حتى العشاء." } },
      { name: "Tailored Wool Blazer", slug: "tailored-wool-blazer", description: "A single-breasted wool-blend blazer with a structured shoulder and clean lapel.", price: 245, categorySlug: "menswear", stock: 30, rating: 4.8, reviewCount: 164, featured: true, tags: ["blazer"], images: [IMG("1551488831-00ddcb6c6bd3")], ar: { name: "بليزر صوف بقصّة مفصّلة", description: "بليزر بصف أزرار واحد من مزيج الصوف، بأكتاف مهيكلة وياقة نظيفة الخطوط." } },
      { name: "Cashmere Crew Sweater", slug: "cashmere-crew-sweater", description: "Pure cashmere knit in a relaxed crew-neck — light, warm and endlessly soft.", price: 159, categorySlug: "womenswear", stock: 55, rating: 4.7, reviewCount: 287, tags: ["knitwear"], images: [IMG("1576566588028-4147f3842f27")], ar: { name: "كنزة كشمير بياقة دائرية", description: "كنزة من الكشمير الخالص بقصّة مريحة وياقة دائرية — خفيفة ودافئة وفائقة النعومة." } },
      { name: "Classic Trench Coat", slug: "classic-trench-coat", description: "A water-resistant cotton-gabardine trench with a timeless double-breasted cut.", price: 320, compareAtPrice: 390, categorySlug: "womenswear", stock: 25, rating: 4.9, reviewCount: 142, onSale: true, tags: ["coat"], images: [IMG("1434389677669-e08b4cac3105")], ar: { name: "معطف ترنش كلاسيكي", description: "معطف ترنش من قماش الغبردين القطني المقاوم للماء بقصّة مزدوجة الصدر لا تفقد أناقتها أبدًا." } },
      { name: "Leather Tote Bag", slug: "leather-tote-bag", description: "A full-grain leather tote roomy enough for the everyday, with a structured silhouette.", price: 210, categorySlug: "accessories", stock: 45, rating: 4.6, reviewCount: 198, tags: ["bag", "leather"], images: [IMG("1595777457583-95e059d581b8")], ar: { name: "حقيبة يد جلدية واسعة", description: "حقيبة من الجلد الطبيعي الفاخر تتسع لكل احتياجاتك اليومية بتصميم مهيكل أنيق." } },
      { name: "Crisp Linen Shirt", slug: "crisp-linen-shirt", description: "A breathable European-linen shirt with mother-of-pearl buttons.", price: 95, categorySlug: "menswear", stock: 80, rating: 4.5, reviewCount: 233, newArrival: true, tags: ["shirt", "linen"], images: [IMG("1521572163474-6864f9cf17ab")], ar: { name: "قميص كتان أنيق", description: "قميص من الكتان الأوروبي الذي يسمح بمرور الهواء، مع أزرار من عرق اللؤلؤ." } },
    ],
    collections: [
      { title: "New Arrivals", handle: "new-arrivals", description: "The latest season, just in.", image: IMG("1490481651871-ab68de25d43d"), productSlugs: ["silk-slip-dress", "crisp-linen-shirt"] },
      { title: "On Sale", handle: "on-sale", description: "Refined pieces, reduced.", image: IMG("1434389677669-e08b4cac3105"), productSlugs: ["silk-slip-dress", "classic-trench-coat"] },
      { title: "Editor's Picks", handle: "editors-picks", description: "Our wardrobe edit.", image: IMG("1576566588028-4147f3842f27"), productSlugs: ["tailored-wool-blazer", "leather-tote-bag", "cashmere-crew-sweater"] },
    ],
    media: { heroImage: WIDE("1490481651871-ab68de25d43d"), bannerImages: [WIDE("1441986300917-64674bd600d8")] },
  },

  // ── beauxe → fashion + cosmetics ──
  beauxe: {
    categories: [
      { name: "Cosmetics", slug: "cosmetics", description: "Makeup for every look.", image: IMG("1586495777744-4413f21062fa"), ar: { name: "مستحضرات التجميل" } },
      { name: "Fragrance", slug: "fragrance", description: "Signature scents.", image: IMG("1512496015851-a90fb38ba796"), ar: { name: "العطور" } },
      { name: "Accessories", slug: "accessories", description: "Scarves, jewelry and more.", image: IMG("1595777457583-95e059d581b8"), ar: { name: "الإكسسوارات" } },
    ],
    products: [
      { name: "Velvet Matte Lipstick Set", slug: "velvet-matte-lipstick-set", description: "A set of four long-wear matte lipsticks in everyday-to-evening shades.", price: 48, compareAtPrice: 64, categorySlug: "cosmetics", stock: 130, rating: 4.7, reviewCount: 642, featured: true, onSale: true, tags: ["lipstick"], images: [IMG("1586495777744-4413f21062fa")], ar: { name: "طقم أحمر شفاه مطفي مخملي", description: "طقم من أربعة ألوان أحمر شفاه مطفي طويل الثبات بدرجات تناسب النهار والمساء." } },
      { name: "Luminous Eyeshadow Palette", slug: "luminous-eyeshadow-palette", description: "Twelve blendable shades — mattes, satins and shimmers — in a mirrored compact.", price: 56, categorySlug: "cosmetics", stock: 90, rating: 4.8, reviewCount: 421, featured: true, tags: ["eyeshadow"], images: [IMG("1596462502278-27bfdc403348")], ar: { name: "باليت ظلال العيون المضيئة", description: "اثنا عشر لونًا سهل الدمج — مطفي وساتان ولامع — في علبة أنيقة مزودة بمرآة." } },
      { name: "Noir Eau de Parfum", slug: "noir-eau-de-parfum", description: "A warm amber-and-vanilla eau de parfum with notes of jasmine and sandalwood.", price: 120, categorySlug: "fragrance", stock: 60, rating: 4.6, reviewCount: 318, tags: ["perfume"], images: [IMG("1512496015851-a90fb38ba796")], ar: { name: "عطر نوار أو دو بارفان", description: "عطر دافئ بنفحات العنبر والفانيليا مع لمسات من الياسمين وخشب الصندل." } },
      { name: "Silk Foundation SPF 20", slug: "silk-foundation-spf20", description: "A buildable, skin-true foundation with a soft-focus finish and broad-spectrum SPF.", price: 42, categorySlug: "cosmetics", stock: 100, rating: 4.5, reviewCount: 512, tags: ["foundation"], images: [IMG("1522335789203-aabd1fc54bc9")], ar: { name: "كريم أساس حريري بحماية SPF 20", description: "كريم أساس طبيعي المظهر قابل للتدرّج، بلمسة نهائية ناعمة وحماية واسعة الطيف من الشمس." } },
      { name: "Printed Silk Scarf", slug: "printed-silk-scarf", description: "A hand-rolled silk twill scarf in a painterly print.", price: 75, categorySlug: "accessories", stock: 50, rating: 4.7, reviewCount: 174, newArrival: true, tags: ["scarf", "silk"], images: [IMG("1595777457583-95e059d581b8")], ar: { name: "وشاح حريري مطبوع", description: "وشاح من حرير التويل مطويّ الحواف يدويًا بنقشة فنية مميزة." } },
      { name: "Gold Statement Earrings", slug: "gold-statement-earrings", description: "18k-gold-plated drop earrings with a hammered, light-catching finish.", price: 38, categorySlug: "accessories", stock: 85, rating: 4.6, reviewCount: 209, tags: ["jewelry"], images: [IMG("1576566588028-4147f3842f27")], ar: { name: "أقراط ذهبية لافتة", description: "أقراط متدلية مطلية بالذهب عيار 18 بلمسة مطروقة تعكس الضوء ببراعة." } },
    ],
    collections: [
      { title: "New Arrivals", handle: "new-arrivals", description: "Fresh beauty drops.", image: IMG("1596462502278-27bfdc403348"), productSlugs: ["printed-silk-scarf", "luminous-eyeshadow-palette"] },
      { title: "Best Sellers", handle: "best-sellers", description: "Our cult favorites.", image: IMG("1586495777744-4413f21062fa"), productSlugs: ["velvet-matte-lipstick-set", "silk-foundation-spf20"] },
      { title: "On Sale", handle: "on-sale", description: "Beauty steals.", image: IMG("1512496015851-a90fb38ba796"), productSlugs: ["velvet-matte-lipstick-set"] },
    ],
    media: { heroImage: WIDE("1522335789203-aabd1fc54bc9"), bannerImages: [WIDE("1596462502278-27bfdc403348")] },
  },

  // ── glowing → skincare / beauty ──
  glowing: {
    categories: [
      { name: "Skincare", slug: "skincare", description: "Daily cleansers and moisturizers.", image: IMG("1556228720-195a672e8a03"), ar: { name: "العناية بالبشرة" } },
      { name: "Serums", slug: "serums", description: "Targeted treatments.", image: IMG("1608248543803-ba4f8c70ae0b"), ar: { name: "السيرومات" } },
      { name: "Masks & SPF", slug: "masks-spf", description: "Masks and sun protection.", image: IMG("1556228578-8c89e6adf883"), ar: { name: "الأقنعة وواقيات الشمس" } },
    ],
    products: [
      { name: "Glow Vitamin C Serum", slug: "glow-vitamin-c-serum", description: "A 15% vitamin C serum that brightens dull skin and evens tone over time.", price: 34, compareAtPrice: 45, categorySlug: "serums", stock: 140, rating: 4.7, reviewCount: 1320, featured: true, onSale: true, tags: ["serum", "vitamin-c"], images: [IMG("1608248543803-ba4f8c70ae0b")], ar: { name: "سيروم فيتامين C للإشراق", description: "سيروم بتركيز 15% من فيتامين C يمنح البشرة الباهتة إشراقًا ويوحّد لونها مع الاستخدام المنتظم." } },
      { name: "Hydra Daily Moisturizer", slug: "hydra-daily-moisturizer", description: "A lightweight gel-cream with ceramides and squalane for 48-hour hydration.", price: 28, categorySlug: "skincare", stock: 160, rating: 4.6, reviewCount: 980, featured: true, tags: ["moisturizer"], images: [IMG("1556228720-195a672e8a03")], ar: { name: "مرطب هيدرا اليومي", description: "جل كريمي خفيف بالسيراميد والسكوالان لترطيب يدوم 48 ساعة." } },
      { name: "Gentle Foaming Cleanser", slug: "gentle-foaming-cleanser", description: "A pH-balanced foaming cleanser that lifts makeup and grime without stripping.", price: 22, categorySlug: "skincare", stock: 180, rating: 4.5, reviewCount: 743, tags: ["cleanser"], images: [IMG("1612817288484-6f916006741a")], ar: { name: "غسول رغوي لطيف", description: "غسول رغوي متوازن الحموضة يزيل المكياج والشوائب دون أن يجفف البشرة." } },
      { name: "Hyaluronic Acid Booster", slug: "hyaluronic-acid-booster", description: "A multi-weight hyaluronic acid serum that plumps and smooths fine lines.", price: 26, categorySlug: "serums", stock: 130, rating: 4.6, reviewCount: 654, tags: ["serum", "hydrating"], images: [IMG("1570172619644-dfd03ed5d881")], ar: { name: "معزز حمض الهيالورونيك", description: "سيروم هيالورونيك متعدد الأوزان الجزيئية يملأ البشرة وينعّم الخطوط الدقيقة." } },
      { name: "Detox Clay Mask", slug: "detox-clay-mask", description: "A kaolin-and-charcoal mask that draws out impurities and refines pores.", price: 24, categorySlug: "masks-spf", stock: 110, rating: 4.4, reviewCount: 432, newArrival: true, tags: ["mask"], images: [IMG("1556228578-8c89e6adf883")], ar: { name: "قناع الطين المنقّي", description: "قناع بالكاولين والفحم يسحب الشوائب من الأعماق وينقّي المسام." } },
      { name: "Daily Defense SPF 50", slug: "daily-defense-spf-50", description: "A weightless broad-spectrum SPF 50 with no white cast — perfect under makeup.", price: 30, categorySlug: "masks-spf", stock: 150, rating: 4.7, reviewCount: 1102, tags: ["spf", "sunscreen"], images: [IMG("1512496015851-a90fb38ba796")], ar: { name: "واقي الشمس اليومي SPF 50", description: "واقي شمس خفيف الملمس بحماية واسعة الطيف ودون أي أثر أبيض — مثالي تحت المكياج." } },
    ],
    collections: [
      { title: "Skincare Essentials", handle: "skincare-essentials", description: "Your daily routine, simplified.", image: IMG("1556228720-195a672e8a03"), productSlugs: ["hydra-daily-moisturizer", "gentle-foaming-cleanser", "daily-defense-spf-50"] },
      { title: "Best Sellers", handle: "best-sellers", description: "The serums everyone loves.", image: IMG("1608248543803-ba4f8c70ae0b"), productSlugs: ["glow-vitamin-c-serum", "hyaluronic-acid-booster"] },
      { title: "On Sale", handle: "on-sale", description: "Glow for less.", image: IMG("1570172619644-dfd03ed5d881"), productSlugs: ["glow-vitamin-c-serum"] },
    ],
    media: { heroImage: WIDE("1612817288484-6f916006741a"), bannerImages: [WIDE("1556228578-8c89e6adf883")] },
  },

  // ── aurum → luxury jewelry (verified Unsplash ids, all HTTP 200) ──
  aurum: {
    categories: [
      { name: "Earrings", slug: "earrings", description: "Hoops, drops and studs in recycled gold.", image: IMG("1573408301185-9146fe634ad0"), ar: { name: "الأقراط" } },
      { name: "Necklaces", slug: "necklaces", description: "Pendants and chains for every neckline.", image: IMG("1506630448388-4e683c67ddb0"), ar: { name: "القلائد" } },
      { name: "Rings", slug: "rings", description: "Signets, domes and stacking bands.", image: IMG("1611085583191-a3b181a88401"), ar: { name: "الخواتم" } },
      { name: "Bracelets", slug: "bracelets", description: "Chains and sculptural cuffs.", image: IMG("1598560917505-59a3ad559071"), ar: { name: "الأساور" } },
    ],
    products: [
      { name: "Split Hoop Earrings", slug: "split-hoop-earrings", description: "Sculptural open hoops in 18k gold vermeil, hand-polished to a mirror finish and light enough for all-day wear.", price: 180, categorySlug: "earrings", stock: 60, rating: 4.8, reviewCount: 214, featured: true, tags: ["earrings", "gold"], images: [IMG("1515562141207-7a88fb7ce338"), IMG("1589128777073-263566ae5e4d")], ar: { name: "أقراط حلقية مفتوحة", description: "حلقات مفتوحة بتصميم نحتي من الفيرميل الذهبي عيار 18، مصقولة يدويًا حتى اللمعان وخفيفة تناسب الارتداء طوال اليوم." } },
      { name: "Sphere Pendant Necklace", slug: "sphere-pendant-necklace", description: "A single polished gold sphere on a fine adjustable chain — the everyday pendant that goes with everything.", price: 240, compareAtPrice: 290, categorySlug: "necklaces", stock: 45, rating: 4.7, reviewCount: 178, featured: true, onSale: true, tags: ["necklace", "pendant"], images: [IMG("1602173574767-37ac01994b2a"), IMG("1506630448388-4e683c67ddb0")], ar: { name: "قلادة الكرة الذهبية", description: "كرة ذهبية مصقولة واحدة على سلسلة رفيعة قابلة للتعديل — الدلاية اليومية التي تناسب كل إطلالة." } },
      { name: "Chunky Dome Ring", slug: "chunky-dome-ring", description: "A bold, hollow-formed dome ring with substantial presence and a feather-light feel.", price: 320, categorySlug: "rings", stock: 35, rating: 4.8, reviewCount: 142, tags: ["ring", "statement"], images: [IMG("1603561591411-07134e71a2a9"), IMG("1611591437281-460bfbe1220a")], ar: { name: "خاتم القبة العريض", description: "خاتم جريء بتصميم قبة مجوّفة يمنح حضورًا لافتًا مع خفة كالريشة." } },
      { name: "Figaro Chain Bracelet", slug: "figaro-chain-bracelet", description: "A classic figaro-link bracelet in solid gold vermeil with a secure lobster clasp.", price: 210, categorySlug: "bracelets", stock: 50, rating: 4.6, reviewCount: 96, tags: ["bracelet", "chain"], images: [IMG("1598560917505-59a3ad559071")], ar: { name: "سوار سلسلة فيغارو", description: "سوار كلاسيكي بحلقات فيغارو من الفيرميل الذهبي الخالص مع قفل آمن ومتين." } },
      { name: "Pearl Drop Earrings", slug: "pearl-drop-earrings", description: "Baroque freshwater pearls suspended from hand-formed gold hooks — no two pairs alike. Reserve yours from the next atelier batch.", price: 260, categorySlug: "earrings", stock: 20, rating: 4.9, reviewCount: 68, newArrival: true, tags: ["earrings", "pearl"], images: [IMG("1617038220319-276d3cfab638"), IMG("1573408301185-9146fe634ad0")], ar: { name: "أقراط اللؤلؤ المتدلية", description: "لآلئ باروكية من المياه العذبة معلّقة على خطافات ذهبية مشكّلة يدويًا — لا يوجد زوجان متطابقان. احجزي قطعتك من دفعة المشغل القادمة." } },
      { name: "Classic Signet Ring", slug: "classic-signet-ring", description: "A refined oval-face signet in brushed gold, ready to wear plain or engraved.", price: 140, compareAtPrice: 175, categorySlug: "rings", stock: 70, rating: 4.5, reviewCount: 121, onSale: true, tags: ["ring", "signet"], images: [IMG("1611652022419-a9419f74343d"), IMG("1605100804763-247f67b3557e")], ar: { name: "خاتم الختم الكلاسيكي", description: "خاتم ختم راقٍ بوجه بيضاوي من الذهب المصقول بلمسة ناعمة، يمكن ارتداؤه كما هو أو نقشه بحروفك." } },
      { name: "Curb Chain Necklace", slug: "curb-chain-necklace", description: "A substantial curb chain with a high-shine finish — layer it or let it stand alone.", price: 380, categorySlug: "necklaces", stock: 30, rating: 4.8, reviewCount: 156, featured: true, tags: ["necklace", "chain"], images: [IMG("1601121141461-9d6647bca1ed")], ar: { name: "قلادة السلسلة الكوبية", description: "سلسلة كوبية بحضور قوي ولمعان فائق — نسّقيها في طبقات أو دعيها تتألق وحدها." } },
      { name: "Molten Cuff Bracelet", slug: "molten-cuff-bracelet", description: "An organically textured open cuff, cast from a hand-carved wax original and finished in our atelier.", price: 620, categorySlug: "bracelets", stock: 15, rating: 4.9, reviewCount: 54, tags: ["bracelet", "cuff"], images: [IMG("1610694955371-d4a3e0ce4b52"), IMG("1617117811969-97f441511dee")], ar: { name: "سوار الكف المنصهر", description: "سوار مفتوح بملمس عضوي فريد، مصبوب من قالب شمعي منحوت يدويًا ومشطّب بعناية في مشغلنا." } },
    ],
    collections: [
      { title: "New Arrivals", handle: "new-arrivals", description: "Fresh from the atelier.", image: IMG("1617038220319-276d3cfab638"), productSlugs: ["pearl-drop-earrings", "molten-cuff-bracelet"] },
      { title: "Best Sellers", handle: "best-sellers", description: "The pieces everyone keeps.", image: IMG("1601121141461-9d6647bca1ed"), productSlugs: ["split-hoop-earrings", "sphere-pendant-necklace", "curb-chain-necklace"] },
      { title: "On Sale", handle: "on-sale", description: "Timeless pieces, for less.", image: IMG("1602173574767-37ac01994b2a"), productSlugs: ["sphere-pendant-necklace", "classic-signet-ring"] },
    ],
    media: { heroImage: WIDE("1531995811006-35cb42e1a022"), bannerImages: [WIDE("1600721391689-2564bb8055de"), WIDE("1588444650733-d0767b753fc8")] },
  },

  // ── bookshelf → books ──
  bookshelf: {
    categories: [
      { name: "Fiction", slug: "fiction", description: "Novels and short stories.", image: IMG("1544947950-fa07a98d237f"), ar: { name: "الروايات والأدب" } },
      { name: "Non-Fiction", slug: "non-fiction", description: "Ideas, history and self-improvement.", image: IMG("1543002588-bfa74002ed7e"), ar: { name: "كتب غير روائية" } },
      { name: "Children's", slug: "childrens", description: "Picture books and early readers.", image: IMG("1497633762265-9d179a990aa6"), ar: { name: "كتب الأطفال" } },
    ],
    products: [
      { name: "The Midnight Library", slug: "the-midnight-library", description: "A moving novel about the infinite lives we could have lived, and the one we do.", price: 16, compareAtPrice: 22, categorySlug: "fiction", stock: 90, rating: 4.7, reviewCount: 4210, featured: true, onSale: true, tags: ["novel", "bestseller"], images: [IMG("1544947950-fa07a98d237f")], ar: { name: "مكتبة منتصف الليل", description: "رواية مؤثرة عن الحيوات اللامتناهية التي كان بوسعنا أن نعيشها، وتلك الحياة الوحيدة التي نعيشها فعلًا." } },
      { name: "Atomic Habits", slug: "atomic-habits", description: "An easy and proven way to build good habits and break bad ones, one percent at a time.", price: 18, categorySlug: "non-fiction", stock: 120, rating: 4.9, reviewCount: 8920, featured: true, tags: ["self-help", "bestseller"], images: [IMG("1543002588-bfa74002ed7e")], ar: { name: "العادات الذرية", description: "طريقة سهلة ومجرّبة لبناء العادات الجيدة والتخلص من السيئة، بتحسّن واحد بالمئة في كل مرة." } },
      { name: "A Brief History of Humankind", slug: "brief-history-humankind", description: "A sweeping account of how our species came to dominate the planet.", price: 21, categorySlug: "non-fiction", stock: 70, rating: 4.6, reviewCount: 3120, tags: ["history"], images: [IMG("1512820790803-83ca734da794")], ar: { name: "موجز تاريخ البشرية", description: "سرد شامل يروي كيف أصبح جنسنا البشري سيّد هذا الكوكب." } },
      { name: "The Silent Patient", slug: "the-silent-patient", description: "A psychological thriller about a woman's act of violence and the therapist obsessed with her.", price: 15, categorySlug: "fiction", stock: 85, rating: 4.5, reviewCount: 5210, tags: ["thriller"], images: [IMG("1495446815901-a7297e633e8d")], ar: { name: "المريضة الصامتة", description: "رواية إثارة نفسية عن امرأة ارتكبت فعل عنف، والمعالج النفسي المهووس بكشف سرّها." } },
      { name: "Goodnight Little Star", slug: "goodnight-little-star", description: "A gentle, beautifully illustrated bedtime picture book for ages 2–5.", price: 12, categorySlug: "childrens", stock: 140, rating: 4.8, reviewCount: 642, newArrival: true, tags: ["picture-book"], images: [IMG("1497633762265-9d179a990aa6")], ar: { name: "تصبحين على خير يا نجمتي الصغيرة", description: "قصة ما قبل النوم لطيفة برسومات بديعة، مناسبة للأعمار من سنتين إلى خمس سنوات." } },
      { name: "The Pocket Stoic", slug: "the-pocket-stoic", description: "Timeless lessons on calm and resilience, distilled into a pocket-sized read.", price: 13, categorySlug: "non-fiction", stock: 100, rating: 4.5, reviewCount: 871, tags: ["philosophy"], images: [IMG("1532012197267-da84d127e765")], ar: { name: "الرواقي في جيبك", description: "دروس خالدة في الهدوء والصلابة النفسية، مختصرة في كتاب بحجم الجيب." } },
    ],
    collections: [
      { title: "Bestsellers", handle: "bestsellers", description: "This month's most-read.", image: IMG("1512820790803-83ca734da794"), productSlugs: ["the-midnight-library", "atomic-habits"] },
      { title: "New Releases", handle: "new-releases", description: "Hot off the press.", image: IMG("1495446815901-a7297e633e8d"), productSlugs: ["goodnight-little-star", "the-pocket-stoic"] },
      { title: "Staff Picks", handle: "staff-picks", description: "Books we couldn't put down.", image: IMG("1532012197267-da84d127e765"), productSlugs: ["atomic-habits", "brief-history-humankind", "the-silent-patient"] },
    ],
    media: { heroImage: WIDE("1507842217343-583bb7270b66"), bannerImages: [WIDE("1481627834876-b7833e8f5570")] },
  },

  // ── freshmart → grocery / produce ──
  freshmart: {
    categories: [
      { name: "Fresh Produce", slug: "fresh-produce", description: "Fruit and vegetables, picked fresh.", image: IMG("1518843875459-f738682238a6"), ar: { name: "الخضار والفواكه الطازجة" } },
      { name: "Pantry", slug: "pantry", description: "Everyday staples.", image: IMG("1542838132-92c53300491e"), ar: { name: "مؤن المطبخ" } },
      { name: "Dairy & Bakery", slug: "dairy-bakery", description: "Eggs, dairy and fresh bread.", image: IMG("1509440159596-0249088772ff"), ar: { name: "الألبان والمخبوزات" } },
    ],
    products: [
      { name: "Organic Hass Avocados (4-pack)", slug: "organic-avocados-4pack", description: "Creamy, ripe-and-ready organic Hass avocados — perfect for toast and salads.", price: 6, compareAtPrice: 8, categorySlug: "fresh-produce", stock: 200, rating: 4.6, reviewCount: 540, featured: true, onSale: true, tags: ["organic", "fruit"], images: [IMG("1523049673857-eb18f1d7b578")], ar: { name: "أفوكادو هاس عضوي (4 حبات)", description: "أفوكادو هاس عضوي كريمي القوام، ناضج وجاهز للأكل — مثالي للتوست والسلطات." } },
      { name: "Fresh Strawberries 1lb", slug: "fresh-strawberries-1lb", description: "Sweet, fragrant strawberries picked at peak ripeness.", price: 5, categorySlug: "fresh-produce", stock: 180, rating: 4.7, reviewCount: 612, featured: true, tags: ["fruit"], images: [IMG("1518843875459-f738682238a6")], ar: { name: "فراولة طازجة (رطل)", description: "فراولة حلوة عطرية قُطفت في ذروة نضجها." } },
      { name: "Free-Range Eggs (dozen)", slug: "free-range-eggs-dozen", description: "A dozen large free-range eggs from pasture-raised hens.", price: 5, categorySlug: "dairy-bakery", stock: 150, rating: 4.8, reviewCount: 980, tags: ["eggs"], images: [IMG("1582722872445-44dc5f7e3c8f")], ar: { name: "بيض بلدي (دستة)", description: "اثنتا عشرة بيضة كبيرة من دجاج يُربّى طليقًا في المراعي المفتوحة." } },
      { name: "Artisan Sourdough Loaf", slug: "artisan-sourdough-loaf", description: "A slow-fermented sourdough with a crackly crust and open crumb, baked daily.", price: 7, categorySlug: "dairy-bakery", stock: 90, rating: 4.7, reviewCount: 432, newArrival: true, tags: ["bread"], images: [IMG("1509440159596-0249088772ff")], ar: { name: "رغيف خبز الساوردو الحرفي", description: "خبز ساوردو مخمّر ببطء بقشرة مقرمشة ولُبّ هشّ، يُخبز طازجًا كل يوم." } },
      { name: "Vine Cherry Tomatoes", slug: "vine-cherry-tomatoes", description: "Sweet on-the-vine cherry tomatoes bursting with flavor.", price: 4, categorySlug: "fresh-produce", stock: 160, rating: 4.5, reviewCount: 318, tags: ["vegetable"], images: [IMG("1557844352-761f2565b576")], ar: { name: "طماطم كرزية على العنقود", description: "طماطم كرزية حلوة على عنقودها، مفعمة بالنكهة." } },
      { name: "Cold-Pressed Olive Oil 500ml", slug: "cold-pressed-olive-oil", description: "Extra-virgin, cold-pressed olive oil with a peppery, fruity finish.", price: 14, compareAtPrice: 18, categorySlug: "pantry", stock: 120, rating: 4.8, reviewCount: 745, onSale: true, tags: ["pantry"], images: [IMG("1542838132-92c53300491e")], ar: { name: "زيت زيتون معصور على البارد 500 مل", description: "زيت زيتون بكر ممتاز معصور على البارد، بنكهة فاكهية ولمسة فلفلية في الختام." } },
    ],
    collections: [
      { title: "Fresh This Week", handle: "fresh-this-week", description: "Picked at peak ripeness.", image: IMG("1523049673857-eb18f1d7b578"), productSlugs: ["organic-avocados-4pack", "fresh-strawberries-1lb", "vine-cherry-tomatoes"] },
      { title: "Pantry Staples", handle: "pantry-staples", description: "Everyday essentials.", image: IMG("1542838132-92c53300491e"), productSlugs: ["cold-pressed-olive-oil", "free-range-eggs-dozen"] },
      { title: "On Sale", handle: "on-sale", description: "This week's deals.", image: IMG("1518843875459-f738682238a6"), productSlugs: ["organic-avocados-4pack", "cold-pressed-olive-oil"] },
    ],
    media: { heroImage: WIDE("1542838132-92c53300491e"), bannerImages: [WIDE("1488459716781-31db52582fe9")] },
  },

  // ── kidsworld → toys ──
  kidsworld: {
    categories: [
      { name: "Building Blocks", slug: "building-blocks", description: "Bricks and construction sets.", image: IMG("1545558014-8692077e9b5c"), ar: { name: "مكعبات البناء" } },
      { name: "Plush Toys", slug: "plush-toys", description: "Soft and cuddly friends.", image: IMG("1503454537195-1dcabb73ffb9"), ar: { name: "ألعاب القطيفة" } },
      { name: "Learning & Crafts", slug: "learning-crafts", description: "Educational and creative play.", image: IMG("1513519245088-0e12902e35ca"), ar: { name: "التعلم والأشغال اليدوية" } },
    ],
    products: [
      { name: "Wooden Building Blocks (100 pcs)", slug: "wooden-building-blocks-100", description: "A 100-piece set of smooth, brightly-painted wooden blocks for open-ended play.", price: 34, compareAtPrice: 45, categorySlug: "building-blocks", stock: 110, rating: 4.8, reviewCount: 642, featured: true, onSale: true, tags: ["blocks", "wooden"], images: [IMG("1545558014-8692077e9b5c")], ar: { name: "مكعبات بناء خشبية (100 قطعة)", description: "طقم من 100 مكعب خشبي أملس بألوان زاهية يفتح للأطفال آفاق اللعب الإبداعي الحر." } },
      { name: "Cuddles the Teddy Bear", slug: "cuddles-teddy-bear", description: "An extra-soft, huggable teddy bear with embroidered eyes — safe from birth.", price: 24, categorySlug: "plush-toys", stock: 140, rating: 4.9, reviewCount: 1320, featured: true, tags: ["plush"], images: [IMG("1503454537195-1dcabb73ffb9")], ar: { name: "الدب كادلز المحبوب", description: "دب قطيفة فائق النعومة يحلو ضمّه، بعيون مطرّزة — آمن للأطفال منذ الولادة." } },
      { name: "Wooden Train Set", slug: "wooden-train-set", description: "A 40-piece wooden train and track set that connects in endless layouts.", price: 39, categorySlug: "building-blocks", stock: 80, rating: 4.7, reviewCount: 412, tags: ["train"], images: [IMG("1596461404969-9ae70f2830c1")], ar: { name: "طقم القطار الخشبي", description: "قطار خشبي مع سكة من 40 قطعة تتصل ببعضها في تشكيلات لا نهائية." } },
      { name: "Rainbow Stacking Rings", slug: "rainbow-stacking-rings", description: "A classic stacking-rings toy that builds color recognition and motor skills.", price: 16, categorySlug: "learning-crafts", stock: 160, rating: 4.6, reviewCount: 528, tags: ["educational"], images: [IMG("1566576912321-d58ddd7a6088")], ar: { name: "حلقات التكديس قوس قزح", description: "لعبة الحلقات الكلاسيكية التي تنمّي تمييز الألوان والمهارات الحركية الدقيقة." } },
      { name: "Benny the Plush Bunny", slug: "benny-plush-bunny", description: "A floppy-eared plush bunny in soft velour, just right for little hands.", price: 19, categorySlug: "plush-toys", stock: 120, rating: 4.8, reviewCount: 367, newArrival: true, tags: ["plush"], images: [IMG("1515488042361-ee00e0ddd4e4")], ar: { name: "الأرنب بيني القطيفة", description: "أرنب قطيفة بأذنين متدليتين من القطيفة الناعمة، بحجم مثالي للأيادي الصغيرة." } },
      { name: "Deluxe Art & Craft Kit", slug: "deluxe-art-craft-kit", description: "A 150-piece art kit with crayons, markers, stickers and paper for hours of creativity.", price: 29, categorySlug: "learning-crafts", stock: 95, rating: 4.7, reviewCount: 284, tags: ["craft", "art"], images: [IMG("1513519245088-0e12902e35ca")], ar: { name: "طقم الفنون والأشغال الفاخر", description: "طقم فني من 150 قطعة يضم أقلام تلوين وأقلام فلوماستر وملصقات وأوراقًا لساعات من الإبداع." } },
    ],
    collections: [
      { title: "Toys for Toddlers", handle: "toys-for-toddlers", description: "Safe, soft and fun for little ones.", image: IMG("1503454537195-1dcabb73ffb9"), productSlugs: ["cuddles-teddy-bear", "rainbow-stacking-rings", "benny-plush-bunny"] },
      { title: "New Arrivals", handle: "new-arrivals", description: "Fresh fun, just in.", image: IMG("1566576912321-d58ddd7a6088"), productSlugs: ["benny-plush-bunny", "deluxe-art-craft-kit"] },
      { title: "On Sale", handle: "on-sale", description: "Playtime for less.", image: IMG("1545558014-8692077e9b5c"), productSlugs: ["wooden-building-blocks-100"] },
    ],
    media: { heroImage: WIDE("1558877385-81a1c7e67d72"), bannerImages: [WIDE("1596461404969-9ae70f2830c1")] },
  },

  // ── homedecor → home decor ──
  homedecor: {
    categories: [
      { name: "Lighting", slug: "lighting", description: "Lamps and ambient light.", image: IMG("1540574163026-643ea20ade25"), ar: { name: "الإضاءة" } },
      { name: "Textiles", slug: "textiles", description: "Throws, cushions and rugs.", image: IMG("1616486338812-3dadae4b4ace"), ar: { name: "المفروشات" } },
      { name: "Decor", slug: "decor", description: "Vases, candles and accents.", image: IMG("1565183997392-2f6f122e5912"), ar: { name: "الديكور" } },
    ],
    products: [
      { name: "Ceramic Table Lamp", slug: "ceramic-table-lamp", description: "A hand-glazed ceramic base with a linen drum shade for a warm, even glow.", price: 89, compareAtPrice: 120, categorySlug: "lighting", stock: 60, rating: 4.7, reviewCount: 218, featured: true, onSale: true, tags: ["lamp"], images: [IMG("1540574163026-643ea20ade25")], ar: { name: "مصباح طاولة خزفي", description: "قاعدة خزفية مطلية يدويًا مع غطاء أسطواني من الكتان يمنح إضاءة دافئة ومتوازنة." } },
      { name: "Chunky Knit Throw Blanket", slug: "chunky-knit-throw", description: "An oversized chunky-knit throw in soft acrylic-wool blend — cozy and sculptural.", price: 65, categorySlug: "textiles", stock: 90, rating: 4.8, reviewCount: 412, featured: true, tags: ["throw"], images: [IMG("1616486338812-3dadae4b4ace")], ar: { name: "بطانية محبوكة بغرز سميكة", description: "بطانية كبيرة محبوكة بغرز عريضة من مزيج ناعم من الأكريليك والصوف — دفء وأناقة معًا." } },
      { name: "Scented Soy Candle Set", slug: "scented-soy-candle-set", description: "A trio of hand-poured soy candles in sandalwood, fig and sea salt.", price: 42, categorySlug: "decor", stock: 130, rating: 4.6, reviewCount: 324, tags: ["candle"], images: [IMG("1565183997392-2f6f122e5912")], ar: { name: "طقم شموع الصويا المعطرة", description: "ثلاث شموع صويا مصبوبة يدويًا بروائح خشب الصندل والتين وملح البحر." } },
      { name: "Matte Stoneware Vase", slug: "matte-stoneware-vase", description: "A tall, matte-finish stoneware vase with an organic, hand-thrown silhouette.", price: 48, categorySlug: "decor", stock: 75, rating: 4.7, reviewCount: 186, newArrival: true, tags: ["vase"], images: [IMG("1567538096630-e0c55bd6374c")], ar: { name: "مزهرية فخارية مطفية", description: "مزهرية فخارية طويلة بلمسة مطفية وقوام عضوي مصنوعة على عجلة الخزّاف يدويًا." } },
      { name: "Velvet Lumbar Cushion", slug: "velvet-lumbar-cushion", description: "A plush velvet lumbar cushion with a hidden zip and feather-down insert.", price: 35, categorySlug: "textiles", stock: 110, rating: 4.5, reviewCount: 263, tags: ["cushion"], images: [IMG("1513519245088-0e12902e35ca")], ar: { name: "وسادة ظهر مخملية", description: "وسادة ظهر مخملية فاخرة بسحّاب مخفي وحشوة من الريش الناعم." } },
      { name: "Woven Macrame Wall Hanging", slug: "woven-macrame-wall-hanging", description: "A handwoven cotton macrame piece that adds warmth and texture to any wall.", price: 54, categorySlug: "decor", stock: 50, rating: 4.6, reviewCount: 142, tags: ["wall-art"], images: [IMG("1493663284031-b7e3aefcae8e")], ar: { name: "معلقة جدارية مكرمية", description: "قطعة مكرمية قطنية منسوجة يدويًا تضفي دفئًا وملمسًا مميزًا على أي جدار." } },
    ],
    collections: [
      { title: "New Arrivals", handle: "new-arrivals", description: "Fresh finds for the home.", image: IMG("1567538096630-e0c55bd6374c"), productSlugs: ["matte-stoneware-vase", "woven-macrame-wall-hanging"] },
      { title: "On Sale", handle: "on-sale", description: "Style for less.", image: IMG("1540574163026-643ea20ade25"), productSlugs: ["ceramic-table-lamp"] },
      { title: "Editor's Picks", handle: "editors-picks", description: "Pieces we're loving now.", image: IMG("1616486338812-3dadae4b4ace"), productSlugs: ["chunky-knit-throw", "scented-soy-candle-set", "velvet-lumbar-cushion"] },
    ],
    media: { heroImage: WIDE("1586023492125-27b2c045efd7"), bannerImages: [WIDE("1556228453-efd6c1ff04f6")] },
  },

  // ── artisan → handmade / home decor ──
  artisan: {
    categories: [
      { name: "Pottery", slug: "pottery", description: "Hand-thrown ceramics.", image: IMG("1565193566173-7a0ee3dbe261"), ar: { name: "الفخاريات" } },
      { name: "Woven & Textiles", slug: "woven-textiles", description: "Baskets, weavings and fabric.", image: IMG("1493663284031-b7e3aefcae8e"), ar: { name: "المنسوجات والسلال" } },
      { name: "Woodcraft", slug: "woodcraft", description: "Carved and turned wood pieces.", image: IMG("1567538096630-e0c55bd6374c"), ar: { name: "المشغولات الخشبية" } },
    ],
    products: [
      { name: "Handmade Ceramic Mug", slug: "handmade-ceramic-mug", description: "A wheel-thrown stoneware mug with a reactive glaze — no two are exactly alike.", price: 32, compareAtPrice: 42, categorySlug: "pottery", stock: 80, rating: 4.8, reviewCount: 312, featured: true, onSale: true, tags: ["ceramic", "handmade"], images: [IMG("1565193566173-7a0ee3dbe261")], ar: { name: "كوب خزفي مصنوع يدويًا", description: "كوب فخاري مصنوع على عجلة الخزّاف بطلاء تفاعلي — لا توجد قطعتان متطابقتان تمامًا." } },
      { name: "Woven Seagrass Basket", slug: "woven-seagrass-basket", description: "A hand-woven seagrass storage basket with sturdy handles, made by artisans.", price: 46, categorySlug: "woven-textiles", stock: 65, rating: 4.7, reviewCount: 198, featured: true, tags: ["basket"], images: [IMG("1493663284031-b7e3aefcae8e")], ar: { name: "سلة الأعشاب البحرية المنسوجة", description: "سلة تخزين من الأعشاب البحرية منسوجة يدويًا بمقابض متينة، من صنع حرفيين مهرة." } },
      { name: "Carved Acacia Serving Bowl", slug: "carved-acacia-bowl", description: "A hand-carved acacia-wood bowl with a natural grain and food-safe finish.", price: 58, categorySlug: "woodcraft", stock: 50, rating: 4.8, reviewCount: 164, tags: ["wood"], images: [IMG("1567538096630-e0c55bd6374c")], ar: { name: "وعاء تقديم من خشب السنط", description: "وعاء منحوت يدويًا من خشب السنط بعروقه الطبيعية الجميلة وطبقة نهائية آمنة للطعام." } },
      { name: "Hand-Poured Beeswax Candle", slug: "hand-poured-beeswax-candle", description: "A pure beeswax candle hand-poured in small batches, with a honey-warm scent.", price: 28, categorySlug: "pottery", stock: 120, rating: 4.6, reviewCount: 241, tags: ["candle"], images: [IMG("1565183997392-2f6f122e5912")], ar: { name: "شمعة شمع العسل اليدوية", description: "شمعة من شمع العسل النقي تُصبّ يدويًا بدفعات صغيرة، برائحة دافئة كالعسل." } },
      { name: "Macrame Plant Hanger", slug: "macrame-plant-hanger", description: "A hand-knotted cotton macrame plant hanger that fits most 6\" pots.", price: 24, categorySlug: "woven-textiles", stock: 100, rating: 4.5, reviewCount: 176, newArrival: true, tags: ["macrame"], images: [IMG("1513519245088-0e12902e35ca")], ar: { name: "معلاق نباتات مكرمية", description: "معلاق نباتات قطني معقود يدويًا بفن المكرمية، يناسب معظم الأصص بمقاس 6 بوصات." } },
      { name: "Stoneware Bud Vase", slug: "stoneware-bud-vase", description: "A petite hand-glazed bud vase, perfect for a single stem on a windowsill.", price: 26, categorySlug: "pottery", stock: 90, rating: 4.7, reviewCount: 203, tags: ["vase"], images: [IMG("1610701596007-11502861dcfa")], ar: { name: "مزهرية فخارية صغيرة", description: "مزهرية صغيرة مطلية يدويًا، مثالية لوضع زهرة واحدة على حافة النافذة." } },
    ],
    collections: [
      { title: "New Arrivals", handle: "new-arrivals", description: "Freshly made by hand.", image: IMG("1610701596007-11502861dcfa"), productSlugs: ["macrame-plant-hanger", "stoneware-bud-vase"] },
      { title: "Best Sellers", handle: "best-sellers", description: "Our most-loved makes.", image: IMG("1565193566173-7a0ee3dbe261"), productSlugs: ["handmade-ceramic-mug", "woven-seagrass-basket"] },
      { title: "Editor's Picks", handle: "editors-picks", description: "Handpicked artisan pieces.", image: IMG("1567538096630-e0c55bd6374c"), productSlugs: ["carved-acacia-bowl", "hand-poured-beeswax-candle"] },
    ],
    media: { heroImage: WIDE("1493106641515-6b5631de4bb9"), bannerImages: [WIDE("1452860606245-08befc0ff44b")] },
  },

  // ── nutreko → supplements / fitness ──
  nutreko: {
    categories: [
      { name: "Protein", slug: "protein", description: "Powders and recovery.", image: IMG("1607619056574-7b8d3ee536b2"), ar: { name: "البروتين" } },
      { name: "Vitamins", slug: "vitamins", description: "Daily nutrition.", image: IMG("1556909114-f6e7ad7d3136"), ar: { name: "الفيتامينات" } },
      { name: "Performance", slug: "performance", description: "Pre-workout and training support.", image: IMG("1593095948071-474c5cc2989d"), ar: { name: "الأداء الرياضي" } },
    ],
    products: [
      { name: "Whey Protein Powder 2lb", slug: "whey-protein-2lb", description: "24g of grass-fed whey protein per serving, in smooth vanilla — mixes clean.", price: 39, compareAtPrice: 49, categorySlug: "protein", stock: 140, rating: 4.7, reviewCount: 1820, featured: true, onSale: true, tags: ["protein", "whey"], images: [IMG("1607619056574-7b8d3ee536b2")], ar: { name: "بروتين مصل اللبن 2 رطل", description: "24 غرامًا من بروتين مصل اللبن من أبقار تتغذى على الأعشاب في كل حصة، بنكهة فانيليا ناعمة سهلة المزج." } },
      { name: "Daily Multivitamin (90 ct)", slug: "daily-multivitamin-90", description: "A complete daily multivitamin with iron, B-complex and vitamin D3.", price: 22, categorySlug: "vitamins", stock: 200, rating: 4.6, reviewCount: 1320, featured: true, tags: ["vitamins"], images: [IMG("1556909114-f6e7ad7d3136")], ar: { name: "فيتامينات متعددة يومية (90 قرصًا)", description: "فيتامينات يومية متكاملة مع الحديد ومجموعة فيتامينات B وفيتامين D3." } },
      { name: "Pre-Workout Energy Mix", slug: "pre-workout-energy-mix", description: "A balanced pre-workout with caffeine, beta-alanine and citrulline for clean energy.", price: 34, categorySlug: "performance", stock: 110, rating: 4.5, reviewCount: 642, tags: ["pre-workout"], images: [IMG("1593095948071-474c5cc2989d")], ar: { name: "مزيج طاقة ما قبل التمرين", description: "مزيج متوازن لما قبل التمرين بالكافيين والبيتا-ألانين والسيترولين لطاقة صافية ومركّزة." } },
      { name: "Omega-3 Fish Oil", slug: "omega-3-fish-oil", description: "High-potency omega-3 softgels with EPA and DHA for heart and brain health.", price: 19, categorySlug: "vitamins", stock: 160, rating: 4.6, reviewCount: 874, tags: ["omega-3"], images: [IMG("1556909114-f6e7ad7d3136")], ar: { name: "زيت السمك أوميغا 3", description: "كبسولات أوميغا 3 عالية التركيز غنية بـ EPA وDHA لصحة القلب والدماغ." } },
      { name: "Creatine Monohydrate 300g", slug: "creatine-monohydrate-300g", description: "Pure micronized creatine monohydrate — unflavored and easy to mix.", price: 24, categorySlug: "performance", stock: 130, rating: 4.8, reviewCount: 1102, newArrival: true, tags: ["creatine"], images: [IMG("1583454110551-21f2fa2afe61")], ar: { name: "كرياتين مونوهيدرات 300 غرام", description: "كرياتين مونوهيدرات نقي مطحون بدقة — بدون نكهة وسهل المزج." } },
      { name: "BCAA Recovery Drink", slug: "bcaa-recovery-drink", description: "A 2:1:1 BCAA blend with electrolytes for hydration and muscle recovery.", price: 29, categorySlug: "protein", stock: 95, rating: 4.5, reviewCount: 487, tags: ["bcaa"], images: [IMG("1607619056574-7b8d3ee536b2")], ar: { name: "مشروب الاستشفاء BCAA", description: "مزيج أحماض أمينية متشعبة بنسبة 2:1:1 مع إلكتروليتات للترطيب واستشفاء العضلات." } },
    ],
    collections: [
      { title: "Best Sellers", handle: "best-sellers", description: "Top picks for your goals.", image: IMG("1607619056574-7b8d3ee536b2"), productSlugs: ["whey-protein-2lb", "daily-multivitamin-90"] },
      { title: "New Arrivals", handle: "new-arrivals", description: "Latest in nutrition.", image: IMG("1583454110551-21f2fa2afe61"), productSlugs: ["creatine-monohydrate-300g"] },
      { title: "On Sale", handle: "on-sale", description: "Fuel for less.", image: IMG("1593095948071-474c5cc2989d"), productSlugs: ["whey-protein-2lb"] },
    ],
    media: { heroImage: WIDE("1517836357463-d25dfeac3438"), bannerImages: [WIDE("1581009146145-b5ef050c2e1e")] },
  },

  // ── sportzone → sports gear ──
  sportzone: {
    categories: [
      { name: "Footwear", slug: "footwear", description: "Performance shoes.", image: IMG("1542291026-7eec264c27ff"), ar: { name: "الأحذية الرياضية" } },
      { name: "Equipment", slug: "equipment", description: "Weights, mats and gear.", image: IMG("1518611012118-696072aa579a"), ar: { name: "المعدات الرياضية" } },
      { name: "Apparel", slug: "apparel", description: "Training clothing.", image: IMG("1517649763962-0c623066013b"), ar: { name: "الملابس الرياضية" } },
    ],
    products: [
      { name: "Velocity Running Shoes", slug: "velocity-running-shoes", description: "Lightweight, responsive running shoes with a breathable knit upper and cushioned midsole.", price: 110, compareAtPrice: 140, categorySlug: "footwear", stock: 90, rating: 4.7, reviewCount: 1420, featured: true, onSale: true, tags: ["running", "shoes"], images: [IMG("1542291026-7eec264c27ff")], ar: { name: "حذاء فيلوسيتي للجري", description: "حذاء جري خفيف وسريع الاستجابة بوجه محبوك جيد التهوية ونعل أوسط مبطّن." } },
      { name: "Pro Grip Yoga Mat", slug: "pro-grip-yoga-mat", description: "A 6mm non-slip yoga mat with alignment lines and a sweat-resistant surface.", price: 45, categorySlug: "equipment", stock: 120, rating: 4.8, reviewCount: 642, featured: true, tags: ["yoga"], images: [IMG("1518611012118-696072aa579a")], ar: { name: "سجادة يوغا برو غريب", description: "سجادة يوغا بسماكة 6 مم مانعة للانزلاق مع خطوط محاذاة وسطح مقاوم للتعرق." } },
      { name: "Adjustable Dumbbell Set", slug: "adjustable-dumbbell-set", description: "A space-saving pair of adjustable dumbbells, 5–52.5 lbs each, with a quick dial.", price: 299, categorySlug: "equipment", stock: 40, rating: 4.7, reviewCount: 318, tags: ["weights"], images: [IMG("1599058917212-d750089bc07e")], ar: { name: "طقم دمبل قابل للتعديل", description: "زوج من الدمبلات القابلة للتعديل موفّر للمساحة، من 5 حتى 52.5 رطلًا لكل دمبل، مع قرص ضبط سريع." } },
      { name: "Official Size Basketball", slug: "official-size-basketball", description: "A composite-leather indoor/outdoor basketball with a deep-channel grip.", price: 34, categorySlug: "equipment", stock: 110, rating: 4.6, reviewCount: 528, tags: ["basketball"], images: [IMG("1535131749006-b7f58c99034b")], ar: { name: "كرة سلة بالحجم الرسمي", description: "كرة سلة من الجلد المركّب للصالات والملاعب الخارجية بقبضة عميقة القنوات." } },
      { name: "Compression Training Tee", slug: "compression-training-tee", description: "A moisture-wicking compression tee with four-way stretch for full range of motion.", price: 32, categorySlug: "apparel", stock: 150, rating: 4.5, reviewCount: 412, newArrival: true, tags: ["apparel"], images: [IMG("1517649763962-0c623066013b")], ar: { name: "تيشيرت التدريب الضاغط", description: "تيشيرت ضاغط طارد للرطوبة بخامة مرنة في جميع الاتجاهات لحرية حركة كاملة." } },
      { name: "Resistance Bands Set", slug: "resistance-bands-set", description: "Five stackable resistance bands with handles, door anchor and ankle straps.", price: 28, categorySlug: "equipment", stock: 170, rating: 4.6, reviewCount: 736, tags: ["bands"], images: [IMG("1461896836934-ffe607ba8211")], ar: { name: "طقم أحزمة المقاومة", description: "خمسة أحزمة مقاومة قابلة للتجميع مع مقابض ومثبّت للباب وأربطة للكاحل." } },
    ],
    collections: [
      { title: "New Arrivals", handle: "new-arrivals", description: "Gear up with the latest.", image: IMG("1461896836934-ffe607ba8211"), productSlugs: ["compression-training-tee", "resistance-bands-set"] },
      { title: "On Sale", handle: "on-sale", description: "Train for less.", image: IMG("1542291026-7eec264c27ff"), productSlugs: ["velocity-running-shoes"] },
      { title: "Best Sellers", handle: "best-sellers", description: "Athlete favorites.", image: IMG("1518611012118-696072aa579a"), productSlugs: ["pro-grip-yoga-mat", "adjustable-dumbbell-set"] },
    ],
    media: { heroImage: WIDE("1534438327276-14e5300c3a48"), bannerImages: [WIDE("1517649763962-0c623066013b")] },
  },

  // ── milmaa → organic / wellness ──
  milmaa: {
    categories: [
      { name: "Organic Foods", slug: "organic-foods", description: "Pure, natural pantry goods.", image: IMG("1587049352846-4a222e784d38"), ar: { name: "الأغذية العضوية" } },
      { name: "Herbal Teas", slug: "herbal-teas", description: "Soothing botanical blends.", image: IMG("1556881286-fc6915169721"), ar: { name: "شاي الأعشاب" } },
      { name: "Wellness", slug: "wellness", description: "Everyday wellbeing.", image: IMG("1490645935967-10de6ba17061"), ar: { name: "الصحة والعافية" } },
    ],
    products: [
      { name: "Raw Organic Honey 500g", slug: "raw-organic-honey-500g", description: "Unfiltered, cold-extracted raw honey from wildflower meadows — pure and golden.", price: 16, compareAtPrice: 21, categorySlug: "organic-foods", stock: 130, rating: 4.8, reviewCount: 642, featured: true, onSale: true, tags: ["honey", "organic"], images: [IMG("1587049352846-4a222e784d38")], ar: { name: "عسل عضوي خام 500 غرام", description: "عسل خام غير مصفّى مستخلص على البارد من مروج الأزهار البرية — نقي وذهبي اللون." } },
      { name: "Calm Herbal Tea Blend", slug: "calm-herbal-tea-blend", description: "A caffeine-free blend of chamomile, lavender and lemon balm for winding down.", price: 12, categorySlug: "herbal-teas", stock: 160, rating: 4.7, reviewCount: 412, featured: true, tags: ["tea", "herbal"], images: [IMG("1556881286-fc6915169721")], ar: { name: "خلطة شاي الأعشاب المهدئة", description: "خلطة خالية من الكافيين من البابونج واللافندر والمليسة تساعدك على الاسترخاء قبل النوم." } },
      { name: "Organic Quinoa 1kg", slug: "organic-quinoa-1kg", description: "Triple-washed organic white quinoa — a complete-protein pantry staple.", price: 14, categorySlug: "organic-foods", stock: 110, rating: 4.6, reviewCount: 318, tags: ["organic", "grain"], images: [IMG("1490645935967-10de6ba17061")], ar: { name: "كينوا عضوية 1 كغم", description: "كينوا بيضاء عضوية مغسولة ثلاث مرات — بروتين متكامل وعنصر أساسي في مطبخك." } },
      { name: "Cold-Pressed Coconut Oil", slug: "cold-pressed-coconut-oil", description: "Virgin, cold-pressed coconut oil for cooking, skin and hair.", price: 13, categorySlug: "organic-foods", stock: 140, rating: 4.7, reviewCount: 524, tags: ["organic"], images: [IMG("1556228720-195a672e8a03")], ar: { name: "زيت جوز الهند المعصور على البارد", description: "زيت جوز هند بكر معصور على البارد، للطبخ والعناية بالبشرة والشعر." } },
      { name: "Green Tea & Mint Blend", slug: "green-tea-mint-blend", description: "A refreshing organic green tea blended with cooling peppermint leaves.", price: 11, categorySlug: "herbal-teas", stock: 150, rating: 4.5, reviewCount: 287, newArrival: true, tags: ["tea", "green"], images: [IMG("1556881286-fc6915169721")], ar: { name: "خلطة الشاي الأخضر بالنعناع", description: "شاي أخضر عضوي منعش ممزوج بأوراق النعناع الفلفلي المنعشة." } },
      { name: "Organic Chia Seeds 500g", slug: "organic-chia-seeds-500g", description: "Nutrient-dense organic chia seeds, rich in fiber and omega-3.", price: 10, categorySlug: "wellness", stock: 180, rating: 4.6, reviewCount: 463, tags: ["organic", "superfood"], images: [IMG("1490645935967-10de6ba17061")], ar: { name: "بذور الشيا العضوية 500 غرام", description: "بذور شيا عضوية غنية بالعناصر الغذائية والألياف وأوميغا 3." } },
    ],
    collections: [
      { title: "Best Sellers", handle: "best-sellers", description: "Pure favorites.", image: IMG("1587049352846-4a222e784d38"), productSlugs: ["raw-organic-honey-500g", "calm-herbal-tea-blend"] },
      { title: "New Arrivals", handle: "new-arrivals", description: "Fresh from nature.", image: IMG("1556881286-fc6915169721"), productSlugs: ["green-tea-mint-blend", "organic-chia-seeds-500g"] },
      { title: "On Sale", handle: "on-sale", description: "Wellness for less.", image: IMG("1490645935967-10de6ba17061"), productSlugs: ["raw-organic-honey-500g"] },
    ],
    media: { heroImage: WIDE("1490818387583-1baba5e638af"), bannerImages: [WIDE("1556881286-fc6915169721")] },
  },
};

/**
 * Build a Category document payload for insertion. Slugs are namespaced with a
 * `demo-` prefix so a demo category can never collide on the unique
 * (tenantId, slug) index with a real merchant category.
 */
function buildCategoryDoc(tenantId, cat, sortOrder) {
  return {
    tenantId,
    name: cat.name,
    slug: `demo-${cat.slug}`,
    description: cat.description || "",
    image: cat.image,
    status: "active",
    sortOrder,
    isDemo: true,
    // Optional Arabic override (`cat.ar.name`) so bilingual demo stores show
    // localized category names via the storefront's per-language resolver.
    translations: {
      en: { name: cat.name },
      ar: { name: cat.ar?.name || "" },
    },
  };
}

/**
 * Build a Product document payload. `category` is the created Category _id.
 * When `draft` is true the product is seeded as a draft (status:"draft") so
 * nothing is live until the merchant publishes the starter content.
 */
function buildProductDoc(tenantId, p, categoryId, { draft = false } = {}) {
  return {
    tenantId,
    name: p.name,
    slug: `demo-${p.slug}`,
    description: p.description,
    shortDescription: p.shortDescription,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    category: categoryId,
    sku: `DEMO-${p.slug.toUpperCase()}`,
    stock: p.stock ?? 25,
    status: draft ? "draft" : "active",
    featured: !!p.featured,
    // Treat any product with a struck-through compareAtPrice as on-sale so the
    // storefront's sale badges/filters have something to show.
    onSale: !!p.onSale || (p.compareAtPrice != null && p.compareAtPrice > p.price),
    newArrival: !!p.newArrival,
    rating: p.rating ?? 0,
    reviewCount: p.reviewCount ?? 0,
    tags: p.tags || [],
    images: p.images || [],
    isDemo: true,
    // Optional Arabic overrides (`p.ar.{name,description,shortDescription}`) so
    // bilingual demo stores localize product text via the storefront resolver.
    translations: {
      en: {
        name: p.name,
        description: p.description,
        shortDescription: p.shortDescription || "",
      },
      ar: {
        name: p.ar?.name || "",
        description: p.ar?.description || "",
        shortDescription: p.ar?.shortDescription || "",
      },
    },
  };
}

/**
 * Build a Collection document payload. `handle` is namespaced with a `demo-`
 * prefix so a demo collection can never collide on the unique (tenantId, handle)
 * index with a real merchant collection. `productIds` are the demo Product _ids
 * resolved from the collection's `productSlugs`.
 */
function buildCollectionDoc(tenantId, col, productIdBySlug, { draft = false } = {}) {
  const productIds = (col.productSlugs || [])
    .map((slug) => productIdBySlug[slug])
    .filter(Boolean);
  return {
    tenantId,
    title: col.title,
    handle: `demo-${col.handle}`,
    description: col.description || "",
    image: { url: col.image, alt: col.title },
    type: "manual",
    productIds,
    // Draft starter content stays unpublished until the merchant publishes.
    isPublished: !draft,
    publishedAt: draft ? null : new Date(),
    sortOrder: "manual",
    isDemo: true,
  };
}

/**
 * Starter CMS pages (About + Contact) seeded for every new store. These are
 * real, editable Page documents (not theme-specific) with sensible bilingual
 * starter copy. Seeded as DRAFT (isPublished:false) + isDemo:true so the
 * "publish starter content" action can flip them live alongside the catalog.
 *
 * The merchant edits the title/content in the dashboard, then publishes.
 */
function buildStarterPages(tenantId, language, { draft = true } = {}) {
  const isAr = String(language || "").toLowerCase().startsWith("ar");
  const locale = isAr ? "ar" : "en";
  const now = new Date();

  const pages = isAr
    ? [
        {
          slug: "about",
          title: "من نحن",
          metaTitle: "من نحن",
          metaDescription: "تعرّف على قصتنا ورسالتنا.",
          content:
            "<h1>من نحن</h1>" +
            "<p>مرحبًا بك في متجرنا! نحن شغوفون بتقديم منتجات مختارة بعناية وتجربة تسوّق سلسة لعملائنا.</p>" +
            "<p>هذه صفحة بداية يمكنك تعديلها بالكامل — أضف قصة علامتك التجارية، وما يميّزك، ولماذا يثق بك عملاؤك. عندما تكون جاهزًا، انشر متجرك ليصبح كل هذا مباشرًا.</p>",
        },
        {
          slug: "contact",
          title: "اتصل بنا",
          metaTitle: "اتصل بنا",
          metaDescription: "تواصل معنا — يسعدنا مساعدتك.",
          content:
            "<h1>اتصل بنا</h1>" +
            "<p>هل لديك سؤال؟ يسعدنا أن نسمع منك.</p>" +
            "<ul>" +
            "<li><strong>البريد الإلكتروني:</strong> support@example.com</li>" +
            "<li><strong>الهاتف:</strong> +000 000 0000</li>" +
            "<li><strong>العنوان:</strong> أضف عنوان متجرك هنا</li>" +
            "<li><strong>ساعات العمل:</strong> من الأحد إلى الخميس، 9 صباحًا – 5 مساءً</li>" +
            "</ul>" +
            "<p>هذه تفاصيل مبدئية — استبدلها بمعلومات التواصل الحقيقية ثم انشر الصفحة.</p>",
        },
      ]
    : [
        {
          slug: "about",
          title: "About Us",
          metaTitle: "About Us",
          metaDescription: "Learn about our story and mission.",
          content:
            "<h1>About Us</h1>" +
            "<p>Welcome to our store! We're passionate about bringing you carefully selected products and a smooth shopping experience.</p>" +
            "<p>This is a starter page you can fully edit — add your brand story, what makes you different, and why customers trust you. When you're ready, publish your store to make it all go live.</p>",
        },
        {
          slug: "contact",
          title: "Contact Us",
          metaTitle: "Contact Us",
          metaDescription: "Get in touch — we'd love to help.",
          content:
            "<h1>Contact Us</h1>" +
            "<p>Have a question? We'd love to hear from you.</p>" +
            "<ul>" +
            "<li><strong>Email:</strong> support@example.com</li>" +
            "<li><strong>Phone:</strong> +000 000 0000</li>" +
            "<li><strong>Address:</strong> Add your store address here</li>" +
            "<li><strong>Hours:</strong> Mon–Fri, 9am – 5pm</li>" +
            "</ul>" +
            "<p>These are placeholder details — replace them with your real contact info, then publish the page.</p>",
        },
      ];

  return pages.map((p) => ({
    tenantId,
    slug: p.slug,
    title: p.title,
    content: p.content,
    metaTitle: p.metaTitle,
    metaDescription: p.metaDescription,
    locale,
    isPublished: !draft,
    publishedAt: draft ? null : now,
    isDemo: true,
    createdAt: now,
    updatedAt: now,
  }));
}

/**
 * Seed the About + Contact starter pages. Idempotent: skips any page whose
 * (tenant, slug) already exists so re-runs / theme switches never duplicate.
 * Never throws — returns the count created.
 */
async function seedStarterPages(tenantId, language, { draft = true } = {}) {
  let created = 0;
  try {
    const Page = mongoose.model("Page");
    const docs = buildStarterPages(tenantId, language, { draft });
    for (const doc of docs) {
      const exists = await Page.findOne({ tenantId, slug: doc.slug })
        .select("_id")
        .lean();
      if (exists) continue;
      await Page.create(doc);
      created += 1;
    }
  } catch (err) {
    logger.warn("Failed to seed starter pages", {
      tenantId: tenantId?.toString(),
      error: err.message,
    });
  }
  return created;
}

/**
 * Resolve the id of a section's first image-type setting from the theme's
 * manifest (e.g. `background_image` for most heroes, `image` for the
 * niche heroes like `glowing-hero`). Returns null when the section has no
 * image setting at all (gradient/color-only heroes).
 */
function imageSettingIdForSection(manifestSections, type) {
  const def = (manifestSections || []).find((s) => s && s.type === type);
  if (!def || !Array.isArray(def.settings)) return null;
  const imgSetting = def.settings.find((s) => s && s.type === "image");
  return imgSetting ? imgSetting.id : null;
}

/**
 * Patch a list of theme-customization sections in place with the theme's demo
 * media. The hero (any section whose type contains "hero") gets `heroImage`
 * written to its manifest image-setting id, falling back to `background_image`
 * when the hero is a gradient/color hero with no image setting (harmless extra
 * key — the storefront ignores it and renders the gradient). Every other
 * section that declares a top-level image setting (promo/banner/editorial)
 * gets the next `bannerImages` entry in order.
 *
 * Returns `{ sections, changed }`; never throws.
 */
function applyMediaToSections(sections, media, manifestSections) {
  if (!Array.isArray(sections) || !media) {
    return { sections: Array.isArray(sections) ? sections : [], changed: false };
  }
  const heroImage = media.heroImage;
  const bannerImages = Array.isArray(media.bannerImages) ? media.bannerImages : [];
  let bannerIdx = 0;
  let changed = false;

  for (const section of sections) {
    if (!section || typeof section !== "object") continue;
    const type = typeof section.type === "string" ? section.type : "";
    if (!section.settings || typeof section.settings !== "object") section.settings = {};
    const settingId = imageSettingIdForSection(manifestSections, type);

    if (/hero/i.test(type)) {
      if (heroImage) {
        section.settings[settingId || "background_image"] = heroImage;
        changed = true;
      }
    } else if (settingId && bannerImages.length) {
      section.settings[settingId] = bannerImages[bannerIdx % bannerImages.length];
      bannerIdx += 1;
      changed = true;
    }
  }

  return { sections, changed };
}

/**
 * Seed (or re-seed) a tenant's store with the demo categories + products that
 * fit the given theme. Idempotent and safe to call on every theme activation.
 *
 * Contract:
 *   (a) If the store already has any NON-demo products, do nothing — we never
 *       touch a real merchant's catalog.
 *   (b) Remove any demo categories/products/collections left over from a
 *       previous theme.
 *   (c) Insert this theme's demo categories (with niche images), then products
 *       linked to them.
 *   (d) Insert this theme's demo collections, linked to the new demo products.
 *   (e) Patch the tenant's theme customization with the theme's hero/banner
 *       imagery so the storefront's visual layer matches the niche.
 *
 * Never throws — a demo-seed failure must not break theme installation. Returns
 * a small result object describing what happened (useful for tests/logging).
 *
 * @param {import('mongoose').Types.ObjectId|string} tenantId
 * @param {string} themeSlug
 * @param {object} [options]
 * @param {boolean} [options.draft=false] seed everything as DRAFT (products
 *        status:"draft", collections/pages isPublished:false) so nothing is
 *        live until the merchant publishes the starter content.
 * @param {string} [options.language] tenant language for the starter CMS pages
 *        (falls back to the tenant's own settings.language, then "en").
 */
export async function seedThemeDemoData(tenantId, themeSlug, options = {}) {
  const draft = !!options.draft;
  try {
    if (!tenantId) {
      return { seeded: false, reason: "missing-tenant-id" };
    }

    const data = THEME_DEMO_DATA[themeSlug];
    if (!data) {
      logger.info("No demo dataset for theme, skipping demo seed", { themeSlug });
      return { seeded: false, reason: "no-dataset-for-theme" };
    }

    const Product = mongoose.model("Product");
    const Category = mongoose.model("Category");
    const Collection = mongoose.model("Collection");

    // (a) Bail out if the store already has real merchant products. We only
    // ever decorate empty stores, never overwrite a merchant's own catalog.
    const realProductCount = await Product.countDocuments({
      tenantId,
      isDemo: { $ne: true },
    });
    if (realProductCount > 0) {
      logger.info("Store has real products, skipping demo seed", {
        tenantId: tenantId?.toString(),
        themeSlug,
        realProductCount,
      });
      return { seeded: false, reason: "real-products-exist" };
    }

    // (b) Clear out any demo content from a previously-activated theme so the
    // catalog always reflects the *current* theme's niche.
    await Product.deleteMany({ tenantId, isDemo: true });
    await Category.deleteMany({ tenantId, isDemo: true });
    await Collection.deleteMany({ tenantId, isDemo: true });

    // (c) Insert categories first so we can link products to their _ids.
    const categoryIdBySlug = {};
    let sortOrder = 0;
    for (const cat of data.categories) {
      const created = await Category.create(buildCategoryDoc(tenantId, cat, sortOrder++));
      categoryIdBySlug[cat.slug] = created._id;
    }

    const fallbackCategoryId = Object.values(categoryIdBySlug)[0];
    const productDocs = data.products.map((p) =>
      buildProductDoc(tenantId, p, categoryIdBySlug[p.categorySlug] || fallbackCategoryId, { draft })
    );

    // create() (vs insertMany) fires the schema's validate/save hooks and the
    // tenant-scope safety net, matching how scripts/seed-tech-store.js writes.
    const createdProducts = await Product.create(productDocs);

    // Keep each category's productCount accurate so storefront category badges
    // and counts render correctly out of the box. Count all demo products in
    // the category regardless of status so the badge is right whether the
    // products are seeded as draft or active.
    for (const [slug, id] of Object.entries(categoryIdBySlug)) {
      const count = await Product.countDocuments({
        tenantId,
        category: id,
        isDemo: true,
      });
      await Category.updateOne(
        { _id: id, tenantId },
        { $set: { productCount: count } }
      );
    }

    // (d) Seed demo Collections linked to the just-inserted demo products.
    // `Product.create(array)` preserves input order, so we can zip the created
    // docs back to their source slugs to resolve each collection's productIds.
    const productIdBySlug = {};
    data.products.forEach((p, i) => {
      if (createdProducts[i]) productIdBySlug[p.slug] = createdProducts[i]._id;
    });

    let collectionsCreated = 0;
    if (Array.isArray(data.collections) && data.collections.length) {
      const collectionDocs = data.collections.map((col) =>
        buildCollectionDoc(tenantId, col, productIdBySlug, { draft })
      );
      const created = await Collection.create(collectionDocs);
      collectionsCreated = Array.isArray(created) ? created.length : 0;
    }

    // Seed the About + Contact starter CMS pages (real, editable, draft).
    // Idempotent — skips slugs that already exist. Resolve the language from
    // the option or the tenant's own setting so a new Arabic store gets
    // Arabic starter copy.
    let pageLanguage = options.language;
    if (!pageLanguage) {
      try {
        const Tenant = mongoose.model("Tenant");
        const t = await Tenant.findById(tenantId).select("settings.language").lean();
        pageLanguage = t?.settings?.language;
      } catch {
        /* fall back to "en" inside buildStarterPages */
      }
    }
    const pagesCreated = await seedStarterPages(tenantId, pageLanguage, { draft });

    // (e) Inject niche hero/banner imagery into the tenant's live theme
    // customization so the hero + promo/banner sections render with
    // theme-fitting art instead of an empty/gradient default. The install flow
    // seeds `themeCustomization.sectionsByTemplate` (+ published) *before*
    // calling us, so the index bucket already exists here. Defensive: only
    // runs when the theme ships media, patches both draft and published
    // copies, and never throws.
    let mediaPatched = false;
    try {
      if (data.media) {
        const Tenant = mongoose.model("Tenant");
        const tenant = await Tenant.findById(tenantId).select("themeCustomization").lean();
        if (tenant && tenant.themeCustomization) {
          const manifestSections = getThemeManifest(themeSlug)?.sections || [];
          const tc = tenant.themeCustomization;
          const draftIndex = Array.isArray(tc.sectionsByTemplate?.index)
            ? tc.sectionsByTemplate.index
            : [];
          const publishedIndex = Array.isArray(tc.published?.sectionsByTemplate?.index)
            ? tc.published.sectionsByTemplate.index
            : [];
          const draft = applyMediaToSections(draftIndex, data.media, manifestSections);
          const published = applyMediaToSections(publishedIndex, data.media, manifestSections);
          if (draft.changed || published.changed) {
            await Tenant.findByIdAndUpdate(tenantId, {
              $set: {
                "themeCustomization.sectionsByTemplate.index": draft.sections,
                "themeCustomization.published.sectionsByTemplate.index": published.sections,
              },
            });
            mediaPatched = true;
          }
        }
      }
    } catch (mediaErr) {
      // A media-patch failure must never break theme install or the demo seed.
      logger.warn("Failed to inject theme media into customization", {
        tenantId: tenantId?.toString(),
        themeSlug,
        error: mediaErr.message,
      });
    }

    logger.info("Seeded theme demo data", {
      tenantId: tenantId?.toString(),
      themeSlug,
      draft,
      categories: data.categories.length,
      products: createdProducts.length,
      collections: collectionsCreated,
      pages: pagesCreated,
      mediaPatched,
    });

    return {
      seeded: true,
      themeSlug,
      draft,
      categories: data.categories.length,
      products: createdProducts.length,
      collections: collectionsCreated,
      pages: pagesCreated,
      mediaPatched,
    };
  } catch (error) {
    // Defensive: never let a demo-seed problem bubble up into theme install.
    logger.warn("Failed to seed theme demo data", {
      tenantId: tenantId?.toString(),
      themeSlug,
      error: error.message,
    });
    return { seeded: false, reason: "error", error: error.message };
  }
}

export default seedThemeDemoData;
