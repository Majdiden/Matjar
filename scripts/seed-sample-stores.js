/**
 * Seed complete SAMPLE STORES — one per storefront theme — for showing clients
 * how their store could look. Each store is:
 *   - a live tenant on a category subdomain (electronics.<domain>, fashion.<domain>, …)
 *   - owned by ONE shared account (same login across all 15 stores)
 *   - populated with the theme's bilingual (en/ar) demo catalog, collections,
 *     About/Contact pages, hero/banner imagery, payment methods, store policies
 *     (privacy/returns/delivery/cod), a footer menu, and a published theme.
 *
 * Idempotent: re-running skips (or refreshes) stores whose subdomain already exists.
 *
 * Usage:
 *   node scripts/seed-sample-stores.js            # all 15 themes
 *   node scripts/seed-sample-stores.js techhub    # just one (by theme slug)
 *   node scripts/seed-sample-stores.js --reset techhub   # delete + recreate
 */
import mongoose from "mongoose";
import { connectDb } from "../utils/connectionManager.js";
import { createScopedModels } from "../utils/scopedModel.js";
import { addATenantService, addStoreForExistingUserService } from "../services/tenant.js";
import { installThemeService } from "../services/theme.js";
import { seedThemeDemoData } from "../services/themeDemoData.js";
import { seedDefaultPaymentMethods } from "../services/storeSetup.js";
import { publishCustomizationService } from "../services/themeCustomization.js";
import logger from "../utils/logger.js";

// ─── Shared owner account (one login for all sample stores) ─────────────
const OWNER = {
  name: "Matjar Samples",
  email: "samples@matjar.to",
  password: "MatjarDemo2025!",
};

// ─── Theme → sample store config ────────────────────────────────────────
// `lang: "ar"` opens the store in Arabic (target market); the EN/AR switcher
// still works and product/category/page content is bilingual.
const STORES = [
  { theme: "techhub",   subdomain: "electronics", en: "Volt Electronics",     ar: "فولت للإلكترونيات" },
  { theme: "modern",    subdomain: "fashion",     en: "Attire Fashion",       ar: "أتاير للأزياء" },
  { theme: "elegance",  subdomain: "boutique",    en: "Élégance Boutique",    ar: "بوتيك إيليجانس" },
  { theme: "aurum",     subdomain: "jewelry",     en: "Aurum Jewelry",        ar: "أوروم للمجوهرات" },
  { theme: "beauxe",    subdomain: "beauty",      en: "Beauxe Cosmetics",     ar: "بوكس للتجميل" },
  { theme: "glowing",   subdomain: "skincare",    en: "Glow Skincare",        ar: "جلو للعناية بالبشرة" },
  { theme: "bookshelf", subdomain: "books",       en: "The Bookshelf",        ar: "الرف — للكتب" },
  { theme: "freshmart", subdomain: "grocery",     en: "FreshMart Grocery",    ar: "فريش مارت للبقالة" },
  { theme: "kidsworld", subdomain: "toys",        en: "KidsWorld Toys",       ar: "عالم الأطفال للألعاب" },
  { theme: "homedecor", subdomain: "home",        en: "Casa Home Decor",      ar: "كازا لديكور المنزل" },
  { theme: "artisan",   subdomain: "handmade",    en: "Artisan Handmade",     ar: "أرتيزان للمصنوعات اليدوية" },
  { theme: "nutreko",   subdomain: "supplements", en: "Nutreko Supplements",  ar: "نوتريكو للمكملات" },
  { theme: "sportzone", subdomain: "sports",      en: "SportZone",            ar: "سبورت زون للرياضة" },
  { theme: "milmaa",    subdomain: "beverages",   en: "Milmaa Beverages",     ar: "ملماء للمشروبات" },
  { theme: "starter",   subdomain: "shop",        en: "Matjar Demo Shop",     ar: "متجر — متجر تجريبي" },
];

const LANG = "ar";
const CURRENCY = "SDG";

// ─── Store policies (bilingual: EN + AR in one body) ────────────────────
const policyBody = (en, ar) =>
  `<div dir="ltr">${en}</div><hr/><div dir="rtl">${ar}</div>`;

