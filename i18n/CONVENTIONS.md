# i18n Conventions — Hard Rules for Every Translation Agent

These rules are **non-negotiable**. Every agent working on any
localization task MUST follow them. Inconsistency between agents is
the #1 risk in this multi-agent effort.

---

## 1. Library

- **react-i18next** is the only i18n library. No `react-intl`,
  no `formatjs`, no custom hand-rolled context.
- `i18next` core + `react-i18next` + `i18next-browser-languagedetector`.
- No backend loader plugin. All resources are bundled at build time
  (we want zero network for translation lookup).

## 2. Locale codes

- English: `en`
- Arabic: `ar`
- These are the only two values. No regional variants in the i18n key
  layer (`ar-SD`, `ar-EG` etc. are only for `Intl.*` formatting).

## 3. Namespace structure

### Dashboard (`dashboard/src/i18n/locales/{lang}/{namespace}.json`)

| Namespace | Scope |
|---|---|
| `common.json` | Shared verbs/states/glossary terms used across pages |
| `auth.json` | Login, register, forgot/reset password, accept invite |
| `nav.json` | Sidebar groups + nav items + breadcrumbs |
| `dashboard.json` | Home/Dashboard page |
| `products.json` | Products list, product form, variants, preorder |
| `orders.json` | Orders list, order details, fulfillments, lifecycle, documents |
| `customers.json` | Customers, customer segments |
| `inventory.json` | Inventory page |
| `marketing.json` | Discounts, gift cards, promotions |
| `analytics.json` | Analytics page |
| `themes.json` | Themes list, visual editor, theme editor |
| `pages.json` | CMS pages (the held Pages feature) |
| `menus.json` | Menus list and form |
| `domains.json` | Domains page + add-domain dialog |
| `staff.json` | Staff, invites, roles, permissions |
| `payments.json` | Payments, payment methods, transactions |
| `settings.json` | Settings page (largest file by string count) |
| `reviews.json` | Reviews page |
| `webhooks.json` | Webhooks page |
| `notifications.json` | Notifications + bell |
| `companies.json` | Companies / B2B accounts |
| `subscriptions.json` | Subscriptions page |
| `audit.json` | Audit logs page |
| `errors.json` | Error pages, fallbacks, server-error toasts |

### Themes shared (`storefront-themes/_shared/i18n/locales/{lang}/{namespace}.json`)

| Namespace | Scope |
|---|---|
| `common.json` | Shared verbs/states/glossary terms |
| `cart.json` | Cart drawer + cart page |
| `checkout.json` | Checkout flow |
| `product.json` | ProductCard, ProductDetail, ProductReviews, etc. |
| `category.json` | CategoryPage, CollectionPage, CollectionsIndex |
| `account.json` | Account, login, register, wishlist |
| `order.json` | OrderTracking, OrderSuccess |
| `marketing.json` | Newsletter popup, announcement bar, social share |
| `nav.json` | MegaMenu, MobileBottomNav, Pagination, Breadcrumbs, SearchBar |
| `discovery.json` | FilterPanel, GridListToggle, QuickView |
| `footer.json` | Footer copy (about, contact, terms, etc.) |
| `errors.json` | NotFound, fallbacks |

### Per-theme (`storefront-themes/<theme>/src/i18n/locales/{lang}/theme.json`)

