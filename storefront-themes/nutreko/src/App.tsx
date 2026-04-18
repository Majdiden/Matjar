import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import CategoryPage from './pages/CategoryPage';
import CollectionsIndex from '@shared/pages/CollectionsIndex';
import CollectionPage from '@shared/pages/CollectionPage';
import CartPage from './pages/CartPage';
import SearchResults from '@shared/pages/SearchResults';
import Wishlist from '@shared/pages/Wishlist';
import NotFound from '@shared/pages/NotFound';
import Contact from '@shared/pages/Contact';
import About from '@shared/pages/About';
import Login from '@shared/pages/Login';
import Register from '@shared/pages/Register';
import Account from '@shared/pages/Account';
import Checkout from '@shared/pages/Checkout';
import OrderSuccess from '@shared/pages/OrderSuccess';
import OrderTracking from '@shared/pages/OrderTracking';
import ScrollToTop from '@shared/components/navigation/ScrollToTop';
import { ThemeCardProvider } from '@shared/theme/ThemeCardProvider';
import NutrekoProductCard from './components/NutrekoProductCard';

const renderNutrekoCard = (product: any, onQuickView?: (p: any) => void) => (
  <NutrekoProductCard product={product} onQuickView={onQuickView} />
);

function App() {
  return (
    <ThemeCardProvider renderCard={renderNutrekoCard}>
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
        <Route path="*" element={<NotFound />} />
      </Route>
      </Routes>
    </ThemeCardProvider>
  );
}

export default App;
