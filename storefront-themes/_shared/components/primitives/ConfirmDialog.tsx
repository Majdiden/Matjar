import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Modal } from './Modal';
import { cn } from '../../utils/cn';

export interface ConfirmOptions {
  title?: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

type Resolver = (value: boolean) => void;

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<Resolver | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOptions(opts);
    });
  }, []);

  const close = (result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  };

  const isDestructive = options?.variant === 'destructive';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal isOpen={!!options} onClose={() => close(false)} size="sm">
        <div className="p-6">
          <div className="flex items-start gap-3">
            {isDestructive && (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {options?.title || 'Are you sure?'}
              </h3>
              {options?.description && (
                <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
                  {options.description}
                </p>
              )}
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => close(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              {options?.cancelText || 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => close(true)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium text-white transition',
                isDestructive
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100',
              )}
            >
              {options?.confirmText || 'Confirm'}
            </button>
          </div>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
};

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within <ConfirmProvider>');
  }
  return ctx;
}
