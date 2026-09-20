import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { usersApi } from '../lib/api-users';
import { useAuth } from '../contexts/auth-context';
import { Button } from '../components/ui/Button';
import { Input, Label } from '../components/ui/Input';
import { ShieldAlert, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';

const PASSWORD_OK = (p: string) => p.length >= 12 && /[A-Za-z]/.test(p) && /\d/.test(p);

/**
 * Three modes on one route:
 *   /reset-password             → request a reset link (public)
 *   /reset-password?token=…     → set a new password with the emailed token (public)
 *   /reset-password?forced=1    → signed-in operator was forced to reset: the
 *                                 server refuses an own-password change while
 *                                 the forced reset is pending, so this mode only
 *                                 points at the emailed link (and can resend it).
 */
export default function ResetPlatformPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const token = params.get('token') || '';
  const forced = params.get('forced') === '1' && !!user;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resent, setResent] = useState<string | null>(null);
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const pwValid = PASSWORD_OK(password) && password === confirm;

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await usersApi.public.requestReset(email.trim());
      setDone(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwValid) return;
    setSubmitting(true);
    setError(null);
    try {
      await usersApi.public.confirmReset(token, password);
      navigate('/login?reset=1', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the password.');
    } finally {
      setSubmitting(false);
    }
  };

  const mode: 'request' | 'confirm' | 'forced' = forced ? 'forced' : token ? 'confirm' : 'request';

  // Forced mode: re-send the reset link to the signed-in operator's own email.
  // The public endpoint answers generically, so we only show a neutral notice.
  const resendLink = async () => {
    if (!user?.email) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await usersApi.public.requestReset(user.email);
      setResent(res.message || 'If the address belongs to a platform user, a new link has been sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the link.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/30 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {mode === 'request' ? 'Reset your password' : mode === 'forced' ? 'Check your email' : 'Choose a new password'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === 'request'
              ? 'We will email a link if the address belongs to a platform user.'
              : mode === 'forced'
                ? 'An owner requires you to set a new password before continuing.'
                : 'At least 12 characters with letters and numbers.'}
          </p>
        </div>

        {done ? (
          <div className="flex items-start gap-2 rounded-lg border bg-card p-6 text-sm shadow-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div>
              {done}
              <div className="mt-3">
                <Link to="/login" className="text-sm underline">Back to sign in</Link>
              </div>
            </div>
          </div>
        ) : mode === 'forced' ? (
          <div className="space-y-4 rounded-lg border bg-card p-6 text-sm shadow-sm">
            {error && <ErrorBox error={error} />}
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div>
                A password reset link was emailed to <span className="font-medium" dir="ltr">{user?.email}</span>. Open it to choose a new password; you will then sign in again.
                {resent && <div className="mt-2 text-muted-foreground">{resent}</div>}
              </div>
            </div>
            <Button type="button" className="w-full" variant="outline" onClick={resendLink} loading={submitting}>
              Resend link
            </Button>
            <button type="button" onClick={logout} className="w-full text-center text-xs text-muted-foreground underline">
              Sign out
            </button>
          </div>
        ) : mode === 'request' ? (
          <form onSubmit={submitRequest} className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
            {error && <ErrorBox error={error} />}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting} />
            </div>
            <Button type="submit" className="w-full" loading={submitting} disabled={!/^\S+@\S+\.\S+$/.test(email.trim())}>
              Send reset link
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              <Link to="/login" className="underline">Back to sign in</Link>
            </p>
          </form>
        ) : (
          <form onSubmit={submitConfirm} className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
            {error && <ErrorBox error={error} />}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">New password</Label>
                <button type="button" onClick={() => setShow((v) => !v)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {show ? 'Hide' : 'Show'}
                </button>
              </div>
              <Input id="password" type={show ? 'text' : 'password'} autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} disabled={submitting} />
              <p className={`text-xs ${password && !PASSWORD_OK(password) ? 'text-destructive' : 'text-muted-foreground'}`}>
                At least 12 characters with letters and numbers.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input id="confirm" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={submitting} />
              {confirm && confirm !== password && <p className="text-xs text-destructive">Passwords do not match.</p>}
            </div>
            <Button type="submit" className="w-full" loading={submitting} disabled={!pwValid}>
              Set new password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

const ErrorBox: React.FC<{ error: string }> = ({ error }) => (
  <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
    <div>{error}</div>
  </div>
);
