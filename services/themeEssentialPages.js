/**
 * Essential storefront pages
 * --------------------------
 * Every theme's chrome links to the same handful of content pages — About,
 * Contact and FAQ sit in the footer, the mobile drawer and (usually) the main
 * menu. Before this module a freshly installed theme linked to pages that did
 * not exist yet, so a brand-new store shipped with 404s in its own footer.
 *
 * `ensureEssentialPages` creates those pages at theme-install time in BOTH
 * locales, and is deliberately conservative:
 *
 *   - idempotent per (tenantId, slug, locale) — re-installing a theme, or
 *     switching themes, never duplicates or overwrites anything;
 *   - it only ever CREATES. A merchant who has edited their About page keeps
 *     exactly what they wrote, in every locale they wrote it in;
 *   - flagged `isDemo: true`, so it is distinguishable from merchant-authored
 *     pages and removable by the starter-content tooling;
 *   - published on creation, because the links that point at them are already
 *     live in the theme's footer.
 *
 * The copy is starter copy with no invented facts — no phone numbers, no
 * addresses, no claims. It tells the merchant what to replace.
 */

import mongoose from "mongoose";
import logger from "../utils/logger.js";

/** Pages every theme links to. Keep slugs in sync with the themes' footers. */
const ESSENTIAL_PAGES = {
  en: [
    {
      slug: "about",
      title: "About Us",
      metaTitle: "About Us",
      metaDescription: "Our story, and what we stand for.",
      content:
        "<h2>Our story</h2>" +
        "<p>Welcome. This is where you tell customers who you are: how the shop started, what you choose to sell, and why they should trust you with an order.</p>" +
        "<h2>What we promise</h2>" +
        "<p>Describe how you pick what you stock, how you pack it, and what happens if something isn't right. Short and specific beats long and vague.</p>" +
        "<h2>Get in touch</h2>" +
        "<p>Point people at the fastest way to reach you, then replace this starter text with your own.</p>",
    },
    {
      slug: "contact",
      title: "Contact",
      metaTitle: "Contact",
      metaDescription: "How to reach us.",
      content:
        "<h2>Talk to us</h2>" +
        "<p>Tell customers the quickest way to reach you and roughly how long a reply takes.</p>" +
        "<h2>Details to fill in</h2>" +
        "<ul>" +
        "<li><strong>WhatsApp:</strong> add your number</li>" +
        "<li><strong>Phone:</strong> add your number</li>" +
        "<li><strong>Email:</strong> add your address</li>" +
        "<li><strong>Address:</strong> add your location, if you have a shopfront</li>" +
        "<li><strong>Hours:</strong> add the days and times you answer</li>" +
        "</ul>" +
        "<p>These are placeholders — replace them with your real details.</p>",
    },
    {
      slug: "faq",
      title: "FAQ",
      metaTitle: "Frequently asked questions",
      metaDescription: "Answers to the questions customers ask most.",
      content:
        "<h2>How long does delivery take?</h2>" +
        "<p>Set out your delivery times by area, and say what happens if an order is delayed.</p>" +
        "<h2>How do I pay?</h2>" +
        "<p>List the payment methods you accept, and whether you take cash on delivery.</p>" +
        "<h2>Can I return something?</h2>" +
        "<p>State your return window and the condition items need to be in.</p>" +
        "<h2>How do I track my order?</h2>" +
        "<p>Explain how customers check where an order is, and who to contact if they're stuck.</p>",
    },
  ],
  ar: [
    {
      slug: "about",
      title: "من نحن",
      metaTitle: "من نحن",
      metaDescription: "قصّتنا، وما نؤمن به.",
      content:
        "<h2>قصّتنا</h2>" +
        "<p>أهلًا بك. هنا تحكي لعملائك من أنت: كيف بدأ المتجر، وما الذي تختار بيعه، ولماذا يطمئنّون حين يطلبون منك.</p>" +
        "<h2>ما نلتزم به</h2>" +
        "<p>اشرح كيف تختار ما تعرضه، وكيف تُغلّفه، وما الذي يحدث إن لم يكن الطلب كما توقّع العميل. الوضوح والاختصار أفضل من الإطالة.</p>" +
        "<h2>تواصل معنا</h2>" +
        "<p>دُلّ الناس على أسرع طريقة للوصول إليك، ثم استبدل هذا النص المبدئي بنصّك أنت.</p>",
    },
    {
      slug: "contact",
      title: "تواصل معنا",
      metaTitle: "تواصل معنا",
      metaDescription: "كيف تصل إلينا.",
      content:
        "<h2>كلّمنا</h2>" +
        "<p>أخبر عملاءك بأسرع وسيلة للوصول إليك، وكم يستغرق الردّ عادةً.</p>" +
        "<h2>بيانات تحتاج إلى تعبئة</h2>" +
        "<ul>" +
        "<li><strong>واتساب:</strong> أضف رقمك</li>" +
        "<li><strong>الهاتف:</strong> أضف رقمك</li>" +
        "<li><strong>البريد الإلكتروني:</strong> أضف عنوانك</li>" +
        "<li><strong>العنوان:</strong> أضف موقعك إن كان لديك محلّ</li>" +
        "<li><strong>أوقات العمل:</strong> أضف الأيام والساعات التي تردّ فيها</li>" +
        "</ul>" +
        "<p>هذه بيانات مبدئية — استبدلها ببياناتك الحقيقية.</p>",
    },
    {
      slug: "faq",
      title: "الأسئلة الشائعة",
      metaTitle: "الأسئلة الشائعة",
      metaDescription: "إجابات عن أكثر ما يسأل عنه العملاء.",
      content:
        "<h2>كم يستغرق التوصيل؟</h2>" +
        "<p>وضّح مدّة التوصيل حسب المنطقة، وما الذي يحدث إن تأخّر الطلب.</p>" +
        "<h2>كيف أدفع؟</h2>" +
        "<p>اذكر طرق الدفع التي تقبلها، وهل الدفع عند الاستلام متاح.</p>" +
        "<h2>هل يمكنني الإرجاع؟</h2>" +
        "<p>حدّد مدّة الإرجاع والحالة التي ينبغي أن تكون عليها القطعة.</p>" +
        "<h2>كيف أتابع طلبي؟</h2>" +
        "<p>اشرح كيف يعرف العميل أين وصل طلبه، وبمن يتصل إن احتاج مساعدة.</p>",
    },
  ],
};

