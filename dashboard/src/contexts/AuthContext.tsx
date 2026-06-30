import React, { useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User, AuthResponse, LoginCredentials, RegisterData, StoreChoice } from '../types';
import { api } from '../lib/api-client';
import { setTenantCurrency, setTenantLocale } from '../lib/format';
import { AuthContext } from './auth-context';
import { encodeAuthPayload, hydrateAuthFromUrlHash } from '../lib/authHandoff';

// Narrow responses from `/auth/me` and store-picker handoffs without
// resorting to `any`. Only the fields we actually read are typed; the
// rest of the backend envelope is ignored.
interface AuthMeResponse {
  responseObject?: {
    settings?: { currency?: string; language?: string };
    permissions?: string[];
  };
}

interface StoreSelectionLoginResponse {
  requiresStoreSelection: true;
  data: { stores: StoreChoice[] };
}

interface RefreshTokenResponse {
  responseObject?: { accessToken?: string; refreshToken?: string };
  data?: { accessToken?: string; refreshToken?: string };
}

function isStoreSelectionResponse(value: unknown): value is StoreSelectionLoginResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { requiresStoreSelection?: unknown; data?: { stores?: unknown } };
  return v.requiresStoreSelection === true && Array.isArray(v.data?.stores);
}

// Cross-host handoff base64 helpers live in lib/authHandoff (shared with the
// synchronous pre-render hydration in main.tsx).

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permissions, setPermissions] = useState<string[]>([]);

  const clearAuth = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    setToken(null);
    setUser(null);
    setPermissions([]);
  }, []);

  // Check if JWT token is expired
  const isTokenExpired = (jwt: string): boolean => {
    try {
      const parts = jwt.split('.');
      if (parts.length !== 3) return true;
      // base64url → base64 with padding before atob().
      let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const pad = b64.length % 4;
      if (pad) b64 += '='.repeat(4 - pad);
      const payload = JSON.parse(atob(b64)) as { exp?: number };
      if (!payload.exp) return false;
      // Add 30s buffer for clock skew
      return payload.exp < Math.floor(Date.now() / 1000) + 30;
    } catch {
      return true;
    }
  };

  // Attempt to refresh the access token
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return null;

    try {
      const response = await api.post<RefreshTokenResponse>('/auth/refresh', { refreshToken });
      const newAccessToken = response.responseObject?.accessToken || response.data?.accessToken;
      const newRefreshToken = response.responseObject?.refreshToken || response.data?.refreshToken;

      if (newAccessToken) {
        localStorage.setItem('token', newAccessToken);
        if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken);
        setToken(newAccessToken);
        return newAccessToken;
      }
    } catch {
      // Refresh failed — clear auth state
      clearAuth();
    }
    return null;
  }, [clearAuth]);

  // Cross-host handoff: if we were redirected here from another
  // subdomain with the auth payload in the URL fragment, hydrate
  // localStorage from it before the normal init runs. localStorage
  // is per-origin, so a login on `foo.localhost` can't reach
  // `bar.localhost`'s storage directly — the fragment is the
  // transport. We strip it immediately so it doesn't linger in
  // history or leak into referrers.
  // Fallback only — the real hydration runs synchronously in main.tsx BEFORE
  // the router mounts (the router strips the fragment during its initial
  // redirect, so a useEffect read is too late). Harmless no-op if main.tsx
  // already consumed it.
  useEffect(() => {
    hydrateAuthFromUrlHash();
  }, []);

  // Initialize auth state from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      try {
        if (isTokenExpired(storedToken)) {
          // Try refresh
          refreshAccessToken().then(newToken => {
            if (!newToken) clearAuth();
          });
        } else {
          setToken(storedToken);
          setUser(JSON.parse(storedUser) as User);
          // Refresh tenant settings (currency, locale) in the background.
          api.auth.me().then((res) => {
            const meRes = res as AuthMeResponse;
            const s = meRes?.responseObject?.settings;
            if (s?.currency) setTenantCurrency(s.currency);
            if (s?.language) setTenantLocale(s.language === 'ar' ? 'ar-SD' : 'en-US');
            const perms = meRes?.responseObject?.permissions;
            if (Array.isArray(perms)) setPermissions(perms);
          }).catch(() => { /* ignore */ });
        }
      } catch {
        clearAuth();
      }
    }

    setIsLoading(false);
  }, [clearAuth, refreshAccessToken]);

  const login = async (credentials: LoginCredentials) => {
    const response = await api.auth.login(
      credentials.email,
      credentials.password,
      credentials.tenantId
    );

    // Store-picker handoff — caller shows a selector and re-calls login
    // with tenantId.
    if (isStoreSelectionResponse(response)) {
      return { stores: response.data.stores };
    }

    const ro = (response as AuthResponse).responseObject;
    if (!ro?.accessToken || !ro?.userId) {
      throw new Error('Invalid response from server');
    }

    const userData: User = {
      id: ro.userId,
      name: ro.name,
      email: ro.email,
      tenantId: ro.tenantId || ro.userId,
      roles: ro.roles,
    };

    localStorage.setItem('token', ro.accessToken);
    if (ro.refreshToken) localStorage.setItem('refreshToken', ro.refreshToken);
    localStorage.setItem('userId', ro.userId);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(ro.accessToken);
    setUser(userData);

    // Fetch tenant settings + permissions so the dashboard renders
    // correctly immediately after login. Without this, RequirePermission
    // and sidebar gating stall on an empty permissions array until the
    // next full page load (when the init effect below calls /auth/me).
    try {
      const res = await api.auth.me();
      const meRes = res as AuthMeResponse;
      const s = meRes?.responseObject?.settings;
      if (s?.currency) setTenantCurrency(s.currency);
      if (s?.language) setTenantLocale(s.language === 'ar' ? 'ar-SD' : 'en-US');
      const perms = meRes?.responseObject?.permissions;
      if (Array.isArray(perms)) setPermissions(perms);
    } catch {
      /* ignore — user can still navigate, permissions will fill on refresh */
    }

    // Host/tenant binding — the API's auth middleware rejects any
    // request whose JWT tenantId disagrees with the host's resolved
    // tenant. If we just signed in to a store that lives on a
    // different host than the one the dashboard is currently loaded
    // from, redirect to the correct host so every subsequent API
    // call lands on the same tenant.
    const desiredHost = ro.tenantDomain;
    if (desiredHost) {
      const currentHost = window.location.host;
      const currentHostnameFirstLabel = window.location.hostname.split('.')[0];
      const desiredFirstLabel = desiredHost.split('.')[0];
      const hostMatches =
        currentHost === desiredHost ||
        currentHostnameFirstLabel === desiredFirstLabel;
      if (!hostMatches) {
        const isDev = import.meta.env.MODE !== 'production';
        const targetHost = isDev
          ? `${desiredFirstLabel}.localhost:${window.location.port || '3000'}`
          : desiredHost;
        // localStorage is per-origin, so tokens we just wrote on this
        // host aren't visible to the target subdomain. Pass them in
        // the URL fragment and have the target rehydrate on mount.
        const handoff = encodeAuthPayload({
          token: ro.accessToken,
          refreshToken: ro.refreshToken || null,
          userId: ro.userId,
          user: userData,
        });
        window.location.href = `${window.location.protocol}//${targetHost}/dashboard#auth=${encodeURIComponent(handoff)}`;
        // Prevent the caller's local navigate from firing first.
        await new Promise(() => {});
      }
    }
  };

  const register = async (data: RegisterData) => {
    const response = await api.auth.register(data) as { responseObject?: unknown };

    if (!response.responseObject) {
      throw new Error('Registration succeeded but missing response data');
    }

    // Auto-login after registration — email alone is enough now.
    await login({
      email: data.email,
      password: data.password,
    });
  };

  const logout = useCallback(() => {
    const refreshToken = localStorage.getItem('refreshToken');
    // Fire and forget — don't block UI on server logout
    if (refreshToken) {
      api.post('/auth/logout', { refreshToken }).catch(() => {});
    }
    clearAuth();
  }, [clearAuth]);

  const can = useCallback((...keys: string[]) => {
    if (permissions.includes('*')) return true;
    if (keys.length === 0) return true;
    return keys.some(k => permissions.includes(k));
  }, [permissions]);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!token && !!user,
      isLoading,
      login,
      register,
      logout,
      permissions,
      can,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
