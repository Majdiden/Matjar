import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import { PrivateRoute } from './components/PrivateRoute';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import Tenants from './pages/Tenants';
import TenantDetail from './pages/TenantDetail';
import Plans from './pages/Plans';
import Queues from './pages/Queues';
import Incidents from './pages/incidents/Incidents';
import Features from './pages/Features';
import PhoneCountries from './pages/PhoneCountries';
import GlobalConfiguration from './pages/settings/GlobalConfiguration';
import Programs from './pages/programs/Programs';
import Overview from './pages/overview/Overview';
import AuditLog from './pages/audit/AuditLog';
import PlatformUsers from './pages/users/PlatformUsers';
import Billing from './pages/billing/Billing';
import Payments from './pages/payments/Payments';
import AcceptInvite from './pages/AcceptInvite';
import ResetPlatformPassword from './pages/ResetPlatformPassword';
import MySecurity from './pages/security/MySecurity';
import SecuritySettings from './pages/security/SecuritySettings';
// ── SIBLING WORKSTREAMS: import your pages here and add routes in the block below. ──
import CommerceOrders from './pages/commerce/Orders';
import CommerceProducts from './pages/commerce/Products';
import CommerceCustomers from './pages/commerce/Customers';
import CommerceInventory from './pages/commerce/Inventory';
import StorefrontDomains from './pages/storefront/Domains';
import StorefrontThemes from './pages/storefront/Themes';
import StorefrontHealth from './pages/storefront/Health';
import SystemHealth from './pages/system/Health';
import SystemIntegrations from './pages/system/Integrations';
import SystemWebhooks from './pages/system/Webhooks';
import SystemErrors from './pages/system/Errors';
import AnalyticsPlatform from './pages/analytics/Platform';
import AnalyticsCommerce from './pages/analytics/Commerce';
import AnalyticsRevenue from './pages/analytics/Revenue';
import AnalyticsUsage from './pages/analytics/Usage';
import FeedbackQueue from './pages/feedback/Feedback';
import ActivityFeed from './pages/activity/ActivityFeed';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route path="/reset-password" element={<ResetPlatformPassword />} />
          <Route
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Overview />} />
            <Route path="/tenants" element={<Tenants />} />
            <Route path="/tenants/:tenantId" element={<TenantDetail />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/users" element={<PlatformUsers />} />
            <Route path="/audit" element={<AuditLog />} />
            <Route path="/features" element={<Features />} />
            <Route path="/programs" element={<Programs />} />
            <Route path="/phone-countries" element={<PhoneCountries />} />
            <Route path="/settings/global" element={<GlobalConfiguration />} />
            <Route path="/queues" element={<Queues />} />
            <Route path="/incidents" element={<Incidents />} />
            <Route path="/commerce" element={<Navigate to="/commerce/orders" replace />} />
            <Route path="/commerce/orders" element={<CommerceOrders />} />
            <Route path="/commerce/products" element={<CommerceProducts />} />
            <Route path="/commerce/customers" element={<CommerceCustomers />} />
            <Route path="/commerce/inventory" element={<CommerceInventory />} />
            <Route path="/storefront" element={<Navigate to="/storefront/domains" replace />} />
            <Route path="/storefront/domains" element={<StorefrontDomains />} />
            <Route path="/storefront/themes" element={<StorefrontThemes />} />
            <Route path="/storefront/health" element={<StorefrontHealth />} />
            <Route path="/system" element={<Navigate to="/system/health" replace />} />
            <Route path="/system/health" element={<SystemHealth />} />
            <Route path="/system/integrations" element={<SystemIntegrations />} />
            <Route path="/system/webhooks" element={<SystemWebhooks />} />
            <Route path="/system/errors" element={<SystemErrors />} />
            <Route path="/analytics" element={<Navigate to="/analytics/platform" replace />} />
            <Route path="/analytics/platform" element={<AnalyticsPlatform />} />
            <Route path="/analytics/commerce" element={<AnalyticsCommerce />} />
            <Route path="/analytics/revenue" element={<AnalyticsRevenue />} />
            <Route path="/analytics/usage" element={<AnalyticsUsage />} />
            <Route path="/feedback" element={<FeedbackQueue />} />
            <Route path="/activity" element={<ActivityFeed />} />
            <Route path="/security/me" element={<MySecurity />} />
            <Route path="/security/settings" element={<SecuritySettings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
