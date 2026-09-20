import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context';
import { useToast } from './ui/toast-context';
import { Shield, LogOut, ShieldAlert, Menu, X, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { visibleGroups, bottomTabs, type NavGroup } from './nav';
import type { PlatformUser } from '../lib/api';

const COLLAPSE_KEY = 'platform_admin_nav_collapsed';
function readCollapsed(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}');
  } catch {
    return {};
  }
}

/**
 * Grouped navigation (drawer + desktop sidebar). Groups collapse (state is a
 * per-device convenience in localStorage); the group containing the current
 * route is always expanded. Planned pages (`ready: false`) render as muted
 * hints so the operator can see the console's shape without dead links.
 */
const NavList: React.FC<{ user: PlatformUser | null; onNavigate?: () => void }> = ({ user, onNavigate }) => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(readCollapsed);
  const groups = visibleGroups(user);
  const toggle = (key: string) =>
    setCollapsed((c) => {
      const next = { ...c, [key]: !c[key] };
      try {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  const containsCurrent = (g: NavGroup) =>
    g.items.some((i) => (i.end ? location.pathname === i.to : location.pathname.startsWith(i.to)));

  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const open = !collapsed[g.key] || containsCurrent(g);
        return (
          <div key={g.key}>
            {g.label && (
              <button
                type="button"
                onClick={() => toggle(g.key)}
                className="flex w-full items-center justify-between px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 hover:text-foreground"
                aria-expanded={open}
              >
                {g.label}
                <ChevronDown className={cn('h-3 w-3 transition-transform', !open && '-rotate-90')} />
              </button>
            )}
            {open && (
              <ul className="space-y-0.5">
                {g.items.map((item) =>
                  item.ready ? (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end={item.end}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors md:py-2',
                            isActive ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                          )
                        }
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </NavLink>
                    </li>
                  ) : (
                    <li key={item.to} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/50" title="Coming soon">
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                      <span className="ms-auto text-[10px] uppercase tracking-wide">soon</span>
                    </li>
                  )
                )}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
};

const Brand: React.FC<{ onClick?: () => void }> = ({ onClick }) => (
  <Link to="/" className="flex items-center gap-2 font-semibold" onClick={onClick}>
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
      <ShieldAlert className="h-4 w-4" />
    </div>
    <span>Platform</span>
  </Link>
);

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const toast = useToast();

  // One-shot notice written by Login.tsx after a recovery-code sign-in.
  useEffect(() => {
    let notice: string | null = null;
    try {
      notice = sessionStorage.getItem('platform_admin_notice');
      if (notice) sessionStorage.removeItem('platform_admin_notice');
    } catch { /* storage unavailable */ }
    if (notice) toast.info(notice);
  }, [toast]);
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Close the drawer on navigation and lock body scroll while it is open.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onEsc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onEsc);
    };
  }, [drawerOpen]);

  const userBlock = (
    <div className="border-t p-3">
      <div className="mb-2 px-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Shield className="h-3 w-3 shrink-0" />
          <span className="truncate">{user?.email}</span>
        </div>
      </div>
      <div className="mb-1 flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
        {user?.role && <span className="rounded bg-accent px-1.5 py-0.5 capitalize">{user.role}</span>}
        {user?.mfaEnabled ? <span className="text-emerald-700">2FA on</span> : <Link to="/security/me" className="underline hover:text-foreground">enable 2FA</Link>}
      </div>
      <button
        onClick={handleLogout}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        Log out
      </button>
    </div>
  );

  return (
    <div className="flex min-h-[100dvh] bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex h-14 items-center border-b px-4">
          <Brand />
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <NavList user={user} />
        </nav>
        {userBlock}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-card shadow-xl pt-[env(safe-area-inset-top)]">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <Brand onClick={() => setDrawerOpen(false)} />
              <button
                onClick={() => setDrawerOpen(false)}
                className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 py-3">
              <NavList user={user} onNavigate={() => setDrawerOpen(false)} />
            </nav>
            <div className="pb-[env(safe-area-inset-bottom)]">{userBlock}</div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-40 flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center justify-between border-b bg-background/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
          <Brand />
          <button
            onClick={() => setDrawerOpen(true)}
            className="-me-2 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-7xl p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
            <Outlet />
          </div>
        </main>

        {/* Mobile bottom tab bar */}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
          aria-label="Primary"
        >
          <div className="mx-auto flex max-w-lg items-stretch">
            {bottomTabs(user).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                <span className="max-w-full truncate">{item.shortLabel ?? item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
};
