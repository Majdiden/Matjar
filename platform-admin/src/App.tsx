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

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/tenants" replace />} />
            <Route path="/tenants" element={<Tenants />} />
            <Route path="/tenants/:tenantId" element={<TenantDetail />} />
            <Route path="/plans" element={<Plans />} />
            <Route path="/features" element={<Features />} />
            <Route path="/queues" element={<Queues />} />
          </Route>
          <Route path="*" element={<Navigate to="/tenants" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
