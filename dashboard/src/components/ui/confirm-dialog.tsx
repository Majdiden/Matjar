import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { ConfirmContext, type ConfirmOptions } from '@/components/ui/use-confirm';

/**
 * Promise-based confirm dialog — the site-wide replacement for
 * `window.confirm`. Dropped in at the app root via `<ConfirmProvider>`;
 * pages call `useConfirm()` (from `./use-confirm`) to get a function
 * that returns `Promise<boolean>`.
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: 'Delete?', variant: 'destructive' }))) return;
 *
 * The hook + context live in `./use-confirm` so this file can stay a
 * components-only module (Fast Refresh bails on mixed exports).
 */

type Resolver = (value: boolean) => void;

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [options, setOptions] = React.useState<ConfirmOptions | null>(null);
  const resolverRef = React.useRef<Resolver | null>(null);

  const confirm = React.useCallback((opts: ConfirmOptions) => {
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
      <Dialog
        open={!!options}
        onOpenChange={(open) => {
          if (!open) close(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-start gap-3">
              {isDestructive && (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              )}
              <div className="flex-1 space-y-1.5">
                <DialogTitle>{options?.title || 'Are you sure?'}</DialogTitle>
                {options?.description && (
                  <DialogDescription>{options.description}</DialogDescription>
                )}
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => close(false)}>
              {options?.cancelText || 'Cancel'}
            </Button>
            <Button
              variant={isDestructive ? 'destructive' : 'default'}
              onClick={() => close(true)}
            >
              {options?.confirmText || 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
};
