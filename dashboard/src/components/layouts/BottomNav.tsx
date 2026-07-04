import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, ShoppingCart, Package, Menu } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/auth-context';

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

const DESTS: Dest[] = [
  { key: 'home', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.read' },
  { key: 'orders', href: '/dashboard/orders', icon: ShoppingCart, permission: 'orders.read', badge: true },
  { key: 'products', href: '/dashboard/products', icon: Package, permission: 'products.read' },
];

/**
 * Thumb-reachable bottom navigation for phones (below lg — the desktop
 * sidebar takes over at lg+). Sudan is ~90% mobile-only, so the 3 most-used
 * destinations plus a "More" sheet trigger sit here with large (>=56px) tap
 * targets and a safe-area inset for notched/gesture-bar phones. The whole bar
 * mirrors automatically in RTL because it's a plain flex row.
 */
export const BottomNav: React.FC<BottomNavProps> = ({ onMore, pendingOrders = 0 }) => {
  const { t } = useTranslation('nav');
  const { can } = useAuth();
  const location = useLocation();

  const isActive = (href: string) =>
    href === '/dashboard'
      ? location.pathname === '/dashboard'
      : location.pathname === href || location.pathname.startsWith(href + '/');

  const dests = DESTS.filter((d) => {
    if (!d.permission) return true;
    const keys = Array.isArray(d.permission) ? d.permission : [d.permission];
    return can(...keys);
  });

  const itemClass = (active: boolean) =>
    cn(
      'relative flex flex-1 flex-col items-center justify-center gap-1 min-h-[56px] px-1 text-[11px] font-medium transition-colors',
      active ? 'text-primary' : 'text-muted-foreground',
    );

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur lg:hidden pb-[env(safe-area-inset-bottom)]"
      aria-label={t('bottom_nav.menu_title')}
    >
      <div className="mx-auto flex max-w-lg items-stretch">
        {dests.map((d) => {
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
        })}
        <button type="button" onClick={onMore} className={itemClass(false)}>
          <Menu className="h-6 w-6" strokeWidth={2} />
          <span className="truncate max-w-full">{t('bottom_nav.more')}</span>
        </button>
      </div>
    </nav>
  );
};
