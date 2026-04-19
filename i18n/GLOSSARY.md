# Arabic Translation Glossary — Single Source of Truth

This is the **canonical** English→Arabic dictionary for every surface
of the platform: merchant dashboard, all 14 storefront themes, and
shared components/sections.

**Rules for every translator agent:**

1. If a term appears here, use this translation. Do not paraphrase.
2. If a term does NOT appear here, propose a translation in your
   commit message and add it to this file in the same change.
3. Arabic is RTL. Numbers stay LTR. Prices stay LTR. Dates use Arabic
   locale formatting (`Intl.DateTimeFormat('ar-SD')`).
4. Punctuation: use Arabic comma `،` and Arabic question mark `؟`
   inside Arabic strings. Keep English punctuation when interpolating
   English (brand names, numbers, codes).
5. Sentence case in English → no caps in Arabic (Arabic has no case).
6. Avoid colloquial dialects. Use **Modern Standard Arabic (MSA)**
   throughout — the platform is multi-region.
7. Brand and product names stay in their original script unless the
   merchant configures otherwise.
8. Honor pluralization with i18next's plural rules (Arabic has 6
   plural forms: `zero`, `one`, `two`, `few`, `many`, `other`).

---

## A. Core UI verbs (buttons, actions)

| English     | Arabic         |
| ----------- | -------------- |
| Save        | حفظ            |
| Cancel      | إلغاء          |
| Delete      | حذف            |
| Remove      | إزالة          |
| Edit        | تعديل          |
| Add         | إضافة          |
| Create      | إنشاء          |
| Update      | تحديث          |
| Submit      | إرسال          |
| Send        | إرسال          |
| Apply       | تطبيق          |
| Reset       | إعادة تعيين    |
| Confirm     | تأكيد          |
| Close       | إغلاق          |
| Open        | فتح            |
| View        | عرض            |
| Show        | عرض            |
| Hide        | إخفاء          |
| Search      | بحث            |
| Filter      | تصفية          |
| Sort        | ترتيب          |
| Refresh     | تحديث          |
| Reload      | إعادة تحميل    |
| Copy        | نسخ            |
| Paste       | لصق            |
| Cut         | قص             |
| Duplicate   | نسخ            |
| Download    | تنزيل          |
| Upload      | رفع            |
| Import      | استيراد        |
| Export      | تصدير          |
| Print       | طباعة          |
| Share       | مشاركة         |
| Subscribe   | اشتراك         |
| Unsubscribe | إلغاء الاشتراك |
| Follow      | متابعة         |
| Unfollow    | إلغاء المتابعة |
| Continue    | متابعة         |
| Back        | رجوع           |
| Next        | التالي         |
| Previous    | السابق         |
| Skip        | تخطي           |
| Done        | تم             |
| Finish      | إنهاء          |
| Start       | بدء            |
| Restart     | إعادة التشغيل  |
| Pause       | إيقاف مؤقت     |
| Resume      | استئناف        |
| Activate    | تفعيل          |
| Deactivate  | إلغاء التفعيل  |
| Enable      | تمكين          |
| Disable     | تعطيل          |
| Approve     | الموافقة       |
| Reject      | رفض            |
| Accept      | قبول           |
| Decline     | رفض            |
| Try again   | حاول مرة أخرى  |
| Learn more  | اعرف المزيد    |
| See more    | عرض المزيد     |
| See less    | عرض أقل        |
| Show more   | عرض المزيد     |
| Show less   | عرض أقل        |
| Read more   | اقرأ المزيد    |
| Get started | ابدأ الآن      |
| Sign in     | تسجيل الدخول   |
| Sign up     | إنشاء حساب     |
| Sign out    | تسجيل الخروج   |
| Log in      | تسجيل الدخول   |
| Log out     | تسجيل الخروج   |
| Register    | التسجيل        |

## B. Generic states

| English     | Arabic        |
| ----------- | ------------- |
| Yes         | نعم           |
| No          | لا            |
| OK          | حسناً         |
| Loading     | جاري التحميل  |
| Loading…    | جاري التحميل… |
| Saving      | جاري الحفظ    |
| Saving…     | جاري الحفظ…   |
| Sending     | جاري الإرسال  |
| Processing  | جاري المعالجة |
| Success     | تم بنجاح      |
| Saved       | تم الحفظ      |
| Sent        | تم الإرسال    |
| Updated     | تم التحديث    |
| Deleted     | تم الحذف      |
| Created     | تم الإنشاء    |
| Error       | خطأ           |
| Warning     | تحذير         |
| Info        | معلومات       |
| Required    | مطلوب         |
| Optional    | اختياري       |
| Recommended | موصى به       |
| Active      | نشط           |
| Inactive    | غير نشط       |
| Enabled     | مفعّل         |
| Disabled    | معطّل         |
| Online      | متصل          |
| Offline     | غير متصل      |
| Available   | متاح          |
| Unavailable | غير متاح      |
| Default     | افتراضي       |
| Custom      | مخصص          |
| Selected    | محدد          |
| Unselected  | غير محدد      |
| All         | الكل          |
| None        | لا شيء        |
| Other       | أخرى          |
| More        | المزيد        |
| Less        | أقل           |
| New         | جديد          |
| Old         | قديم          |
| Recent      | حديث          |
| Popular     | الأكثر رواجاً |
| Featured    | مميّز         |
| Latest      | الأحدث        |
| Top         | الأعلى        |
| Bottom      | الأسفل        |

