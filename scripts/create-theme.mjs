#!/usr/bin/env node
/**
 * create-theme — Matjar storefront theme scaffolder (audit 2.3)
 * ─────────────────────────────────────────────────────────────
 *
 * Replaces the old `storefront-themes/_shared/utils/createTheme.sh`
 * (which copied the `modern` theme wholesale). This generates the
 * MINIMAL post-SDK theme contract from scratch: a theme is now a
 * manifest + Layout + Home + the five bespoke commerce pages, wired
 * through `createThemeApp`/`mountTheme`. Everything else falls back to
 * the shared SDK pages.
 *
 * It registers NOTHING — the boot-time catalog sync
 * (`services/themeCatalogSync.js`) auto-discovers the theme from its
 * built `dist/manifest.json`, and `scripts/build-themes.sh` discovers
 * the source dir. So the flow is:
 *
 *     npm run create-theme -- --slug foo --name Foo
 *     bash scripts/build-themes.sh          # builds + validates foo
 *     # restart backend → foo appears in GET /api/themes
 *
 * Usage:
 *   npm run create-theme -- --slug <slug> [--name <Name>] [--font <Font>] [--palette <#hex>]
 *
 * Flags (prompted interactively when omitted and stdin is a TTY):
 *   --slug      kebab-case identifier + directory name (required)
 *   --name      display name (default: Title-cased slug)
 *   --font      display/heading font family, e.g. "Poppins" (default: Inter)
 *   --palette   primary brand color hex, e.g. "#7c3aed" (default: #2563eb)
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const THEMES_ROOT = path.join(REPO_ROOT, "storefront-themes");

// ─── arg parsing ─────────────────────────────────────────────────
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}

function titleCase(s) {
  return s
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function isValidSlug(s) {
  return typeof s === "string" && /^[a-z][a-z0-9-]{1,40}$/.test(s) && !s.startsWith("_");
}

function isValidHex(s) {
  return typeof s === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(s);
}

// Darken a hex color by mixing toward black — used to derive a `secondary`
// from the chosen primary so the palette is coherent out of the box.
function shade(hex, factor) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = Math.round(parseInt(h.slice(0, 2), 16) * factor);
  const g = Math.round(parseInt(h.slice(2, 4), 16) * factor);
  const b = Math.round(parseInt(h.slice(4, 6), 16) * factor);
  const to = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

async function prompt(rl, question, fallback) {
  const suffix = fallback ? ` [${fallback}]` : "";
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || fallback || "";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const interactive = process.stdin.isTTY && !args.slug;

  let rl;
  if (interactive) rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  let slug = args.slug;
  if (!slug && rl) slug = await prompt(rl, "Theme slug (kebab-case)");
  slug = String(slug || "").trim();
  if (!isValidSlug(slug)) {
    console.error(`✗ invalid slug "${slug}" — use kebab-case (a-z, 0-9, -), 2-41 chars, not starting with _`);
    if (rl) rl.close();
    process.exit(1);
  }

  const themeDir = path.join(THEMES_ROOT, slug);
  if (fs.existsSync(themeDir)) {
    console.error(`✗ theme "${slug}" already exists at storefront-themes/${slug}`);
    if (rl) rl.close();
    process.exit(1);
  }

  let name = args.name || (rl ? await prompt(rl, "Display name", titleCase(slug)) : titleCase(slug));
  name = String(name).trim() || titleCase(slug);

  let font = args.font || (rl ? await prompt(rl, "Display font", "Inter") : "Inter");
  font = String(font).trim() || "Inter";

  let palette = args.palette || (rl ? await prompt(rl, "Primary color hex", "#2563eb") : "#2563eb");
  palette = String(palette).trim();
  if (!isValidHex(palette)) {
    console.error(`✗ invalid palette "${palette}" — use a hex color like #2563eb`);
    if (rl) rl.close();
    process.exit(1);
  }

  if (rl) rl.close();

  const secondary = shade(palette, 0.8);
  const fontStack = `${font}, 'Cairo', system-ui, sans-serif`;
  const googleFontFamily = encodeURIComponent(font).replace(/%20/g, "+");

  const ctx = { slug, name, font, fontStack, primary: palette, secondary, googleFontFamily };

  // ─── write files ───────────────────────────────────────────────
  const files = buildFiles(ctx);
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(themeDir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }

  console.log(`✓ Scaffolded theme "${slug}" (${name}) at storefront-themes/${slug}`);
  console.log(`  Files:\n${Object.keys(files).map((f) => `    - ${f}`).join("\n")}`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. npm install                       # link the new workspace");
  console.log("  2. bash scripts/build-themes.sh      # build + validate (auto-discovered)");
  console.log(`  3. node scripts/dev-mock.mjs ${slug}  # develop against mock data, no backend`);
  console.log("  Restart the backend to have the catalog sync register it in GET /api/themes.");
}

// ─── file templates ──────────────────────────────────────────────
function buildFiles(c) {
  const files = {};

  files["package.json"] = JSON.stringify(
    {
      name: `@matjar/theme-${c.slug}`,
      version: "1.0.0",
      private: true,
      type: "module",
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview",
        "dev:mock": `node ../../scripts/dev-mock.mjs ${c.slug}`,
      },
      dependencies: {
        "@matjar/theme-shared": "2.0.0",
        i18next: "^26.0.6",
        "i18next-browser-languagedetector": "^8.2.1",
        react: "^18.3.1",
        "react-dom": "^18.3.1",
        "react-i18next": "^17.0.4",
        "react-router-dom": "^6.26.0",
        "tailwindcss-rtl": "^0.9.0",
      },
      devDependencies: {
        "@types/react": "^18.3.3",
        "@types/react-dom": "^18.3.0",
        "@vitejs/plugin-react": "^4.3.1",
        autoprefixer: "^10.4.19",
        postcss: "^8.4.38",
        tailwindcss: "^3.4.4",
        typescript: "^5.5.3",
        vite: "^5.3.4",
      },
    },
    null,
    2
  ) + "\n";

  // Canonical vite.config shape (copied from starter). The resolve.dedupe
  // comment MUST be preserved — it explains the single-React invariant. The
  // proxy target honours VITE_PROXY_TARGET so `dev:mock` can point it at the
  // standalone mock server without editing this file.
  files["vite.config.ts"] = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import emitManifest from '@matjar/theme-shared/build/emitManifest.mjs';

const PROXY_TARGET = process.env.VITE_PROXY_TARGET || 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), emitManifest()],
  resolve: {
    // dedupe is still REQUIRED under npm workspaces: the dashboard (react 19)
    // wins the root hoist, so themes keep a nested react 18 while hoisted
    // packages (react-i18next, @matjar/theme-shared peers) would resolve the
    // root copy — bundling two Reacts. dedupe forces every import to resolve
    // from this theme's own tree, guaranteeing a single React per bundle.
    dedupe: ['react', 'react-dom', 'react-router-dom', 'i18next', 'react-i18next', 'i18next-browser-languagedetector'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 4000,
    proxy: {
      '/api': PROXY_TARGET,
      '/storefront': PROXY_TARGET,
    },
  },
});
`;

  files["tailwind.config.js"] = `const rtl = require('tailwindcss-rtl');
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../_shared/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary, ${c.primary})',
        secondary: 'var(--color-secondary, ${c.secondary})',
        accent: 'var(--color-accent, ${c.primary})',
      },
      fontFamily: {
        sans: ['var(--font-app)', ${JSON.stringify(c.font)}, 'system-ui', 'sans-serif'],
        heading: [${JSON.stringify(c.font)}, 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [rtl],
};
`;

  files["postcss.config.js"] = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;

  files["tsconfig.json"] = JSON.stringify(
    {
      compilerOptions: {
        target: "ES2020",
        useDefineForClassFields: true,
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        module: "ESNext",
        skipLibCheck: true,
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        isolatedModules: true,
        moduleDetection: "force",
        noEmit: true,
        jsx: "react-jsx",
        strict: true,
      },
      include: ["src"],
    },
    null,
    2
  ) + "\n";

  files["index.html"] = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=${c.googleFontFamily}:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <title>${c.name}</title>
    <script>
      (function () {
        try {
          var stored = localStorage.getItem('matjar.storefront.lang');
          var nav = (navigator.language || '').toLowerCase();
          var lang = stored === 'ar' || stored === 'en'
            ? stored
            : (nav.indexOf('ar') === 0 ? 'ar' : 'en');
          var dir = lang === 'ar' ? 'rtl' : 'ltr';
          document.documentElement.lang = lang;
          document.documentElement.dir = dir;
          document.documentElement.setAttribute('dir', dir);
        } catch (e) {}
      })();
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

  files["src/main.tsx"] = `import { mountTheme } from '@matjar/theme-shared/app/mountTheme';
import App from './App';
import './index.css';

mountTheme(App);
`;

  files["src/App.tsx"] = `import { createThemeApp } from '@matjar/theme-shared/app/createThemeApp';
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
`;

  files["src/index.css"] = `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-primary: ${c.primary};
  --color-secondary: ${c.secondary};
  --color-accent: ${c.primary};
  --font-en: ${JSON.stringify(c.font)}, system-ui, sans-serif;
  --font-ar: 'Cairo', ${JSON.stringify(c.font)}, system-ui, sans-serif;
  --font-app: var(--font-en);
}
html[lang='ar'] { --font-app: var(--font-ar); }
body { font-family: var(--font-app); }
h1, h2, h3, h4, h5, h6 { font-family: ${JSON.stringify(c.font)}, system-ui, sans-serif; }

/* Arabic shaping breaks under any non-zero letter-spacing — reset every
   descendant to normal letter-spacing in Arabic mode. */
