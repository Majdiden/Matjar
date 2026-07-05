/**
 * Cross-host auth handoff helpers.
 *
 * When a user is sent to this dashboard from another origin (store-picker on
 * the main domain → store subdomain, post-onboarding setup → new store,
 * platform-admin impersonation), the session is passed in the URL fragment
 * (`#auth=` / `#impersonation=`) because localStorage is per-origin.
 *
 * CRITICAL: this MUST run synchronously BEFORE React + React Router mount.
 * The router normalizes/redirects the initial location during render (e.g.
 * `/` → `/dashboard`), which strips the fragment before any `useEffect`
 * could read it — so a useEffect-based hydration loses the token and dumps
 * the user on /login. `hydrateAuthFromUrlHash()` is called at the top of
 * main.tsx, before createRoot, so the token is in localStorage by the time
 * the router evaluates routes (AuthProvider starts with isLoading=true and
 * picks it up in its init effect).
 */

/**
 * App-host helpers.
 *
 * The dashboard now lives on a single, tenant-agnostic host —
 * `app.<platformDomain>` (app.invoila.io in prod, app.localhost:3000 in dev).
 * The active tenant rides the JWT, so we never need to hop to a store
 * subdomain to operate on it. These helpers let the client detect whether it's
 * already on that host and, if not, build the URL to hop TO it (carrying the
 * session in a `#auth=` fragment, since localStorage is per-origin).
 */

/** The platform host suffix WITHOUT the leading app/store label. */
function platformHostSuffix(): string {
  if (typeof window === 'undefined') return '';
  const isDev = import.meta.env.MODE !== 'production';
  if (isDev) return `localhost:${window.location.port || '3000'}`;
  const envDomain = import.meta.env.VITE_PLATFORM_DOMAIN as string | undefined;
  if (envDomain) return envDomain;
  // Fall back to everything after the current host's first DNS label
  // (e.g. store.invoila.io → invoila.io → app.invoila.io).
  const parts = window.location.host.split('.');
  return parts.length > 1 ? parts.slice(1).join('.') : window.location.host;
}

/** The canonical dashboard app host, e.g. `app.invoila.io` / `app.localhost:3000`. */
export function appHost(): string {
  return `app.${platformHostSuffix()}`;
}

/** True when the current page is already served from the app host. */
export function isAppHost(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.split('.')[0] === 'app';
}

/**
 * The real base path of the dashboard SPA. Routes carry the full `/dashboard`
 * prefix (the router basename itself is "/"), and the app is served under
 * `/dashboard/` in production and via the dev-server fallback in development.
 * Raw `window.location` redirects (logout, 401, post-auth home) must therefore
 * target `/dashboard` in BOTH environments — otherwise on a store subdomain a
 * bare `/login` falls through to the STOREFRONT instead of the dashboard login.
 */
export function dashboardBasename(): string {
  return '/dashboard';
}

/** Absolute URL of the dashboard login page, basename-aware. */
export function loginUrl(): string {
  return `${dashboardBasename()}/login`;
}

/** True if we're already on the dashboard login page (basename-aware). */
export function isOnLoginPage(): boolean {
  return typeof window !== 'undefined' && window.location.pathname.endsWith('/login');
}

// UTF-8-safe base64 (btoa/atob are Latin1-only — a non-ASCII store/user name
// would otherwise throw and silently break the handoff).
export function encodeAuthPayload(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}
export function decodeAuthPayload<T>(encoded: string): T {
  const bin = atob(encoded);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

/**
 * If the URL fragment carries a handoff payload, write it into localStorage
 * and strip the fragment. Safe to call multiple times. Returns true if a
 * payload was consumed.
 */
export function hydrateAuthFromUrlHash(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash;

  if (hash.startsWith('#auth=')) {
    try {
      const encoded = hash.slice('#auth='.length);
      const payload = decodeAuthPayload<{
        token?: string;
        refreshToken?: string;
        userId?: string;
        user?: unknown;
      }>(decodeURIComponent(encoded));
      if (payload?.token) localStorage.setItem('token', payload.token);
      if (payload?.refreshToken) localStorage.setItem('refreshToken', payload.refreshToken);
      if (payload?.userId) localStorage.setItem('userId', payload.userId);
      if (payload?.user) localStorage.setItem('user', JSON.stringify(payload.user));
    } catch {
      // Malformed — fall through; normal init will land on /login.
    }
    history.replaceState(null, '', window.location.pathname + window.location.search);
    return true;
  }

  if (hash.startsWith('#impersonation=')) {
    try {
      const token = decodeURIComponent(hash.slice('#impersonation='.length));
      if (token) {
        localStorage.removeItem('refreshToken'); // impersonation tokens aren't refreshable
        localStorage.setItem('token', token);
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const pad = b64.length % 4;
            if (pad) b64 += '='.repeat(4 - pad);
            const payload = JSON.parse(atob(b64)) as { userId?: string };
            if (payload?.userId) localStorage.setItem('userId', payload.userId);
          }
        } catch {
          /* best effort */
        }
        localStorage.setItem(
          'user',
          JSON.stringify({ id: '', name: 'Impersonated session', email: '', impersonated: true }),
        );
      }
    } catch {
      /* malformed — fall through */
    }
    history.replaceState(null, '', window.location.pathname + window.location.search);
    return true;
  }

  return false;
}
