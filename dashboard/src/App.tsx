import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RequirePermission } from './components/RequirePermission';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import SetupInProgress from './pages/SetupInProgress';
import { DashboardLayout } from './components/layouts/DashboardLayout';
import { Dashboard } from './pages/Dashboard';
import { Domains } from './pages/domains/Domains';
import { Products } from './pages/products/Products';
import { ProductForm } from './pages/products/ProductForm';
import { Categories } from './pages/categories/Categories';
import { Orders } from './pages/orders/Orders';
import { OrderDetails } from './pages/orders/OrderDetails';
import OrderLifecycle from './pages/orders/OrderLifecycle';
import PackingSlip from './pages/orders/documents/PackingSlip';
import Invoice from './pages/orders/documents/Invoice';
import RefundReceipt from './pages/orders/documents/RefundReceipt';
import { Themes } from './pages/themes/Themes';
import VisualEditor from './pages/themes/VisualEditor';
import { Settings } from './pages/Settings';
import ShippingZoneForm from './pages/ShippingZoneForm';
import Discounts from './pages/marketing/Discounts';
import DiscountForm from './pages/marketing/DiscountForm';
import Customers from './pages/customers/Customers';
import CustomerSegments from './pages/customers/CustomerSegments';
import CustomerSegmentForm from './pages/customers/CustomerSegmentForm';
import Analytics from './pages/analytics/Analytics';
import Reviews from './pages/reviews/Reviews';
import Inventory from './pages/inventory/Inventory';
import { Fulfillments } from './pages/fulfillments/Fulfillments';
import { CustomFields } from './pages/custom-fields/CustomFields';
import { AuditLogs } from './pages/audit-logs/AuditLogs';
import Payments from './pages/payments/Payments';
import PaymentMethods from './pages/payments/PaymentMethods';
import TransactionDetail from './pages/payments/TransactionDetail';
import Subscriptions from './pages/subscriptions/Subscriptions';
import Permissions from './pages/permissions/Permissions';
import Webhooks from './pages/webhooks/Webhooks';
import GiftCards from './pages/gift-cards/GiftCards';
import GiftCardDetail from './pages/gift-cards/GiftCardDetail';
import GiftCardNew from './pages/gift-cards/GiftCardNew';
import Collections from './pages/collections/Collections';
import CollectionForm from './pages/collections/CollectionForm';
import Menus from './pages/menus/Menus';
import MenuForm from './pages/menus/MenuForm';
import Pages from './pages/pages/Pages';
import PageForm from './pages/pages/PageForm';
import Staff from './pages/staff/Staff';
import AcceptInvite from './pages/staff/AcceptInvite';
import Notifications from './pages/notifications/Notifications';
import { Toaster } from './components/ui/sonner';
import { ConfirmProvider } from './components/ui/confirm-dialog';

// Get base path from environment (for production build served at /dashboard/)
const basename = import.meta.env.MODE === 'production' ? '/dashboard' : '/';

