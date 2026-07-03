import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/auth-context';
import { useLanguage } from '../../i18n/LanguageProvider';
import {
  LogOut,
  Store,
  Settings as SettingsIcon,
  ChevronRight,
  Menu,
  ChevronsUpDown,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible';
import { TooltipProvider } from '../ui/tooltip';
import { DirectionProvider } from '@radix-ui/react-direction';
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../ui/breadcrumb';
import { BreadcrumbProvider } from '../../contexts/BreadcrumbContext';
import { useBreadcrumbOverride } from '../../contexts/breadcrumb-context';
import { NotificationsProvider } from '../../contexts/NotificationsContext';
import { useNotifications } from '../../hooks/useNotifications';
import { fireNativeNotification } from '../../lib/notification-effects';
import { NotificationBell } from '../NotificationBell';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { toast } from 'sonner';
import { api } from '../../lib/api-client';
import { buildNavGroups, flattenNav, type NavItem } from './nav';

// ---------------------------------------------------------------------------
// Pending-orders badge (audit 4.2.4)
//
// GET /api/orders/stats is a single cheap server-side aggregation (5.4.3);
// its `pending` figure feeds the badge on the Orders link. A module-level
// cache with a modest TTL means the desktop aside and the mobile Sheet (two
// SidebarContent instances) plus route-to-route remounts share ONE fetch —
// we only refresh when the cache has gone stale during navigation.
// ---------------------------------------------------------------------------
const PENDING_BADGE_TTL_MS = 60_000;
let pendingOrdersCache: { value: number; fetchedAt: number } | null = null;

function usePendingOrdersCount(): number {
  const { can } = useAuth();
  const location = useLocation();
  const [count, setCount] = React.useState(pendingOrdersCache?.value ?? 0);

  React.useEffect(() => {
    if (!can('orders.read')) return;
    if (pendingOrdersCache && Date.now() - pendingOrdersCache.fetchedAt < PENDING_BADGE_TTL_MS) {
      setCount(pendingOrdersCache.value);
      return;
    }
    let cancelled = false;
    api.orders
      .getStats()
      .then((res) => {
        const stats = (res as { responseObject?: { pending?: number } }).responseObject;
        const pending = Number(stats?.pending) || 0;
        pendingOrdersCache = { value: pending, fetchedAt: Date.now() };
        if (!cancelled) setCount(pending);
      })
      .catch(() => {
        // Non-fatal — the badge simply stays hidden if stats are offline.
      });
    return () => {
      cancelled = true;
    };
  }, [can, location.pathname]);

  return count;
}

function NavLink({
  item,
  isActive,
  onClick,
  badge,
}: {
  item: NavItem;
  isActive: boolean;
  onClick?: () => void;
  badge?: number;
}) {
  const { href } = item;
  if (!href) return null; // link-less toggle parents never reach NavLink
  return (
    <Link
      to={href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all',
        isActive
          ? 'bg-primary text-primary-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.name}</span>
      {badge !== undefined && badge > 0 && (
        // Brand-accent pill so the count reads on the dark sidebar surface;
        // when the row itself is active (also bg-primary) invert to white.
        <Badge
          className={cn(
            'ms-auto h-5 min-w-5 justify-center px-1.5 text-xs tabular-nums border-transparent',
            isActive
              ? 'bg-primary-foreground text-primary'
              : 'bg-primary text-primary-foreground'
          )}
        >
          {badge > 99 ? '99+' : badge}
        </Badge>
      )}
    </Link>
  );
}

/**
 * Parent nav item with children. Renders an expandable group; auto-opens
 * when the current route lives anywhere inside the group.
 */
function NavGroupItem({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const childActive = (item.children || []).some(
    (c) =>
      !!c.href &&
      (pathname === c.href || (c.href !== '/dashboard' && pathname.startsWith(c.href + '/')))
  );
  const [open, setOpen] = React.useState(childActive);

  React.useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent',
          childActive
            ? 'text-foreground font-medium'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        <span className="truncate flex-1 text-start">{item.name}</span>
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 transition-transform',
            open ? 'rotate-90' : 'rtl:rotate-180'
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 space-y-1 ps-7">
        {(item.children || []).map((child) => {
          if (!child.href) return null; // children are always links
          const isActive =
            pathname === child.href ||
            (child.href !== '/dashboard' && pathname.startsWith(child.href + '/'));
          return (
            <Link
              key={child.href}
              to={child.href}
              onClick={onNavigate}
              className={cn(
                'block rounded-md px-3 py-1.5 text-sm transition-all',
                isActive
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {child.name}
            </Link>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

function SidebarContent({
  onNavigate,
  pendingOrders = 0,
}: {
  onNavigate?: () => void;
  /** Pending-orders count for the Orders badge (audit 4.2.4); hidden at 0. */
  pendingOrders?: number;
}) {
  const location = useLocation();
  const { can } = useAuth();
  const { t } = useTranslation(['nav']);

  const navGroups = buildNavGroups(t);

  const hasPermission = (permission?: string | string[]): boolean => {
    if (!permission) return true;
    const keys = Array.isArray(permission) ? permission : [permission];
    return can(...keys);
  };

  const itemVisible = (item: NavItem): boolean => {
    if (item.children?.some(itemVisible)) return true;
    if (!item.permission) return true;
    const keys = Array.isArray(item.permission) ? item.permission : [item.permission];
    return can(...keys);
  };

  const visibleGroups = navGroups
    .map((g) => ({
      ...g,
      items: g.items
        .filter(itemVisible)
        .map((i) =>
          i.children
            ? { ...i, children: i.children.filter((child) => hasPermission(child.permission)) }
            : i
        )
        .filter((i) => !i.children || i.children.length > 0 || !i.permission),
    }))
    .filter((g) => g.items.length > 0);

  return (
    // `flex-1 min-h-0` so the sidebar content takes the remaining
    // vertical space *after* the user profile below it, and the nav
    // scrolls inside this region instead of pushing the user block
    // off the bottom of the aside.
    <div className="flex flex-1 min-h-0 flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-4">
        <Link to="/dashboard" className="flex items-center gap-2 font-semibold" onClick={onNavigate}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Store className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg">Matjar</span>
        </Link>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <div className="space-y-6">
          {visibleGroups.map((group) => (
            <div key={group.groupKey}>
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  if (item.children && item.children.length > 0) {
                    // Pure group toggle (audit 4.1) — parents with children
                    // carry no href, so key by name.
                    return (
                      <NavGroupItem
                        key={item.href ?? item.name}
                        item={item}
                        pathname={location.pathname}
                        onNavigate={onNavigate}
                      />
                    );
                  }
                  if (!item.href) return null;
                  const isActive =
                    location.pathname === item.href ||
                    (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
                  return (
                    <NavLink
                      key={item.href}
                      item={item}
                      isActive={isActive}
                      onClick={onNavigate}
                      badge={item.badgeKey === 'pendingOrders' ? pendingOrders : undefined}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

const NOTIF_PROMPT_DISMISSED_KEY = 'matjar.notifPromptDismissed.v1';

/**
 * One-shot Notification API permission prompt. Checks Notification.permission
 * on mount and, if it's `default` AND the user hasn't previously dismissed
 * the offer, opens a centered modal so the prompt sits visually in the middle
 * of the screen instead of getting lost in a corner toast. Dismissal is
 * remembered in localStorage so we don't nag on every page load.
 */
const NotificationPermissionPrompt: React.FC = () => {
  const { t } = useTranslation(['nav']);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'default') return;
    if (localStorage.getItem(NOTIF_PROMPT_DISMISSED_KEY) === '1') return;
    setOpen(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(NOTIF_PROMPT_DISMISSED_KEY, '1');
    setOpen(false);
  };

  const enable = () => {
    Notification.requestPermission()
      .then((result) => {
        if (result === 'granted') {
          fireNativeNotification(
            t('nav:browser_notifications.native_title'),
            t('nav:browser_notifications.native_body'),
          );
          toast.success(t('nav:browser_notifications.enabled_success'));
        }
      })
      .catch(() => {})
      .finally(() => {
        localStorage.setItem(NOTIF_PROMPT_DISMISSED_KEY, '1');
        setOpen(false);
      });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('nav:browser_notifications.prompt_title')}</DialogTitle>
          <DialogDescription>
            {t('nav:browser_notifications.prompt_description')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={dismiss}>
            {t('nav:browser_notifications.not_now')}
          </Button>
          <Button onClick={enable}>
            {t('nav:browser_notifications.enable')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const DashboardLayoutInner: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const breadcrumbOverride = useBreadcrumbOverride();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const { t } = useTranslation(['nav']);
  const { dir } = useLanguage();

  // Side-effect hook for notifications — mounted here so it lives for the
  // entire lifetime of an authenticated dashboard session. The permission
  // prompt itself is rendered below as a centered modal.
  useNotifications();

  // Pending-orders count for the sidebar badge (audit 4.2.4). Fetched here
  // once and shared by the desktop aside and the mobile Sheet.
  const pendingOrders = usePendingOrdersCount();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Build breadcrumb from path — uses translated nav item names
  const getBreadcrumbs = () => {
    const path = location.pathname;
    // Build a flat list of linkable nav items for lookup using translated
    // names (toggle parents have no href and can't be crumbs). Prefer an
    // exact href match over the first prefix match so e.g.
    // /dashboard/payments/methods resolves to "Payment methods".
    const navGroups = buildNavGroups(t);
    const allNavItems = navGroups
      .flatMap((g) => flattenNav(g.items))
      .filter((item): item is NavItem & { href: string } => !!item.href);
    const navItem =
      allNavItems.find((item) => item.href === path) ??
      allNavItems.find((item) => item.href !== '/dashboard' && path.startsWith(item.href));
    if (!navItem || path === '/dashboard') return null;

    // Handle sub-pages like /dashboard/orders/:id
    const segments = path.replace('/dashboard/', '').split('/');
    const crumbs: { label: string; href?: string }[] = [{ label: navItem.name, href: navItem.href }];

    if (segments.length > 1) {
      const lastSegment = segments[segments.length - 1];
      if (lastSegment === 'new') {
        crumbs.push({ label: t('nav:breadcrumb.new') });
      } else if (segments[segments.length - 1] === 'edit') {
        crumbs.push({ label: t('nav:breadcrumb.edit') });
      } else if (lastSegment !== navItem.name.toLowerCase()) {
        crumbs.push({ label: `#${lastSegment.slice(0, 8)}...` });
      }
    }

    return crumbs;
  };

  const breadcrumbs = breadcrumbOverride ?? getBreadcrumbs();

  return (
    <DirectionProvider dir={dir}>
      <TooltipProvider delayDuration={0}>
        <div dir={dir} className="flex h-screen overflow-hidden bg-background">
        {/* Desktop Sidebar — dark surface via sidebar-scoped tokens (3.8.6) */}
        <aside className="sidebar-surface hidden lg:flex lg:w-64 lg:flex-col lg:border-e">
          <SidebarContent pendingOrders={pendingOrders} />

          {/* User section — pinned to the bottom of the sidebar. */}
          <div className="shrink-0 border-t p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-lg p-2 text-start hover:bg-accent transition-colors">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium">{user?.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/dashboard/settings')}>
                  <SettingsIcon className="me-2 h-4 w-4" />
                  {t('nav:user_menu.settings')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="me-2 h-4 w-4" />
                  {t('nav:user_menu.log_out')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top header */}
          <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
            {/* Mobile menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">{t('nav:toggle_menu')}</span>
                </Button>
              </SheetTrigger>
              {/* flex flex-col + overflow-hidden so SidebarContent's
                  `flex-1 min-h-0` resolves against the sheet's full height and
                  its inner ScrollArea actually scrolls on mobile (the nav is
                  taller than the viewport on small screens). */}
              <SheetContent side="left" className="sidebar-surface w-64 p-0 flex flex-col overflow-hidden">
                <SidebarContent onNavigate={() => setMobileOpen(false)} pendingOrders={pendingOrders} />
              </SheetContent>
            </Sheet>

            {/* Breadcrumb */}
            <Breadcrumb className="hidden md:flex min-w-0 flex-1 overflow-hidden">
              <BreadcrumbList className="flex-nowrap flex-1 min-w-0">
                {(() => {
                  // Always start with Dashboard, then append page-specific
                  // crumbs. When there are more than 3 crumbs in total, we
                  // collapse the middle into an ellipsis so the trail never
                  // pushes the rest of the topbar offscreen.
                  type Item =
                    | { kind: 'crumb'; label: string; href?: string; isLast: boolean }
                    | { kind: 'ellipsis' };
                  const all: { label: string; href?: string }[] = [
                    { label: t('nav:breadcrumb.dashboard'), href: '/dashboard' },
                    ...(breadcrumbs ?? []),
                  ];
                  const lastIdx = all.length - 1;
                  let items: Item[];
                  if (all.length > 3) {
                    items = [
                      { kind: 'crumb', label: all[0].label, href: all[0].href, isLast: false },
                      { kind: 'ellipsis' },
                      { kind: 'crumb', label: all[lastIdx - 1].label, href: all[lastIdx - 1].href, isLast: false },
                      { kind: 'crumb', label: all[lastIdx].label, href: all[lastIdx].href, isLast: true },
                    ];
                  } else {
                    items = all.map((c, i) => ({
                      kind: 'crumb' as const,
                      label: c.label,
                      href: c.href,
                      isLast: i === lastIdx,
                    }));
                  }
                  return items.map((it, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <BreadcrumbSeparator className="shrink-0" />}
                      <BreadcrumbItem className="min-w-0">
                        {it.kind === 'ellipsis' ? (
                          <BreadcrumbEllipsis className="h-4 w-4 shrink-0" />
                        ) : it.isLast || !it.href ? (
                          <BreadcrumbPage className="truncate max-w-[180px]">
                            {it.label}
                          </BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link to={it.href} className="truncate max-w-[180px] inline-block align-bottom">
                              {it.label}
                            </Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </React.Fragment>
                  ));
                })()}
              </BreadcrumbList>
            </Breadcrumb>

            <div className="ms-auto flex items-center gap-2">
              <LanguageSwitcher />
              <NotificationBell />

              {/* Mobile user menu */}
              <div className="lg:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{user?.name}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/dashboard/settings')}>
                      {t('nav:user_menu.settings')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                      {t('nav:user_menu.log_out')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          {/* Page content — light neutral canvas behind white cards (3.8.1) */}
          <main className="flex-1 overflow-y-auto bg-canvas p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
        </div>
        <NotificationPermissionPrompt />
      </TooltipProvider>
    </DirectionProvider>
  );
};

export const DashboardLayout: React.FC = () => (
  <BreadcrumbProvider>
    <NotificationsProvider>
      <DashboardLayoutInner />
    </NotificationsProvider>
  </BreadcrumbProvider>
);
