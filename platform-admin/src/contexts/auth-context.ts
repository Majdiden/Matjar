import { createContext, useContext } from 'react';
import type { PlatformSessionUser } from '../lib/api-users';

export type LoginOutcome = { mfaRequired: true; mfaToken: string } | { mfaRequired: false; user: PlatformSessionUser };

export interface AuthContextShape {
  user: PlatformSessionUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  /** Step 1. Either completes the session or returns an mfaToken for step 2. */
  login: (email: string, password: string) => Promise<LoginOutcome>;
  /** Step 2 when MFA is enrolled. */
  completeMfa: (mfaToken: string, code: string) => Promise<PlatformSessionUser & { mfaMethod: string; recoveryCodesRemaining?: number }>;
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