html[lang='ar'], html[lang='ar'] * { letter-spacing: 0 !important; }
html[dir='rtl'], html[dir='rtl'] body { direction: rtl; }
html[dir='ltr'], html[dir='ltr'] body { direction: ltr; }
`;

  files["src/theme.manifest.ts"] = manifestTemplate(c);
  files["src/components/Layout.tsx"] = layoutTemplate(c);
  files["src/pages/Home.tsx"] = homeTemplate(c);
  files["src/pages/Products.tsx"] = productsTemplate();
  files["src/pages/ProductDetail.tsx"] = productDetailTemplate();
  files["src/pages/CategoryPage.tsx"] = categoryPageTemplate();
  files["src/pages/CartPage.tsx"] = cartPageTemplate();
  files["src/i18n/locales/en/theme.json"] = enLocale(c);
  files["src/i18n/locales/ar/theme.json"] = arLocale(c);

  return files;
}

// ─── manifest (starter's universal template layout) ──────────────
function manifestTemplate(c) {
  return `import { defineTheme } from '@matjar/theme-shared/theme/defineTheme';
import { defineSection } from '@matjar/theme-shared/theme/defineSection';
import type { SectionDefinition } from '@matjar/theme-shared/types/theme';

// ─── Section Definitions ─────────────────────────────────────────

