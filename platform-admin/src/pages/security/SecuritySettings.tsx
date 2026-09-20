import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/auth-context';
import { usersApi, type PlatformRoleDef, type SecuritySettings as Settings } from '../../lib/api-users';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Toggle } from '../../components/ui/Toggle';
import { PageSpinner, ErrorState } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/toast-context';
import { useReauth } from '../../components/useReauth';
import { ShieldAlert, Save } from 'lucide-react';

/** Owner-only platform security policy. Writes require recent re-authentication. */
export default function SecuritySettings() {
  const toast = useToast();
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  const reauth = useReauth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [roles, setRoles] = useState<PlatformRoleDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await usersApi.security.get();
      setSettings(r.settings); setDraft(r.settings.requireMfaForRoles); setRoles(r.roles);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load security settings'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const dirty = !!settings && JSON.stringify([...draft].sort()) !== JSON.stringify([...settings.requireMfaForRoles].sort());

  const save = async () => {
    try { await reauth.ensure(); } catch { return; }
    setSaving(true);
    try {
      const r = await usersApi.security.update({ requireMfaForRoles: draft });
      setSettings(r.settings); setDraft(r.settings.requireMfaForRoles);
      toast.success('Security settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  };

  if (loading) return <PageSpinner />;
  if (error) return <ErrorState error={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-1 h-6 w-6 shrink-0 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Security settings</h1>
            <p className="text-sm text-muted-foreground">Platform-wide policy for operator accounts. {!isOwner && '(read-only — owners only)'}</p>
          </div>
        </div>
        {isOwner && (
          <Button size="sm" onClick={save} loading={saving} disabled={!dirty}><Save className="h-3.5 w-3.5" /> Save changes</Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Require two-factor authentication</CardTitle>
          <CardDescription>
            Operators with these roles cannot use the console until they enrol an authenticator app. They can still sign in, reach their security page and enrol.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {roles.map((r) => {
            const on = draft.includes(r.key);
            return (
              <div key={r.key} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium capitalize">{r.label}</p>
                  <p className="text-xs text-muted-foreground">{r.description}</p>
                </div>
                <Toggle checked={on} disabled={!isOwner || saving} onChange={(v) => setDraft((d) => (v ? [...d, r.key] : d.filter((k) => k !== r.key)))} />
              </div>
            );
          })}
        </CardContent>
      </Card>
      {reauth.modal}
    </div>
  );
}
