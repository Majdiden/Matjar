import React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ShieldAlert, Check, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { api } from '../../lib/api-client';
import { useImpersonation, type PendingGrant } from '../../contexts/ImpersonationContext';

/**
 * Owner-facing consent popup. Appears the moment a support agent requests
 * access (SSE-driven, also survives reload via /state). The owner must
 * explicitly Approve or Deny. A 6-char consent code is shown so the owner
 * can read it to support on the phone as a fallback approval path.
 */
export const ImpersonationConsentModal: React.FC = () => {
  const { t } = useTranslation(['impersonation']);
  const { viewerRole, pending, active, refresh } = useImpersonation();
  const [busy, setBusy] = React.useState<'approve' | 'deny' | null>(null);
  const [secondsLeft, setSecondsLeft] = React.useState<number | null>(null);

  // The impersonating session never needs to approve. Once a session is
  // active there's nothing to consent to either.
  const grant: PendingGrant | null =
    viewerRole === 'owner' && !active && pending.length > 0 ? pending[0] : null;

  // Live countdown to the approval-window expiry.
  React.useEffect(() => {
    if (!grant?.approvalExpiresAt) {
      setSecondsLeft(null);
      return;
    }
    const tick = () => {
      const ms = new Date(grant.approvalExpiresAt as string).getTime() - Date.now();
      setSecondsLeft(Math.max(0, Math.floor(ms / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [grant?.approvalExpiresAt]);

  // Auto-dismiss when the window elapses.
  React.useEffect(() => {
    if (secondsLeft === 0) {
      const id = window.setTimeout(() => refresh(), 800);
      return () => window.clearTimeout(id);
    }
  }, [secondsLeft, refresh]);

  if (!grant) return null;

  const respond = async (action: 'approve' | 'deny') => {
    setBusy(action);
    try {
      if (action === 'approve') {
        await api.impersonation.approve(grant.grantId);
        toast.success(t('impersonation:consent.approved_toast'));
      } else {
        await api.impersonation.deny(grant.grantId);
        toast.success(t('impersonation:consent.denied_toast'));
      }
      refresh();
    } catch {
      toast.error(t('impersonation:consent.error'));
    } finally {
      setBusy(null);
    }
  };

  const expired = secondsLeft === 0;

  return (
    <Dialog open>
      {/* No onOpenChange handler → the owner cannot dismiss by clicking away;
          they must Approve or Deny (or let it expire). */}
      <DialogContent
        className="sm:max-w-md [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
            <ShieldAlert className="h-6 w-6 text-amber-600" />
          </div>
          <DialogTitle className="text-center">
            {t('impersonation:consent.title')}
          </DialogTitle>
          <DialogDescription className="text-center">
            {t('impersonation:consent.description', { ticket: grant.ticket })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">
              {t('impersonation:consent.requested_by')}
            </span>
            <span className="truncate text-end font-medium">
              {grant.supportName || grant.supportEmail || '—'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{t('impersonation:consent.ticket')}</span>
            <span className="font-mono font-medium">#{grant.ticket}</span>
          </div>
        </div>

        {/* Phone fallback: owner reads this code to support. */}
        {grant.code && (
          <div className="rounded-lg border border-dashed p-3 text-center">
            <p className="text-xs text-muted-foreground">
              {t('impersonation:consent.code_hint')}
            </p>
            <p className="mt-1 text-2xl font-bold tracking-[0.35em] tabular-nums">
              {grant.code}
            </p>
          </div>
        )}

        <p
          className={`text-center text-xs ${expired ? 'text-destructive' : 'text-muted-foreground'}`}
          aria-live="polite"
        >
          {expired
            ? t('impersonation:consent.expired')
            : secondsLeft != null
              ? t('impersonation:consent.expires_in', { seconds: secondsLeft })
              : ''}
        </p>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => respond('deny')}
            disabled={!!busy || expired}
            className="flex-1"
          >
            <X className="me-1.5 h-4 w-4" />
            {busy === 'deny' ? t('impersonation:consent.denying') : t('impersonation:consent.deny')}
          </Button>
          <Button
            onClick={() => respond('approve')}
            disabled={!!busy || expired}
            className="flex-1 bg-amber-600 text-white hover:bg-amber-700"
          >
            <Check className="me-1.5 h-4 w-4" />
            {busy === 'approve'
              ? t('impersonation:consent.approving')
              : t('impersonation:consent.approve')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
