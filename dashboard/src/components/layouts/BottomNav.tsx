import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, ShoppingCart, Package, Menu, Plus, ClipboardList, PackagePlus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/auth-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface BottomNavProps {
  /** Opens the full-nav Sheet (the "More" destination). */
  onMore: () => void;
  /** Pending-orders count — surfaced as a badge on the Orders tab. */
  pendingOrders?: number;
}

interface Dest {
  key: 'home' | 'orders' | 'products';
  href: string;
  icon: React.ElementType;
  permission?: string | string[];
  badge?: boolean;
}

// Two destinations flank the centre quick-action button; a third (Products)
// is reachable from the action menu and the More sheet.
const LEFT_DESTS: Dest[] = [
  { key: 'home', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.read' },
  { key: 'orders', href: '/dashboard/orders', icon: ShoppingCart, permission: 'orders.read', badge: true },
];
const RIGHT_DESTS: Dest[] = [
  { key: 'products', href: '/dashboard/products', icon: Package, permission: 'products.read' },
];

/**
 * Thumb-reachable bottom navigation for phones (below lg — the desktop
 * sidebar takes over at lg+). Sudan is ~90% mobile-only, so the most-used
 * destinations plus a raised centre quick-action (create order / product)
 * and a "More" sheet trigger sit here with large (>=56px) tap targets and a
 * safe-area inset for notched/gesture-bar phones. Mirrors in RTL.
 */
export const BottomNav: React.FC<BottomNavProps> = ({ onMore, pendingOrders = 0 }) => {
  const { t } = useTranslation('nav');
  const { can } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [actionOpen, setActionOpen] = React.useState(false);

  const isActive = (href: string) =>
    href === '/dashboard'
      ? location.pathname === '/dashboard'
      : location.pathname === href || location.pathname.startsWith(href + '/');

  const allowed = (d: Dest) => {
    if (!d.permission) return true;
    const keys = Array.isArray(d.permission) ? d.permission : [d.permission];
    return can(...keys);
  };
  const left = LEFT_DESTS.filter(allowed);
  const right = RIGHT_DESTS.filter(allowed);

  // Quick-create actions the merchant is permitted to perform.
  const canCreateOrder = can('orders.write');
  const canCreateProduct = can('products.write');
  const showAction = canCreateOrder || canCreateProduct;

  const itemClass = (active: boolean) =>
    cn(
      'relative flex flex-1 flex-col items-center justify-center gap-1 min-h-[56px] px-1 text-[11px] font-medium transition-colors',
      active ? 'text-primary' : 'text-muted-foreground',
    );

  const renderDest = (d: Dest) => {
    const active = isActive(d.href);
    return (
      <Link key={d.key} to={d.href} className={itemClass(active)}>
        <span className="relative">
          <d.icon className="h-6 w-6" strokeWidth={active ? 2.4 : 2} />
          {d.badge && pendingOrders > 0 && (
            <span className="absolute -top-1.5 -end-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground tabular-nums">
              {pendingOrders > 99 ? '99+' : pendingOrders}
            </span>
          )}
        </span>
        <span className="truncate max-w-full">{t(`bottom_nav.${d.key}`)}</span>
      </Link>
    );
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur lg:hidden pb-[env(safe-area-inset-bottom)]"
      aria-label={t('bottom_nav.menu_title')}
    >
      <div className="mx-auto flex max-w-lg items-stretch">
        {left.map(renderDest)}

        {/* Raised centre quick-action — create an order or a product. */}
        {showAction && (
          <div className="relative flex flex-1 items-start justify-center">
            <DropdownMenu open={actionOpen} onOpenChange={setActionOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t('bottom_nav.create')}
                  className="-mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform active:scale-95"
                >
                  <Plus className="h-7 w-7" strokeWidth={2.4} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="center" sideOffset={12} className="min-w-52">
                {canCreateOrder && (
                  <DropdownMenuItem onClick={() => navigate('/dashboard/orders/new')}>
                    <ClipboardList className="me-2 h-4 w-4" />
                    {t('bottom_nav.new_order')}
                  </DropdownMenuItem>
                )}
                {canCreateProduct && (
                  <DropdownMenuItem onClick={() => navigate('/dashboard/products/new')}>
                    <PackagePlus className="me-2 h-4 w-4" />
                    {t('bottom_nav.new_product')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {right.map(renderDest)}
        <button type="button" onClick={onMore} className={itemClass(false)}>
          <Menu className="h-6 w-6" strokeWidth={2} />
          <span className="truncate max-w-full">{t('bottom_nav.more')}</span>
        </button>
      </div>
    </nav>
  );
};