## C. Commerce nouns (the most important section)

| English              | Arabic                   |
| -------------------- | ------------------------ |
| Store                | المتجر                   |
| Storefront           | واجهة المتجر             |
| Shop                 | المتجر                   |
| Marketplace          | السوق                    |
| Product              | منتج                     |
| Products             | المنتجات                 |
| Category             | الفئة                    |
| Categories           | الفئات                   |
| Subcategory          | الفئة الفرعية            |
| Collection           | المجموعة                 |
| Collections          | المجموعات                |
| Brand                | العلامة التجارية         |
| Brands               | العلامات التجارية        |
| Variant              | متغيّر                   |
| Variants             | المتغيّرات               |
| Option               | خيار                     |
| Options              | الخيارات                 |
| SKU                  | رمز المنتج               |
| Barcode              | الباركود                 |
| Image                | صورة                     |
| Images               | الصور                    |
| Gallery              | المعرض                   |
| Description          | الوصف                    |
| Specifications       | المواصفات                |
| Features             | الميّزات                 |
| Title                | العنوان                  |
| Subtitle             | العنوان الفرعي           |
| Tag                  | علامة                    |
| Tags                 | العلامات                 |
| Slug                 | المعرّف                  |
| Cart                 | سلة التسوق               |
| Add to cart          | إضافة إلى السلة          |
| Remove from cart     | إزالة من السلة           |
| Empty cart           | السلة فارغة              |
| Your cart is empty   | سلتك فارغة               |
| Wishlist             | قائمة الأمنيات           |
| Add to wishlist      | إضافة إلى قائمة الأمنيات |
| Remove from wishlist | إزالة من قائمة الأمنيات  |
| Favorite             | المفضّلة                 |
| Favorites            | المفضّلة                 |
| Compare              | مقارنة                   |
| Quick view           | عرض سريع                 |
| Order                | طلب                      |
| Orders               | الطلبات                  |
| Order number         | رقم الطلب                |
| Order date           | تاريخ الطلب              |
| Order status         | حالة الطلب               |
| Order summary        | ملخّص الطلب              |
| Order details        | تفاصيل الطلب             |
| Order history        | سجل الطلبات              |
| Track order          | تتبع الطلب               |
| Order tracking       | تتبع الطلب               |
| Checkout             | إتمام الشراء             |
| Proceed to checkout  | المتابعة إلى الدفع       |
| Place order          | تأكيد الطلب              |
| Buy now              | اشترِ الآن               |
| Continue shopping    | متابعة التسوق            |
| Customer             | العميل                   |
| Customers            | العملاء                  |
| Guest                | ضيف                      |
| Account              | الحساب                   |
| My account           | حسابي                    |
| Profile              | الملف الشخصي             |
| Address              | العنوان                  |
| Addresses            | العناوين                 |
| Shipping address     | عنوان الشحن              |
| Billing address      | عنوان الفوترة            |
| Same as shipping     | نفس عنوان الشحن          |
| Add address          | إضافة عنوان              |
| Phone                | الهاتف                   |
| Phone number         | رقم الهاتف               |
| Email                | البريد الإلكتروني        |
| Password             | كلمة المرور              |
| Confirm password     | تأكيد كلمة المرور        |
| Current password     | كلمة المرور الحالية      |
| New password         | كلمة المرور الجديدة      |
| Forgot password?     | هل نسيت كلمة المرور؟     |
| Reset password       | إعادة تعيين كلمة المرور  |
| Change password      | تغيير كلمة المرور        |
| Name                 | الاسم                    |
| First name           | الاسم الأول              |
| Last name            | الاسم الأخير             |
| Full name            | الاسم الكامل             |
| Country              | الدولة                   |
| State                | الولاية                  |
| Province             | المقاطعة                 |
| City                 | المدينة                  |
| Postal code          | الرمز البريدي            |
| ZIP code             | الرمز البريدي            |
| Street               | الشارع                   |
| Apartment            | الشقة                    |
| Building             | المبنى                   |

## D. Money & numbers

