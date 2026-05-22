import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/auth-context';
import { useLanguage } from '../../i18n/LanguageProvider';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingCart,
  Palette,
  Globe,
  LogOut,
  Store,
  Tag,
  Settings as SettingsIcon,
  Users,
  BarChart3,
  MessageSquare,
  Warehouse,
  Truck,
  FileCode,
  Shield,
  CreditCard,
  Wallet,
  Crown,
  Key,
  Webhook,
  Layers,
  ListTree,
  FileText,
  Gift,
  UserCog,
  ChevronRight,
  Menu,
  ChevronsUpDown,
  Bell,
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

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  children?: NavItem[];
  // If set, the user must have at least one of these permission keys
  // for the item to appear in the sidebar. Omit to make public to any
  // authenticated dashboard user.
  permission?: string | string[];
}

interface NavGroup {
  label: string;
  groupKey: string;
  items: NavItem[];
}

// Nav data uses translation keys; labels are resolved in render.
const buildNavGroups = (t: (key: string) => string): NavGroup[] => [
  {
    label: t('nav:sidebar.home.title'),
    groupKey: 'home',
    items: [
      { name: t('nav:sidebar.home.dashboard'), href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.read' },
      { name: t('nav:sidebar.home.analytics'), href: '/dashboard/analytics', icon: BarChart3, permission: 'analytics.read' },
      { name: t('nav:sidebar.home.notifications'), href: '/dashboard/notifications', icon: Bell },
    ],
  },
  {
    label: t('nav:sidebar.orders.title'),
    groupKey: 'orders',
    items: [
      {
        name: t('nav:sidebar.orders.orders'),
        href: '/dashboard/orders',
        icon: ShoppingCart,
        permission: 'orders.read',
        children: [
          { name: t('nav:sidebar.orders.all_orders'), href: '/dashboard/orders', icon: ShoppingCart, permission: 'orders.read' },
        ],
      },
      { name: t('nav:sidebar.orders.fulfillments'), href: '/dashboard/fulfillments', icon: Truck, permission: ['fulfillments.read', 'fulfillments.write'] },
      {
        name: t('nav:sidebar.orders.payments'),
        href: '/dashboard/payments',
        icon: CreditCard,
        permission: 'payments.read',
        children: [
          { name: t('nav:sidebar.orders.transactions'), href: '/dashboard/payments', icon: CreditCard, permission: 'payments.read' },
          { name: t('nav:sidebar.orders.payment_methods'), href: '/dashboard/payments/methods', icon: Wallet, permission: 'settings.write' },
        ],
      },
    ],
  },
  {
    label: t('nav:sidebar.catalog.title'),
    groupKey: 'catalog',
    items: [
      {
        name: t('nav:sidebar.catalog.products'),
        href: '/dashboard/products',
        icon: Package,
        permission: 'products.read',
        children: [
          { name: t('nav:sidebar.catalog.all_products'), href: '/dashboard/products', icon: Package, permission: 'products.read' },
          { name: t('nav:sidebar.catalog.categories'), href: '/dashboard/categories', icon: FolderTree, permission: 'products.read' },
          { name: t('nav:sidebar.catalog.collections'), href: '/dashboard/collections', icon: Layers, permission: 'products.read' },
        ],
      },
      { name: t('nav:sidebar.catalog.inventory'), href: '/dashboard/inventory', icon: Warehouse, permission: ['inventory.read', 'inventory.write'] },
    ],
  },
  {
    label: t('nav:sidebar.customers.title'),
    groupKey: 'customers',
    items: [
      {
        name: t('nav:sidebar.customers.customers'),
        href: '/dashboard/customers',
        icon: Users,
        permission: ['customers.read', 'customers.write'],
        children: [
          { name: t('nav:sidebar.customers.all_customers'), href: '/dashboard/customers', icon: Users, permission: ['customers.read', 'customers.write'] },
          { name: t('nav:sidebar.customers.segments'), href: '/dashboard/customers/segments', icon: Users, permission: ['customers.read', 'customers.write'] },
        ],
      },
      { name: t('nav:sidebar.customers.reviews'), href: '/dashboard/reviews', icon: MessageSquare, permission: ['reviews.read', 'reviews.moderate'] },
    ],
  },
  {
    label: t('nav:sidebar.marketing.title'),
    groupKey: 'marketing',
    items: [
      { name: t('nav:sidebar.marketing.discounts'), href: '/dashboard/marketing/discounts', icon: Tag, permission: ['discounts.read', 'discounts.write'] },
      { name: t('nav:sidebar.marketing.gift_cards'), href: '/dashboard/gift-cards', icon: Gift, permission: ['discounts.read', 'discounts.write'] },
    ],
  },
  {
    label: t('nav:sidebar.storefront.title'),
    groupKey: 'storefront',
    items: [
      {
        name: t('nav:sidebar.storefront.themes'),
        href: '/dashboard/themes',
        icon: Palette,
        permission: ['themes.read', 'themes.write'],
        children: [
          { name: t('nav:sidebar.storefront.theme_library'), href: '/dashboard/themes', icon: Palette, permission: ['themes.read', 'themes.write'] },
          { name: t('nav:sidebar.storefront.visual_editor'), href: '/dashboard/themes/editor', icon: Palette, permission: 'themes.write' },
        ],
      },
      { name: t('nav:sidebar.storefront.navigation'), href: '/dashboard/menus', icon: ListTree, permission: ['themes.read', 'themes.write'] },
      { name: t('nav:sidebar.storefront.pages'), href: '/dashboard/pages', icon: FileText, permission: ['themes.read', 'themes.write'] },
      { name: t('nav:sidebar.storefront.domains'), href: '/dashboard/domains', icon: Globe, permission: ['domains.read', 'domains.write'] },
    ],
  },
  {
    label: t('nav:sidebar.settings.title'),
    groupKey: 'settings',
    items: [
      { name: t('nav:sidebar.settings.settings'), href: '/dashboard/settings', icon: SettingsIcon, permission: ['settings.read', 'settings.write'] },
      { name: t('nav:sidebar.settings.subscription'), href: '/dashboard/subscription', icon: Crown, permission: 'settings.read' },
      { name: t('nav:sidebar.settings.custom_fields'), href: '/dashboard/custom-fields', icon: FileCode, permission: 'settings.write' },
      { name: t('nav:sidebar.settings.webhooks'), href: '/dashboard/webhooks', icon: Webhook, permission: 'settings.write' },
    ],
  },
  {
    label: t('nav:sidebar.team_security.title'),
    groupKey: 'team_security',
    items: [
      { name: t('nav:sidebar.team_security.staff'), href: '/dashboard/staff', icon: UserCog, permission: 'team.manage' },
      { name: t('nav:sidebar.team_security.permissions'), href: '/dashboard/permissions', icon: Key, permission: 'team.manage' },
      { name: t('nav:sidebar.team_security.audit_logs'), href: '/dashboard/audit-logs', icon: Shield, permission: 'audit.read' },
    ],
  },
];

const flattenNav = (items: NavItem[]): NavItem[] =>
  items.flatMap((i) => (i.children ? [i, ...i.children] : [i]));

function NavLink({ item, isActive, onClick }: { item: NavItem; isActive: boolean; onClick?: () => void }) {
  return (
    <Link
      to={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent',
        isActive
          ? 'bg-accent text-accent-foreground font-medium'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.name}</span>
      {item.badge && (
        <Badge variant="secondary" className="ms-auto text-xs">
          {item.badge}
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
    (c) => pathname === c.href || (c.href !== '/dashboard' && pathname.startsWith(c.href + '/'))
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
          const isActive =
            pathname === child.href ||
            (child.href !== '/dashboard' && pathname.startsWith(child.href + '/'));
          return (
            <Link
              key={child.href}
              to={child.href}
              onClick={onNavigate}
              className={cn(
                'block rounded-md px-3 py-1.5 text-sm transition-all hover:bg-accent',
                isActive
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
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

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
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
                    return (
                      <NavGroupItem
                        key={item.href}
                        item={item}
                        pathname={location.pathname}
                        onNavigate={onNavigate}
                      />
                    );
                  }
                  const isActive =
                    location.pathname === item.href ||
                    (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
                  return (
                    <NavLink
                      key={item.href}
                      item={item}
                      isActive={isActive}
                      onClick={onNavigate}
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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Build breadcrumb from path — uses translated nav item names
  const getBreadcrumbs = () => {
    const path = location.pathname;
    // Build a flat list of nav items for lookup using translated names
    const navGroups = buildNavGroups(t);
    const allNavItems = navGroups.flatMap((g) => flattenNav(g.items));
    const navItem = allNavItems.find(
      (item) => item.href === path || (item.href !== '/dashboard' && path.startsWith(item.href))
    );
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
    <TooltipProvider delayDuration={0}>
      <div dir={dir} className="flex h-screen overflow-hidden bg-background">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-e">
          <SidebarContent />

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
              <SheetContent side="left" className="w-64 p-0">
                <SidebarContent onNavigate={() => setMobileOpen(false)} />
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

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
      <NotificationPermissionPrompt />
    </TooltipProvider>
  );
};

export const DashboardLayout: React.FC = () => (
  <BreadcrumbProvider>
    <NotificationsProvider>
      <DashboardLayoutInner />
    </NotificationsProvider>
  </BreadcrumbProvider>
);
