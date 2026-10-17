import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context';
import { PageSpinner } from './ui/Spinner';
import { isPromoter, promoterMayOpen, PROMOTER_HOME } from '../lib/api';

export const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) return <PageSpinner />;
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }
  // Promoters only reach their invitation codes, the stores registered with
  // them and their own security page; anything else lands on their codes.
  if (isPromoter(user) && !promoterMayOpen(location.pathname)) {
    return <Navigate to={PROMOTER_HOME} replace />;
  }
  return <>{children}</>;
};