| English            | Arabic               |
| ------------------ | -------------------- |
| Price              | السعر                |
| Sale price         | سعر التخفيض          |
| Regular price      | السعر الأصلي         |
| From               | من                   |
| Quantity           | الكمية               |
| Qty                | الكمية               |
| Subtotal           | الإجمالي الفرعي      |
| Total              | الإجمالي             |
| Grand total        | الإجمالي الكلي       |
| Discount           | الخصم                |
| Discounts          | الخصومات             |
| Coupon             | القسيمة              |
| Coupon code        | كود القسيمة          |
| Promo code         | كود الترويج          |
| Apply code         | تطبيق الكود          |
| Tax                | الضريبة              |
| Taxes              | الضرائب              |
| VAT                | ضريبة القيمة المضافة |
| Shipping           | الشحن                |
| Shipping cost      | تكلفة الشحن          |
| Free shipping      | شحن مجاني            |
| Estimated shipping | الشحن المقدّر        |
| Estimated delivery | التسليم المقدّر      |
| Currency           | العملة               |
| Save 20%           | وفّر 20%             |
| Off                | خصم                  |
| Items in cart      | العناصر في العربة    |
| 1 item             | عنصر واحد            |
| {{count}} items    | {{count}} عناصر      |

## E. Order/fulfillment statuses

| English             | Arabic           |
| ------------------- | ---------------- |
| Draft               | مسودة            |
| Pending             | قيد الانتظار     |
| Processing          | قيد المعالجة     |
| Confirmed           | مؤكّد            |
| Paid                | مدفوع            |
| Unpaid              | غير مدفوع        |
| Refunded            | تم الاسترداد     |
| Partially refunded  | تم استرداد جزئي  |
| Voided              | ملغى             |
| Authorized          | مفوّض            |
| Captured            | محصّل            |
| Shipped             | تم الشحن         |
| Out for delivery    | في الطريق إليك   |
| Delivered           | تم التسليم       |
| Returned            | تم الإرجاع       |
| Cancelled           | ملغى             |
| Completed           | مكتمل            |
| Failed              | فشل              |
| Fulfilled           | تم التنفيذ       |
| Unfulfilled         | لم يتم التنفيذ   |
| Partially fulfilled | تنفيذ جزئي       |
| In stock            | متوفر            |
| Out of stock        | غير متوفر        |
| Low stock           | مخزون منخفض      |
| {{count}} in stock  | {{count}} متوفّر |
| Sold out            | نفد المخزون      |
| Pre-order           | الطلب المسبق     |
| Backorder           | طلب مؤجّل        |
| On hold             | قيد الانتظار     |
| Open                | مفتوح            |
| Closed              | مغلق             |
| Archived            | مؤرشف            |
| Live                | مباشر            |
| Published           | منشور            |
| Unpublished         | غير منشور        |

## F. Dashboard / merchant terms

