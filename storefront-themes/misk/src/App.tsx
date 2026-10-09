import { createThemeApp } from '@matjar/theme-shared/app/createThemeApp';
import Layout from './components/Layout';
import manifest from './theme.manifest';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import CategoryPage from './pages/CategoryPage';
import CollectionPage from './pages/CollectionPage';
import CartPage from './pages/CartPage';
import MiskProductCard from './components/MiskProductCard';
import en from './i18n/locales/en/theme.json';
import ar from './i18n/locales/ar/theme.json';

export default createThemeApp({
  Layout,
  manifest,
  locales: { en, ar },
  pages: { Home, Products, ProductDetail, CategoryPage, CollectionPage, CartPage },
  // Shared pages (search, wishlist, collections index) render the theme card.
  renderCard: (product: any, onQuickView?: (p: any) => void) => (
    <MiskProductCard key={product._id} product={product} onQuickView={onQuickView} />
  ),
});