const POLICIES = {
  privacy: {
    title: "Privacy Policy / سياسة الخصوصية",
    body: policyBody(
      "<p>We respect your privacy. We collect only the information needed to process your orders and improve your experience, and we never sell your data. Your details are stored securely and shared only with the couriers and payment partners required to fulfil your order.</p>",
      "<p>نحترم خصوصيتك. نجمع فقط المعلومات اللازمة لمعالجة طلباتك وتحسين تجربتك، ولا نبيع بياناتك أبداً. تُحفظ بياناتك بشكل آمن ولا تُشارك إلا مع شركات التوصيل وشركاء الدفع اللازمين لإتمام طلبك.</p>"
    ),
  },
  returns: {
    title: "Returns & Refunds / الإرجاع والاسترداد",
    body: policyBody(
      "<p>Changed your mind? You can return most items within 14 days of delivery in their original condition. Once we receive and inspect the item, your refund is issued to the original payment method or as store credit.</p>",
      "<p>غيّرت رأيك؟ يمكنك إرجاع معظم المنتجات خلال 14 يوماً من الاستلام بحالتها الأصلية. بعد استلام المنتج وفحصه، يُصرف المبلغ إلى وسيلة الدفع الأصلية أو كرصيد في المتجر.</p>"
    ),
  },
  delivery: {
    title: "Delivery / التوصيل",
    body: policyBody(
      "<p>We deliver across the city within 1–3 business days, and to other states within 3–7 days. You'll get an order confirmation and can reach us any time on WhatsApp to track your delivery.</p>",
      "<p>نوصّل داخل المدينة خلال 1–3 أيام عمل، وإلى بقية الولايات خلال 3–7 أيام. ستصلك رسالة تأكيد بالطلب، ويمكنك التواصل معنا في أي وقت عبر واتساب لتتبّع طلبك.</p>"
    ),
  },
  cod: {
    title: "Cash on Delivery / الدفع عند الاستلام",
    body: policyBody(
      "<p>Pay with cash when your order arrives — no card needed. Please have the exact amount ready for the courier. Cash on delivery is available on all orders within our delivery zones.</p>",
      "<p>ادفع نقداً عند وصول طلبك — دون الحاجة لبطاقة. يُرجى تجهيز المبلغ بالضبط لمندوب التوصيل. الدفع عند الاستلام متاح لجميع الطلبات داخل مناطق التوصيل لدينا.</p>"
    ),
  },
};

// ─── Header nav (bilingual via translations.ar) ─────────────────────────
const headerMenuItems = () => [
  { label: "Home", translations: { ar: { label: "الرئيسية" } }, type: "link", url: "/", order: 0 },
  { label: "Shop", translations: { ar: { label: "التسوق" } }, type: "link", url: "/products", order: 1 },
  { label: "Collections", translations: { ar: { label: "المجموعات" } }, type: "link", url: "/collections", order: 2 },
  { label: "About", translations: { ar: { label: "من نحن" } }, type: "page", url: "/pages/about", order: 3 },
  { label: "Contact", translations: { ar: { label: "تواصل معنا" } }, type: "page", url: "/pages/contact", order: 4 },
];

