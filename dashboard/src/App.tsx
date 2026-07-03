import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RequirePermission } from './components/RequirePermission';
import { DashboardLayout } from './components/layouts/DashboardLayout';
import { PageLoader } from './components/PageLoader';
// Login stays eager — it's the most common cold entry, so a Suspense
// spinner there would flash on nearly every unauthenticated visit.
import { Login } from './pages/Login';
import { Toaster } from './components/ui/sonner';
import { ConfirmProvider } from './components/ui/confirm-dialog';

// Every route page is code-split (audit 3.6) so the initial bundle no
// longer carries all ~55 pages. Vite emits one chunk per lazy import;
// the Suspense boundaries below show PageLoader while a chunk loads.
const Register = lazy(() => import('./pages/Register').then(m => ({ default: m.Register })));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./pages/ResetPassword').then(m => ({ default: m.ResetPassword })));
const SetupInProgress = lazy(() => import('./pages/SetupInProgress'));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Domains = lazy(() => import('./pages/domains/Domains').then(m => ({ default: m.Domains })));
const Products = lazy(() => import('./pages/products/Products').then(m => ({ default: m.Products })));
const ProductForm = lazy(() => import('./pages/products/ProductForm').then(m => ({ default: m.ProductForm })));
const Categories = lazy(() => import('./pages/categories/Categories').then(m => ({ default: m.Categories })));
const Orders = lazy(() => import('./pages/orders/Orders').then(m => ({ default: m.Orders })));
const OrderCreate = lazy(() => import('./pages/orders/create/OrderCreate').then(m => ({ default: m.OrderCreate })));
const OrderDetails = lazy(() => import('./pages/orders/detail').then(m => ({ default: m.OrderDetails })));
const OrderLifecycle = lazy(() => import('./pages/orders/OrderLifecycle'));
const PackingSlip = lazy(() => import('./pages/orders/documents/PackingSlip'));
const Invoice = lazy(() => import('./pages/orders/documents/Invoice'));
const RefundReceipt = lazy(() => import('./pages/orders/documents/RefundReceipt'));
const Themes = lazy(() => import('./pages/themes/Themes').then(m => ({ default: m.Themes })));
const VisualEditor = lazy(() => import('./pages/themes/VisualEditor'));
const Settings = lazy(() => import('./pages/settings').then(m => ({ default: m.Settings })));
const Companies = lazy(() => import('./pages/companies/Companies').then(m => ({ default: m.Companies })));
const ShippingZoneForm = lazy(() => import('./pages/ShippingZoneForm'));
const Discounts = lazy(() => import('./pages/marketing/Discounts'));
const DiscountForm = lazy(() => import('./pages/marketing/DiscountForm'));
const Customers = lazy(() => import('./pages/customers/Customers'));
const CustomerSegments = lazy(() => import('./pages/customers/CustomerSegments'));
const CustomerSegmentForm = lazy(() => import('./pages/customers/CustomerSegmentForm'));
const Analytics = lazy(() => import('./pages/analytics/Analytics'));
const Reviews = lazy(() => import('./pages/reviews/Reviews'));
const Inventory = lazy(() => import('./pages/inventory/Inventory'));
const Fulfillments = lazy(() => import('./pages/fulfillments/Fulfillments').then(m => ({ default: m.Fulfillments })));
const CustomFields = lazy(() => import('./pages/custom-fields/CustomFields').then(m => ({ default: m.CustomFields })));
const AuditLogs = lazy(() => import('./pages/audit-logs/AuditLogs').then(m => ({ default: m.AuditLogs })));
const Payments = lazy(() => import('./pages/payments/Payments'));
const PaymentMethods = lazy(() => import('./pages/payments/PaymentMethods'));
const TransactionDetail = lazy(() => import('./pages/payments/TransactionDetail'));
const Subscriptions = lazy(() => import('./pages/subscriptions/Subscriptions'));
const Permissions = lazy(() => import('./pages/permissions/Permissions'));
const Webhooks = lazy(() => import('./pages/webhooks/Webhooks'));
const GiftCards = lazy(() => import('./pages/gift-cards/GiftCards'));
const GiftCardDetail = lazy(() => import('./pages/gift-cards/GiftCardDetail'));
const GiftCardNew = lazy(() => import('./pages/gift-cards/GiftCardNew'));
const Collections = lazy(() => import('./pages/collections/Collections'));
const CollectionForm = lazy(() => import('./pages/collections/CollectionForm'));
const Menus = lazy(() => import('./pages/menus/Menus'));
const MenuForm = lazy(() => import('./pages/menus/MenuForm'));
const Pages = lazy(() => import('./pages/pages/Pages'));
const PageForm = lazy(() => import('./pages/pages/PageForm'));
const MediaLibrary = lazy(() => import('./pages/media/MediaLibrary'));
const Redirects = lazy(() => import('./pages/redirects/Redirects'));
const Staff = lazy(() => import('./pages/staff/Staff'));
const AcceptInvite = lazy(() => import('./pages/staff/AcceptInvite'));
const Notifications = lazy(() => import('./pages/notifications/Notifications'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Get base path from environment (for production build served at /dashboard/)
const basename = import.meta.env.MODE === 'production' ? '/dashboard' : '/';

function App() {
  return (
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <ConfirmProvider>
        {/* Outer boundary catches the standalone lazy routes (register,
            printable docs, editor). Dashboard child pages have their own
            boundary inside DashboardLayout so the sidebar never flashes. */}
        <Suspense fallback={<PageLoader fullScreen />}>
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
            <Route path="orders/new" element={<RequirePermission permission="orders.write"><OrderCreate /></RequirePermission>} />
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
            <Route path="companies" element={<RequirePermission permission={['customers.read', 'customers.write']}><Companies /></RequirePermission>} />
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
            <Route path="media" element={<RequirePermission permission="themes.write"><MediaLibrary /></RequirePermission>} />
            <Route path="redirects" element={<RequirePermission permission={['themes.read', 'themes.write']}><Redirects /></RequirePermission>} />
            <Route path="staff" element={<RequirePermission permission="team.manage"><Staff /></RequirePermission>} />
            {/* Real 404 inside the shell for unknown /dashboard/* paths */}
            <Route path="*" element={<NotFound />} />
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

          {/* Unknown top-level paths fall into the app; the dashboard's
              own "*" child then renders the real 404 in the shell. */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </Suspense>
        <Toaster richColors closeButton position="top-right" />
        </ConfirmProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
