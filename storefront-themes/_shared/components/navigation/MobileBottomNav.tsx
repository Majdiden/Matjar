import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';
import { useCart } from '../../contexts/CartContext';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';
import { SearchOverlay } from './SearchBar';

export const SLOT_KEY = 'mobileBottomNav';

interface NavItem {
  /** Stable identifier (not translated) used for active-state and click detection */
  id?: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  /** Optional filled variant shown when the tab is active (falls back to `icon`) */
  iconActive?: React.ReactNode;
  badge?: number;
}

interface MobileBottomNavProps {
  items?: NavItem[];
  className?: string;
  onCartClick?: () => void;
  onSearchClick?: () => void;
}

const ICON_CLASS = 'h-6 w-6';

/** Outline (inactive) + filled (active) icon pairs — Heroicons, inline so no deps. */
const ICONS = {
  home: {
    outline: (
      <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
    filled: (
      <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.47 3.841a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.061l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 101.061 1.06l8.69-8.689z" />
        <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" />
      </svg>
    ),
  },
  search: {
    outline: (
      <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
    filled: (
      <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" clipRule="evenodd" d="M10.5 3.75a6.75 6.75 0 100 13.5 6.75 6.75 0 000-13.5zM2.25 10.5a8.25 8.25 0 1114.59 5.28l4.69 4.69a.75.75 0 11-1.06 1.06l-4.69-4.69A8.25 8.25 0 012.25 10.5z" />
      </svg>
    ),
  },
  cart: {
    outline: (
      <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
    filled: (
      <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" clipRule="evenodd" d="M7.5 6v.75H5.513c-.96 0-1.764.724-1.865 1.679l-1.263 12A1.875 1.875 0 004.25 22.5h15.5a1.875 1.875 0 001.865-2.071l-1.263-12a1.875 1.875 0 00-1.865-1.679H16.5V6a4.5 4.5 0 10-9 0zM12 3a3 3 0 00-3 3v.75h6V6a3 3 0 00-3-3zm-3 8.25a3 3 0 106 0v-.75a.75.75 0 011.5 0v.75a4.5 4.5 0 11-9 0v-.75a.75.75 0 011.5 0v.75z" />
      </svg>
    ),
  },
  account: {
    outline: (
      <svg className={ICON_CLASS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
    filled: (
      <svg className={ICON_CLASS} viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" clipRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" />
      </svg>
    ),
  },
};

/**
 * Scoped styles: a floating, frosted rounded-full pill (Instagram-style),
 * per-item active highlight, and badge pop. All motion is disabled under
 * prefers-reduced-motion.
 */
const NAV_CSS = `
.mbn-pill {
  background: var(--color-background, #ffffff);
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.35), 0 2px 8px -4px rgba(0, 0, 0, 0.2);
}
@supports (background: color-mix(in srgb, red 50%, transparent)) {
  @supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
    .mbn-pill {
      background: color-mix(in srgb, var(--color-background, #ffffff) 80%, transparent);
      -webkit-backdrop-filter: blur(18px) saturate(1.7);
      backdrop-filter: blur(18px) saturate(1.7);
    }
  }
}
.mbn-hi {
  transition: opacity 260ms ease, transform 320ms var(--ease-emphasized, cubic-bezier(0.3, 1.25, 0.5, 1));
}
@keyframes mbn-badge-pop {
  0% { transform: scale(0); }
  60% { transform: scale(1.18); }
  100% { transform: scale(1); }
}
.mbn-badge { animation: mbn-badge-pop 320ms cubic-bezier(0.3, 1.25, 0.5, 1) both; }
@media (prefers-reduced-motion: reduce) {
  .mbn-hi { transition: none; }
  .mbn-badge { animation: none; }
}
`;

export function MobileBottomNav(props: MobileBottomNavProps) {
  const Override = useThemeSlot<React.ComponentType<MobileBottomNavProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const { t } = useTranslation('nav');
  const { items, className, onCartClick, onSearchClick } = props;
  const location = useLocation();
  const { cart } = useCart();
  // The search tab opens an in-place search OVERLAY (input + live results)
  // rather than jumping straight to the results page — otherwise tapping
  // Search dumps the customer on an empty /search page with no input.
  const [searchOpen, setSearchOpen] = useState(false);

  const defaultItems: NavItem[] = [
    {
      id: 'home',
      label: t('mobile_bottom.home'),
      href: '/',
      icon: ICONS.home.outline,
      iconActive: ICONS.home.filled,
    },
    {
      id: 'search',
      label: t('mobile_bottom.search'),
      href: '/search',
      icon: ICONS.search.outline,
      iconActive: ICONS.search.filled,
    },
    {
      id: 'cart',
      label: t('mobile_bottom.cart'),
      href: '/cart',
      icon: ICONS.cart.outline,
      iconActive: ICONS.cart.filled,
      badge: cart?.itemCount || 0,
    },
    {
      id: 'account',
      label: t('mobile_bottom.account'),
      href: '/account',
      icon: ICONS.account.outline,
      iconActive: ICONS.account.filled,
    },
  ];

  const navItems = items || defaultItems;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 md:hidden"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
    >
      <style>{NAV_CSS}</style>
      {/* Floating frosted pill (Instagram-style) — icon-only, detached from the
          screen edges so content scrolls beneath it. */}
      <nav
        className={cn('mbn-pill pointer-events-auto flex items-center gap-1 rounded-full border p-1.5', className)}
        style={{ borderColor: 'color-mix(in srgb, var(--color-foreground, #000) 10%, transparent)' }}
      >
        {navItems.map(item => {
          const isActive = location.pathname === item.href;
          // Use stable `id` if provided; otherwise fall back to href-based detection
          const isCart = item.id === 'cart' || item.href === '/cart';
          const isSearch = item.id === 'search' || item.href === '/search';

          const handleClick = (e: React.MouseEvent) => {
            if (isCart && onCartClick) {
              e.preventDefault();
              onCartClick();
            }
            if (isSearch) {
              // Always open a search input first (never navigate straight to
              // the results page). Prefer the theme's handler if it wires its
              // own overlay; otherwise open the shared one.
              e.preventDefault();
              if (onSearchClick) onSearchClick();
              else setSearchOpen(true);
            }
          };

          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={handleClick}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              title={item.label}
              className="group relative grid h-12 w-12 select-none place-items-center rounded-full"
              style={{
                color: isActive ? 'var(--color-primary, #111827)' : 'var(--color-muted, #9ca3af)',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {/* Active highlight capsule behind the icon */}
              <span
                aria-hidden="true"
                className={cn(
                  'mbn-hi absolute inset-1 rounded-full',
                  isActive ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
                )}
                style={{ background: 'color-mix(in srgb, var(--color-primary, #2563eb) 15%, transparent)' }}
              />
              {/* Icon — springs down slightly while pressed */}
              <span className="relative grid place-items-center transition-transform duration-200 ease-out group-active:scale-90 motion-reduce:transition-none motion-reduce:transform-none">
                <span className="relative h-6 w-6">
                  {/* Outline (inactive) crossfades into filled (active) */}
                  <span
                    className={cn(
                      'absolute inset-0 transition-all duration-300 motion-reduce:transition-none',
                      isActive ? 'scale-75 opacity-0' : 'scale-100 opacity-100'
                    )}
                  >
                    {item.icon}
                  </span>
                  <span
                    className={cn(
                      'absolute inset-0 transition-all duration-300 motion-reduce:transition-none',
                      isActive ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
                    )}
                  >
                    {item.iconActive ?? item.icon}
                  </span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      // Re-keying on the count replays the pop whenever it changes
                      key={item.badge}
                      className="mbn-badge absolute -top-1.5 -end-1.5 z-10 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none text-white"
                      style={{
                        background: 'var(--color-error, #ef4444)',
                        boxShadow: '0 0 0 2px var(--color-background, #ffffff)',
                      }}
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
