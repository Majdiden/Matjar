# Testing guide: store design for first-time sellers (PBI 10), permanent store deletion (PBI 11) and the follow-up fixes

A step-by-step manual test on production with your **test store**, a phone, and a computer. It is written to be followed top to bottom in one sitting (about 90 minutes). Each step says what to do and what you should see. If something differs, note the step number, take a screenshot, and record the time (it helps find the server log line).

**Legend:** ☐ = check · **Expect:** = what should happen · ⚠ = known limitation, not a bug

---

## 0. Before you start

1. ☐ Confirm the deploy finished on Render (the latest commit on `master` is live).
2. ☐ On your phone, open the dashboard and, if you see "New version available — refresh", tap it. Do the same on the computer. (The dashboard caches the app offline; an old copy will show old behaviour.)
3. ☐ Platform admin → your **test store** → feature overrides: turn ON `design.simpleMode` and `onboarding.v2` for that store only. Leave them OFF globally.
4. ☐ Platform admin → Staff → your row: check the **email alerts** icon. You should now receive "New store signup" even if it's unticked (owners always get it).
5. Have ready: a Facebook page link copied **from the Facebook app in Arabic** on your phone, a logo image, a wide cover photo, and a second email address you can receive mail on.

---

## 1. Signup and the store link (everyone, no flag)

Open `/dashboard/register` in a private/incognito window.

| # | Do | Expect |
|---|---|---|
| 1.1 | Get to the "اختر اسمًا لمتجرك" step. Type an Arabic store name, e.g. `متجر الشمس`. | The link fills automatically with English letters (e.g. `mtjr-alshms`). A note explains links can't have Arabic letters. Below: "سيفتح متجرك على هذا الرابط: https://mtjr-alshms.matjar.to". |
| 1.2 | Clear the link field and **paste** the Facebook link you copied from the Arabic Facebook app. | The field does **not** fill with `httpswwwfacebook…`. A note says it's your Facebook page and it was saved. The link is taken from the page name, or from the store name when the Facebook link has no name in it (e.g. `profile.php?id=…`). |
| 1.3 | Paste `https://store-name.matjar.to`. | Note: "كان هذا مجرد مثال…"; the link goes back to one made from your store name. |
| 1.4 | Type `httpswwwfacebookcomx` by hand. | Red message: "يبدو أن هذا رابط لموقع…"; Continue is blocked. |
| 1.5 | Type `app`, then `admin`. | Rejected (reserved names). |
| 1.6 | Paste a Facebook link into the **store name** field. | The name isn't replaced by the link; a note says the page was saved and asks for the store's name. |
| 1.7 | Finish signup in **Arabic** (dashboard language Arabic). | Store is created. |

After signup:

| # | Do | Expect |
|---|---|---|
| 1.8 | Watch the "setting up your store" screen. | When it finishes, you land in the dashboard **already signed in**, without typing your password. |
| 1.9 | (Security check, computer) Before the setup screen finishes, open DevTools → Application → Session storage. | There is **no** `setupPassword` key. There may be `setupEmail`, `setupToken`, `setupDomain`. |
| 1.10 | Check the inbox of the platform owner. | A "[Matjar] New store signup: …" email arrives within a minute. If not, check Resend's dashboard for the failure reason and tell me. |
| 1.11 | Open the new store's storefront. Footer. | The Facebook link from 1.2 appears as a social link. |
| 1.12 | Place a test order on the new store, open the order email. | The email is in **Arabic** (new stores default to Arabic). |

---

## 2. Signup v2 (behind `onboarding.v2`)

Open `/dashboard/register?flow=v2` in a private window (works even while the flag is off globally).

| # | Do | Expect |
|---|---|---|
| 2.1 | Go through the steps on your phone. | One question per screen, no horizontal scrolling: account → code → store name → what you sell → "أين متجرك، وإلى أين توصّل الطلبات؟" (city required, delivery areas optional) → pick a look. |
| 2.2 | On "pick a look". | At most 3 themes, the one for your niche first, each showing **your store name**. |
| 2.3 | Finish, then open My store → Store info (step 4). | WhatsApp is pre-filled with your account phone; City has what you typed. |
| 2.4 | `/dashboard/register?flow=v1` | The old signup order. |

