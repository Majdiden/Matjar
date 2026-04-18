import React, { useEffect } from 'react';
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
    container: 'right-0 top-0 h-full',
    open: 'translate-x-0',
  },
  left: {
    container: 'left-0 top-0 h-full',
    open: 'translate-x-0',
  },
  bottom: {
    container: 'bottom-0 left-0 w-full',
    open: 'translate-y-0',
  },
};

const closedClasses: Record<DrawerSide, string> = {
  right: 'translate-x-full',
  left: '-translate-x-full',
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
          'fixed z-50 bg-white dark:bg-gray-900 shadow-2xl transition-transform duration-300 ease-in-out flex flex-col',
          slideClasses[side].container,
          isOpen ? slideClasses[side].open : closedClasses[side],
          side !== 'bottom' && `w-full ${width}`,
          side === 'bottom' && 'max-h-[85vh] rounded-t-2xl',
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
  return (
    <div className={cn('flex items-center justify-between p-4 border-b shrink-0', className)}>
      <div className="font-semibold text-lg">{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          aria-label="Close"
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
  return <div className={cn('flex-1 overflow-y-auto p-4', className)}>{children}</div>;
};

Drawer.Footer = function DrawerFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('p-4 border-t shrink-0', className)}>{children}</div>;
};
