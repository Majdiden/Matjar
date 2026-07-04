import { createContext, useContext } from 'react';
import type { User, AuthResponse, LoginCredentials, RegisterData, StoreChoice } from '../types';

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  // Returns `stores` when the backend asks the user to pick one (same
  // email owning multiple stores). Returns `void` when the login
  // completed and the user is now authenticated.
  login: (credentials: LoginCredentials) => Promise<{ stores: StoreChoice[] } | void>;
  // Establish a session from an already-verified login response — used by the
  // passwordless passkey (WebAuthn) sign-in, where the WebAuthn ceremony (not
  // a password) produced the tokens.
  loginWithResponse: (responseObject: NonNullable<AuthResponse['responseObject']>) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  // Switch the active store in place (no host hop): re-issues a token for the
  // chosen tenant, swaps it in, and hard-reloads the dashboard.
  switchStore: (tenantId: string) => Promise<void>;
  permissions: string[];
  can: (...keys: string[]) => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
