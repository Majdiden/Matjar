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
import { LinenProductCard } from './components/LinenProductCard';

export default createThemeApp({
  Layout,
  manifest,
  locales: { en, ar },
  pages: { Home, Products, ProductDetail, CategoryPage, CartPage },
  // Shared pages (collections, search, wishlist…) render the theme's own
  // card through this slot, so a product looks identical everywhere.
  renderCard: (product: any, onQuickView?: (p: any) => void) => (
    <LinenProductCard product={product} onQuickView={onQuickView} />
  ),
});