// ─── Footer menu (bilingual via translations.ar) ────────────────────────
const footerMenuItems = () => [
  {
    label: "Shop", translations: { ar: { label: "التسوق" } }, type: "link", url: "/products", order: 0,
    children: [
      { label: "All Products", translations: { ar: { label: "كل المنتجات" } }, type: "link", url: "/products", order: 0 },
      { label: "Collections", translations: { ar: { label: "المجموعات" } }, type: "link", url: "/collections", order: 1 },
    ],
  },
  {
    label: "Company", translations: { ar: { label: "الشركة" } }, type: "link", url: "/about", order: 1,
    children: [
      { label: "About Us", translations: { ar: { label: "من نحن" } }, type: "page", url: "/pages/about", order: 0 },
      { label: "Contact", translations: { ar: { label: "تواصل معنا" } }, type: "page", url: "/pages/contact", order: 1 },
    ],
  },
  {
    label: "Help", translations: { ar: { label: "المساعدة" } }, type: "link", url: "/policies/delivery", order: 2,
    children: [
      { label: "Delivery", translations: { ar: { label: "التوصيل" } }, type: "link", url: "/policies/delivery", order: 0 },
      { label: "Returns", translations: { ar: { label: "الإرجاع" } }, type: "link", url: "/policies/returns", order: 1 },
      { label: "Privacy", translations: { ar: { label: "الخصوصية" } }, type: "link", url: "/policies/privacy", order: 2 },
    ],
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────
async function findTenantBySubdomain(subdomain) {
  const Tenant = mongoose.model("Tenant");
  return Tenant.findOne({ "domains.subdomain.name": subdomain });
}

async function ensureOwner() {
  // The first sample store creates the shared owner account; the rest are
  // added under it. Return an { existingUser } marker once we have one.
  const Tenant = mongoose.model("Tenant");
  const anyOwned = await Tenant.findOne({ email: OWNER.email }).lean();
  return anyOwned || null;
}

// English About/Contact pages (the demo seed creates the store-language ones —
// Arabic here; we add the English counterparts so pages are bilingual whichever
// locale the storefront requests).
const EN_PAGES = [
  {
    slug: "about",
    title: "About Us",
    content:
      "<p>Welcome to our store. We're a small team passionate about bringing you carefully chosen products, honest prices, and friendly service. This is a sample store built on Matjar — everything here, from the look to the catalog, is fully customizable for your own brand.</p><p>Have a question? We're always happy to help on WhatsApp.</p>",
  },
  {
    slug: "contact",
    title: "Contact",
    content:
      "<p>We'd love to hear from you. Reach us any time on WhatsApp for orders, delivery, or product questions — we usually reply within a few minutes during working hours.</p><p>You can also browse our shipping, returns, and privacy policies from the footer.</p>",
  },
];

async function seedEnglishPages(tenant, models) {
  const Page = models.Page;
  for (const p of EN_PAGES) {
    const exists = await Page.findOne({ slug: p.slug, locale: "en" });
    if (!exists) {
      await Page.create({
        tenantId: tenant._id,
        slug: p.slug,
        title: p.title,
        content: p.content,
        locale: "en",
        isPublished: true,
      });
    }
  }
}

async function seedPoliciesAndMenu(tenant, models) {
  const Tenant = mongoose.model("Tenant");
  // Policies live on tenant.settings.policies.<key> = { title, body }.
  const set = {};
  for (const [key, p] of Object.entries(POLICIES)) {
    set[`settings.policies.${key}.title`] = p.title;
    set[`settings.policies.${key}.body`] = p.body;
  }
  await Tenant.updateOne({ _id: tenant._id }, { $set: set });

  // Header + footer menus (idempotent by handle).
  const Menu = models.Menu;
  const menus = [
    { handle: "header", title: "Main menu", location: "header", items: headerMenuItems() },
    { handle: "footer", title: "Footer", location: "footer", items: footerMenuItems() },
  ];
  for (const m of menus) {
    if (!(await Menu.findOne({ handle: m.handle }))) {
      await Menu.create({ tenantId: tenant._id, isActive: true, ...m });
    }
  }
}

async function setupStore(cfg, ownerUser) {
  const existing = await findTenantBySubdomain(cfg.subdomain);
  if (existing) {
    console.log(`  ↷ ${cfg.subdomain} already exists (${existing._id}) — skipping`);
    return existing;
  }

  const storeData = {
    storeName: cfg.en,
    subdomain: cfg.subdomain,
    themeSlug: cfg.theme,
    themeSelected: true,
    niche: cfg.theme,
    currency: CURRENCY,
    language: LANG,
    subscriptionPlan: "trial",
    skipAutoSetup: true, // we drive setup synchronously below (seed LIVE, no DNS)
  };

  let res;
  if (ownerUser) {
    res = await addStoreForExistingUserService(
      { name: OWNER.name, email: OWNER.email, password: ownerUser.__passwordHash },
      storeData
    );
  } else {
    res = await addATenantService({ ...storeData, name: OWNER.name, email: OWNER.email, password: OWNER.password });
  }
  const tenantId = res?.responseObject?.tenantId;
  if (!tenantId) throw new Error(`tenant creation returned no id for ${cfg.subdomain}`);
  const Tenant = mongoose.model("Tenant");
  const tenant = await Tenant.findById(tenantId);
  const models = createScopedModels(mongoose.connection, tenant._id);

  // Store the Arabic display name too (settings.storeNameAr is read by nothing
  // yet, but harmless + future-proof) and confirm language/currency.
  await Tenant.updateOne(
    { _id: tenant._id },
    { $set: { "settings.language": LANG, "settings.currency": CURRENCY, "settings.storeNameAr": cfg.ar } }
  );

  // 1) Install the theme (writes themeCustomization draft + published from manifest).
  const Theme = mongoose.model("Theme");
  const theme = await Theme.findOne({ slug: cfg.theme, status: "active" });
  if (!theme) throw new Error(`theme ${cfg.theme} not found/active`);
  await installThemeService(theme._id, tenant._id);

  // 2) Seed the theme's bilingual demo catalog + pages + media — LIVE (not draft).
  const demo = await seedThemeDemoData(tenant._id, cfg.theme, { draft: false, language: LANG });

  // 3) Payment methods (COD + bank transfer defaults).
  await seedDefaultPaymentMethods(models, LANG);

  // 4) Policies + header/footer menus + English About/Contact pages.
  await seedPoliciesAndMenu(tenant, models);
  await seedEnglishPages(tenant, models);

  // 5) Publish the theme customization so the storefront serves it. Strict
  // publish validation can reject the demo media patch (it injects a hero
  // `background_image` some manifests don't declare); the install + demo seed
  // already populate the PUBLISHED sections bucket, so on failure we just stamp
  // publishedAt + mirror draft→published so the storefront serves it.
  try {
    await publishCustomizationService(tenant._id, { models });
  } catch (e) {
    const fresh = await Tenant.findById(tenant._id).lean();
    const tc = fresh.themeCustomization || {};
    await Tenant.updateOne(
      { _id: tenant._id },
      {
        $set: {
          "themeCustomization.published.sectionsByTemplate":
            tc.sectionsByTemplate || tc.published?.sectionsByTemplate || {},
          "themeCustomization.published.settings": tc.settings || {},
          "themeCustomization.published.publishedAt": new Date(),
          "themeCustomization.isDraft": false,
        },
      }
    );
    console.log(`    · publish fell back to direct snapshot (${e.message.split(":")[0]})`);
  }

  // 6) Flag the store live + setup complete.
  await Tenant.updateOne(
    { _id: tenant._id },
    { $set: { storeStatus: "live", "setupStatus.status": "completed", "setupStatus.completedAt": new Date() } }
  );

  console.log(`  ✓ ${cfg.subdomain} (${cfg.theme}) — products:${demo?.products ?? "?"} categories:${demo?.categories ?? "?"}`);
  return tenant;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--reset");
  const reset = process.argv.includes("--reset");
  const only = args[0];

  await connectDb();
  console.log(`Connected. Seeding sample stores${only ? ` (only: ${only})` : ""}${reset ? " [RESET]" : ""}\n`);

  const list = only ? STORES.filter((s) => s.theme === only || s.subdomain === only) : STORES;
  if (list.length === 0) {
    console.error(`No store matches "${only}"`);
    process.exit(1);
  }

  if (reset) {
    const Tenant = mongoose.model("Tenant");
    for (const cfg of list) {
      const t = await findTenantBySubdomain(cfg.subdomain);
      if (t) {
        const models = createScopedModels(mongoose.connection, t._id);
        await Promise.all([
          models.Product.deleteMany({}),
          models.Category.deleteMany({}),
          models.Collection.deleteMany({}),
          models.Page.deleteMany({}),
          models.Menu.deleteMany({}),
          models.User.deleteMany({}),
          models.PaymentMethod?.deleteMany({}).catch(() => {}),
        ]);
        // Domain registry rows (hostname → tenant) live in the admin `domains`
        // collection, two per store (with + without :port). Clear by tenantId.
        await mongoose.connection.collection("domains").deleteMany({ tenantId: t._id });
        await Tenant.deleteOne({ _id: t._id });
        console.log(`  ✗ reset ${cfg.subdomain}`);
      }
    }
  }

  // Resolve the shared owner (its password hash) if any sample store exists.
  let ownerUser = null;
  const ownerTenant = await ensureOwner();
  if (ownerTenant) {
    const models = createScopedModels(mongoose.connection, ownerTenant._id);
    const u = await models.User.findOne({ email: OWNER.email }).select("+password");
    if (u) ownerUser = { __passwordHash: u.password };
  }

  for (const cfg of list) {
    console.log(`→ ${cfg.en} (${cfg.theme} → ${cfg.subdomain})`);
    try {
      const tenant = await setupStore(cfg, ownerUser);
      if (!ownerUser && tenant) {
        const models = createScopedModels(mongoose.connection, tenant._id);
        const u = await models.User.findOne({ email: OWNER.email }).select("+password");
        if (u) ownerUser = { __passwordHash: u.password };
      }
    } catch (err) {
      console.error(`  ✗ FAILED ${cfg.subdomain}: ${err.message}`);
      logger.error("sample-store seed failed", { subdomain: cfg.subdomain, error: err.message, stack: err.stack });
    }
  }

  console.log(`\nDone. Shared login → email: ${OWNER.email}  password: ${OWNER.password}`);
  console.log("Log in per store with that email + the store's domain.");
  await mongoose.connection.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
