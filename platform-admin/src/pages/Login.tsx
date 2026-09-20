import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context';
import { Button } from '../components/ui/Button';
import { Input, Label } from '../components/ui/Input';
import { ShieldAlert, AlertCircle, Eye, EyeOff, KeyRound } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, completeMfa, isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  // Step 2 (MFA): set after a successful password check when MFA is enrolled.
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);

  const from =
    (location.state as { from?: string } | null)?.from ||
    (new URLSearchParams(location.search).get('expired') ? '/tenants' : '/tenants');
  const qs = new URLSearchParams(location.search);
  const expired = qs.get('expired') === '1';
  const notice = qs.get('invited') === '1'
    ? 'Invitation accepted. Sign in with your new password.'
    : qs.get('reset') === '1'
      ? 'Password updated. Sign in with your new password.'
      : null;

  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, from, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    try {
      const outcome = await login(email.trim(), password);
      if (outcome.mfaRequired) {
        setMfaToken(outcome.mfaToken);
        setPassword('');
        return;
      }
      // A forced reset takes precedence over any deep link.
      navigate(outcome.user.mustResetPassword ? '/reset-password?forced=1' : from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmitMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaToken) return;
    setError(null);
    const c = code.trim();
    if (!c) {
      setError(useRecovery ? 'Enter a recovery code.' : 'Enter the 6-digit code from your authenticator app.');
      return;
    }
    setSubmitting(true);
    try {
      const u = await completeMfa(mfaToken, c);
      if (u.mfaMethod === 'recovery') {
        sessionStorage.setItem('platform_admin_notice', `You signed in with a recovery code. ${u.recoveryCodesRemaining ?? 0} remaining — generate new ones from My security.`);
      }
      navigate(u.mustResetPassword ? '/reset-password?forced=1' : from, { replace: true });
    } catch (err) {
      const e = err as Error & { status?: number };
      // An expired/invalid mfaToken sends the operator back to step 1.
      if (e.status === 401 && /sign in again/i.test(e.message)) {
        setMfaToken(null);
        setCode('');
      }
      setError(e.message || 'Verification failed.');
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
          <h1 className="text-2xl font-bold tracking-tight">Platform Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Internal ops console. Merchants sign in at /dashboard.
          </p>
        </div>

        {mfaToken ? (
          <form onSubmit={onSubmitMfa} className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <KeyRound className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Two-factor verification</h2>
                <p className="text-sm text-muted-foreground">
                  {useRecovery ? 'Enter one of your recovery codes.' : 'Enter the 6-digit code from your authenticator app.'}
                </p>
              </div>
            </div>
            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>{error}</div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="code">{useRecovery ? 'Recovery code' : 'Authenticator code'}</Label>
              <Input
                id="code"
                inputMode={useRecovery ? 'text' : 'numeric'}
                autoComplete="one-time-code"
                autoFocus
                placeholder={useRecovery ? 'XXXXX-XXXXX' : '123456'}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={submitting}
                className="font-mono tracking-widest"
                dir="ltr"
              />
            </div>
            <Button type="submit" className="w-full" loading={submitting}>
              Verify
            </Button>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <button type="button" className="underline hover:text-foreground" onClick={() => { setUseRecovery((v) => !v); setCode(''); setError(null); }}>
                {useRecovery ? 'Use authenticator app' : 'Use a recovery code'}
              </button>
              <button type="button" className="underline hover:text-foreground" onClick={() => { setMfaToken(null); setCode(''); setError(null); }}>
                Back
              </button>
            </div>
          </form>
        ) : (
        <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
          {expired && !error && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>Your session expired. Sign in again to continue.</div>
            </div>
          )}
          {notice && !error && (
            <div className="rounded-md border border-emerald-500/40 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</div>
          )}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          <Button type="submit" className="w-full" loading={submitting}>
            Sign in
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            <Link to="/reset-password" className="underline hover:text-foreground">Forgot password?</Link>
          </p>
        </form>
        )}
      </div>
    </div>
  );
}
