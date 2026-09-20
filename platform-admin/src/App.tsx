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
import Features from './pages/Features';
import PhoneCountries from './pages/PhoneCountries';
import Overview from './pages/overview/Overview';
import AuditLog from './pages/audit/AuditLog';
import PlatformUsers from './pages/users/PlatformUsers';
import Billing from './pages/billing/Billing';
import AcceptInvite from './pages/AcceptInvite';
import ResetPlatformPassword from './pages/ResetPlatformPassword';

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
            <Route path="/billing" element={<Billing />} />
            <Route path="/users" element={<PlatformUsers />} />
            <Route path="/audit" element={<AuditLog />} />
            <Route path="/features" element={<Features />} />
            <Route path="/phone-countries" element={<PhoneCountries />} />
            <Route path="/queues" element={<Queues />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