export const heroSection: SectionDefinition = defineSection({
  type: 'hero',
  name: 'Hero',
  icon: 'LayoutTemplate',
  category: 'content',
  description: 'Centered text hero with a single call-to-action button',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'textarea', label: 'Subheading', default: '' },
    { id: 'button_text', type: 'text', label: 'Button Text', default: '' },
    { id: 'button_url', type: 'url', label: 'Button URL', default: '/products' },
  ],
});

export const categoriesSection: SectionDefinition = defineSection({
  type: 'categories',
  name: 'Categories',
  icon: 'FolderTree',
  category: 'commerce',
  description: 'Horizontal list of category chips',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'max_categories', type: 'number', label: 'Max Categories', default: 12, min: 2, max: 30 },
  ],
});

export const featuredProductsSection: SectionDefinition = defineSection({
  type: 'featured-products',
  name: 'Featured Products',
  icon: 'Star',
  category: 'commerce',
  description: 'Product grid with a view-all link',
  target: 'body',
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'view_all_text', type: 'text', label: 'View All Link Text', default: '' },
    { id: 'view_all_url', type: 'url', label: 'View All URL', default: '/products' },
    { id: 'product_limit', type: 'number', label: 'Number of Products', default: 6, min: 2, max: 12 },
    { id: 'add_to_cart_text', type: 'text', label: 'Add to Cart Text', default: '' },
    { id: 'show_rating', type: 'checkbox', label: 'Show Rating', default: true },
    { id: 'show_quick_view', type: 'checkbox', label: 'Show Quick View', default: true },
  ],
});

export const trustBadgesSection: SectionDefinition = defineSection({
  type: 'trust-badges',
  name: 'Trust Badges',
  icon: 'ShieldCheck',
  category: 'marketing',
  description: 'Three-column feature strip',
  target: 'body',
  limit: 1,
  settings: [],
  blocks: [
    {
      type: 'badge',
      name: 'Badge',
      settings: [
        { id: 'title', type: 'text', label: 'Title', default: '' },
        { id: 'description', type: 'text', label: 'Description', default: '' },
      ],
    },
  ],
  defaultBlocks: [
    { id: 'badge-1', type: 'badge', settings: { title: 'Free Shipping', description: 'On orders over $50' } },
    { id: 'badge-2', type: 'badge', settings: { title: 'Easy Returns', description: '30-day return policy' } },
    { id: 'badge-3', type: 'badge', settings: { title: 'Secure Checkout', description: 'Safe & encrypted' } },
  ],
});

export const newsletterSection: SectionDefinition = defineSection({
  type: 'newsletter',
  name: 'Newsletter',
  icon: 'Mail',
  category: 'marketing',
  description: 'Email subscription row',
  target: 'body',
  limit: 1,
  settings: [
    { id: 'heading', type: 'text', label: 'Heading', default: '' },
    { id: 'subheading', type: 'text', label: 'Subheading', default: '' },
    { id: 'placeholder', type: 'text', label: 'Input Placeholder', default: '' },
    { id: 'button_text', type: 'text', label: 'Button Text', default: '' },
  ],
});

// ─── Theme Manifest ──────────────────────────────────────────────

