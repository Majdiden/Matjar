import React, { useEffect, useRef, useCallback } from 'react';
import { cn } from '../../utils/cn';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  overlayClassName?: string;
  /** Close when clicking overlay (default: true) */
  closeOnOverlay?: boolean;
  /** Close on Escape key (default: true) */
  closeOnEscape?: boolean;
  /** Size preset */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const sizeClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw] max-h-[95vh]',
};

export function Modal({
  isOpen,
  onClose,
  children,
  className,
  overlayClassName,
  closeOnOverlay = true,
  closeOnEscape = true,
  size = 'md',
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Focus trap & restore
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      // Focus first focusable element in modal
      setTimeout(() => {
        const focusable = modalRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusable?.focus();
      }, 50);

      // Lock body scroll
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      previousActiveElement.current?.focus();
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className={cn('fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity', overlayClassName)}
        onClick={closeOnOverlay ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 w-full bg-white dark:bg-gray-900 rounded-xl shadow-2xl',
          'animate-in fade-in zoom-in-95 duration-200',
          'max-h-[90vh] overflow-y-auto',
          sizeClasses[size],
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

// Subcomponents for structured modal content
Modal.Header = function ModalHeader({
  children,
  className,
  onClose,
}: {
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
}) {
  return (
    <div className={cn('flex items-center justify-between p-4 border-b', className)}>
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

Modal.Body = function ModalBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('p-4', className)}>{children}</div>;
};

Modal.Footer = function ModalFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex items-center justify-end gap-2 p-4 border-t', className)}>{children}</div>;
};