---

## 3. "3 steps to your first sale" checklist (behind `onboarding.v2`, per store)

On the test store's dashboard home (phone):

| # | Do | Expect |
|---|---|---|
| 3.1 | Look at the card. | "ثلاث خطوات لأول عملية بيع", 0 of 3 (or 1 of 3 if the store has products). |
| 3.2 | Tap "Add your first product". | Opens the short form "أضف منتجًا": photos, name, price, "كم قطعة عندك؟". Not the long product form. |
| 3.2a | Take a photo, type a name, a price **with the Arabic keyboard** (e.g. ١٥٬٠٠٠), tap + once, tap "انشر المنتج". | "منتجك الآن في متجرك" with Share, Add another, Back to home, Edit details. The price shows as 15,000. |
| 3.2b | Open the store and find the product. | It is live (not a draft), with the photo and price, in a category called "منتجاتنا". Two more quick products land in the same category. |
| 3.2c | Leave the name empty, or type letters in the price, and tap "انشر المنتج". | Red message under the field; nothing is saved. |
| 3.2d | Back on home. | Step 1 shows ✓ "تم". With `design.simpleMode` on, the + button in the bottom bar → "New product", and "Add product" on the Products page, also open the short form. |
| 3.3 | Payment step: tap the button. | Opens payment methods (or "OK, that works for me" if payment methods are off). Step 2 ✓. |
| 3.4 | Share step: tap Share and **actually send** to someone (or copy the link). | Step 3 ✓. Closing the share sheet without sending must **not** tick it. |
| 3.5 | All 3 done. | The card disappears. The × dismisses it earlier. |

---

## 4. My store hub and Store info (behind `design.simpleMode`)

Phone, dashboard → bottom bar "متجري".

| # | Do | Expect |
|---|---|---|
| 4.1 | Open the hub. | Cards: Store info, Homepage, About us, Contact us, Delivery & returns, Change look, Advanced options ("يُفضّل من الكمبيوتر"). Each shows what's missing. Store card on top with Share and "Open my store". |
| 4.2 | Store info → upload a **logo** (phone camera/gallery). | Uploads, shows "Saved". ⚠ Not tested on a real server before — watch closely. |
| 4.3 | Slogan: type Arabic only, tap outside. | "Saved". |
| 4.4 | Tap "+ بالإنجليزية (اختياري)", type English, then delete the Arabic. | Error: Arabic is required. Put Arabic back → saves. |
| 4.5 | Upload a **cover photo**. | Saves. |
| 4.6 | Pick a colour swatch. | Saves. |
| 4.7 | WhatsApp: if pre-filled, tap "نعم، استخدم هذا الرقم". Also try pasting a `wa.me/249…` link. | Saved as a number. |
| 4.8 | Instagram: type `@yourname`. | Becomes a full Instagram link. |
| 4.9 | Turn on airplane mode, change the store name, tap outside. Turn airplane mode off. | "Not saved yet — we'll try again", then "Saved" by itself once online. Reloading while offline keeps your text. |
| 4.10 | "معاينة / Preview" button. | Your real store in a phone frame. ⚠ Not tested with the real storefront before. |
| 4.11 | Open the storefront. | Hero shows your cover photo and slogan; buttons use your colour. |
| 4.12 | Open a **different** test store that has never touched Store info. | Looks exactly as before. |

---

## 5. Homepage editor (behind `design.simpleMode`)

Hub → Homepage, on the phone.

