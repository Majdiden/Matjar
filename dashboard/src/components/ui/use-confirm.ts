import * as React from 'react';

/**
 * Shared context + hook for the site-wide confirm dialog.
 *
 * Lives in its own file so `confirm-dialog.tsx` can stay a
 * components-only module (keeps Fast Refresh happy — React Refresh
 * bails on a file that mixes component and non-component exports).
 * `ConfirmProvider` lives in `confirm-dialog.tsx` and writes into this
 * context; consumers import `useConfirm` from here.
 */
export type ConfirmOptions = {
  title?: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
};

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

export const ConfirmContext = React.createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within <ConfirmProvider>');
  }
  return ctx;
}