| English           | Arabic            |
| ----------------- | ----------------- |
| Dashboard         | لوحة التحكم       |
| Home              | الرئيسية          |
| Overview          | نظرة عامة         |
| Analytics         | التحليلات         |
| Reports           | التقارير          |
| Insights          | الإحصاءات         |
| Settings          | الإعدادات         |
| Configuration     | الإعدادات         |
| Preferences       | التفضيلات         |
| Account settings  | إعدادات الحساب    |
| Store settings    | إعدادات المتجر    |
| Notifications     | الإشعارات         |
| Notification      | إشعار             |
| Mark as read      | تحديد كمقروء      |
| Mark all as read  | تحديد الكل كمقروء |
| Unread            | غير مقروء         |
| Read              | مقروء             |
| Inventory         | المخزون           |
| Stock management  | إدارة المخزون     |
| Catalog           | الكتالوج          |
| Marketing         | التسويق           |
| Promotion         | عرض ترويجي        |
| Promotions        | العروض الترويجية  |
| Campaign          | حملة              |
| Campaigns         | الحملات           |
| Discount code     | كود الخصم         |
| Gift card         | بطاقة الهدايا     |
| Gift cards        | بطاقات الهدايا    |
| Reviews           | المراجعات         |
| Review            | مراجعة            |
| Rating            | التقييم           |
| Stars             | نجوم              |
| Star              | نجمة              |
| Customer review   | مراجعة العميل     |
| Storefront        | واجهة المتجر      |
| Themes            | القوالب           |
| Theme             | القالب            |
| Theme editor      | محرر القوالب      |
| Customize         | تخصيص             |
| Pages             | الصفحات           |
| Page              | صفحة              |
| Menus             | القوائم           |
| Menu              | القائمة           |
| Navigation        | التنقل            |
| Domains           | النطاقات          |
| Domain            | النطاق            |
| Custom domain     | نطاق مخصص         |
| Apps              | التطبيقات         |
| Integrations      | عمليات التكامل    |
| Webhook           | خطّاف الويب       |
| Webhooks          | خطّافات الويب     |
| API               | واجهة برمجية      |
| API key           | مفتاح API         |
| Staff             | الموظفون          |
| Staff member      | موظف              |
| Team              | الفريق            |
| Members           | الأعضاء           |
| Member            | عضو               |
| Invite            | دعوة              |
| Invitation        | دعوة              |
| Send invite       | إرسال دعوة        |
| Roles             | الأدوار           |
| Role              | الدور             |
| Permissions       | الصلاحيات         |
| Permission        | صلاحية            |
| Owner             | المالك            |
| Admin             | المسؤول           |
| Manager           | المدير            |
| Editor            | المحرر            |
| Viewer            | المُشاهد          |
| Markets           | الأسواق           |
| Market            | السوق             |
| Region            | المنطقة           |
| Regions           | المناطق           |
| Locale            | اللغة المنطقية    |
| Language          | اللغة             |
| Languages         | اللغات            |
| Customer segment  | شريحة العملاء     |
| Customer segments | شرائح العملاء     |
| Custom field      | حقل مخصص          |
| Custom fields     | الحقول المخصصة    |
| Subscription      | الاشتراك          |
| Subscriptions     | الاشتراكات        |
| Plan              | الخطة             |
| Plans             | الخطط             |
| Billing           | الفوترة           |
| Invoices          | الفواتير          |
| Invoice           | الفاتورة          |
| Payment method    | طريقة الدفع       |
| Payment methods   | طرق الدفع         |
| Payments          | المدفوعات         |
| Payment           | الدفع             |
| Transaction       | المعاملة          |
| Transactions      | المعاملات         |
| Refund            | الاسترداد         |
| Refunds           | الاستردادات       |
| Issue refund      | إصدار استرداد     |
| Capture           | تحصيل             |
| Authorize         | تفويض             |
| Audit log         | سجل التدقيق       |
| Audit logs        | سجلات التدقيق     |
| Activity          | النشاط            |
| Activity log      | سجل النشاط        |
| Fulfillment       | التنفيذ           |
| Fulfillments      | عمليات التنفيذ    |
| Fulfill           | تنفيذ             |
| Mark as fulfilled | تحديد كمنفّذ      |
| Tracking number   | رقم التتبع        |
| Carrier           | شركة الشحن        |
| Shipping zone     | منطقة الشحن       |
| Shipping zones    | مناطق الشحن       |
| Shipping rate     | تعرفة الشحن       |
| Shipping method   | طريقة الشحن       |
| Tax rule          | قاعدة ضريبية      |
| Tax rules         | القواعد الضريبية  |
| Tax rate          | المعدّل الضريبي   |
| Tax behaviour     | سلوك الضريبة      |
| Branding          | الهوية            |
| Logo              | الشعار            |
| Favicon           | الأيقونة المفضلة  |
| Timezone          | المنطقة الزمنية   |
| Exchange rate     | سعر الصرف         |
| Exchange rates    | أسعار الصرف       |
| Base currency     | العملة الأساسية   |
| Price adjustment  | تعديل السعر       |
| Flat rate         | تعرفة ثابتة       |
| Flat shipping     | شحن ثابت          |
| Sender            | المرسِل           |
| Email template    | قالب البريد الإلكتروني |
| Email templates   | قوالب البريد الإلكتروني |
| Order emails      | رسائل الطلبات     |
| Browser notification | إشعار المتصفح  |
| Sound channel     | قناة الصوت        |
| Inbox             | صندوق الوارد      |
| Toast notification | إشعار لحظي       |

## G. Form & validation

| English                             | Arabic                         |
| ----------------------------------- | ------------------------------ |
| This field is required              | هذا الحقل مطلوب                |
| Invalid email                       | البريد الإلكتروني غير صالح     |
| Invalid phone number                | رقم الهاتف غير صالح            |
| Invalid URL                         | الرابط غير صالح                |
| Password too short                  | كلمة المرور قصيرة جداً         |
| Passwords do not match              | كلمتا المرور غير متطابقتين     |
| Must be a number                    | يجب أن يكون رقماً              |
| Must be at least {{min}} characters | يجب ألا يقل عن {{min}} حرفاً   |
| Must be at most {{max}} characters  | يجب ألا يزيد عن {{max}} حرفاً  |
| Please enter a valid value          | الرجاء إدخال قيمة صالحة        |
| Choose a file                       | اختر ملفاً                     |
| Drop files here                     | أسقط الملفات هنا               |
| Drag and drop                       | اسحب وأفلت                     |
| Browse                              | تصفّح                          |
| Upload image                        | رفع صورة                       |
| Upload file                         | رفع ملف                        |
| File too large                      | حجم الملف كبير جداً            |
| Unsupported file type               | نوع الملف غير مدعوم            |
| Saved successfully                  | تم الحفظ بنجاح                 |
| Failed to save                      | فشل الحفظ                      |
| Are you sure?                       | هل أنت متأكد؟                  |
| This action cannot be undone        | لا يمكن التراجع عن هذا الإجراء |
| Yes, delete                         | نعم، احذف                      |
| Yes, continue                       | نعم، تابع                      |

