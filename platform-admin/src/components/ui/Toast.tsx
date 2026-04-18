import React, { useCallback, useState } from 'react';
import { cn } from '../../lib/utils';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { ToastContext, type ToastApi } from './toast-context';

type ToastVariant = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, variant: ToastVariant) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const api: ToastApi = {
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    info: (m) => push(m, 'info'),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-2 rounded-md border bg-background p-3 text-sm shadow-lg',
              t.variant === 'success' && 'border-green-500/30',
              t.variant === 'error' && 'border-destructive/40',
              t.variant === 'info' && 'border-border'
            )}
          >
            {t.variant === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600 shrink-0" />}
            {t.variant === 'error' && <AlertCircle className="mt-0.5 h-4 w-4 text-destructive shrink-0" />}
            <div className="flex-1">{t.message}</div>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