| # | Do | Expect |
|---|---|---|
| 5.1 | Open it. | Phone preview at the top, list of homepage parts with plain names ("الصورة الكبيرة في أعلى الصفحة"…), each with a switch and ↑ ↓. |
| 5.2 | Hide a part with its switch. | Disappears from the preview and the live store; "Saved — live on your store" with Undo. |
| 5.3 | Undo. | It comes back. |
| 5.4 | Move a part up. | Order changes in preview and live store. |
| 5.5 | Tap the top picture part. | A sheet with only 2–3 settings. The subtitle shows "مأخوذ من هوية متجرك" (taken from Store info). |
| 5.6 | Change the subtitle here. | It becomes the page's own text; "Use my store info again" appears. Tap it → back to the slogan. |
| 5.7 | "Advanced options". | Opens the full editor (desktop). |

---

## 6. About, Contact, Delivery & returns (behind `design.simpleMode`)

| # | Do | Expect |
|---|---|---|
| 6.1 | About us → answer "What do you sell?" (+ optional questions, photo) → "اكتب صفحتي". | An Arabic About page appears on the storefront (`/pages/about`). With English answers, an English version too. |
| 6.2 | Edit that page by hand in Pages, then go back and regenerate. | It asks before replacing your edits. |
| 6.3 | Contact us → turn on the switch. | Storefront `/contact` shows a big WhatsApp button, email, city, hours and social links from Store info. Turn off → your old contact page returns. |
| 6.4 | Delivery & returns → answer (areas pre-filled from signup v2), accept returns within 7 days → write. | Storefront policy pages filled in. Product pages show badges: cash on delivery, Bankak (if on), delivery areas, returns within 7 days. ⚠ The dashboard shows "Bankak" in Latin letters. |

---

## 7. Product and category links (everyone)

| # | Do | Expect |
|---|---|---|
| 7.1 | Add a product named only in Arabic, e.g. `عطر الورد`. | The form shows the link preview `…/products/atr-alord` without you touching it. |
| 7.2 | Add another product with the same name. | Gets `atr-alord-2`. |
| 7.3 | Rename the first product. | Its link does **not** change. |
| 7.4 | On the **published** product, "تعديل الرابط" and change the link. | Note that the old link will forward. Open the old URL after ~30 seconds → redirects to the new one. |
| 7.5 | Categories: add a category with an Arabic name, then edit/delete a **non-first** category. | Readable link; the edit/delete affects the category you chose (this used to hit the first one). |

---

## 8. Sharing

| # | Do | Expect |
|---|---|---|
| 8.1 | Dashboard home / Domains → Share (phone). | The phone's own share sheet (WhatsApp, Facebook, Telegram, SMS…). |
| 8.2 | Same on the computer. | A menu: WhatsApp, Facebook, Telegram, Copy link. |

---

## 9. Arabic wording

| # | Do | Expect |
|---|---|---|
| 9.1 | Browse orders, products, home in Arabic. | Natural standard Arabic, "عميل" for customer everywhere, "تأكيد الشحن" for mark as shipped. Full list of changes: `docs/delivery/10/10-19.md`. |
| 9.2 | Orders list with orders of 3, 11 and 1 items. | "3 منتجات", "11 منتجًا", "منتج واحد" (not "3 منتج"). |

---

## 10. Permanent store deletion (platform admin)

Use throwaway stores only.

