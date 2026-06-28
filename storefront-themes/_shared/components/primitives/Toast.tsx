import React, { useState, useCallback, useEffect, createContext, useContext, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextValue {
  toast: (message: string, options?: { type?: ToastType; duration?: number }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const { t } = useTranslation(['common']);
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

let toastId = 0;

const typeStyles: Record<ToastType, string> = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-blue-600 text-white',
  warning: 'bg-amber-500 text-white',
};

const typeIcons: Record<ToastType, string> = {
  success: '\u2713',
  error: '\u2717',
  info: '\u24D8',
  warning: '\u26A0',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message: string, options?: { type?: ToastType; duration?: number }) => {
    const id = `toast-${++toastId}`;
    const type = options?.type || 'info';
    const duration = options?.duration || 3000;

    setToasts(prev => [...prev, { id, message, type, duration }]);

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
  }, [removeToast]);

  // Bridge for non-React / cross-provider callers (e.g. the CartProvider, which
  // sits ABOVE this provider and so cannot use the `useToast` hook). They
  // dispatch a `storefront:toast` window event and we surface it here.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { message?: string; type?: ToastType }
        | undefined;
      if (detail?.message) toast(detail.message, { type: detail.type || 'info' });
    };
    window.addEventListener('storefront:toast', handler as EventListener);
    return () => window.removeEventListener('storefront:toast', handler as EventListener);
  }, [toast]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Toast container */}
      <div
        className="fixed bottom-4 end-4 z-[100] flex flex-col-reverse gap-2 pointer-events-none"
        aria-live="polite"
      >
        {toasts.map(t => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg min-w-[280px] max-w-sm',
              'animate-in slide-in-from-right fade-in duration-300',
              typeStyles[t.type]
            )}
          >
            <span className="text-lg leading-none">{typeIcons[t.type]}</span>
            <span className="text-sm font-medium flex-1">{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="opacity-70 hover:opacity-100 transition-opacity text-lg leading-none"
              aria-label={t('common:aria.dismiss')}
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
