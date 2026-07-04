import React from 'react';
import { Routes, Route } from 'react-router-dom';

// Shared default pages — a theme only overrides the ones it re-implements.
import CollectionsIndex from '../pages/CollectionsIndex';
import CollectionPage from '../pages/CollectionPage';
import SearchResults from '../pages/SearchResults';
import Wishlist from '../pages/Wishlist';
import NotFound from '../pages/NotFound';
import Contact from '../pages/Contact';
import About from '../pages/About';
import PageView from '../pages/PageView';
import Login from '../pages/Login';
import Register from '../pages/Register';
import ForgotPassword from '../pages/ForgotPassword';
import ResetPassword from '../pages/ResetPassword';
import Account from '../pages/Account';
import Checkout from '../pages/Checkout';
import OrderSuccess from '../pages/OrderSuccess';
import OrderTracking from '../pages/OrderTracking';

import ScrollToTop from '../components/navigation/ScrollToTop';
import { ThemeCardProvider, type ThemeCardRenderer } from '../theme/ThemeCardProvider';
import { ThemeSlotsProvider, type ThemeSlotMap } from '../theme/ThemeSlotsProvider';
import type { ThemeManifest } from '../types/theme';

type PageComponent = React.ComponentType<any>;

/**
 * Per-page overrides. Anything omitted falls back to the shared SDK page.
 * `Home`, `Products`, `ProductDetail`, `CategoryPage` and `CartPage` have no
 * shared default (every theme ships its own), so they are required.
 */
export interface ThemePages {
  // Required — bespoke in every theme.
  Home: PageComponent;
  Products: PageComponent;
  ProductDetail: PageComponent;
  CategoryPage: PageComponent;
  CartPage: PageComponent;
  // Optional — default to the shared SDK pages.
  CollectionsIndex?: PageComponent;
  CollectionPage?: PageComponent;
  SearchResults?: PageComponent;
  Wishlist?: PageComponent;
  NotFound?: PageComponent;
  Contact?: PageComponent;
  About?: PageComponent;
  PageView?: PageComponent;
  Login?: PageComponent;
  Register?: PageComponent;
  ForgotPassword?: PageComponent;
  ResetPassword?: PageComponent;
  Account?: PageComponent;
  Checkout?: PageComponent;
  OrderSuccess?: PageComponent;
  OrderTracking?: PageComponent;
}

export interface ExtraRoute {
  path: string;
  element: React.ReactNode;
}

export interface CreateThemeAppOptions {
  /** The theme's bespoke layout (header/footer/outlet shell). Required. */
  Layout: PageComponent;
  /** Per-page components; unset optional keys use the shared SDK pages. */
  pages: ThemePages;
  /** The theme's manifest — consumed by `mountTheme` for <ThemeProvider>. */
  manifest: ThemeManifest;
  /**
   * Theme-specific i18n bundles (`locales/{en,ar}/theme.json`), registered
   * under the `theme` namespace by `mountTheme` before first render.
   */
  locales?: { en?: Record<string, unknown>; ar?: Record<string, unknown> };
  /** Theme product-card renderer (wraps the app in <ThemeCardProvider>). */
  renderCard?: ThemeCardRenderer;
  /** Extra slot overrides, e.g. `{ productDetailExtras: Component }`. */
  slots?: ThemeSlotMap;
  /** Additional theme-specific routes rendered inside the Layout. */
  routes?: ExtraRoute[];
}

export interface ThemeAppComponent extends React.FC {
  /** Read by `mountTheme` — the manifest passed to createThemeApp. */
  manifest: ThemeManifest;
  /** Read by `mountTheme` — theme i18n bundles to register. */
  locales?: CreateThemeAppOptions['locales'];
}

/**
 * Builds the standard storefront route table shared by every theme.
 *
 * Adding a route here reaches all themes at once; a theme adds bespoke
 * routes via `options.routes` and swaps page implementations via
 * `options.pages`.
 */
export function createThemeApp(options: CreateThemeAppOptions): ThemeAppComponent {
  const { Layout, pages, renderCard, slots, routes = [] } = options;

  const P = {
    CollectionsIndex,
    CollectionPage,
    SearchResults,
    Wishlist,
    NotFound,
    Contact,
    About,
    PageView,
    Login,
    Register,
    ForgotPassword,
    ResetPassword,
    Account,
    Checkout,
    OrderSuccess,
    OrderTracking,
    ...pages,
  };

  const App: React.FC = () => {
    let tree: React.ReactElement = (
      <>
        <ScrollToTop />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<P.Home />} />
            <Route path="/products" element={<P.Products />} />
            <Route path="/products/:slug" element={<P.ProductDetail />} />
            <Route path="/categories/:slug" element={<P.CategoryPage />} />
            <Route path="/collections" element={<P.CollectionsIndex />} />
            <Route path="/collections/:handle" element={<P.CollectionPage />} />
            <Route path="/cart" element={<P.CartPage />} />
            <Route path="/checkout" element={<P.Checkout />} />
            <Route path="/order-success/:id" element={<P.OrderSuccess />} />
            <Route path="/order-success" element={<P.OrderSuccess />} />
            <Route path="/orders/:id" element={<P.OrderTracking />} />
            <Route path="/search" element={<P.SearchResults />} />
            <Route path="/login" element={<P.Login />} />
            <Route path="/register" element={<P.Register />} />
            <Route path="/forgot-password" element={<P.ForgotPassword />} />
            <Route path="/reset-password" element={<P.ResetPassword />} />
            <Route path="/account" element={<P.Account />} />
            <Route path="/wishlist" element={<P.Wishlist />} />
            <Route path="/contact" element={<P.Contact />} />
            <Route path="/about" element={<P.About />} />
            <Route path="/pages/:slug" element={<P.PageView />} />
            {routes.map((r) => (
              <Route key={r.path} path={r.path} element={r.element} />
            ))}
            <Route path="*" element={<P.NotFound />} />
          </Route>
        </Routes>
      </>
    );

    // Wrap only when the theme provides these — matches the pre-SDK App.tsx
    // shape exactly (themes without a card renderer had no provider at all).
    if (slots) {
      tree = <ThemeSlotsProvider slots={slots}>{tree}</ThemeSlotsProvider>;
    }
    if (renderCard) {
      tree = <ThemeCardProvider renderCard={renderCard}>{tree}</ThemeCardProvider>;
    }
    return tree;
  };

  const ThemeApp = App as ThemeAppComponent;
  ThemeApp.manifest = options.manifest;
  ThemeApp.locales = options.locales;
  return ThemeApp;
}

export default createThemeApp;
