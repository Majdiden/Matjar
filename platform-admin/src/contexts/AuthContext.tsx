import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  api,
  clearSession,
  getStoredUser,
  getToken,
  setStoredUser,
  setToken,
} from '../lib/api';
import type { PlatformSessionUser } from '../lib/api-users';
import { AuthContext, type LoginOutcome } from './auth-context';
import { clearReauth, onMfaGate } from '../lib/api';

// Idle timeout. Platform-admin sessions are high-blast-radius, so we
// log out after 20 minutes of no user activity even if the JWT itself
// is still valid. The backend also caps tokens at 30m absolute.
const IDLE_MS = 20 * 60 * 1000;

const rawBase = import.meta.env.BASE_URL || '/';
const basePrefix = rawBase === '/' ? '' : rawBase.replace(/\/$/, '');

/**
 * When an operator has been forced to reset their password, nothing else
 * in the console is reachable until they do (server-side the token still
 * works, but the console refuses to render anything but the reset page).
 */
const MustResetGate: React.FC<{ user: PlatformSessionUser | null; children: React.ReactNode }> = ({
  user,
  children,
}) => {
  const location = useLocation();
  if (user?.mustResetPassword && !location.pathname.startsWith('/reset-password')) {
    return <Navigate to="/reset-password?forced=1" replace />;
  }
  return <>{children}</>;
};

/**
 * When the server answers 403 MFA_ENROLLMENT_REQUIRED (the operator's role
 * must have two-factor and they have not enrolled), send them to their
 * security page with an explanation. Mirrors MustResetGate: the server is
 * the authority; this only makes the console usable instead of erroring.
 */
const MfaEnrollmentGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [gated, setGated] = useState(false);
  useEffect(() => onMfaGate(() => setGated(true)), []);
  useEffect(() => {
    if (location.pathname.startsWith('/security/me')) setGated(false);
  }, [location.pathname]);
  if (gated && !location.pathname.startsWith('/security/me')) {
    return <Navigate to="/security/me?required=1" replace />;
  }
  return <>{children}</>;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<PlatformSessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doLogout = useCallback(() => {
    clearSession();
    clearReauth();
    setUser(null);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    // Full-page redirect honoring Vite's configured BASE_URL so this
    // works both in dev (base `/`) and in prod under `/platform/`.
    const loginPath = `${basePrefix}/login`;
    if (window.location.pathname !== loginPath) {
      window.location.href = `${loginPath}?idle=1`;
    }
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(doLogout, IDLE_MS);
  }, [doLogout]);

  const refresh = useCallback(async () => {
    const fresh = (await api.me()) as PlatformSessionUser;
    setUser(fresh);
    setStoredUser(fresh);
  }, []);

  useEffect(() => {
    // Rehydrate from localStorage on boot, then refresh from /me so
    // scopes/role stay current (operator might have been re-scoped on the
    // backend since their last visit).
    const token = getToken();
    const stored = getStoredUser() as PlatformSessionUser | null;
    if (token && stored) {
      setUser(stored);
      refresh().catch(() => {
        // The 401 interceptor in api.ts will redirect if the token
        // is bad; other errors we swallow and keep the cached user.
      });
    }
    setLoading(false);
  }, [refresh]);

  // Wire up activity listeners only while authenticated. Any input
  // event resets the idle clock; after IDLE_MS with no input we force
  // a logout.
  useEffect(() => {
    if (!user) return;
    resetIdleTimer();
    const events: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, resetIdleTimer, { passive: true }));
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetIdleTimer));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [user, resetIdleTimer]);

  const establish = useCallback(async (token: string, u: PlatformSessionUser) => {
    setToken(token);
    // Fetch scopes via /me so the initial render has them immediately.
    let full: PlatformSessionUser = u;
    try {
      full = (await api.me()) as PlatformSessionUser;
    } catch {
      // Fall through with the bare login payload.
    }
    setStoredUser(full);
    setUser(full);
    return full;
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginOutcome> => {
      const result = await api.login(email, password);
      if ('mfaRequired' in result && result.mfaRequired) {
        return { mfaRequired: true, mfaToken: result.mfaToken };
      }
      const full = await establish(result.token, result.user as PlatformSessionUser);
      return { mfaRequired: false, user: full };
    },
    [establish],
  );

  const completeMfa = useCallback(
    async (mfaToken: string, code: string) => {
      const result = await api.mfaVerify(mfaToken, code);
      const full = await establish(result.token, result.user as PlatformSessionUser);
      return { ...full, mfaMethod: result.mfaMethod, recoveryCodesRemaining: result.recoveryCodesRemaining };
    },
    [establish],
  );

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, login, completeMfa, logout: doLogout, refresh }}>
      <MustResetGate user={user}>
        <MfaEnrollmentGate>{children}</MfaEnrollmentGate>
      </MustResetGate>
    </AuthContext.Provider>
  );
};
