import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { usersApi } from '../lib/api-users';
import { Button } from '../components/ui/Button';
import { Input, Label } from '../components/ui/Input';
import { ShieldAlert, AlertCircle, Eye, EyeOff } from 'lucide-react';

const PASSWORD_OK = (p: string) => p.length >= 12 && /[A-Za-z]/.test(p) && /\d/.test(p);

/** Public: an invited operator sets their name + password. */
export default function AcceptInvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim().length >= 2 && PASSWORD_OK(password) && password === confirm && !!token;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    setError(null);
    try {
      await usersApi.public.acceptInvite(token, name.trim(), password);
      navigate('/login?invited=1', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept the invitation.');
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
          <h1 className="text-2xl font-bold tracking-tight">Join the platform console</h1>
          <p className="mt-1 text-sm text-muted-foreground">Set your name and a password to accept your invitation.</p>
        </div>

        {!token ? (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
            This link is missing its token. Open the link from your invitation email.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>{error}</div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="name">Your name</Label>
              <Input id="name" autoComplete="name" autoFocus value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button type="button" onClick={() => setShow((v) => !v)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {show ? 'Hide' : 'Show'}
                </button>
              </div>
              <Input id="password" type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={submitting} />
              <p className={`text-xs ${password && !PASSWORD_OK(password) ? 'text-destructive' : 'text-muted-foreground'}`}>
                At least 12 characters with letters and numbers.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={submitting} />
              {confirm && confirm !== password && <p className="text-xs text-destructive">Passwords do not match.</p>}
            </div>
            <Button type="submit" className="w-full" loading={submitting} disabled={!valid}>
              Accept invitation
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Already have access? <Link to="/login" className="underline">Sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
