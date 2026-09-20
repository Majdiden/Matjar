import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/auth-context';
import { usersApi, type MfaStatus, type PlatformSession } from '../../lib/api-users';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Label } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ConfirmModal';
import { DataList, type DataListColumn } from '../../components/ui/DataList';
import { PageSpinner, ErrorState } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/toast-context';
import { formatRelative, formatDate } from '../../lib/utils';
import { RecoveryCodes } from './RecoveryCodes';
import { ShieldCheck, ShieldOff, KeyRound, LogOut, RefreshCw, Smartphone } from 'lucide-react';

type EnrollStep = 'password' | 'scan' | 'done';

export default function MySecurity() {
  const toast = useToast();
  const { user, refresh } = useAuth();
  const [searchParams] = useSearchParams();
  const required = searchParams.get('required') === '1';
  const [mfa, setMfa] = useState<MfaStatus | null>(null);
  const [sessions, setSessions] = useState<PlatformSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [step, setStep] = useState<EnrollStep>('password');
  const [password, setPassword] = useState('');
  const [provision, setProvision] = useState<{ secret: string; otpauth: string; account: string; issuer: string } | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [disableOpen, setDisableOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [revokeOthers, setRevokeOthers] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, s] = await Promise.all([usersApi.mfa.status(), usersApi.sessions.mine()]);
      setMfa(m);
      setSessions(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load security settings');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const resetEnroll = () => {
    setStep('password'); setPassword(''); setProvision(null); setCode(''); setCodes(null); setFormError(null); setBusy(false);
  };

  const begin = async () => {
    setBusy(true); setFormError(null);
    try {
      setProvision(await usersApi.mfa.beginEnroll(password));
      setPassword('');
      setStep('scan');
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Failed'); }
    finally { setBusy(false); }
  };
  const confirm = async () => {
    setBusy(true); setFormError(null);
    try {
      const res = await usersApi.mfa.confirmEnroll(code.trim());
      setCodes(res.recoveryCodes);
      setMfa(res.status);
      setStep('done');
      await refresh();
      toast.success('Two-factor authentication enabled');
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Invalid code'); }
    finally { setBusy(false); }
  };

  const sessionCols: DataListColumn<PlatformSession>[] = [
    {
      id: 'device', header: 'Device', primary: true,
      cell: (s) => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
            <span className="truncate">{describeUa(s.userAgent)}</span>
            {s.current && <Badge variant="default" className="text-[10px]">this session</Badge>}
            {s.mfaVerified && <Badge variant="outline" className="text-[10px]">2FA</Badge>}
          </div>
          <div className="truncate text-xs text-muted-foreground" dir="ltr">{s.ip || '—'}</div>
        </div>
      ),
    },
    { id: 'seen', header: 'Last active', cell: (s) => <span className="text-xs text-muted-foreground">{formatRelative(s.lastSeenAt)}</span> },
    { id: 'started', header: 'Signed in', hideOnMobile: true, cell: (s) => <span className="text-xs text-muted-foreground">{formatDate(s.createdAt)}</span> },
    {
      id: 'actions', align: 'end',
      cell: (s) => s.current ? null : (
        <Button variant="ghost" size="sm" title="Sign out this session" onClick={async () => {
          try { await usersApi.sessions.revokeMine(s.id); toast.success('Session signed out'); await load(); }
          catch (err) { toast.error(err instanceof Error ? err.message : 'Failed'); }
        }}>
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  if (loading) return <PageSpinner />;
  if (error) return <ErrorState error={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My security</h1>
          <p className="text-sm text-muted-foreground">Two-factor authentication and active sessions for <span dir="ltr">{user?.email}</span>.</p>
        </div>
      </div>

      {required && !mfa?.enabled && (
        <div className="rounded-md border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Two-factor authentication is required for your role.</p>
          <p className="text-xs">Enable it below to continue using the console. Everything else stays locked until you do.</p>
        </div>
      )}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2"><Smartphone className="h-4 w-4" /> Two-factor authentication</CardTitle>
            <CardDescription>A 6-digit code from an authenticator app (Google Authenticator, Aegis, 1Password…) on every sign-in.</CardDescription>
          </div>
          {mfa?.enabled ? <Badge variant="success">Enabled</Badge> : <Badge variant="outline">Off</Badge>}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {mfa?.enabled ? (
            <>
              <div className="text-muted-foreground">
                Enrolled {mfa.enrolledAt ? formatDate(mfa.enrolledAt) : '—'} · {mfa.recoveryCodesRemaining} recovery code(s) left
                {mfa.recoveryCodesRemaining <= 2 && <span className="ms-1 text-amber-700">— generate new ones soon.</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setRegenOpen(true)}><KeyRound className="h-3.5 w-3.5" /> New recovery codes</Button>
                <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDisableOpen(true)}><ShieldOff className="h-3.5 w-3.5" /> Disable</Button>
              </div>
            </>
          ) : (
            <Button size="sm" onClick={() => { resetEnroll(); setEnrollOpen(true); }}><ShieldCheck className="h-3.5 w-3.5" /> Enable two-factor</Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Active sessions</CardTitle>
            <CardDescription>Every device currently signed in as you. Sessions expire 30 minutes after sign-in, and 20 minutes of inactivity signs you out.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-3.5 w-3.5" /></Button>
            {sessions.some((s) => !s.current) && (
              <Button variant="outline" size="sm" onClick={() => setRevokeOthers(true)}><LogOut className="h-3.5 w-3.5" /> Sign out others</Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <DataList columns={sessionCols} rows={sessions} rowKey={(s) => s.id} />
        </CardContent>
      </Card>

      {/* Enrolment wizard */}
      <Modal
        open={enrollOpen}
        onClose={busy ? () => {} : () => { setEnrollOpen(false); resetEnroll(); }}
        title={step === 'done' ? 'Two-factor enabled' : 'Enable two-factor authentication'}
        description={step === 'password' ? 'Confirm your password to begin.' : step === 'scan' ? 'Add the account to your authenticator app, then enter the code it shows.' : undefined}
        footer={
          step === 'password' ? (
            <><Button variant="outline" onClick={() => setEnrollOpen(false)} disabled={busy}>Cancel</Button><Button onClick={begin} loading={busy} disabled={!password}>Continue</Button></>
          ) : step === 'scan' ? (
            <><Button variant="outline" onClick={() => setEnrollOpen(false)} disabled={busy}>Cancel</Button><Button onClick={confirm} loading={busy} disabled={code.trim().length !== 6}>Verify & enable</Button></>
          ) : (
            <Button onClick={() => { setEnrollOpen(false); resetEnroll(); }}>Done</Button>
          )
        }
      >
        <div className="space-y-3">
          {formError && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">{formError}</div>}
          {step === 'password' && (
            <div className="space-y-1.5">
              <Label htmlFor="mfa-pw">Current password</Label>
              <Input id="mfa-pw" type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} />
            </div>
          )}
          {step === 'scan' && provision && (
            <>
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="mb-1 font-medium">Manual setup</p>
                <p className="text-xs text-muted-foreground">Account: <span dir="ltr">{provision.account}</span> · Issuer: {provision.issuer} · Time-based, SHA-1, 6 digits, 30 s</p>
                <p className="mt-2 text-xs text-muted-foreground">Secret key</p>
                <code className="block break-all rounded bg-background p-2 font-mono text-sm" dir="ltr">{provision.secret.replace(/(.{4})/g, '$1 ').trim()}</code>
                <p className="mt-2 text-xs text-muted-foreground">Or paste this link into an app that accepts it:</p>
                <code className="block break-all rounded bg-background p-2 font-mono text-[11px]" dir="ltr">{provision.otpauth}</code>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mfa-code">6-digit code</Label>
                <Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} disabled={busy} className="font-mono tracking-widest" dir="ltr" />
              </div>
            </>
          )}
          {step === 'done' && codes && <RecoveryCodes codes={codes} />}
        </div>
      </Modal>

      <ConfirmModal
        open={disableOpen}
        onClose={() => setDisableOpen(false)}
        title="Disable two-factor authentication"
        description="Your account will be protected by the password alone. If your role requires 2FA, you will be asked to enrol again."
        fields={[
          { name: 'currentPassword', label: 'Current password', type: 'password', required: true, placeholder: '••••••••' },
          { name: 'code', label: 'Authenticator or recovery code', required: true, placeholder: '123456' },
        ]}
        confirmLabel="Disable"
        confirmVariant="destructive"
        onConfirm={async (v) => {
          setMfa(await usersApi.mfa.disable(v.currentPassword, v.code));
          await refresh();
          toast.success('Two-factor disabled');
        }}
      />

      <RegenModal open={regenOpen} onClose={() => setRegenOpen(false)} onDone={(s) => setMfa(s)} />

      <ConfirmModal
        open={revokeOthers}
        onClose={() => setRevokeOthers(false)}
        title="Sign out other sessions"
        description="Every other device signed in as you will be signed out. This session stays."
        confirmLabel="Sign out others"
        onConfirm={async () => {
          const r = await usersApi.sessions.revokeMyOthers();
          toast.success(`${r.revoked} session(s) signed out`);
          await load();
        }}
      />
    </div>
  );
}

const RegenModal: React.FC<{ open: boolean; onClose: () => void; onDone: (s: MfaStatus) => void }> = ({ open, onClose, onDone }) => {
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (open) { setCode(''); setCodes(null); setErr(null); setBusy(false); } }, [open]);
  const go = async () => {
    setBusy(true); setErr(null);
    try { const r = await usersApi.mfa.regenerateRecovery(code.trim()); setCodes(r.recoveryCodes); onDone(r.status); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(false); }
  };
  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title="New recovery codes"
      description={codes ? 'Your previous codes no longer work.' : 'Enter a current authenticator code. Your old recovery codes will stop working.'}
      footer={codes ? <Button onClick={onClose}>Done</Button> : <><Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button><Button onClick={go} loading={busy} disabled={!code.trim()}>Generate</Button></>}
    >
      <div className="space-y-3">
        {err && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">{err}</div>}
        {codes ? <RecoveryCodes codes={codes} /> : (
          <div className="space-y-1.5">
            <Label htmlFor="regen-code">Authenticator code</Label>
            <Input id="regen-code" inputMode="numeric" autoComplete="one-time-code" autoFocus value={code} onChange={(e) => setCode(e.target.value)} disabled={busy} className="font-mono tracking-widest" dir="ltr" />
          </div>
        )}
      </div>
    </Modal>
  );
};

function describeUa(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : /curl|node/i.test(ua) ? 'API client' : 'Browser';
  return `${browser} on ${os}`;
}