| # | Do | Expect |
|---|---|---|
| 10.1 | As an **admin** (not owner) staff member, open a store. | No "Delete permanently" button. |
| 10.2 | As owner, Staff → an Operations user → skull icon → Allow (you'll confirm your identity). | Their row shows "can delete stores". Revoke works the same way. |
| 10.3 | Throwaway store with a product image and one order → "Delete permanently". Type the slug, a reason, a **wrong** password. | "Incorrect password", nothing deleted. |
| 10.4 | Same with the right password. | The store disappears from the list; its link is free again (register it again to check). Owners get "Store permanently deleted" email. |
| 10.5 | Commerce → Orders. | The deleted store's order is still there, labelled with the old store name. |
| 10.6 | Cloudinary media library → the store's folder. | Its images are gone. ⚠ Not tested against Cloudinary before. |
| 10.7 | Tenants list → select 2 throwaway stores → "Delete…". Type `delete 2 stores` + password. | Both deleted, per-store results shown. |
| 10.8 | Platform audit log. | One `tenant.delete_permanently` entry per store; no password anywhere. |

---

## 11. The latest fixes

| # | Do | Expect |
|---|---|---|
| 11.1 | Platform admin → Tenants. | "Last login" column; "never" until a merchant signs in. Sort menu: "Recently logged in" / "Longest without login". |
| 11.2 | Sign in to the test store's dashboard, reload the tenants list. | The test store shows "just now"; the store page shows "Last merchant login" with your email; the store's Staff tab shows your login time. |
| 11.3 | Platform admin "Open as merchant" (impersonation) on a store. | Does **not** change that store's last login. |
| 11.4 | In a private window open the storefront at `/orders/<order number>` (e.g. `/orders/1001`) and enter the buyer's email when asked. | Status, items, totals; **no delivery address**, with a privacy note. |
| 11.5 | Open the tracking link from the order confirmation email. | Full order including the address. |
| 11.6 | Change one letter of the `token=` in that link. | "Order not found". |
| 11.7 | Try 11 wrong order numbers in a row with the same email. | After 10, "Too many order lookups" for 15 minutes. |
| 11.8 | Register a new store (any). | The owner receives "[Matjar] New store signup". |

---

## 13. This round (homepage, editor, pages, digits, delivery prices)

Deploying runs migration 016 automatically: every store's homepage becomes **hero → newest products → featured products**. Text, photos and button words in those parts are kept; other parts leave the homepage but are still in Advanced options.

| # | Do | Expect |
|---|---|---|
| 13.1 | Open the test store's homepage on a phone. | Only: top strip (if you wrote one), the big photo at the top, newest products, featured products. |
| 13.2 | My store → Homepage. | A large preview pinned at the top. Rows: **Top strip** (first, "Shows at the top of every page"), the big photo, newest products, featured products. |
| 13.3 | Tap the big photo **in the preview**. | Its editing sheet opens; the part is outlined in blue. |
| 13.4 | Type a new title slowly. | The preview changes **while you type**. It saves when you leave the field: "Saved — live on your store" appears above the bottom bar and **fades after a few seconds**. |
| 13.5 | Change **the words on the button**. | The button in the preview and on the store changes. |
| 13.6 | Tap the top strip row (or the strip in the preview), write "التوصيل مجاني داخل الخرطوم", Done. | The strip shows that text on **every page** of the store. Empty text = no strip. |
| 13.7 | Switch theme in the full editor, then look at the homepage. | Same three parts in the new theme's style, one strip only. |
| 13.8 | My store → About / Contact (on) / Delivery & returns, then open /about, /contact, /policies/delivery on the store. | Designed pages: photo header, short fact cards, products (About), WhatsApp button. They look different in a luxury theme (aurum), a playful one (kidsworld) and a plain one (modern). |
| 13.9 | My store → Delivery & returns. | No "delivery price" field. "Delivery prices" shows the prices from Settings → Shipping, with **Edit delivery prices**. With none set: an amber note and **Add delivery prices**. |
| 13.10 | Set a flat price (or zones) in Settings → Shipping, come back, save the questions. | The delivery page states exactly those prices; checkout charges the same. |
| 13.11 | Dashboard in Arabic and in English: a customer's page (lifetime spend, last order, customer since), orders list, products list. | All digits are 0-9 (no ٠١٢), in both languages. On the store, order tracking and review dates too. |
| 13.12 | Any form: leave a required field empty far up the page, tap Save. | The page scrolls to that field and puts the cursor in it. |
| 13.13 | Phone bottom bar. | Home, Orders, +, Products, More. My store is inside More (More is highlighted while you're in My store). |

---

## 12. Turning things back off

If anything in sections 2–6 misbehaves, turn `design.simpleMode` / `onboarding.v2` off for the store: the merchant UI disappears and the storefront keeps whatever was already saved. Sections 1, 7–11 are not behind flags; report problems and I'll fix forward.

## What to send back

For each failed step: step number, screenshot, time, store slug. Also tell me which steps you couldn't test (e.g. no Cloudinary access) so they stay on the list.
