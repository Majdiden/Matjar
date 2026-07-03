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