const manifest = defineTheme({
  slug: '${c.slug}',
  name: '${c.name}',
  version: '1.0.0',
  previewImage: '/preview.jpg',
  description: 'A ${c.name} storefront theme scaffolded with create-theme.',
  author: { name: 'Matjar', website: 'https://matjar.to' },
  categories: ['general'],

  colors: {
    primary: '${c.primary}',
    secondary: '${c.secondary}',
    accent: '${c.primary}',
    background: '#ffffff',
    foreground: '#111827',
    muted: '#6b7280',
    border: '#e5e7eb',
    error: '#ef4444',
    success: '#10b981',
  },

  typography: {
    fontFamily: "${c.fontStack}",
    headingFontFamily: "${c.fontStack}",
    baseFontSize: '16px',
    lineHeight: '1.6',
  },

  fonts: [
    { label: ${JSON.stringify(c.font)}, value: "${c.fontStack}" },
    { label: 'Cairo', value: "'Cairo', sans-serif" },
  ],

  layout: {
    maxWidth: '1152px',
    headerStyle: 'standard',
    footerStyle: 'standard',
  },

  settings: [
    { id: 'show_announcement_bar', type: 'checkbox', label: 'Show Announcement Bar', default: false },
    { id: 'announcement_text', type: 'text', label: 'Announcement Text', default: '' },
  ],

  sections: [
    heroSection,
    categoriesSection,
    featuredProductsSection,
    trustBadgesSection,
    newsletterSection,
  ],

  templates: {
    index: [
      { id: 'hero', type: 'hero', settings: {} },
      { id: 'categories', type: 'categories', settings: {} },
      { id: 'featured-products', type: 'featured-products', settings: {} },
      { id: 'trust-badges', type: 'trust-badges', settings: {}, blocks: [
        { id: 'badge-1', type: 'badge', settings: { title: 'Free Shipping', description: 'On orders over $50' } },
        { id: 'badge-2', type: 'badge', settings: { title: 'Easy Returns', description: '30-day return policy' } },
        { id: 'badge-3', type: 'badge', settings: { title: 'Secure Checkout', description: 'Safe & encrypted' } },
      ]},
      { id: 'newsletter', type: 'newsletter', settings: {} },
    ],
    product: [],
    collection: [],
    cart: [],
    search: [],
    page: [],
  },
});

export default manifest;
`;
}

// ─── Layout ──────────────────────────────────────────────────────
function layoutTemplate() {
  return `import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { useCategories } from '@matjar/theme-shared/hooks/useProducts';
import { useMenu, type MenuItem } from '@matjar/theme-shared/hooks/useMenu';
import { SearchBar } from '@matjar/theme-shared/components/navigation/SearchBar';
import { MobileBottomNav } from '@matjar/theme-shared/components/navigation/MobileBottomNav';
import CartDrawer from '@matjar/theme-shared/components/CartDrawer';
import { LanguageSwitcher } from '@matjar/theme-shared/components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';