## H. Empty / error / loading states

| English                     | Arabic              |
| --------------------------- | ------------------- |
| No results found            | لا توجد نتائج       |
| No items found              | لا توجد عناصر       |
| No data                     | لا توجد بيانات      |
| Nothing here yet            | لا يوجد شيء هنا بعد |
| Get started by creating one | ابدأ بإنشاء واحد    |
| Something went wrong        | حدث خطأ ما          |
| Page not found              | الصفحة غير موجودة   |
| 404                         | 404                 |
| Go back home                | العودة إلى الرئيسية |
| Try again                   | حاول مرة أخرى       |
| Connection lost             | انقطع الاتصال       |
| Offline                     | غير متصل            |

## I. Date/time

| English           | Arabic          |
| ----------------- | --------------- |
| Today             | اليوم           |
| Yesterday         | أمس             |
| Tomorrow          | غداً            |
| This week         | هذا الأسبوع     |
| Last week         | الأسبوع الماضي  |
| This month        | هذا الشهر       |
| Last month        | الشهر الماضي    |
| This year         | هذه السنة       |
| Last year         | السنة الماضية   |
| Date              | التاريخ         |
| Time              | الوقت           |
| Date range        | النطاق الزمني   |
| From              | من              |
| To                | إلى             |
| Start date        | تاريخ البدء     |
| End date          | تاريخ الانتهاء  |
| {{n}} minutes ago | منذ {{n}} دقائق |
| {{n}} hours ago   | منذ {{n}} ساعات |
| {{n}} days ago    | منذ {{n}} أيام  |
| Just now          | الآن            |

## J. Pagination

| English                              | Arabic                           |
| ------------------------------------ | -------------------------------- |
| Page {{n}} of {{total}}              | صفحة {{n}} من {{total}}          |
| Showing {{from}}-{{to}} of {{total}} | عرض {{from}}-{{to}} من {{total}} |
| Rows per page                        | الصفوف لكل صفحة                  |
| Per page                             | لكل صفحة                         |
| First                                | الأولى                           |
| Last                                 | الأخيرة                          |

## K. Storefront-only terms (themes)

| English                 | Arabic                     |
| ----------------------- | -------------------------- |
| Welcome                 | أهلاً وسهلاً               |
| Welcome back            | أهلاً بعودتك               |
| Hero                    | الرئيسي                    |
| Featured products       | المنتجات المميّزة          |
| Best sellers            | الأكثر مبيعاً              |
| New arrivals            | الوصول حديثاً              |
| Trending                | الرائج                     |
| Recommended for you     | مقترح لك                   |
| You may also like       | قد يعجبك أيضاً             |
| Related products        | منتجات ذات صلة             |
| Recently viewed         | شاهدتها مؤخراً             |
| Shop by category        | تسوّق حسب الفئة            |
| Shop by brand           | تسوّق حسب العلامة          |
| Shop now                | تسوّق الآن                 |
| Explore                 | استكشف                     |
| Discover                | اكتشف                      |
| Get inspired            | استلهم                     |
| Newsletter              | النشرة البريدية            |
| Subscribe to newsletter | اشترك في النشرة البريدية   |
| Enter your email        | أدخل بريدك الإلكتروني      |
| Thanks for subscribing  | شكراً لاشتراكك             |
| Follow us               | تابعنا                     |
| About us                | من نحن                     |
| Contact us              | اتصل بنا                   |
| Contact                 | تواصل معنا                 |
| Get in touch            | تواصل معنا                 |
| FAQ                     | الأسئلة الشائعة            |
| Help                    | المساعدة                   |
| Support                 | الدعم                      |
| Customer service        | خدمة العملاء               |
| Privacy policy          | سياسة الخصوصية             |
| Terms of service        | شروط الخدمة                |
| Terms & conditions      | الشروط والأحكام            |
| Returns                 | الإرجاع                    |
| Returns policy          | سياسة الإرجاع              |
| Shipping policy         | سياسة الشحن                |
| Refund policy           | سياسة الاسترداد            |
| Cookie policy           | سياسة ملفات تعريف الارتباط |
| Made with love          | صُنع بحب                   |
| All rights reserved     | جميع الحقوق محفوظة         |
| Powered by              | مدعوم من                   |
| {{year}}                | {{year}}                   |

## L. Product detail specifics

