import React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { UserCog, LogOut } from 'lucide-react';
import { Button } from '../ui/button';
import { api } from '../../lib/api-client';
import { loginUrl } from '../../lib/authHandoff';
import { useImpersonation } from '../../contexts/ImpersonationContext';

/**
 * Support-facing persistent banner shown INSIDE the merchant dashboard while
 * a platform admin is impersonating a store. Every action they take is
 * audit-tagged server-side; this banner keeps the impersonation obvious and
 * offers a one-click exit that ends the grant and returns them to login.
 *
 * Only rendered for the impersonating session (viewerRole === 'support').
 */
export const ImpersonationBanner: React.FC = () => {
  const { t } = useTranslation(['impersonation']);
  const { viewerRole, active } = useImpersonation();
  const [exiting, setExiting] = React.useState(false);

  if (viewerRole !== 'support' || !active) return null;

  const exit = async () => {
    setExiting(true);
    try {
      await api.impersonation.exitSelf(active.grantId);
    } catch {
      /* Even if the call fails, tear down the local session below. */
    } finally {
      // Impersonation tokens are not refreshable — clear and bounce to login.
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('userId');
      toast.success(t('impersonation:banner.exiting'));
      window.location.href = loginUrl();
    }
  };

  return (
    <div
      className="z-[70] flex shrink-0 items-center gap-3 border-b border-amber-700 bg-amber-600 px-4 py-2 text-white shadow-md pt-[calc(env(safe-area-inset-top)+0.5rem)]"
      role="status"
    >
      <UserCog className="h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {t('impersonation:banner.label', {
            store: active.storeName || '—',
            ticket: active.ticket,
          })}
        </p>
        <p className="truncate text-xs text-white/85">
          {t('impersonation:banner.audited')}
        </p>
      </div>
      <Button
        size="sm"
        onClick={exit}
        disabled={exiting}
        className="shrink-0 bg-white text-amber-700 hover:bg-white/90"
      >
        <LogOut className="me-1.5 h-3.5 w-3.5" />
        {exiting ? t('impersonation:banner.exiting') : t('impersonation:banner.exit')}
      </Button>
    </div>
  );
};
