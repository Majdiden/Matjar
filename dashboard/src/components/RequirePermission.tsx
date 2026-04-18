import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context';
import { Card, CardContent } from './ui/card';
import { ShieldAlert } from 'lucide-react';

interface RequirePermissionProps {
  permission: string | string[];
  children: React.ReactNode;
  // If true, render a forbidden card instead of redirecting (used inside
  // a layout so the surrounding chrome stays visible). Defaults to true.
  inline?: boolean;
}

export const RequirePermission: React.FC<RequirePermissionProps> = ({
  permission,
  children,
  inline = true,
}) => {
  const { can, isLoading, permissions } = useAuth();
  const keys = Array.isArray(permission) ? permission : [permission];

  // Wait until /auth/me has populated permissions. Otherwise a brief
  // empty-permissions window would flash the forbidden state before the
  // real data lands.
  if (isLoading || permissions.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!can(...keys)) {
    if (!inline) return <Navigate to="/dashboard" replace />;
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground mb-3" />
            <h2 className="text-lg font-semibold">You don't have access to this page</h2>
            <p className="text-sm text-muted-foreground max-w-md mt-1">
              Ask an admin to grant you the required permission
              {keys.length === 1 ? ` (${keys[0]})` : ` (one of: ${keys.join(', ')})`}.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default RequirePermission;