| English             | Arabic                |
| ------------------- | --------------------- |
| Color               | اللون                 |
| Colors              | الألوان               |
| Size                | المقاس                |
| Sizes               | المقاسات              |
| Material            | المادة                |
| Materials           | المواد                |
| Weight              | الوزن                 |
| Dimensions          | الأبعاد               |
| Capacity            | السعة                 |
| Style               | الأسلوب               |
| Pattern             | النمط                 |
| Fit                 | المقاس                |
| Care                | العناية               |
| Origin              | بلد المنشأ            |
| Reviews ({{count}}) | المراجعات ({{count}}) |
| Write a review      | اكتب مراجعة           |
| Submit review       | إرسال المراجعة        |
| Rate this product   | قيّم هذا المنتج       |
| Helpful             | مفيد                  |
| Verified buyer      | مشترٍ موثّق           |
| Specifications      | المواصفات             |
| Shipping & returns  | الشحن والإرجاع        |
| Ships in {{n}} days | يُشحن خلال {{n}} أيام |

## N. New terms added by staff/reviews/webhooks/notifications/subscriptions/audit agent

| English                  | Arabic                        |
| ------------------------ | ----------------------------- |
| Revoke                   | إلغاء                         |
| Resend                   | إعادة الإرسال                 |
| Built-in                 | مدمج                          |
| Built-in role            | دور مدمج                      |
| Custom role              | دور مخصص                      |
| Wildcard                 | صلاحية شاملة                  |
| Verified Purchase        | مشترٍ موثّق                   |
| Endpoint                 | نقطة النهاية                  |
| Endpoint URL             | رابط نقطة النهاية             |
| Secret                   | السر                          |
| Test event               | حدث اختبار                    |
| Delivery                 | التسليم                       |
| Actor                    | المنفّذ                       |
| Audit log detail         | تفاصيل سجل التدقيق            |
| Current Plan             | الخطة الحالية                 |
| Trial ends               | تنتهي الفترة التجريبية        |
| Upgrade                  | ترقية                         |
| Switch plan              | تغيير الخطة                   |
| Prorated                 | بالتناسب                      |
| Select all               | تحديد الكل                    |
| Deselect all             | إلغاء تحديد الكل              |
| Price adjustment         | تعديل السعر                   |
| Amount off products      | خصم على المنتجات              |
| Amount off order         | خصم على الطلب                 |
| Buy X get Y              | اشترِ X واحصل على Y           |
| Usage limit              | حد الاستخدام                  |
| Per-customer limit       | الحد لكل عميل                 |
| Combinations             | التوليفات                     |
| Combines with            | يُدمج مع                     |
| Initial amount           | المبلغ الأولي                 |
| Balance                  | الرصيد                        |
| Recipient                | المستلم                       |
| Covers shipping          | يغطي الشحن                    |
| Covers tax               | يغطي الضريبة                  |
| Transaction history      | سجل المعاملات                 |
| Balance after            | الرصيد بعدها                  |
| Adjust balance           | تعديل الرصيد                  |
| Refund to card           | استرداد إلى البطاقة           |
| On hand                  | المتاح                        |
| Revenue over time        | الإيرادات عبر الزمن           |
| Top products             | أفضل المنتجات                 |
| Units sold               | الوحدات المباعة               |
| Total revenue            | إجمالي الإيرادات              |
| Average order value      | متوسط قيمة الطلب              |

## M. Notifications & messaging

| English                 | Arabic                  |
| ----------------------- | ----------------------- |
| You have a new order    | لديك طلب جديد           |
| New order #{{number}}   | طلب جديد #{{number}}    |
| Order shipped           | تم شحن الطلب            |
| Order delivered         | تم تسليم الطلب          |
| Order cancelled         | تم إلغاء الطلب          |
| Payment received        | تم استلام الدفعة        |
| Refund issued           | تم إصدار الاسترداد      |
| Low stock alert         | تنبيه: مخزون منخفض      |
| Out of stock alert      | تنبيه: نفد المخزون      |
| New customer registered | تم تسجيل عميل جديد      |
| New review received     | تمّ استلام مراجعة جديدة |

## N. Customers & Companies (added by customers-agent)

| English                     | Arabic                          |
| --------------------------- | ------------------------------- |
| Lifetime value              | القيمة الدائمة                  |
| Avg lifetime value          | متوسط القيمة الدائمة            |
| Segment                     | شريحة                           |
| Segments                    | الشرائح                         |
| Customer segment            | شريحة عملاء                     |
| Customer segments           | شرائح العملاء                   |
| Marketing consent           | الموافقة التسويقية              |
| Subscribed                  | مشترك                           |
| Not subscribed              | غير مشترك                       |
| Run preview                 | تشغيل المعاينة                  |
| Preview                     | معاينة                          |
| Credit limit                | حد الائتمان                     |
| Payment terms               | شروط الدفع                      |
| Due on receipt              | مستحق عند الاستلام              |
| B2B                         | B2B                             |
| Contacts                    | جهات الاتصال                    |
| Min total spent             | الحد الأدنى للإنفاق             |
| Max total spent             | الحد الأقصى للإنفاق             |
| Min orders                  | الحد الأدنى للطلبات             |
| Max orders                  | الحد الأقصى للطلبات             |
| Last order after            | آخر طلب بعد                     |
| Last order before           | آخر طلب قبل                     |
| Email contains              | البريد الإلكتروني يحتوي على     |
| Tags (comma separated)      | العلامات (مفصولة بفواصل)        |
| Total spent                 | إجمالي الإنفاق                  |
| Bulk activate               | تفعيل جماعي                     |
| Bulk deactivate             | إلغاء تفعيل جماعي               |
| Select all                  | تحديد الكل                      |
| Net 15                      | صافي 15                         |
| Net 30                      | صافي 30                         |
| Net 60                      | صافي 60                         |
| Net 90                      | صافي 90                         |