- One file per theme covering theme-specific copy (taglines, custom
  section titles, brand-specific microcopy in src/sections/* and src/pages/*).
- Re-uses _shared namespaces; only theme-unique strings live here.

## 4. Key naming

- **lower.snake** dotted: `cart.empty.title`, `product.add_to_cart`,
  `orders.list.column.status`.
- Keys are English-derived semantic descriptors, **not** the English
  string itself. `cart.empty.title` not `your_cart_is_empty`.
- For repeated UI verbs (Save/Cancel/Delete), use `common.action.save` —
  do not duplicate per page.
- For form labels: `<feature>.field.<field_name>.label` and `.placeholder`.
- For statuses: `common.status.<key>` (e.g. `common.status.paid`).
- For toasts: `<feature>.toast.<event>` (e.g. `products.toast.created`).
- Pluralization keys: i18next reads `_zero`, `_one`, `_two`, `_few`,
  `_many`, `_other` suffixes automatically. Define all 6 for Arabic
  count strings.

## 5. Interpolation

- Use double-brace `{{name}}` interpolation — i18next default.
- For HTML inside translations (rare), use `<Trans>` component, never
  `dangerouslySetInnerHTML`.
- Numbers/dates pass formatted (in the locale) — do NOT interpolate
  raw `Date` objects.

## 6. Calling pattern

```tsx
import { useTranslation } from 'react-i18next'

function ProductCard() {
  const { t } = useTranslation(['product', 'common'])
  return <button>{t('product.add_to_cart')}</button>
}
```

- Always declare the namespaces you need explicitly.
- Default fallback namespace is `common`.
- For server-side error messages already-translated by the backend,
  pass them through `t(serverKey)` only if the backend uses i18n keys.
  Otherwise display as-is. (Backend i18n is OUT OF SCOPE for this
  effort — agents must not touch backend translation.)

## 7. RTL strategy

- Set `<html lang="ar" dir="rtl">` on language change.
- **Tailwind**: use `tailwindcss-rtl` plugin to enable `rtl:` and
  `ltr:` modifiers AND swap `ml-/mr-`, `pl-/pr-`, `text-left/right`,
  `border-l/r`, `rounded-l/r` to logical equivalents (`ms-/me-`,
  `ps-/pe-`, `text-start/end`, `border-s/e`, `rounded-s/e`) wherever
  practical.
- **Replace** every directional Tailwind class found in source with
  its logical-property equivalent. The RTL-audit step finds them.
- **Icons**: chevrons/arrows used for navigation (next/back, sidebar
  expand) MUST flip in RTL. Use the `rtl:rotate-180` modifier or
  conditionally render the opposite-direction icon.
- **flex/grid**: `flex-row` works under both directions because the
  flex axis follows `dir`. Avoid forced `flex-row-reverse` unless
  intentional.
- **Transforms** `translate-x-N` direction-flips automatically with
  `dir`-aware `rtl:-translate-x-N` modifiers — apply where used.
- **Forms**: input alignment respects `dir`. No special handling
  needed for `text-start`/`text-end`.
- **Numbers/codes/URLs**: wrap in `<bdi>…</bdi>` if they look weird
  inside an Arabic sentence. (Not needed when they sit alone in a
  cell.)

## 8. Fonts

### Dashboard

- English: **Inter** (already implied via system stack — install via
  `@fontsource/inter` or Google Fonts CSS import).
- Arabic: **IBM Plex Sans Arabic** (via `@fontsource/ibm-plex-sans-arabic`
  or Google Fonts).
- Apply via CSS:

```css
:root {
  --font-en: 'Inter', system-ui, sans-serif;
  --font-ar: 'IBM Plex Sans Arabic', 'Inter', system-ui, sans-serif;
}
html { font-family: var(--font-en); }
html[lang="ar"] { font-family: var(--font-ar); }
```

### Themes

- English: theme's existing font (each theme keeps its current English
  font choice).
- Arabic: **Tajawal** (via Google Fonts).
- Apply identically:

```css
html[lang="ar"] { font-family: 'Tajawal', <existing English font>, sans-serif; }
```

- Each theme's tailwind.config.js gets a `fontFamily.sans` entry that
  prepends Tajawal when html[lang=ar].

## 9. Currency / number / date formatting

- Continue using `Intl.NumberFormat(getTenantLocale(), …)` and
  `Intl.DateTimeFormat(getTenantLocale(), …)`.
- `getTenantLocale()` returns `'ar-SD'` for Arabic, `'en-US'` for
  English. (The mapping already exists in dashboard/src/lib/format.ts.)
- For themes, expose a parallel helper in `_shared/utils/formatCurrency.ts`
  that takes a locale string.

## 10. Hard-coded strings that look like data

- Status labels rendered from API enum values: keep the enum value as
  the i18n key. e.g. `common.status.paid` for backend-emitted `paid`.
- Date strings like "Apr 14, 2026" → use the formatter, never
  hard-code the format.
- Currency symbols: never hard-code `$`. Always go through
  `Intl.NumberFormat`.

## 11. Workflow per agent

For every agent assigned a translation task:

1. Read `i18n/GLOSSARY.md` and `i18n/CONVENTIONS.md` first. Internalize.
2. Read the file(s) you're assigned, mark every user-facing string.
3. Replace each string with `t('namespace.key')`. Add the key to
   `dashboard/src/i18n/locales/en/<namespace>.json` AND
   `dashboard/src/i18n/locales/ar/<namespace>.json`.
4. For Arabic, USE THE GLOSSARY. If the term isn't in the glossary,
   propose a translation in Modern Standard Arabic AND append it to
   `i18n/GLOSSARY.md` in your changes.
5. Run the dev server briefly (or `npm run build`) to confirm
   compilation passes.
6. Commit your slice with a descriptive message under your name.

## 12. What agents must NOT do

- ❌ Touch backend code (controllers, services, repositories, schemas)
- ❌ Touch any file that another agent owns (you'll be told your
  exclusive file list)
- ❌ Refactor unrelated code while translating
- ❌ Change UX, layout, or copy meaning — translate, don't rewrite
- ❌ Skip strings you "don't think users see" — debug strings that leak
  into production are real bugs; if it ships in JSX, translate it
- ❌ Touch the `package.json` of someone else's app
- ❌ Add new dependencies without approval (i18n libs are pre-approved
  in foundation; nothing else)
- ❌ Use machine translation for terms in the glossary (the glossary
  already encodes our standard)
- ❌ Translate brand names, technical identifiers (SKU, JSON, CSS),
  enum values, or URL paths

## 13. Output discipline

- Every commit message must follow:
  `i18n(<surface>): <what>` — e.g. `i18n(dashboard/orders): translate Orders list page`
- One commit per logical slice. No mega-commits across surfaces.
- Final report from each agent must list:
  - Files modified
  - Number of keys added per namespace (en + ar mirrored)
  - Any glossary additions
  - Any blockers encountered
