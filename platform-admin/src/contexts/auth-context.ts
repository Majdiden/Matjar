import { createContext, useContext } from 'react';
import type { PlatformSessionUser } from '../lib/api-users';

export interface AuthContextShape {
  user: PlatformSessionUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<PlatformSessionUser>;
  logout: () => void;
  /** Re-fetch /me (e.g. after a forced password change cleared the flag). */
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextShape | null>(null);

export function useAuth(): AuthContextShape {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