## P. Storefront theme-specific terms (added by storefront-themes-agent)

| English                             | Arabic                                    |
| ----------------------------------- | ----------------------------------------- |
| Plant-based                         | نباتي                                     |
| Dairy-free                          | خالٍ من منتجات الألبان                    |
| Organic                             | عضوي                                      |
| Certified organic                   | معتمد عضوياً                              |
| Creamy                              | كريمي                                     |
| Flavor                              | نكهة                                      |
| Flavors                             | النكهات                                   |
| Supplement                          | مكمل غذائي                               |
| Supplements                         | المكملات الغذائية                         |
| Sports nutrition                    | التغذية الرياضية                          |
| Pre-workout                         | ما قبل التمرين                            |
| Recovery                            | التعافي                                   |
| Protein                             | البروتين                                  |
| Creatine                            | الكرياتين                                 |
| Vitamins                            | الفيتامينات                               |
| Authentic (product authenticity)    | أصيل                                      |
| Lab tested                          | مختبر ومعتمد                              |
| Maximum potency                     | أقصى فاعلية                               |
| Fuel your performance               | عزّز أداءك                                |
| Fuel your workout                   | أوقد تمرينك                              |
| Ambassador                          | سفير                                      |
| Ambassadors                         | السفراء                                   |
| Supplement facts                    | حقائق المكمل الغذائي                      |
| Nutrition facts                     | الحقائق الغذائية                          |
| Serving size                        | حجم الحصة                                |
| Ships within 24 hours               | يُشحن خلال 24 ساعة                        |
| Authentic guarantee                 | ضمان الأصالة                              |
| 100% authentic                      | 100% أصيل                                 |
| Buy 2 get 1 free                    | اشترِ 2 واحصل على 1 مجاناً               |
| Limited time                        | عرض محدود                                 |
| From the journal                    | من دفتر اليوميات                          |
| Watch story                         | شاهد القصة                                |
| New arrival (badge)                 | وصول جديد                                 |
| Explore the range                   | استكشف المجموعة                           |
| Top sellers                         | الأكثر مبيعاً                             |
| Trending now                        | الأكثر رواجاً الآن                        |
| You may also love                   | قد يعجبك أيضاً                            |
| You may also like                   | قد يعجبك أيضاً                            |
| Certified organic (badge)           | معتمد عضوياً                              |
| 100% natural (badge)                | 100% طبيعي                                |
| No spam, unsubscribe anytime        | لا رسائل مزعجة، يمكنك إلغاء الاشتراك في أي وقت |
| Stay in the loop                    | ابقَ على اطّلاع                           |
| Hand-picked for you                 | منتقاة خصيصاً لك                          |
| Just landed in store                | وصل للتو إلى متجرنا                       |
| Browse our curated collections      | تصفّح مجموعاتنا المنتقاة                  |

## O. Auth / onboarding (added by auth-agent)

