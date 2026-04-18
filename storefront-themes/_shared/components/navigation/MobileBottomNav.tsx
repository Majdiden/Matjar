import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { useCart } from '../../contexts/CartContext';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'mobileBottomNav';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

interface MobileBottomNavProps {
  items?: NavItem[];
  className?: string;
  onCartClick?: () => void;
  onSearchClick?: () => void;
}

export function MobileBottomNav(props: MobileBottomNavProps) {
  const Override = useThemeSlot<React.ComponentType<MobileBottomNavProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const { items, className, onCartClick, onSearchClick } = props;
  const location = useLocation();
  const { cart } = useCart();

  const defaultItems: NavItem[] = [
    {
      label: 'Home',
      href: '/',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      ),
    },
    {
      label: 'Search',
      href: '/search',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      ),
    },
    {
      label: 'Cart',
      href: '/cart',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      ),
      badge: cart?.itemCount || 0,
    },
    {
      label: 'Account',
      href: '/account',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      ),
    },
  ];

  const navItems = items || defaultItems;

  return (
    <nav className={cn(
      'fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t md:hidden',
      'safe-area-bottom',
      className
    )}>
      <div className="flex items-center justify-around py-2">
        {navItems.map(item => {
          const isActive = location.pathname === item.href;
          const isCart = item.label === 'Cart';
          const isSearch = item.label === 'Search';

          const handleClick = (e: React.MouseEvent) => {
            if (isCart && onCartClick) {
              e.preventDefault();
              onCartClick();
            }
            if (isSearch && onSearchClick) {
              e.preventDefault();
              onSearchClick();
            }
          };

          return (
            <Link
              key={item.label}
              to={item.href}
              onClick={handleClick}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1 relative transition-colors',
                isActive ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
              )}
            >
              <div className="relative">
                {item.icon}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
