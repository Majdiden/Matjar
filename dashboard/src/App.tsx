import { lazy, Suspense, type ComponentType } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { FeaturesProvider } from './contexts/FeaturesContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RequirePermission } from './components/RequirePermission';
import { RequireFeature } from './components/RequireFeature';
import { DashboardLayout } from './components/layouts/DashboardLayout';
import { PageLoader } from './components/PageLoader';
// Login stays eager — it's the most common cold entry, so a Suspense
// spinner there would flash on nearly every unauthenticated visit.
import { Login } from './pages/Login';
import { Toaster } from './components/ui/sonner';
import { ConfirmProvider } from './components/ui/confirm-dialog';

// A failed dynamic import almost always means the chunk hash changed under
// an open tab — a new deploy or a service-worker update, after which the
// cached index.html still references chunk names the server no longer has.
// Instead of falling into the error boundary ("something went wrong — please
// refresh"), reload ONCE to pull the fresh shell. The guard clears on any
// successful import so a genuinely broken chunk still surfaces (no loop).
const CHUNK_RELOAD_KEY = 'matjar:chunk-reloaded';
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors React.lazy's own ComponentType<any> signature
function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(() =>
    factory()
      .then((m) => {
        sessionStorage.removeItem(CHUNK_RELOAD_KEY);
        return m;
      })
      .catch((err) => {
        if (!sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
          sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
          window.location.reload();
          return new Promise<{ default: T }>(() => {}); // never resolves; page reloads
        }
        throw err;
      }),
  );
}

// Every route page is code-split (audit 3.6) so the initial bundle no
// longer carries all ~55 pages. Vite emits one chunk per lazy import;
// the Suspense boundaries below show PageLoader while a chunk loads.
const Register = lazyWithRetry(() => import('./pages/Register').then(m => ({ default: m.Register })));
const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword = lazyWithRetry(() => import('./pages/ResetPassword').then(m => ({ default: m.ResetPassword })));
const SetupInProgress = lazyWithRetry(() => import('./pages/SetupInProgress'));
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Domains = lazyWithRetry(() => import('./pages/domains/Domains').then(m => ({ default: m.Domains })));
const Products = lazyWithRetry(() => import('./pages/products/Products').then(m => ({ default: m.Products })));
const ProductForm = lazyWithRetry(() => import('./pages/products/ProductForm').then(m => ({ default: m.ProductForm })));
const Categories = lazyWithRetry(() => import('./pages/categories/Categories').then(m => ({ default: m.Categories })));
const Orders = lazyWithRetry(() => import('./pages/orders/Orders').then(m => ({ default: m.Orders })));
const OrderCreate = lazyWithRetry(() => import('./pages/orders/create/OrderCreate').then(m => ({ default: m.OrderCreate })));
const OrderDetails = lazyWithRetry(() => import('./pages/orders/detail').then(m => ({ default: m.OrderDetails })));
const OrderLifecycle = lazyWithRetry(() => import('./pages/orders/OrderLifecycle'));
const PackingSlip = lazyWithRetry(() => import('./pages/orders/documents/PackingSlip'));
const Invoice = lazyWithRetry(() => import('./pages/orders/documents/Invoice'));
const RefundReceipt = lazyWithRetry(() => import('./pages/orders/documents/RefundReceipt'));
const Themes = lazyWithRetry(() => import('./pages/themes/Themes').then(m => ({ default: m.Themes })));
const VisualEditor = lazyWithRetry(() => import('./pages/themes/VisualEditor'));
const Settings = lazyWithRetry(() => import('./pages/settings').then(m => ({ default: m.Settings })));
const Security = lazyWithRetry(() => import('./pages/security/Security').then(m => ({ default: m.Security })));
const Companies = lazyWithRetry(() => import('./pages/companies/Companies').then(m => ({ default: m.Companies })));
const ShippingZoneForm = lazyWithRetry(() => import('./pages/ShippingZoneForm'));
const Discounts = lazyWithRetry(() => import('./pages/marketing/Discounts'));
const DiscountForm = lazyWithRetry(() => import('./pages/marketing/DiscountForm'));
const Customers = lazyWithRetry(() => import('./pages/customers/Customers'));
const CustomerSegments = lazyWithRetry(() => import('./pages/customers/CustomerSegments'));
const CustomerSegmentForm = lazyWithRetry(() => import('./pages/customers/CustomerSegmentForm'));
const Analytics = lazyWithRetry(() => import('./pages/analytics/Analytics'));
const Reviews = lazyWithRetry(() => import('./pages/reviews/Reviews'));
const Wishlists = lazyWithRetry(() => import('./pages/wishlists/Wishlists'));
const Inventory = lazyWithRetry(() => import('./pages/inventory/Inventory'));
const Fulfillments = lazyWithRetry(() => import('./pages/fulfillments/Fulfillments').then(m => ({ default: m.Fulfillments })));
const CustomFields = lazyWithRetry(() => import('./pages/custom-fields/CustomFields').then(m => ({ default: m.CustomFields })));
const AuditLogs = lazyWithRetry(() => import('./pages/audit-logs/AuditLogs').then(m => ({ default: m.AuditLogs })));
const Payments = lazyWithRetry(() => import('./pages/payments/Payments'));
const PaymentMethods = lazyWithRetry(() => import('./pages/payments/PaymentMethods'));
const TransactionDetail = lazyWithRetry(() => import('./pages/payments/TransactionDetail'));
const Subscriptions = lazyWithRetry(() => import('./pages/subscriptions/Subscriptions'));
const Permissions = lazyWithRetry(() => import('./pages/permissions/Permissions'));
const Webhooks = lazyWithRetry(() => import('./pages/webhooks/Webhooks'));
const GiftCards = lazyWithRetry(() => import('./pages/gift-cards/GiftCards'));
const GiftCardDetail = lazyWithRetry(() => import('./pages/gift-cards/GiftCardDetail'));
const GiftCardNew = lazyWithRetry(() => import('./pages/gift-cards/GiftCardNew'));
const Collections = lazyWithRetry(() => import('./pages/collections/Collections'));
const CollectionForm = lazyWithRetry(() => import('./pages/collections/CollectionForm'));
const Menus = lazyWithRetry(() => import('./pages/menus/Menus'));
const MenuForm = lazyWithRetry(() => import('./pages/menus/MenuForm'));
const Pages = lazyWithRetry(() => import('./pages/pages/Pages'));
const PageForm = lazyWithRetry(() => import('./pages/pages/PageForm'));
const MediaLibrary = lazyWithRetry(() => import('./pages/media/MediaLibrary'));
const Redirects = lazyWithRetry(() => import('./pages/redirects/Redirects'));
const Staff = lazyWithRetry(() => import('./pages/staff/Staff'));
const AcceptInvite = lazyWithRetry(() => import('./pages/staff/AcceptInvite'));
const Notifications = lazyWithRetry(() => import('./pages/notifications/Notifications'));
const NotFound = lazyWithRetry(() => import('./pages/NotFound'));

