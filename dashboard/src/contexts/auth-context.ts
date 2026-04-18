import { createContext, useContext } from 'react';
import type { User, LoginCredentials, RegisterData, StoreChoice } from '../types';

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  // Returns `stores` when the backend asks the user to pick one (same
  // email owning multiple stores). Returns `void` when the login
  // completed and the user is now authenticated.
  login: (credentials: LoginCredentials) => Promise<{ stores: StoreChoice[] } | void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  permissions: string[];
  can: (...keys: string[]) => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
