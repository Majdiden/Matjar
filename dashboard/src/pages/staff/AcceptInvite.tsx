import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';

type StaffRole = 'admin' | 'manager' | 'staff';

type TokenState =
  | { status: 'loading' }
  | { status: 'valid'; email: string; role: StaffRole }
  | { status: 'invalid'; message: string };

interface InviteVerifyPayload {
  email?: string;
  role?: StaffRole;
}

const errMsg = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object') {
    const e = err as { response?: { data?: { message?: unknown } }; message?: unknown };
    const serverMsg = e.response?.data?.message;
    if (typeof serverMsg === 'string') return serverMsg;
    if (typeof e.message === 'string') return e.message;
  }
  if (typeof err === 'string') return err;
  return fallback;
};

export const AcceptInvite: React.FC = () => {
  const navigate = useNavigate();
  const token = new URLSearchParams(window.location.search).get('token') || '';

  const [tokenState, setTokenState] = useState<TokenState>({ status: 'loading' });
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Verify the token on mount
  useEffect(() => {
    if (!token) {
      setTokenState({ status: 'invalid', message: 'No invitation token found in URL.' });
      return;
    }
    (async () => {
      try {
        const res = await api.get<InviteVerifyPayload>(`/staff/invites/verify?token=${encodeURIComponent(token)}`) as {
          data?: InviteVerifyPayload;
          responseObject?: InviteVerifyPayload;
        };
        const payload: InviteVerifyPayload = res.data || res.responseObject || {};
        const { email, role } = payload;
        if (email && role) {
          setTokenState({ status: 'valid', email, role });
        } else {
          setTokenState({ status: 'invalid', message: 'Invalid invitation response from server.' });
        }
      } catch (err) {
        setTokenState({
          status: 'invalid',
          message: errMsg(err, 'This invitation is invalid or has expired.'),
        });
      }
    })();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }

    try {
      setSubmitting(true);
      await api.post('/staff/invites/accept', { token, name: name.trim(), password });
      setDone(true);
      toast.success('Account created! Redirecting to login…');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      toast.error(errMsg(err, 'Failed to accept invitation. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (tokenState.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Verifying your invitation…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Invalid / expired token ────────────────────────────────────────────────
  if (tokenState.status === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 flex flex-col items-center gap-4 text-center">
            <XCircle className="h-12 w-12 text-destructive" />
            <div>
              <h2 className="text-lg font-semibold">Invitation not found</h2>
              <p className="text-muted-foreground mt-1">{tokenState.message}</p>
            </div>
            <Button variant="outline" onClick={() => navigate('/login')}>
              Go to login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 flex flex-col items-center gap-4 text-center">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <div>
              <h2 className="text-lg font-semibold">Account created!</h2>
              <p className="text-muted-foreground mt-1">Redirecting you to the login page…</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Accept form ────────────────────────────────────────────────────────────
  const { email, role } = tokenState;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">Accept invitation</CardTitle>
          <CardDescription>
            You have been invited to join as{' '}
            <Badge variant={role === 'admin' ? 'default' : role === 'manager' ? 'secondary' : 'outline'}>
              {role}
            </Badge>
            . Create your account to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Email address</Label>
              <Input value={email} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create account
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvite;