// Router basename is always "/" — routes carry their real /dashboard-prefixed
// paths. In production the app is served under /dashboard/ and the asset base
// (vite `base`) handles that; the router matches the full window path as-is.
// Setting basename to "/dashboard" here would double the prefix (every route
// would resolve to /dashboard/dashboard/*), which is exactly the bug this
// avoids.
const basename = '/';

function App() {
  return (
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <FeaturesProvider>
        <ConfirmProvider>
        {/* Outer boundary catches the standalone lazy routes (register,
            printable docs, editor). Dashboard child pages have their own
            boundary inside DashboardLayout so the sidebar never flashes. */}
        <Suspense fallback={<PageLoader fullScreen />}>
        <Routes>
          {/* Public routes. The whole SPA is served under /dashboard/ (both
              in prod and via the dev fallback), and the router basename is
              "/" — so every route carries its real, full path. Public pages
              therefore live at /dashboard/login etc., matching the dashboard
              section instead of doubling up to /dashboard/dashboard. */}
          <Route path="/dashboard/login" element={<Login />} />
          <Route path="/dashboard/register" element={<Register />} />
          <Route path="/dashboard/forgot-password" element={<ForgotPassword />} />
          <Route path="/dashboard/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard/setup" element={<SetupInProgress />} />
          <Route path="/dashboard/staff/accept" element={<AcceptInvite />} />

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
            <Route path="domains" element={<RequireFeature feature="domains.custom"><RequirePermission permission={['domains.read', 'domains.write']}><Domains /></RequirePermission></RequireFeature>} />
            <Route path="products" element={<RequirePermission permission="products.read"><Products /></RequirePermission>} />
            <Route path="products/new" element={<RequirePermission permission="products.write"><ProductForm /></RequirePermission>} />
            <Route path="products/:id/edit" element={<RequirePermission permission="products.write"><ProductForm /></RequirePermission>} />
            <Route path="categories" element={<RequirePermission permission="products.read"><Categories /></RequirePermission>} />
            <Route path="orders" element={<RequirePermission permission="orders.read"><Orders /></RequirePermission>} />
            <Route path="orders/new" element={<RequirePermission permission="orders.write"><OrderCreate /></RequirePermission>} />
            <Route path="orders/:id" element={<RequirePermission permission="orders.read"><OrderDetails /></RequirePermission>} />
            <Route path="orders/:id/lifecycle" element={<RequireFeature feature="orders.lifecycle"><RequirePermission permission="orders.read"><OrderLifecycle /></RequirePermission></RequireFeature>} />
            <Route path="themes" element={<RequirePermission permission={['themes.read', 'themes.write']}><Themes /></RequirePermission>} />
            <Route path="themes/customize" element={<Navigate to="/dashboard/themes/editor" replace />} />
            <Route path="settings" element={<RequirePermission permission={['settings.read', 'settings.write']}><Settings /></RequirePermission>} />
            {/* Security is per-account (passkeys + email verification), not a
                tenant setting — any authenticated user reaches it, no
                settings permission required. */}
            <Route path="security" element={<Security />} />
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
            <Route path="wishlists" element={<RequirePermission permission="analytics.read"><Wishlists /></RequirePermission>} />
            <Route path="reviews" element={<RequirePermission permission={['reviews.read', 'reviews.moderate']}><Reviews /></RequirePermission>} />
            <Route path="inventory" element={<RequirePermission permission={['inventory.read', 'inventory.write']}><Inventory /></RequirePermission>} />
            <Route path="fulfillments" element={<RequireFeature feature="orders.fulfillment"><RequirePermission permission={['fulfillments.read', 'fulfillments.write']}><Fulfillments /></RequirePermission></RequireFeature>} />
            <Route path="custom-fields" element={<RequireFeature feature="customFields"><RequirePermission permission="settings.write"><CustomFields /></RequirePermission></RequireFeature>} />
            <Route path="audit-logs" element={<RequireFeature feature="auditLogs"><RequirePermission permission="audit.read"><AuditLogs /></RequirePermission></RequireFeature>} />
            <Route path="payments" element={<RequireFeature feature="payments.transactions"><RequirePermission permission="payments.read"><Payments /></RequirePermission></RequireFeature>} />
            <Route path="payments/methods" element={<RequireFeature feature="payments.methods"><RequirePermission permission="settings.write"><PaymentMethods /></RequirePermission></RequireFeature>} />
            <Route path="payments/:id" element={<RequireFeature feature="payments.transactions"><RequirePermission permission="payments.read"><TransactionDetail /></RequirePermission></RequireFeature>} />
            <Route path="subscription" element={<RequireFeature feature="billing.subscription"><RequirePermission permission="settings.read"><Subscriptions /></RequirePermission></RequireFeature>} />
            <Route path="permissions" element={<RequireFeature feature="team.advancedRoles"><RequirePermission permission="team.manage"><Permissions /></RequirePermission></RequireFeature>} />
            <Route path="webhooks" element={<RequireFeature feature="webhooks"><RequirePermission permission="settings.write"><Webhooks /></RequirePermission></RequireFeature>} />
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
            <Route path="redirects" element={<RequireFeature feature="redirects"><RequirePermission permission={['themes.read', 'themes.write']}><Redirects /></RequirePermission></RequireFeature>} />
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
                <RequireFeature feature="orders.fulfillment" inline={false}>
                  <RequirePermission permission="orders.read" inline={false}>
                    <PackingSlip />
                  </RequirePermission>
                </RequireFeature>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/orders/:id/refund-receipt/:refundId"
            element={
              <ProtectedRoute>
                <RequireFeature feature="payments.transactions" inline={false}>
                  <RequirePermission permission="orders.read" inline={false}>
                    <RefundReceipt />
                  </RequirePermission>
                </RequireFeature>
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
        </FeaturesProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
