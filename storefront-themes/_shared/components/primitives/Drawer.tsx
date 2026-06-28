import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';

type DrawerSide = 'left' | 'right' | 'bottom';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  overlayClassName?: string;
  side?: DrawerSide;
  /** Width for left/right drawers */
  width?: string;
}

const slideClasses: Record<DrawerSide, { open: string; container: string }> = {
  right: {
    container: 'end-0 top-0 h-full',
    open: 'translate-x-0',
  },
  left: {
    container: 'start-0 top-0 h-full',
    open: 'translate-x-0',
  },
  bottom: {
    container: 'bottom-0 start-0 w-full',
    open: 'translate-y-0',
  },
};

// Closed-state transforms MUST be direction-aware. The container uses
// logical `start-0`/`end-0`, so the panel's physical edge flips under RTL;
// the off-screen transform has to flip with it or a "right" drawer ends up
// sliding INTO view from the left in Arabic (the mid-screen menu bug).
const closedClasses: Record<DrawerSide, string> = {
  right: 'translate-x-full rtl:-translate-x-full',
  left: '-translate-x-full rtl:translate-x-full',
  bottom: 'translate-y-full',
};

export function Drawer({
  isOpen,
  onClose,
  children,
  className,
  overlayClassName,
  side = 'right',
  width = 'max-w-md',
}: DrawerProps) {
  const { t } = useTranslation(['common']);
  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className={cn(
            'fixed inset-0 bg-black/50 z-40 transition-opacity duration-300',
            overlayClassName
          )}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal={isOpen}
        className={cn(
          'fixed z-50 bg-[var(--color-background,#fff)] shadow-[var(--shadow-xl)] flex flex-col',
          'transition-transform ease-[var(--ease-emphasized,cubic-bezier(0.2,0,0,1))] duration-[var(--duration-base,250ms)] will-change-transform',
          slideClasses[side].container,
          isOpen ? slideClasses[side].open : closedClasses[side],
          side !== 'bottom' && `w-full ${width}`,
          side === 'bottom' && 'max-h-[85vh] rounded-t-[var(--radius-lg,20px)]',
          className
        )}
      >
        {children}
      </div>
    </>
  );
}

Drawer.Header = function DrawerHeader({
  children,
  className,
  onClose,
}: {
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
}) {
  // Own translation hook — sub-components don't share the parent's `t`.
  const { t } = useTranslation(['common']);
  return (
    <div className={cn('flex items-center justify-between gap-3 px-5 h-16 border-b border-[var(--color-border,#e5e7eb)] shrink-0', className)}>
      <div className="font-bold text-lg text-[var(--color-foreground,#111)]">{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="grid place-items-center w-10 h-10 -me-2 rounded-full text-[var(--color-foreground,#111)] hover:bg-black/[0.05] transition-colors"
          aria-label={t('common:aria.close')}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};

Drawer.Body = function DrawerBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex-1 overflow-y-auto overscroll-contain p-5', className)}>{children}</div>;
};

Drawer.Footer = function DrawerFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-5 py-4 border-t border-[var(--color-border,#e5e7eb)] shrink-0', className)}>{children}</div>;
};