const Layout: React.FC = () => {
  const { store } = useStore();
  const { cart, isOpen: cartOpen, openCart, closeCart } = useCart();
  const { categories } = useCategories();
  const { items: menuItems } = useMenu('header');
  const hasMenu = menuItems.length > 0;
  const itemHref = (item: MenuItem) => item.resolvedUrl || item.url || '/';
  const isExternal = (item: MenuItem) => item.type === 'external' || item.target === '_blank';
  const { t } = useTranslation(['theme']);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--color-background)', color: 'var(--color-foreground)', fontFamily: 'var(--font-family)' }}
    >
      <header className="sticky top-0 z-50 border-b" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <Link to="/" className="text-lg font-bold" style={{ color: 'var(--color-foreground)', fontFamily: 'var(--font-family-heading)' }}>
              {store?.name || 'Store'}
            </Link>

            <nav className="hidden md:flex items-center gap-5">
              {hasMenu ? (
                menuItems.map(item => {
                  const cls = 'text-sm transition hover:opacity-80';
                  const href = itemHref(item);
                  return isExternal(item) ? (
                    <a key={item._id || href} href={href} target={item.target || '_blank'} rel="noopener noreferrer" className={cls} style={{ color: 'var(--color-muted)' }}>{item.label}</a>
                  ) : (
                    <Link key={item._id || href} to={href} className={cls} style={{ color: 'var(--color-muted)' }}>{item.label}</Link>
                  );
                })
              ) : (
                <>
                  <Link to="/products" className="text-sm transition hover:opacity-80" style={{ color: 'var(--color-muted)' }}>{t('theme.nav.products')}</Link>
                  {categories.slice(0, 3).map(cat => (
                    <Link key={cat._id} to={\`/categories/\${cat.slug}\`} className="text-sm transition hover:opacity-80" style={{ color: 'var(--color-muted)' }}>{cat.name}</Link>
                  ))}
                </>
              )}
            </nav>

            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center"><LanguageSwitcher /></div>
              <div className="hidden md:block"><SearchBar variant="compact" className="hover:opacity-80" /></div>
              <button onClick={openCart} className="relative hover:opacity-80 hidden md:block" style={{ color: 'var(--color-muted)' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                {cart && cart.itemCount > 0 && (
                  <span className="absolute -top-1.5 -end-1.5 w-4 h-4 text-white text-[10px] rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary)' }}>{cart.itemCount}</span>
                )}
              </button>
              <button className="md:hidden hover:opacity-80" style={{ color: 'var(--color-foreground)' }} onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label={t('common:aria.menu')}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
                </svg>
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <nav className="md:hidden border-t py-3 space-y-1" style={{ borderColor: 'var(--color-border)' }}>
              <Link to="/" onClick={() => setMobileMenuOpen(false)} className="block px-2 py-2 text-sm transition hover:opacity-80" style={{ color: 'var(--color-foreground)' }}>{t('theme.nav.home')}</Link>
              <Link to="/products" onClick={() => setMobileMenuOpen(false)} className="block px-2 py-2 text-sm transition hover:opacity-80" style={{ color: 'var(--color-foreground)' }}>{t('theme.nav.products')}</Link>
              {categories.slice(0, 4).map(cat => (
                <Link key={cat._id} to={\`/categories/\${cat.slug}\`} onClick={() => setMobileMenuOpen(false)} className="block px-2 py-2 text-sm transition hover:opacity-80" style={{ color: 'var(--color-muted)' }}>{cat.name}</Link>
              ))}
              <div className="px-2 pt-2"><LanguageSwitcher /></div>
            </nav>
          )}
        </div>
      </header>

      <main className="flex-1"><Outlet /></main>

      <footer className="border-t py-8" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm" style={{ color: 'var(--color-muted)' }}>
            <p>{t('theme.footer.copyright_html', { year: new Date().getFullYear(), name: store?.name || 'Store' })}</p>
            <div className="flex gap-6">
              <Link to="/products" className="transition hover:opacity-80">{t('theme.footer.products')}</Link>
              <Link to="/contact" className="transition hover:opacity-80">{t('theme.footer.contact')}</Link>
            </div>
          </div>
        </div>
      </footer>

      <MobileBottomNav onCartClick={openCart} />
      <CartDrawer isOpen={cartOpen} onClose={closeCart} />
    </div>
  );
};

export default Layout;
`;
}

// ─── Home ────────────────────────────────────────────────────────
function homeTemplate() {
  return `import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useThemeSettings } from '@matjar/theme-shared/theme/ThemeProvider';
import { useFeaturedProducts, useCategories } from '@matjar/theme-shared/hooks/useProducts';
import ProductCard from '@matjar/theme-shared/components/ProductCard';

const Home: React.FC = () => {
  const { t } = useTranslation(['theme']);
  const hero = useThemeSettings('hero');
  const feat = useThemeSettings('featured-products');
  const { products } = useFeaturedProducts(6);
  const { categories } = useCategories();

  return (
    <div>
      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ color: 'var(--color-foreground)' }}>
          {hero.heading || t('theme.hero.main.headline')}
        </h1>
        <p className="text-lg mb-8" style={{ color: 'var(--color-muted)' }}>
          {hero.subheading || t('theme.hero.main.subheadline')}
        </p>
        <Link to={hero.button_url || '/products'} className="inline-block px-8 py-3 rounded-lg text-white font-medium" style={{ backgroundColor: 'var(--color-primary)' }}>
          {hero.button_text || t('theme.hero.main.cta')}
        </Link>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-8">
          <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--color-foreground)' }}>{t('theme.section.categories.title')}</h2>
          <div className="flex flex-wrap gap-3">
            {categories.slice(0, 12).map(cat => (
              <Link key={cat._id} to={\`/categories/\${cat.slug}\`} className="px-4 py-2 rounded-full border text-sm transition hover:opacity-80" style={{ borderColor: 'var(--color-border)', color: 'var(--color-foreground)' }}>
                {cat.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured products */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--color-foreground)' }}>
            {feat.heading || t('theme.section.featured_products.title')}
          </h2>
          <Link to="/products" className="text-sm transition hover:opacity-80" style={{ color: 'var(--color-primary)' }}>
            {t('theme.section.featured_products.view_all')}
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {products.map(p => <ProductCard key={p._id} product={p} />)}
        </div>
      </section>
    </div>
  );
};

export default Home;
`;
}

// ─── Products ────────────────────────────────────────────────────
function productsTemplate() {
  return `import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProducts, useCategories } from '@matjar/theme-shared/hooks/useProducts';
import ProductCard from '@matjar/theme-shared/components/ProductCard';
import { useTranslation } from 'react-i18next';

const Products: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1');
  const sort = searchParams.get('sort') || 'newest';
  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const { t } = useTranslation(['theme']);

  const { products, pagination, loading } = useProducts({ page, sort, search, ...(category && { category }) });
  const { categories } = useCategories();
  const [searchInput, setSearchInput] = useState(search);

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== 'page') params.set('page', '1');
    setSearchParams(params);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold mb-8" style={{ color: 'var(--color-foreground)' }}>{t('theme.products.page_title')}</h1>

      <div className="flex flex-wrap gap-3 mb-8">
        <form onSubmit={(e) => { e.preventDefault(); updateParam('search', searchInput); }} className="flex-1 min-w-[200px]">
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder={t('theme.products.search_placeholder')} className="w-full px-4 py-2 rounded-lg border" style={{ borderColor: 'var(--color-border)' }} />
        </form>
        <select value={category} onChange={(e) => updateParam('category', e.target.value)} className="px-4 py-2 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
          <option value="">{t('theme.products.all_categories')}</option>
          {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <select value={sort} onChange={(e) => updateParam('sort', e.target.value)} className="px-4 py-2 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
          <option value="newest">{t('theme.products.sort_newest')}</option>
          <option value="price_asc">{t('theme.products.sort_price_asc')}</option>
          <option value="price_desc">{t('theme.products.sort_price_desc')}</option>
          <option value="popular">{t('theme.products.sort_popular')}</option>
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="animate-pulse bg-gray-100 rounded-lg aspect-square" />)}
        </div>
      ) : products.length === 0 ? (
        <p className="text-center py-16" style={{ color: 'var(--color-muted)' }}>{t('theme.products.no_results')}</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {products.map(p => <ProductCard key={p._id} product={p} />)}
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-10">
          <button disabled={page <= 1} onClick={() => updateParam('page', String(page - 1))} className="px-4 py-2 rounded-lg border disabled:opacity-40" style={{ borderColor: 'var(--color-border)' }}>{t('theme.products.previous')}</button>
          <span style={{ color: 'var(--color-muted)' }}>{t('theme.products.page_of', { page, total: pagination.pages })}</span>
          <button disabled={page >= pagination.pages} onClick={() => updateParam('page', String(page + 1))} className="px-4 py-2 rounded-lg border disabled:opacity-40" style={{ borderColor: 'var(--color-border)' }}>{t('theme.products.next')}</button>
        </div>
      )}
    </div>
  );
};

export default Products;
`;
}

// ─── ProductDetail ───────────────────────────────────────────────
function productDetailTemplate() {
  return `import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProduct } from '@matjar/theme-shared/hooks/useProducts';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { useTranslation } from 'react-i18next';

const ProductDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { product, loading, error } = useProduct(slug!);
  const { formatPrice } = useStore();
  const { addItem } = useCart();
  const { t } = useTranslation(['theme']);
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [adding, setAdding] = useState(false);

  if (loading) {
    return <div className="max-w-6xl mx-auto px-4 py-16"><div className="animate-pulse bg-gray-100 h-96 rounded-lg" /></div>;
  }
  if (error || !product) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">{t('theme.product_detail.product_not_found')}</h1>
        <Link to="/products" className="underline" style={{ color: 'var(--color-primary)' }}>{t('theme.product_detail.back_to_shop')}</Link>
      </div>
    );
  }

  const images: string[] = product.images && product.images.length ? product.images : [''];

  const handleAdd = async () => {
    setAdding(true);
    try { await addItem(product._id, quantity); } finally { setAdding(false); }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <nav className="text-sm mb-6" style={{ color: 'var(--color-muted)' }}>
        <Link to="/" className="hover:opacity-80">{t('theme.product_detail.breadcrumb_home')}</Link>
        {' / '}
        <Link to="/products" className="hover:opacity-80">{t('theme.product_detail.breadcrumb_products')}</Link>
      </nav>

      <div className="grid md:grid-cols-2 gap-10">
        <div>
          <div className="aspect-square rounded-lg overflow-hidden bg-gray-50 mb-4">
            {images[selectedImage] ? <img src={images[selectedImage]} alt={product.name} className="w-full h-full object-cover" /> : null}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2">
              {images.map((img, i) => (
                <button key={i} onClick={() => setSelectedImage(i)} className="w-16 h-16 rounded-lg overflow-hidden border" style={{ borderColor: i === selectedImage ? 'var(--color-primary)' : 'var(--color-border)' }}>
                  {img ? <img src={img} alt="" className="w-full h-full object-cover" /> : null}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="text-3xl font-bold mb-3" style={{ color: 'var(--color-foreground)' }}>{product.name}</h1>
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>{formatPrice(product.price)}</span>
            {product.compareAtPrice ? <span className="line-through" style={{ color: 'var(--color-muted)' }}>{formatPrice(product.compareAtPrice)}</span> : null}
          </div>
          <p className="mb-8" style={{ color: 'var(--color-muted)' }}>{product.description}</p>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center border rounded-lg" style={{ borderColor: 'var(--color-border)' }}>
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-4 py-2">-</button>
              <span className="px-4">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="px-4 py-2">+</button>
            </div>
            <button onClick={handleAdd} disabled={adding} className="flex-1 px-8 py-3 rounded-lg text-white font-medium disabled:opacity-60" style={{ backgroundColor: 'var(--color-primary)' }}>
              {t('theme.section.featured_products.add_to_cart')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
`;
}

// ─── CategoryPage ────────────────────────────────────────────────
function categoryPageTemplate() {
  return `import React from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useCategory } from '@matjar/theme-shared/hooks/useProducts';
import ProductCard from '@matjar/theme-shared/components/ProductCard';
import { useTranslation } from 'react-i18next';

const CategoryPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1');
  const sort = searchParams.get('sort') || 'newest';
  const { t } = useTranslation(['theme']);

  const { category, products, pagination, loading } = useCategory(slug!, { page, sort });

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set(key, value);
    if (key !== 'page') params.set('page', '1');
    setSearchParams(params);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="animate-pulse bg-gray-100 h-10 w-48 rounded mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="animate-pulse bg-gray-100 rounded-lg aspect-square" />)}
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">{t('theme.category.not_found_heading')}</h1>
        <Link to="/products" className="underline" style={{ color: 'var(--color-primary)' }}>{t('theme.category.browse_all')}</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <nav className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>
        <Link to="/" className="hover:opacity-80">{t('theme.category.breadcrumb_home')}</Link>{' / '}{category.name}
      </nav>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--color-foreground)' }}>{category.name}</h1>
        <select value={sort} onChange={(e) => updateParam('sort', e.target.value)} className="px-4 py-2 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
          <option value="newest">{t('theme.category.sort_newest')}</option>
          <option value="price_asc">{t('theme.category.sort_price_asc')}</option>
          <option value="price_desc">{t('theme.category.sort_price_desc')}</option>
        </select>
      </div>

      {products.length === 0 ? (
        <p className="text-center py-16" style={{ color: 'var(--color-muted)' }}>{t('theme.category.no_products')}</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {products.map(p => <ProductCard key={p._id} product={p} />)}
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-10">
          <button disabled={page <= 1} onClick={() => updateParam('page', String(page - 1))} className="px-4 py-2 rounded-lg border disabled:opacity-40" style={{ borderColor: 'var(--color-border)' }}>{t('theme.category.previous')}</button>
          <span style={{ color: 'var(--color-muted)' }}>{t('theme.category.page_of', { page, total: pagination.pages })}</span>
          <button disabled={page >= pagination.pages} onClick={() => updateParam('page', String(page + 1))} className="px-4 py-2 rounded-lg border disabled:opacity-40" style={{ borderColor: 'var(--color-border)' }}>{t('theme.category.next')}</button>
        </div>
      )}
    </div>
  );
};

export default CategoryPage;
`;
}

// ─── CartPage ────────────────────────────────────────────────────
function cartPageTemplate() {
  return `import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '@matjar/theme-shared/contexts/CartContext';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useTranslation } from 'react-i18next';

const CartPage: React.FC = () => {
  const { cart, updateItem, removeItem, clearCart, loading } = useCart();
  const { formatPrice } = useStore();
  const { t } = useTranslation(['theme']);

  if (loading) {
    return <div className="max-w-4xl mx-auto px-4 py-16 text-center" style={{ color: 'var(--color-muted)' }}>{t('theme.cart.loading')}</div>;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-foreground)' }}>{t('theme.cart.empty_heading')}</h2>
        <p className="mb-6" style={{ color: 'var(--color-muted)' }}>{t('theme.cart.empty_subtext')}</p>
        <Link to="/products" className="inline-block px-6 py-3 rounded-lg text-white font-medium" style={{ backgroundColor: 'var(--color-primary)' }}>{t('theme.cart.start_shopping')}</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--color-foreground)' }}>{t('theme.cart.page_heading')}</h1>
        <button onClick={clearCart} className="text-sm hover:opacity-80" style={{ color: 'var(--color-muted)' }}>{t('theme.cart.clear_cart')}</button>
      </div>

      <div className="space-y-4 mb-8">
        {cart.items.map(item => (
          <div key={item.id} className="flex items-center gap-4 p-4 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
            <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-50 flex-shrink-0">
              {item.product?.images?.[0] ? <img src={item.product.images[0]} alt={item.product?.name} className="w-full h-full object-cover" /> : null}
            </div>
            <div className="flex-1">
              <Link to={\`/products/\${item.product?.slug}\`} className="font-medium hover:opacity-80" style={{ color: 'var(--color-foreground)' }}>{item.product?.name}</Link>
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>{t('theme.cart.price_each', { price: formatPrice(item.price) })}</p>
            </div>
            <div className="flex items-center border rounded-lg" style={{ borderColor: 'var(--color-border)' }}>
              <button onClick={() => updateItem(item.productId, Math.max(1, item.quantity - 1))} className="px-3 py-1">-</button>
              <span className="px-3">{item.quantity}</span>
              <button onClick={() => updateItem(item.productId, item.quantity + 1)} className="px-3 py-1">+</button>
            </div>
            <div className="font-medium w-24 text-end" style={{ color: 'var(--color-foreground)' }}>{formatPrice(item.lineTotal)}</div>
            <button onClick={() => removeItem(item.productId)} className="text-sm hover:opacity-80" style={{ color: 'var(--color-error, #ef4444)' }}>{t('theme.cart.remove')}</button>
          </div>
        ))}
      </div>

      <div className="rounded-lg border p-6" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between mb-4">
          <span style={{ color: 'var(--color-muted)' }}>{t('theme.cart.subtotal', { count: cart.itemCount })}</span>
          <span className="text-xl font-bold" style={{ color: 'var(--color-foreground)' }}>{formatPrice(cart.subtotal)}</span>
        </div>
        <Link to="/checkout" className="block w-full text-center px-6 py-3 rounded-lg text-white font-medium" style={{ backgroundColor: 'var(--color-primary)' }}>{t('theme.cart.checkout_button')}</Link>
        <Link to="/products" className="block text-center mt-3 text-sm hover:opacity-80" style={{ color: 'var(--color-muted)' }}>{t('theme.cart.continue_shopping')}</Link>
      </div>
    </div>
  );
};

export default CartPage;
`;
}

// ─── i18n stubs ──────────────────────────────────────────────────
function enLocale() {
  return JSON.stringify(
    {
      theme: {
        hero: { main: { headline: "Welcome to Our Store", subheadline: "Discover our curated collection of quality products.", cta: "Shop Now" } },
        section: {
          categories: { title: "Categories" },
          featured_products: { title: "Featured Products", view_all: "View All", add_to_cart: "Add to Cart" },
        },
        products: {
          page_title: "All Products", all_categories: "All Categories", search_placeholder: "Search products...",
          sort_newest: "Newest", sort_price_asc: "Price: Low to High", sort_price_desc: "Price: High to Low", sort_popular: "Most Popular",
          no_results: "No products found", previous: "Previous", next: "Next", page_of: "Page {{page}} of {{total}}",
        },
        category: {
          not_found_heading: "Category Not Found", browse_all: "Browse all products", breadcrumb_home: "Home",
          sort_newest: "Newest", sort_price_asc: "Price: Low to High", sort_price_desc: "Price: High to Low",
          no_products: "No products in this category yet", previous: "Previous", next: "Next", page_of: "Page {{page}} of {{total}}",
        },
        product_detail: {
          breadcrumb_home: "Home", breadcrumb_products: "Products", product_not_found: "Product Not Found", back_to_shop: "Back to shop",
        },
        cart: {
          loading: "Loading cart...", empty_heading: "Your cart is empty", empty_subtext: "Looks like you haven't added anything yet",
          start_shopping: "Start Shopping", page_heading: "Shopping Cart", clear_cart: "Clear Cart", subtotal: "Subtotal ({{count}} items)",
          total: "Total", checkout_button: "Proceed to Checkout", continue_shopping: "Continue Shopping", remove: "Remove", price_each: "{{price}} each",
        },
        footer: { copyright_html: "© {{year}} {{name}}", products: "Products", contact: "Contact" },
        nav: { home: "Home", products: "Products" },
      },
    },
    null,
    2
  ) + "\n";
}

function arLocale() {
  return JSON.stringify(
    {
      theme: {
        hero: { main: { headline: "أهلاً وسهلاً بك في متجرنا", subheadline: "اكتشف مجموعتنا المختارة من المنتجات عالية الجودة.", cta: "تسوّق الآن" } },
        section: {
          categories: { title: "الفئات" },
          featured_products: { title: "المنتجات المميّزة", view_all: "عرض الكل", add_to_cart: "أضف إلى السلة" },
        },
        products: {
          page_title: "جميع المنتجات", all_categories: "جميع الفئات", search_placeholder: "ابحث عن منتجات...",
          sort_newest: "الأحدث", sort_price_asc: "السعر: من الأدنى إلى الأعلى", sort_price_desc: "السعر: من الأعلى إلى الأدنى", sort_popular: "الأكثر شعبية",
          no_results: "لا توجد منتجات", previous: "السابق", next: "التالي", page_of: "صفحة {{page}} من {{total}}",
        },
        category: {
          not_found_heading: "الفئة غير موجودة", browse_all: "تصفّح جميع المنتجات", breadcrumb_home: "الرئيسية",
          sort_newest: "الأحدث", sort_price_asc: "السعر: من الأدنى إلى الأعلى", sort_price_desc: "السعر: من الأعلى إلى الأدنى",
          no_products: "لا توجد منتجات في هذه الفئة بعد", previous: "السابق", next: "التالي", page_of: "صفحة {{page}} من {{total}}",
        },
        product_detail: {
          breadcrumb_home: "الرئيسية", breadcrumb_products: "المنتجات", product_not_found: "المنتج غير موجود", back_to_shop: "العودة إلى المتجر",
        },
        cart: {
          loading: "جاري تحميل السلة...", empty_heading: "سلتك فارغة", empty_subtext: "يبدو أنك لم تضف أي شيء بعد",
          start_shopping: "ابدأ التسوق", page_heading: "سلة التسوق", clear_cart: "إفراغ السلة", subtotal: "الإجمالي الفرعي ({{count}} عنصر)",
          total: "الإجمالي", checkout_button: "المتابعة إلى الدفع", continue_shopping: "متابعة التسوق", remove: "إزالة", price_each: "{{price}} للقطعة",
        },
        footer: { copyright_html: "© {{year}} {{name}}", products: "المنتجات", contact: "تواصل معنا" },
        nav: { home: "الرئيسية", products: "المنتجات" },
      },
    },
    null,
    2
  ) + "\n";
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
