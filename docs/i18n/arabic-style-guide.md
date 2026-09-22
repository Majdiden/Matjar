# Arabic style guide — Matjar

The Arabic UI must read as though a native Arabic speaker wrote the product,
not as though English was translated. When a literal translation and a natural
phrasing disagree, **natural wins**. Audience: Sudanese and Gulf merchants and
shoppers. Register: Modern Standard Arabic, plain and direct — the Arabic of a
well-made consumer app, not of a legal notice or a newspaper editorial.

## 1. Voice

- **Address the user directly**, second person, imperative for actions:
  `احفظ`, `أضف`, `اختر`, `أدخل`. Never `قم بالحفظ` / `قم بإضافة` — the
  `قم بـ + مصدر` construction is the clearest sign of machine translation.
- **Buttons and menu items are bare verbs or nouns**, no pronouns, no
  politeness padding: `حذف` not `هل تريد الحذف؟`, `إرسال` not `الرجاء الإرسال`.
- **Explanations are full sentences** ending without a period when they are
  short helper labels, with a period when they are two sentences or more.
- **No exclamation marks** unless the English is genuinely celebratory.
- Avoid `يرجى` / `الرجاء` in every string; use it only where the English says
  "please" or where refusing politeness would read harshly.
- Prefer the active voice. `لم نتمكن من حفظ التغييرات` beats
  `لم يتم حفظ التغييرات` in error messages the user caused, but the passive is
  right for system events (`تم إلغاء الطلب`).

## 2. Orthography

- **Tanween sits before the alef**: `يومًا`, `شكرًا`, `أيضًا` — never `يوماً`.
- **Hamza**: `إ` / `أ` written correctly (`إعدادات`, `أضف`, `إرسال`). Never
  bare `ا` where hamza belongs.
- **Ta marbuta** `ة` never written as `ه`.
- **Alef maqsura** `ى` vs `ي` correct (`على`, `إلى`, `التي`).
- **Shadda only where it disambiguates** (`متغيّر`, `مؤقّت`). Do not vocalize
  decoratively: write `موثّق`, not `مُوثَّق`.
- **Numbers are Western digits** (0-9), matching the rest of the product.
- **No Latin letters inside Arabic sentences** unless the term is a brand or a
  code the user must type.

## 3. Plurals

Arabic has six i18next plural categories: `zero`, `one`, `two`, `few` (3-10),
`many` (11-99), `other` (100+). Where a key has plural forms, all six must be
present and grammatically correct:

```
"products_zero":  "لا توجد منتجات"
"products_one":   "منتج واحد"
"products_two":   "منتجان"
"products_few":   "{{count}} منتجات"
"products_many":  "{{count}} منتجًا"
"products_other": "{{count}} منتج"
```

Note the accusative `منتجًا` in `many` and the bare singular in `other` — this
is the rule, not a stylistic choice. Never leave a plural key as a single
form with `{{count}}` glued to a plural noun.

## 4. Brand and technical names — never translate

`Face ID`, `Touch ID`, `Google`, `Apple Pay`, `Shop Pay`, `PayPal`, `Stripe`,
`WhatsApp`, `Instagram`, `Cloudflare`, `Bankak`, `Fawry`, `OCash`, `Cashi`,
`Matjar`, `SDG`/`USD` currency codes, HTTP verbs, header names, file
extensions, and any placeholder token (`{{count}}`, `{{orderNumber}}`,
`<1>…</1>`) stay exactly as they are in English.

## 5. Glossary — use these, consistently

| English | Arabic | Notes |
|---|---|---|
| order (purchase) | طلب | `الترتيب` only means sort order |
| sort order | الترتيب | |
| product | منتج | |
| variant | متغيّر | |
| collection | مجموعة | |
| category | فئة | |
| customer | عميل | |
| cart | سلة التسوق / السلة | |
| checkout | إتمام الشراء | not `الدفع` alone |
| payment | الدفع | |
| shipping | الشحن | |
| delivery | التوصيل | |
| fulfillment | تجهيز الطلب | |
| refund | استرداد | |
| discount | خصم | |
| coupon code | رمز الخصم | |
| stock / inventory | المخزون | |
| in stock | متوفر | |
| out of stock | نفد المخزون | |
| pre-order | طلب مسبق | |
| add to cart | أضف إلى السلة | |
| buy now | اشترِ الآن | note the kasra on `اشترِ` |
| wishlist | المفضّلة | not `قائمة الرغبات` |
| review (product) | تقييم | |
| rating | التقييم | |
| subtotal | المجموع الفرعي | |
| total | الإجمالي | |
| tax | الضريبة | |
| theme | قالب | |
| typography | الخطوط | **never** `الطباعة` (that is printing) |
| layout | التخطيط | |
| section | قسم | |
| dashboard | لوحة التحكم | |
| settings | الإعدادات | |
| storefront | واجهة المتجر | |
| draft | مسودة | |
| publish | نشر | |
| preview | معاينة | |
| tag | وسم | |
| password | كلمة المرور | |
| passkey | مفتاح المرور | |
| sign in / log in | تسجيل الدخول | |
| sign out | تسجيل الخروج | |
| email | البريد الإلكتروني | |
| placeholder (template token) | حقل متغيّر | not `عنصر نائب` |
| remove | إزالة | distinct from `حذف` (delete) |
| delete | حذف | permanent |
| edit | تعديل | |
| save | حفظ | |
| apply | تطبيق | |
| filter | تصفية | |
| search | البحث | |
| support ticket | تذكرة دعم | |
| staff / team member | موظف | |
| role | دور | |
| permission | صلاحية | |
| webhook | Webhook | keep Latin; `ويب هوك` reads badly |

## 6. Event vs. notification phrasing

- **Event names** in lists, logs and webhook pickers are noun phrases:
  `إنشاء طلب`, `تحديث منتج`.
- **Messages telling the user something happened** are verb phrases in the
  past: `تم إنشاء الطلب`, `تم تحديث المنتج`.

Do not mix the two within a surface.

## 7. Definiteness

Standalone column headers, filter labels and form labels take the definite
article when they name a concept (`الحالة`, `الإجمالي`, `العميل`), and drop it
when they are a count or a type in a list (`طلب جديد`, `منتج مميّز`). Be
consistent within one screen.

## 8. Before you commit

- The Arabic and English files must have **identical key sets**.
- Every `{{placeholder}}`, `<1>tag</1>` and `$t(...)` reference must survive
  unchanged and in a position that makes grammatical sense in Arabic.
- No string may be left in English unless it is on the do-not-translate list.
- JSON must parse, with no trailing commas and no duplicated keys.
