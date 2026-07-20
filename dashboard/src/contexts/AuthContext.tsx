import React, { useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User, AuthResponse, LoginCredentials, RegisterData, StoreChoice } from '../types';
import { api } from '../lib/api-client';
import { setTenantCurrency, setTenantLocale } from '../lib/format';
import { AuthContext } from './auth-context';
import { encodeAuthPayload, hydrateAuthFromUrlHash, appHost, isAppHost, dashboardBasename } from '../lib/authHandoff';
import { teardownPushSubscription } from '../lib/web-push';

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
  // Permissions are persisted to localStorage and hydrated synchronously so
  // the dashboard is usable OFFLINE after a full reload. Sudan's connectivity
  // is unreliable (periodic shutdowns), and `/auth/me` — the only source of
  // permissions — fails offline; without a cached copy every RequirePermission
  // gate would spin forever and the whole shell would be unreachable.
  const [permissions, setPermissions] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('permissions');
      const parsed = stored ? JSON.parse(stored) : null;
      return Array.isArray(parsed) ? (parsed as string[]) : [];
    } catch {
      return [];
    }
  });

  // Update permissions in state AND cache them for offline reloads.
  const applyPermissions = useCallback((perms: string[]) => {
    setPermissions(perms);
    try {
      localStorage.setItem('permissions', JSON.stringify(perms));
    } catch {
      /* storage full / disabled — non-fatal */
    }
  }, []);

  const clearAuth = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    localStorage.removeItem('permissions');
    localStorage.removeItem('features');
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
            if (Array.isArray(perms)) applyPermissions(perms);
          }).catch(() => { /* ignore — cached permissions from localStorage stay in effect offline */ });
        }
      } catch {
        clearAuth();
      }
    }

    setIsLoading(false);
  }, [clearAuth, refreshAccessToken, applyPermissions]);

  // Establish a client session from a login-shaped responseObject (access +
  // refresh token, user identity, tenant host). Shared by the password login
  // and the passwordless passkey (WebAuthn) login so both paths store state,
  // hydrate permissions, and perform the cross-host hop identically.
  const establishSession = async (
    ro: NonNullable<AuthResponse['responseObject']>,
    opts: { skipHostRedirect?: boolean } = {},
  ) => {
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

    try {
      const res = await api.auth.me();
      const meRes = res as AuthMeResponse;
      const s = meRes?.responseObject?.settings;
      if (s?.currency) setTenantCurrency(s.currency);
      if (s?.language) setTenantLocale(s.language === 'ar' ? 'ar-SD' : 'en-US');
      const perms = meRes?.responseObject?.permissions;
      if (Array.isArray(perms)) applyPermissions(perms);
    } catch {
      /* ignore — permissions will fill on refresh */
    }

    // Where should this session live? The canonical dashboard home is the
    // single app host (`app.<platformDomain>`) — the active tenant rides the
    // JWT, so we never hop to a store subdomain any more. If we're already on
    // the app host (or the caller asked us to stay put), do nothing. Otherwise
    // (e.g. someone logged in from an OLD store subdomain), hop to the app
    // host carrying the session in the URL fragment — localStorage is
    // per-origin, so the fragment is the only cross-origin transport.
    if (opts.skipHostRedirect || isAppHost()) return;

    const targetHost = appHost();
    if (window.location.host !== targetHost) {
      const handoff = encodeAuthPayload({
        token: ro.accessToken,
        refreshToken: ro.refreshToken || null,
        userId: ro.userId,
        user: userData,
      });
      window.location.href = `${window.location.protocol}//${targetHost}/dashboard#auth=${encodeURIComponent(handoff)}`;
      await new Promise(() => {});
    }
  };

  // Switch the active store in place — no host hop. The backend re-issues a
  // session bound to the chosen tenant; we swap the token/refreshToken/user in
  // localStorage and hard-reload the dashboard so every store-scoped query
  // refetches against the new tenant. Stays on the SAME (app) host.
  const switchStore = async (tenantId: string) => {
    const res = await api.auth.switchStore(tenantId);
    const ro = (res as AuthResponse).responseObject;
    if (!ro?.accessToken || !ro?.userId) {
      throw new Error('Failed to switch store');
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
    // Drop the previous store's cached permissions + feature flags so the new
    // store's load fresh from /auth/me and /features after the reload.
    localStorage.removeItem('permissions');
    localStorage.removeItem('features');
    window.location.assign(dashboardBasename() || '/');
  };

  // Passwordless passkey login — the caller (Login page) runs the WebAuthn
  // ceremony and hands us the verified responseObject to turn into a session.
  const loginWithResponse = async (ro: NonNullable<AuthResponse['responseObject']>) => {
    if (!ro?.accessToken || !ro?.userId) {
      throw new Error('Invalid response from server');
    }
    await establishSession(ro);
  };

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

    await establishSession(ro, {
      skipHostRedirect: (credentials as { skipHostRedirect?: boolean }).skipHostRedirect,
    });
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
    // Best-effort: drop this device's Web Push subscription so a shared
    // device stops receiving the previous user's background alerts. Runs
    // before clearAuth so the authed unsubscribe call still carries a token.
    void teardownPushSubscription();
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
      loginWithResponse,
      register,
      logout,
      switchStore,
      permissions,
      can,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
