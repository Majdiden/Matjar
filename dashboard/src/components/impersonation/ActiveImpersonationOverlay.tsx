import React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { LifeBuoy, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/button';
import { api } from '../../lib/api-client';
import { useImpersonation } from '../../contexts/ImpersonationContext';

/**
 * Owner-facing freeze. While a support session is ACTIVE the whole dashboard
 * is locked behind a non-interactive veil, the viewport glows on all four
 * edges (see index.css → .impersonation-glow-frame), and a clear banner
 * explains what's happening. The owner keeps a prominent "End session"
 * button that revokes support's grant instantly.
 *
 * Only rendered for the real owner (viewerRole === 'owner'); the impersonating
 * support session sees ImpersonationBanner instead.
 */
export const ActiveImpersonationOverlay: React.FC = () => {
  const { t } = useTranslation(['impersonation']);
  const { viewerRole, active, refresh } = useImpersonation();
  const [ending, setEnding] = React.useState(false);

  if (viewerRole !== 'owner' || !active) return null;

  const endSession = async () => {
    setEnding(true);
    try {
      await api.impersonation.revoke(active.grantId);
      toast.success(t('impersonation:overlay.ended_toast'));
      refresh();
    } catch {
      toast.error(t('impersonation:consent.error'));
    } finally {
      setEnding(false);
    }
  };

  const endsAt = active.sessionExpiresAt
    ? new Date(active.sessionExpiresAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <>
      {/* Non-interactive freeze veil + animated four-edge glow. */}
      <div className="impersonation-veil" aria-hidden="true" />
      <div className="impersonation-glow-frame" aria-hidden="true" />

      {/* Interactive panel sits ABOVE the veil so End session stays clickable. */}
      <div
        className="fixed inset-x-0 top-0 z-[70] flex justify-center px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]"
        role="alertdialog"
        aria-live="assertive"
        aria-label={t('impersonation:overlay.banner', { ticket: active.ticket })}
      >
        <div className="pointer-events-auto w-full max-w-2xl rounded-xl border border-amber-500/50 bg-background/95 p-4 shadow-2xl ring-1 ring-amber-500/20 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
              <LifeBuoy className="h-5 w-5 text-amber-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                {t('impersonation:overlay.banner', { ticket: active.ticket })}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('impersonation:overlay.subtext')}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                {active.supportName && (
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {t('impersonation:overlay.assisting_by', { name: active.supportName })}
                  </span>
                )}
                {endsAt && (
                  <span>{t('impersonation:overlay.session_ends', { time: endsAt })}</span>
                )}
              </div>
            </div>
            <Button
              onClick={endSession}
              disabled={ending}
              className="w-full shrink-0 bg-amber-600 text-white hover:bg-amber-700 sm:w-auto"
            >
              {ending
                ? t('impersonation:overlay.ending')
                : t('impersonation:overlay.end_session')}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};