function App() {
  return (
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <ConfirmProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/setup" element={<SetupInProgress />} />
          <Route path="/staff/accept" element={<AcceptInvite />} />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<RequirePermission permission="dashboard.read"><Dashboard /></RequirePermission>} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="domains" element={<RequirePermission permission={['domains.read', 'domains.write']}><Domains /></RequirePermission>} />
            <Route path="products" element={<RequirePermission permission="products.read"><Products /></RequirePermission>} />
            <Route path="products/new" element={<RequirePermission permission="products.write"><ProductForm /></RequirePermission>} />
            <Route path="products/:id/edit" element={<RequirePermission permission="products.write"><ProductForm /></RequirePermission>} />
            <Route path="categories" element={<RequirePermission permission="products.read"><Categories /></RequirePermission>} />
            <Route path="orders" element={<RequirePermission permission="orders.read"><Orders /></RequirePermission>} />
            <Route path="orders/:id" element={<RequirePermission permission="orders.read"><OrderDetails /></RequirePermission>} />
            <Route path="orders/:id/lifecycle" element={<RequirePermission permission="orders.read"><OrderLifecycle /></RequirePermission>} />
            <Route path="themes" element={<RequirePermission permission={['themes.read', 'themes.write']}><Themes /></RequirePermission>} />
            <Route path="themes/customize" element={<Navigate to="/dashboard/themes/editor" replace />} />
            <Route path="settings" element={<RequirePermission permission={['settings.read', 'settings.write']}><Settings /></RequirePermission>} />
            <Route path="settings/shipping-zones/new" element={<RequirePermission permission="settings.write"><ShippingZoneForm /></RequirePermission>} />
            <Route path="settings/shipping-zones/:id/edit" element={<RequirePermission permission="settings.write"><ShippingZoneForm /></RequirePermission>} />
            <Route path="marketing/discounts" element={<RequirePermission permission={['discounts.read', 'discounts.write']}><Discounts /></RequirePermission>} />
            <Route path="marketing/discounts/new" element={<RequirePermission permission="discounts.write"><DiscountForm /></RequirePermission>} />
            <Route path="marketing/discounts/:id/edit" element={<RequirePermission permission="discounts.write"><DiscountForm /></RequirePermission>} />
            <Route path="customers" element={<RequirePermission permission={['customers.read', 'customers.write']}><Customers /></RequirePermission>} />
            <Route path="customers/segments" element={<RequirePermission permission={['customers.read', 'customers.write']}><CustomerSegments /></RequirePermission>} />
            <Route path="customers/segments/new" element={<RequirePermission permission="customers.write"><CustomerSegmentForm /></RequirePermission>} />
            <Route path="customers/segments/:id/edit" element={<RequirePermission permission="customers.write"><CustomerSegmentForm /></RequirePermission>} />
            <Route path="analytics" element={<RequirePermission permission="analytics.read"><Analytics /></RequirePermission>} />
            <Route path="reviews" element={<RequirePermission permission={['reviews.read', 'reviews.moderate']}><Reviews /></RequirePermission>} />
            <Route path="inventory" element={<RequirePermission permission={['inventory.read', 'inventory.write']}><Inventory /></RequirePermission>} />
            <Route path="fulfillments" element={<RequirePermission permission={['fulfillments.read', 'fulfillments.write']}><Fulfillments /></RequirePermission>} />
            <Route path="custom-fields" element={<RequirePermission permission="settings.write"><CustomFields /></RequirePermission>} />
            <Route path="audit-logs" element={<RequirePermission permission="audit.read"><AuditLogs /></RequirePermission>} />
            <Route path="payments" element={<RequirePermission permission="payments.read"><Payments /></RequirePermission>} />
            <Route path="payments/methods" element={<RequirePermission permission="settings.write"><PaymentMethods /></RequirePermission>} />
            <Route path="payments/:id" element={<RequirePermission permission="payments.read"><TransactionDetail /></RequirePermission>} />
            <Route path="subscription" element={<RequirePermission permission="settings.read"><Subscriptions /></RequirePermission>} />
            <Route path="permissions" element={<RequirePermission permission="team.manage"><Permissions /></RequirePermission>} />
            <Route path="webhooks" element={<RequirePermission permission="settings.write"><Webhooks /></RequirePermission>} />
            <Route path="gift-cards" element={<RequirePermission permission={['discounts.read', 'discounts.write']}><GiftCards /></RequirePermission>} />
            <Route path="gift-cards/new" element={<RequirePermission permission="discounts.write"><GiftCardNew /></RequirePermission>} />
            <Route path="gift-cards/:id" element={<RequirePermission permission={['discounts.read', 'discounts.write']}><GiftCardDetail /></RequirePermission>} />
            <Route path="collections" element={<RequirePermission permission="products.read"><Collections /></RequirePermission>} />
            <Route path="collections/new" element={<RequirePermission permission="products.write"><CollectionForm /></RequirePermission>} />
            <Route path="collections/:id/edit" element={<RequirePermission permission="products.write"><CollectionForm /></RequirePermission>} />
            <Route path="menus" element={<RequirePermission permission={['themes.read', 'themes.write']}><Menus /></RequirePermission>} />
            <Route path="menus/new" element={<RequirePermission permission="themes.write"><MenuForm /></RequirePermission>} />
            <Route path="menus/:id/edit" element={<RequirePermission permission="themes.write"><MenuForm /></RequirePermission>} />
            <Route path="pages" element={<RequirePermission permission={['themes.read', 'themes.write']}><Pages /></RequirePermission>} />
            <Route path="pages/new" element={<RequirePermission permission="themes.write"><PageForm /></RequirePermission>} />
            <Route path="pages/:id/edit" element={<RequirePermission permission="themes.write"><PageForm /></RequirePermission>} />
            <Route path="staff" element={<RequirePermission permission="team.manage"><Staff /></RequirePermission>} />
          </Route>

          {/* Printable order documents — rendered outside DashboardLayout
              so the print view is clean (no sidebar / topbar chrome). All
              require orders.read; the packing slip is safe at that level
              because it deliberately excludes prices. */}
          <Route
            path="/dashboard/orders/:id/invoice"
            element={
              <ProtectedRoute>
                <RequirePermission permission="orders.read" inline={false}>
                  <Invoice />
                </RequirePermission>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/orders/:id/packing-slip"
            element={
              <ProtectedRoute>
                <RequirePermission permission="orders.read" inline={false}>
                  <PackingSlip />
                </RequirePermission>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/orders/:id/refund-receipt/:refundId"
            element={
              <ProtectedRoute>
                <RequirePermission permission="orders.read" inline={false}>
                  <RefundReceipt />
                </RequirePermission>
              </ProtectedRoute>
            }
          />

          {/* Full-screen theme editor — rendered outside DashboardLayout
              so the outer sidebar/topbar are hidden and the editor gets
              the full viewport width. */}
          <Route
            path="/dashboard/themes/editor"
            element={
              <ProtectedRoute>
                <RequirePermission permission="themes.write" inline={false}>
                  <VisualEditor />
                </RequirePermission>
              </ProtectedRoute>
            }
          />

          {/* Redirect root to dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <Toaster richColors closeButton position="top-right" />
        </ConfirmProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
