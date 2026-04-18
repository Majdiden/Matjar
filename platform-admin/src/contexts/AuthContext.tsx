import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  api,
  clearSession,
  getStoredUser,
  getToken,
  setStoredUser,
  setToken,
  type PlatformUser,
} from '../lib/api';
import { AuthContext } from './auth-context';

// Idle timeout. Platform-admin sessions are high-blast-radius, so we
// log out after 20 minutes of no user activity even if the JWT itself
// is still valid. The backend also caps tokens at 30m absolute.
const IDLE_MS = 20 * 60 * 1000;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<PlatformUser | null>(null);
  const [loading, setLoading] = useState(true);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doLogout = useCallback(() => {
    clearSession();
    setUser(null);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    // Full-page redirect honoring Vite's configured BASE_URL so this
    // works both in dev (base `/`) and in prod under `/platform/`.
    const rawBase = import.meta.env.BASE_URL || '/';
    const basePrefix = rawBase === '/' ? '' : rawBase.replace(/\/$/, '');
    const loginPath = `${basePrefix}/login`;
    if (window.location.pathname !== loginPath) {
      window.location.href = `${loginPath}?idle=1`;
    }
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(doLogout, IDLE_MS);
  }, [doLogout]);

  useEffect(() => {
    // Rehydrate from localStorage on boot, then refresh from /me so
    // scopes stay current (operator might have been re-scoped on the
    // backend since their last visit).
    const token = getToken();
    const stored = getStoredUser();
    if (token && stored) {
      setUser(stored);
      api
        .me()
        .then((fresh) => {
          setUser(fresh);
          setStoredUser(fresh);
        })
        .catch(() => {
          // The 401 interceptor in api.ts will redirect if the token
          // is bad; other errors we swallow and keep the cached user.
        });
    }
    setLoading(false);
  }, []);

  // Wire up activity listeners only while authenticated. Any input
  // event resets the idle clock; after IDLE_MS with no input we force
  // a logout.
  useEffect(() => {
    if (!user) return;
    resetIdleTimer();
    const events: (keyof WindowEventMap)[] = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
    ];
    events.forEach((e) => window.addEventListener(e, resetIdleTimer, { passive: true }));
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetIdleTimer));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [user, resetIdleTimer]);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user: u } = await api.login(email, password);
    setToken(token);
    // Fetch scopes via /me so the initial render has them immediately.
    let full: PlatformUser = u;
    try {
      full = await api.me();
    } catch {
      // Fall through with the bare login payload.
    }
    setStoredUser(full);
    setUser(full);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, loading, login, logout: doLogout }}
    >
      {children}
    </AuthContext.Provider>
  );
};
