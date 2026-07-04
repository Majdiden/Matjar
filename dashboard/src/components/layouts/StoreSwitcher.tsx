import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Store, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { useAuth } from '../../contexts/auth-context';
import type { StoreSummary } from '../../types';
import { cn } from '../../lib/utils';

interface StoreSwitcherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stores: StoreSummary[];
  loading: boolean;
}

/**
 * In-app store switcher (single app-host dashboard). Lists every store the
 * signed-in email can access and switches the active one in place — no host
 * hop. Selecting a store re-issues a token bound to that tenant (via
 * AuthContext.switchStore) and hard-reloads the dashboard against it.
 */
export const StoreSwitcherDialog: React.FC<StoreSwitcherDialogProps> = ({
  open,
  onOpenChange,
  stores,
  loading,
}) => {
  const { t } = useTranslation(['nav']);
  const { switchStore } = useAuth();
  const [switching, setSwitching] = React.useState<string | null>(null);

  const handleSelect = async (s: StoreSummary) => {
    if (s.current || switching) return;
    setSwitching(s.id);
    try {
      // On success this hard-reloads the page (bound to the new tenant), so we
      // never return here on the happy path.
      await switchStore(s.id);
    } catch {
      setSwitching(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('nav:store_switcher.title')}</DialogTitle>
          <DialogDescription>{t('nav:store_switcher.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {loading && stores.length === 0 ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : stores.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('nav:store_switcher.empty')}
            </p>
          ) : (
            stores.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelect(s)}
                disabled={s.current || !!switching}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border p-3 text-start transition-colors disabled:cursor-default',
                  s.current ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Store className="h-4 w-4" />
                </span>
                <span className="flex-1 overflow-hidden">
                  <span className="block truncate text-sm font-medium">{s.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{s.domain}</span>
                </span>
                {switching === s.id ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                ) : s.current ? (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                    <Check className="h-4 w-4" />
                    {t('nav:store_switcher.current')}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
