import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input, Label } from '../components/ui/Input';
import { useToast } from '../components/ui/toast-context';
import { ShieldCheck, Clock, Phone } from 'lucide-react';

/**
 * Consent-based impersonation flow (operator side).
 *
 *   request → owner approves (in-dashboard) OR support enters the code the
 *   owner reads to them → enter → open the merchant dashboard impersonating.
 *
 * No token is ever minted until the owner has consented. The modal polls the
 * grant status and, on approval, auto-enters and opens the tenant dashboard
 * with the impersonation token in the URL fragment.
 */

type Phase = 'form' | 'waiting' | 'entering' | 'error';

export function ImpersonationRequestModal({
  open,
  onClose,
  tenantId,
  primaryHost,
}: {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  primaryHost: string | null;
}) {
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>('form');
  const [ticket, setTicket] = useState('');
  const [grantId, setGrantId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<number | null>(null);

  const reset = useCallback(() => {
    if (pollTimer.current != null) window.clearInterval(pollTimer.current);
    pollTimer.current = null;
    setPhase('form');
    setTicket('');
    setGrantId(null);
    setStatus('');
    setCode('');
    setError(null);
  }, []);

  useEffect(() => {
    if (!open) reset();
    return () => {
      if (pollTimer.current != null) window.clearInterval(pollTimer.current);
    };
  }, [open, reset]);

  // Build the tenant dashboard URL with the impersonation token in the hash
  // (never a query string — fragments aren't logged by proxies).
  const openImpersonatedDashboard = useCallback(
    (token: string) => {
      if (!primaryHost) {
        navigator.clipboard?.writeText(token).catch(() => {});
        toast.info('Token copied to clipboard (no tenant host available)');
        return;
      }
      const isLocal =
        window.location.hostname === 'localhost' ||
        window.location.hostname.endsWith('.localhost');
      const bareHost = primaryHost
        .replace(/^[a-z]+:\/\//i, '')
        .replace(/:\d+$/, '')
        .replace(/\/.*$/, '');
      const proto = isLocal ? window.location.protocol : 'https:';
      const port = isLocal ? ':5173' : '';
      try {
        const u = new URL(`${proto}//${bareHost}${port}/login`);
        u.hash = `impersonation=${encodeURIComponent(token)}`;
        const opened = window.open(u.toString(), '_blank', 'noopener');
        if (!opened) {
          navigator.clipboard?.writeText(token).catch(() => {});
          toast.info('Popup blocked — token copied to clipboard');
        }
      } catch {
        toast.error(`Cannot build dashboard URL for host "${bareHost}"`);
      }
    },
    [primaryHost, toast]
  );

  const enterAndOpen = useCallback(
    async (gid: string) => {
      setPhase('entering');
      try {
        const result = await api.tenants.enterImpersonation(tenantId, gid);
        openImpersonatedDashboard(result.token);
        toast.success('Impersonation session started');
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to enter session');
        setPhase('error');
      }
    },
    [tenantId, openImpersonatedDashboard, toast, onClose]
  );

  // Poll the grant while waiting for the owner.
  useEffect(() => {
    if (phase !== 'waiting' || !grantId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const g = await api.tenants.pollImpersonation(tenantId, grantId);
        if (cancelled) return;
        setStatus(g.status);
        if (g.status === 'approved') {
          if (pollTimer.current != null) window.clearInterval(pollTimer.current);
          pollTimer.current = null;
          void enterAndOpen(grantId);
        } else if (['denied', 'expired', 'cancelled'].includes(g.status)) {
          if (pollTimer.current != null) window.clearInterval(pollTimer.current);
          pollTimer.current = null;
          setError(
            g.status === 'denied'
              ? 'The store owner denied the request.'
              : g.status === 'expired'
                ? 'The request expired before the owner approved it.'
                : 'The request was cancelled.'
          );
          setPhase('error');
        }
      } catch {
        /* transient — keep polling */
      }
    };
    void poll();
    pollTimer.current = window.setInterval(poll, 2000);
    return () => {
      cancelled = true;
      if (pollTimer.current != null) window.clearInterval(pollTimer.current);
      pollTimer.current = null;
    };
  }, [phase, grantId, tenantId, enterAndOpen]);

  const submitRequest = async () => {
    const t = ticket.trim();
    if (!t) {
      toast.error('Enter a support ticket number.');
      return;
    }
    try {
      const grant = await api.tenants.requestImpersonation(tenantId, t);
      setGrantId(grant.grantId);
      setStatus(grant.status);
      setPhase('waiting');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed');
    }
  };

  const submitCode = async () => {
    if (!grantId) return;
    const c = code.trim().toUpperCase();
    if (c.length < 6) {
      toast.error('Enter the 6-character code from the owner.');
      return;
    }
    try {
      await api.tenants.approveImpersonationByCode(tenantId, grantId, c);
      // Approved — the poll loop will pick it up and enter, but enter now for speed.
      void enterAndOpen(grantId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Incorrect code');
    }
  };

  const cancelRequest = async () => {
    if (grantId) {
      try {
        await api.tenants.exitImpersonation(tenantId, grantId);
      } catch {
        /* best effort */
      }
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={phase === 'entering' ? () => {} : onClose}
      title="Request impersonation access"
      description="The store owner must approve before you can enter. Access is tied to a support ticket and every action is audited."
      footer={
        phase === 'form' ? (
          <>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submitRequest}>Request access</Button>
          </>
        ) : phase === 'waiting' ? (
          <Button variant="outline" onClick={cancelRequest}>
            Cancel request
          </Button>
        ) : phase === 'error' ? (
          <>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={reset}>Try again</Button>
          </>
        ) : null
      }
    >
      {phase === 'form' && (
        <div className="space-y-3">
          <div>
            <Label htmlFor="imp-ticket">Support ticket number</Label>
            <Input
              id="imp-ticket"
              value={ticket}
              onChange={(e) => setTicket(e.target.value)}
              placeholder="1234"
              autoFocus
            />
          </div>
          <p className="text-xs text-muted-foreground">
            The owner will receive a real-time popup in their dashboard asking them to
            approve access for this ticket.
          </p>
        </div>
      )}

      {phase === 'waiting' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <Clock className="h-4 w-4 animate-pulse text-amber-600" />
            <span>
              Waiting for the owner to approve access for ticket{' '}
              <span className="font-mono font-medium">#{ticket}</span>… (status: {status})
            </span>
          </div>
          <div className="rounded-lg border p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Phone className="h-4 w-4" /> On the phone with the owner?
            </div>
            <p className="mb-2 text-xs text-muted-foreground">
              Ask them to read you the 6-character consent code shown in their dashboard,
              then enter it here.
            </p>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
                className="font-mono tracking-widest"
              />
              <Button onClick={submitCode} disabled={code.trim().length < 6}>
                Approve
              </Button>
            </div>
          </div>
        </div>
      )}

      {phase === 'entering' && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Approved — opening the store dashboard…
        </div>
      )}

      {phase === 'error' && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </Modal>
  );
}
