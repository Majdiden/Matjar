import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../contexts/StoreContext';
import { useCategories } from '../../hooks/useProducts';
import { type MenuItem } from '../../hooks/useMenu';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { cn } from '../../utils/cn';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  /** Store-managed header menu items (may include nested `children`). */
  items: MenuItem[];
  /** Optional panel heading; falls back to the store name. */
  title?: string;
}

const itemHref = (item: MenuItem) => item.resolvedUrl || item.url || '/';
const isExternal = (item: MenuItem) =>
  item.type === 'external' || item.target === '_blank';

/**
 * Full-screen slide-over navigation menu (replaces the old inline dropdown).
 *
 * - Full-width on phones, a large drawer on tablets — slides in from the
 *   logical start edge (left in LTR, right in RTL) with a smooth transform.
 * - Locks body scroll while open, closes on Escape / overlay tap.
 * - Supports nested menu items via inline accordions.
 * - Falls back to the category list + static links when no menu is configured.
 * - Inherits each theme's identity through the CSS-var token bridge.
 */
export function MobileMenu({ isOpen, onClose, items, title }: MobileMenuProps) {
  const { t } = useTranslation(['common', 'nav', 'footer', 'theme']);
  const { store } = useStore();
  const { categories } = useCategories();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const hasMenu = items.length > 0;
  const heading = title || store?.name || 'Menu';

  // Lock body scroll while open.
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const linkCls =
    'flex items-center justify-between gap-3 py-3.5 text-base font-medium transition hover:opacity-70';
  const linkStyle: React.CSSProperties = { color: 'var(--color-foreground)' };

  const renderLeaf = (item: MenuItem, indent = false) => {
    const href = itemHref(item);
    const cls = cn(linkCls, indent && 'ps-4 text-sm');
    return isExternal(item) ? (
      <a
        key={item._id || href}
        href={href}
        target={item.target || '_blank'}
        rel="noopener noreferrer"
        onClick={onClose}
        className={cls}
        style={linkStyle}
      >
        <span>{item.label}</span>
      </a>
    ) : (
      <Link
        key={item._id || href}
        to={href}
        onClick={onClose}
        className={cls}
        style={linkStyle}
      >
        <span>{item.label}</span>
      </Link>
    );
  };

  const renderItem = (item: MenuItem) => {
    const key = item._id || item.label;
    const children = item.children || [];
    if (children.length === 0) return renderLeaf(item);
    const open = !!expanded[key];
    return (
      <div
        key={key}
        className="border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <button
          type="button"
          onClick={() => toggle(key)}
          className={linkCls}
          style={{ ...linkStyle, width: '100%' }}
          aria-expanded={open}
        >
          <span>{item.label}</span>
          <svg
            className={cn('w-4 h-4 shrink-0 transition-transform', open && 'rotate-180')}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && (
          <div className="pb-2">
            {renderLeaf({ ...item, children: undefined }, true)}
            {children.map((child) => renderLeaf(child, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          'fixed inset-0 z-[60] bg-black/50 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel — start-anchored, RTL-aware transform. */}
      <div
        role="dialog"
        aria-modal={isOpen}
        aria-label={heading}
        className={cn(
          'fixed top-0 bottom-0 start-0 z-[61] w-full sm:max-w-md flex flex-col shadow-2xl',
          'transition-transform duration-300 ease-out will-change-transform',
          isOpen
            ? 'translate-x-0'
            : '-translate-x-full rtl:translate-x-full pointer-events-none',
        )}
        style={{
          backgroundColor: 'var(--color-background)',
          color: 'var(--color-foreground)',
          fontFamily: 'var(--font-family)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between gap-3 px-5 h-16 border-b shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <span
            className="text-lg font-bold truncate"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {heading}
          </span>
          <button
            onClick={onClose}
            className="grid place-items-center w-10 h-10 -me-2 rounded-full transition hover:bg-black/[0.06]"
            aria-label={t('common:aria.close')}
            style={{ color: 'var(--color-foreground)' }}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Links */}
        <nav
          className="flex-1 overflow-y-auto overscroll-contain px-5 py-2"
          aria-label={t('nav:megamenu.aria', 'Main navigation')}
        >
          {hasMenu ? (
            items.map(renderItem)
          ) : (
            <>
              {renderLeaf({ label: t('theme:theme.nav.home', 'Home'), url: '/' })}
              {renderLeaf({ label: t('theme:theme.nav.products', 'Products'), url: '/products' })}
              {categories.slice(0, 8).map((cat: any) =>
                renderLeaf({ _id: cat._id, label: cat.name, url: `/categories/${cat.slug}` }),
              )}
              {renderLeaf({ label: t('footer:footer.about.title', { defaultValue: 'About' }), url: '/about' })}
              {renderLeaf({ label: t('footer:footer.contact.title', { defaultValue: 'Contact' }), url: '/contact' })}
            </>
          )}
        </nav>

        {/* Footer — language switcher */}
        <div
          className="px-5 py-4 border-t shrink-0"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <LanguageSwitcher />
        </div>
      </div>
    </>
  );
}

export default MobileMenu;