| English                                        | Arabic                                                      |
| ---------------------------------------------- | ----------------------------------------------------------- |
| Store dashboard                                | لوحة تحكم المتجر                                           |
| Create a store                                 | أنشئ متجراً                                                 |
| Open store                                     | فتح المتجر                                                  |
| Choose a store                                 | اختر متجراً                                                 |
| Back to sign in                                | العودة إلى تسجيل الدخول                                    |
| Send reset link                                | إرسال رابط الاستعادة                                        |
| Request a reset link                           | طلب رابط الاستعادة                                          |
| Check your inbox                               | تحقق من بريدك الوارد                                        |
| Missing reset token                            | رابط الاستعادة مفقود                                        |
| Password updated                               | تم تحديث كلمة المرور                                        |
| Choose a new password                          | اختر كلمة مرور جديدة                                        |
| Launch my store                                | أطلق متجري                                                  |
| Name your store                                | سمِّ متجرك                                                  |
| What will you sell?                            | ماذا ستبيع؟                                                 |
| Pick a starting look                           | اختر مظهراً ابتدائياً                                       |
| Niche                                          | المجال                                                      |
| Fashion & Apparel                              | الأزياء والملابس                                            |
| Electronics                                    | الإلكترونيات                                                |
| Food & Grocery                                 | الغذاء والبقالة                                             |
| Sports & Fitness                               | الرياضة واللياقة                                            |
| Books & Media                                  | الكتب والإعلام                                              |
| Kids & Toys                                    | الأطفال والألعاب                                            |
| Home & Decor                                   | المنزل والديكور                                             |
| A bit of everything                            | متنوع                                                       |
| Store URL                                      | رابط المتجر                                                 |
| Subdomain                                      | النطاق الفرعي                                               |
| Checking availability                          | جاري التحقق من التوفر                                       |
| That URL is taken                              | هذا الرابط مأخوذ                                            |
| Your store is being created                    | جاري إنشاء متجرك                                            |
| Building your store                            | جاري بناء متجرك                                             |
| Hang tight                                     | انتظر قليلاً                                                |
| Registering your domain                        | جاري تسجيل نطاقك                                           |
| Installing your theme                          | جاري تثبيت قالبك                                           |
| Seeding sample content                         | جاري إضافة محتوى نموذجي                                    |
| Finishing up                                   | جاري الإنهاء                                               |
| Your store is ready                            | متجرك جاهز                                                  |
| Redirecting in                                 | إعادة التوجيه خلال                                          |
| Team & Security                                | الفريق والأمان                                              |
| Visual editor                                  | المحرر المرئي                                               |
| Theme library                                  | مكتبة القوالب                                               |
| Toggle menu                                    | تبديل القائمة                                               |
| Not now                                        | ليس الآن                                                    |
| Enable browser notifications                   | تفعيل إشعارات المتصفح                                       |

## O. Storefront theme copy (added by theme-agent — sportzone/starter/techhub)

| English | Arabic |
| ------- | ------ |
| New Season | الموسم الجديد |
| Push Your Limits | تجاوز حدودك |
| Performance gear | معدات الأداء |
| Pro Gear | معدات احترافية |
| Fast Delivery | توصيل سريع |
| Free Returns | إرجاع مجاني |
| Shop by Sport | تسوّق حسب الرياضة |
| Top Picks | أبرز المنتجات |
| Ready to Perform? | هل أنت مستعد للأداء؟ |
| Get Started | ابدأ الآن |
| Gear up. Get moving. No limits. | جهّز نفسك. تحرّك. لا حدود. |
| Stay Updated | ابقَ على اطلاع |
| Easy Returns | إرجاع سهل |
| Secure Checkout | دفع آمن |
| Flash Deal | عرض خاطف |
| Browse All Collection | تصفّح جميع المجموعات |
| Hotline | الخط الساخن |
| Featured in | مميّز في |
| Shop by department | تسوّق حسب القسم |
| Find what you need, fast | اعثر على ما تحتاجه بسرعة |
| All categories | جميع الفئات |
| Help & Support | المساعدة والدعم |
| Company Info | معلومات الشركة |
| Customer Care | خدمة العملاء |
| Shipping Info | معلومات الشحن |
| How To Order | كيفية الطلب |
| How To Track | كيفية التتبع |
| Size Guide | دليل المقاسات |
| Our Blog | مدونتنا |
| Careers | الوظائف |
| Store Locations | مواقع المتاجر |
| Testimonial | آراء العملاء |
| Select color | اختر اللون |
| Select size | اختر المقاس |
| Choose Options | اختر الخيارات |
| Adding... | جاري الإضافة... |
| HOT (product badge) | رائج |
| Available by phone | متاح عبر الهاتف |
| Opening Hours | ساعات العمل |
| All Products (tab) | جميع المنتجات |
| Best Seller (tab) | الأكثر مبيعاً |
| On Sale (tab) | عروض التخفيضات |
| Join the team. Get exclusive drops. | انضم إلى الفريق. احصل على عروض حصرية. |
| Search gear... (placeholder) | ابحث عن معدات... |
| Enter your keywords... (placeholder) | أدخل كلماتك البحثية... |
| Hello, Login | مرحباً، سجّل الدخول |

---

## Style notes

- **Numbers**: Render with Western Arabic numerals (0-9), not Eastern
  Arabic-Indic. The platform's existing format util uses `Intl.NumberFormat('ar-SD')`
  which defaults to Western — keep that.
- **Currency**: `Intl.NumberFormat('ar-SD', { style: 'currency', currency })` —
  the symbol position flips automatically for RTL.
- **Time**: 12h format with `ص` (AM) and `م` (PM).
- **Brand "Matjar"**: keep as Latin "Matjar" in dashboard chrome; the
  Arabic name "متجر" can appear as a tagline/subtitle if asked.
- **Punctuation inside Arabic strings**: use `،` `؛` `؟` (not `,` `;` `?`).
  Inside English fragments embedded in Arabic, keep English punctuation.