export const ESSENTIAL_PAGE_SLUGS = ESSENTIAL_PAGES.en.map((p) => p.slug);

/**
 * Create any missing essential pages for a tenant, in both locales.
 *
 * Never throws: a content-seeding failure must not fail a theme install, which
 * is the user-visible action that triggered it.
 *
 * @param {import("mongoose").Types.ObjectId|string} tenantId
 * @param {{ locales?: string[], publish?: boolean }} [options]
 * @returns {Promise<{ created: number, skipped: number }>}
 */
export async function ensureEssentialPages(tenantId, options = {}) {
  const { locales = ["en", "ar"], publish = true } = options;
  let created = 0;
  let skipped = 0;

  try {
    const Page = mongoose.model("Page");
    const now = new Date();

    for (const locale of locales) {
      const docs = ESSENTIAL_PAGES[locale];
      if (!docs) continue;

      for (const page of docs) {
        // (tenantId, slug, locale) is the unique index — match it exactly so a
        // merchant's existing page in either language is left untouched.
        const exists = await Page.findOne({ tenantId, slug: page.slug, locale })
          .select("_id")
          .lean();
        if (exists) {
          skipped += 1;
          continue;
        }

        await Page.create({
          tenantId,
          slug: page.slug,
          title: page.title,
          content: page.content,
          metaTitle: page.metaTitle,
          metaDescription: page.metaDescription,
          locale,
          isPublished: publish,
          publishedAt: publish ? now : null,
          isDemo: true,
        });
        created += 1;
      }
    }
  } catch (err) {
    logger.warn("Failed to ensure essential storefront pages", {
      tenantId: tenantId?.toString(),
      error: err.message,
    });
  }

  return { created, skipped };
}

export default ensureEssentialPages;
