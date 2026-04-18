import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context';
import { PageSpinner } from './ui/Spinner';

export const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageSpinner />;
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }
  return <>{children}</>;
};
