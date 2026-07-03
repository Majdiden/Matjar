import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import CategoryPage from './pages/CategoryPage';
import CollectionsIndex from '@matjar/theme-shared/pages/CollectionsIndex';
import CollectionPage from '@matjar/theme-shared/pages/CollectionPage';
import CartPage from './pages/CartPage';
import SearchResults from '@matjar/theme-shared/pages/SearchResults';
import Wishlist from '@matjar/theme-shared/pages/Wishlist';
import NotFound from '@matjar/theme-shared/pages/NotFound';
import Contact from '@matjar/theme-shared/pages/Contact';
import About from '@matjar/theme-shared/pages/About';
import PageView from '@matjar/theme-shared/pages/PageView';
import Login from '@matjar/theme-shared/pages/Login';
import Register from '@matjar/theme-shared/pages/Register';
import Account from '@matjar/theme-shared/pages/Account';
import Checkout from '@matjar/theme-shared/pages/Checkout';
import OrderSuccess from '@matjar/theme-shared/pages/OrderSuccess';
import OrderTracking from '@matjar/theme-shared/pages/OrderTracking';
import ScrollToTop from '@matjar/theme-shared/components/navigation/ScrollToTop';
import { ThemeCardProvider } from '@matjar/theme-shared/theme/ThemeCardProvider';
import { ThemeSlotsProvider } from '@matjar/theme-shared/theme/ThemeSlotsProvider';
import TonmartProductCard from './components/TonmartProductCard';
import TechhubProductDetailExtras from './components/TechhubProductDetailExtras';

const renderTonmartCard = (product: any, onQuickView?: (p: any) => void) => (
  <TonmartProductCard product={product} onQuickView={onQuickView} />
);

function App() {
  return (
    <ThemeCardProvider renderCard={renderTonmartCard}>
      <ThemeSlotsProvider slots={{ productDetailExtras: TechhubProductDetailExtras }}>
      <ScrollToTop />
      <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:slug" element={<ProductDetail />} />
        <Route path="/categories/:slug" element={<CategoryPage />} />
        <Route path="/collections" element={<CollectionsIndex />} />
        <Route path="/collections/:handle" element={<CollectionPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order-success/:id" element={<OrderSuccess />} />
        <Route path="/order-success" element={<OrderSuccess />} />
        <Route path="/orders/:id" element={<OrderTracking />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/account" element={<Account />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/about" element={<About />} />
        <Route path="/pages/:slug" element={<PageView />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      </Routes>
      </ThemeSlotsProvider>
    </ThemeCardProvider>
  );
}

export default App;
