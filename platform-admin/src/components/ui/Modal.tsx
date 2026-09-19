import React, { useEffect } from 'react';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Dialog. On phones it renders as a bottom sheet (full width, rounded top,
 * capped at 90dvh with a scrollable body); from `sm` up it is the familiar
 * centred card.
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}) => {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onEsc);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          'relative z-10 flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-xl border bg-background shadow-lg sm:rounded-lg',
          'pb-[env(safe-area-inset-bottom)] sm:pb-0',
          className
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 p-4 pb-3 sm:p-6 sm:pb-4">
          <div className="min-w-0 space-y-1">
            {title && <h2 className="text-lg font-semibold tracking-tight">{title}</h2>}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="-me-1 -mt-1 shrink-0 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children && (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6">{children}</div>
        )}
        {footer && (
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t px-4 py-3 sm:flex-row sm:justify-end sm:px-6 sm:py-4 [&>button]:w-full sm:[&>button]:w-auto">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
