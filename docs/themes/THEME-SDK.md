# Matjar Theme SDK — the theme contract

Since audit item 2.2 (`createThemeApp`), a storefront theme is no longer a
copy of an entire React app. The SDK package `@matjar/theme-shared`
(`storefront-themes/_shared`, consumed via npm workspaces) owns the router,
the provider stack, the bootstrap, the i18n merge and every generic page.
A theme ships only what makes it *look* different.

## What a theme consists of

```
storefront-themes/<slug>/
├── package.json               # name, deps (react, @matjar/theme-shared, …)
├── vite.config.ts             # standard theme Vite config (emits dist/manifest.json)
├── tailwind.config.js         # theme fonts + palette extensions
├── index.html
└── src/
    ├── theme.manifest.ts      # defineTheme({...}) — identity, sections, templates, design tokens
    ├── App.tsx                # ~15 lines: createThemeApp({ ... })
    ├── main.tsx               # 4 lines: mountTheme(App)
    ├── index.css              # Tailwind entry + theme CSS
    ├── components/
    │   ├── Layout.tsx         # REQUIRED — header/footer shell around <Outlet/>
    │   └── <Slug>ProductCard.tsx   # optional bespoke card (renderCard option)
    ├── pages/                 # bespoke page implementations (see "Pages")
    │   ├── Home.tsx
    │   ├── Products.tsx
    │   ├── ProductDetail.tsx
    │   ├── CategoryPage.tsx
    │   └── CartPage.tsx
    ├── sections/              # optional per-theme section registry
    └── i18n/locales/{en,ar}/theme.json   # theme-namespace strings (both languages required)
```

## App.tsx — `createThemeApp(options)`

```tsx
import { createThemeApp } from '@matjar/theme-shared/app/createThemeApp';
import Layout from './components/Layout';
import manifest from './theme.manifest';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import CategoryPage from './pages/CategoryPage';
import CartPage from './pages/CartPage';
import en from './i18n/locales/en/theme.json';
import ar from './i18n/locales/ar/theme.json';

export default createThemeApp({
  Layout,
  manifest,
  locales: { en, ar },
  pages: { Home, Products, ProductDetail, CategoryPage, CartPage },
});
```

### Options

| Option       | Required | Purpose |
| ------------ | -------- | ------- |
| `Layout`     | yes      | The theme shell rendered around every route (`<Outlet/>` inside). |
| `manifest`   | yes      | The `defineTheme` manifest; `mountTheme` feeds it to `<ThemeProvider>`. |
| `pages`      | yes      | Page components. `Home`, `Products`, `ProductDetail`, `CategoryPage`, `CartPage` are required (no shared default exists). Every other key is optional and falls back to the shared SDK page: `CollectionsIndex`, `CollectionPage`, `SearchResults`, `Wishlist`, `NotFound`, `Contact`, `About`, `PageView`, `Login`, `Register`, `Account`, `Checkout`, `OrderSuccess`, `OrderTracking`. |
| `locales`    | no       | `{ en, ar }` — the theme's `theme.json` bundles, registered in the `theme` i18n namespace before first render (replaces the old `src/i18n/theme.ts`). |
| `renderCard` | no       | `(product, onQuickView?) => ReactNode` — wraps the app in `<ThemeCardProvider>` so shared components render the theme's product card. Omit it and no card provider is mounted (SDK default card is used). |
| `slots`      | no       | Extra `<ThemeSlotsProvider>` overrides, e.g. `{ productDetailExtras: MyExtras }`. Only mounted when provided. |
| `routes`     | no       | `[{ path, element }]` — extra theme-specific routes rendered inside `Layout`, before the `*` not-found catch-all. |

### The route table (owned by the SDK)

`/`, `/products`, `/products/:slug`, `/categories/:slug`, `/collections`,
`/collections/:handle`, `/cart`, `/checkout`, `/order-success[/:id]`,
`/orders/:id`, `/search`, `/login`, `/register`, `/account`, `/wishlist`,
`/contact`, `/about`, `/pages/:slug` (CMS pages), `*` (not-found).

Adding a route in `_shared/app/createThemeApp.tsx` reaches all themes with
one edit — never add routes to individual themes unless genuinely bespoke
(use the `routes` option for that).

## main.tsx — `mountTheme(App)`

```tsx
import { mountTheme } from '@matjar/theme-shared/app/mountTheme';
import App from './App';
import './index.css';

mountTheme(App);
```

`mountTheme` registers the theme's i18n bundles, then renders the canonical
provider stack (identical for every theme):

```
BrowserRouter > LanguageProvider > StoreProvider > ThemeProvider(manifest)
  > CartProvider > ToastProvider > CompareProvider > ConfirmProvider > App
```

Inside `App`, `createThemeApp` additionally mounts (only when configured):
`ThemeCardProvider(renderCard)` > `ThemeSlotsProvider(slots)` >
`ScrollToTop` + `Routes`.

## Pages

- The five commerce pages (`Home`, `Products`, `ProductDetail`,
  `CategoryPage`, `CartPage`) are bespoke per theme — they are where a
  theme's design lives, so the SDK deliberately has no default for them.
- All other pages default to `@matjar/theme-shared/pages/*`. Override one
  only when the design genuinely diverges; pass it as `pages.X`.
- Section-driven homes use `SectionRenderer` with an optional per-theme
  `registry` (see `src/sections/` in `aurum` or `techhub`). The registry
  stays a `SectionRenderer` prop consumed inside `Home` — it is not an
  app-level concern.

## i18n

- Shared namespaces (`common`, `cart`, `product`, …) live in
  `_shared/i18n/locales`.
- Theme-specific copy lives in `src/i18n/locales/{en,ar}/theme.json` and is
  registered under the `theme` namespace via the `locales` option. Both
  languages are mandatory; RTL is first-class (use logical properties:
  `ms-/me-/ps-/pe-/text-start/text-end`).

## Styling contract

- `index.css` imports Tailwind and any theme-scoped CSS.
- `tailwind.config.js` declares the theme's font families; the manifest's
  `designTokens` bridge merchant customizations into CSS variables
  (`--color-primary`, `--font-family-heading`, …) via `ThemeProvider`.
- Read colors from CSS variables, never hardcode brand hex values in
  components that merchants can retheme.

## Build

- `bash scripts/build-themes.sh` builds every theme (root `npm ci` once,
  then `npx vite build` per theme). Each build must emit
  `dist/manifest.json` — the backend manifest registry loads it at startup.
- After changing anything in `_shared`, rebuild all themes before judging
  storefront behaviour.
