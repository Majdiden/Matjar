import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context';
import {
  Shield,
  Building2,
  Layers,
  CreditCard,
  LogOut,
  ShieldAlert,
  ToggleLeft,
  Phone,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';

const navItems = [
  { to: '/tenants', label: 'Tenants', icon: Building2, end: false },
  { to: '/plans', label: 'Plans', icon: CreditCard, end: false },
  { to: '/features', label: 'Features', icon: ToggleLeft, end: false },
  { to: '/phone-countries', label: 'Phone countries', shortLabel: 'Phones', icon: Phone, end: false },
  { to: '/queues', label: 'Queues', icon: Layers, end: false },
];

// Bottom tab bar shows the four most-used destinations; the rest live in
// the drawer.
const bottomTabs = navItems.filter((i) => i.to !== '/phone-countries');

const NavList: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => (
  <ul className="space-y-1">
    {navItems.map((item) => (
      <li key={item.to}>
        <NavLink
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors md:py-2',
              isActive
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )
          }
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </NavLink>
      </li>
    ))}
  </ul>
);

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
          <NavList />
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
              <NavList onNavigate={() => setDrawerOpen(false)} />
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
            {bottomTabs.map((item) => (
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
