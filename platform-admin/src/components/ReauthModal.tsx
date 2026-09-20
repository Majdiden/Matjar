import { useEffect, useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input, Label } from './ui/Input';
import { api, setReauthToken } from '../lib/api';
import { useAuth } from '../contexts/auth-context';
import { ShieldCheck, AlertCircle } from 'lucide-react';

/**
 * Re-authentication prompt for destructive / privilege-changing actions.
 * Asks for the password (MFA off) or an authenticator/recovery code (MFA on),
 * stores the 5-minute reauth token IN MEMORY (lib/api.ts) so the next
 * protected call carries `X-Reauth`, then invokes `onConfirmed`.
 *
 * Usage: `const reauth = useReauth(); await reauth.ensure(); await doTheThing();`
 */
export const ReauthModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onConfirmed: () => void;
  title?: string;
}> = ({ open, onClose, onConfirmed, title = 'Confirm it is you' }) => {
  const { user } = useAuth();
  const mfa = !!user?.mfaEnabled;
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setValue('');
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.reauth(mfa ? { code: value.trim() } : { password: value });
      setReauthToken(res.reauthToken, res.expiresInSeconds);
      onConfirmed();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      description={
        mfa
          ? 'This action is sensitive. Enter the current code from your authenticator app (or a recovery code).'
          : 'This action is sensitive. Re-enter your password to continue.'
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} loading={busy} disabled={!value.trim()}>
            <ShieldCheck className="h-3.5 w-3.5" /> Confirm
          </Button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) void submit();
        }}
      >
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="reauth-value">{mfa ? 'Authenticator code' : 'Password'}</Label>
          <Input
            id="reauth-value"
            type={mfa ? 'text' : 'password'}
            inputMode={mfa ? 'numeric' : undefined}
            autoComplete={mfa ? 'one-time-code' : 'current-password'}
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={busy}
            dir="ltr"
            className={mfa ? 'font-mono tracking-widest' : undefined}
          />
        </div>
        <p className="text-xs text-muted-foreground">Confirmation stays valid for 5 minutes and is tied to this session.</p>
      </form>
    </Modal>
  );
};
