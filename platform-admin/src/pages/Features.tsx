import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  hasScope,
  PLATFORM_SCOPES,
  type FeatureFlagDef,
  type FeaturesResponse,
} from '../lib/api';
import { useAuth } from '../contexts/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { PageSpinner, ErrorState } from '../components/ui/Spinner';
import { useToast } from '../components/ui/toast-context';
import { ToggleLeft } from 'lucide-react';

/** A small controlled on/off switch (no shared Switch component exists). */
function Toggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-indigo-600' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export default function Features() {
  const toast = useToast();
  const { user } = useAuth();
  const canWrite = hasScope(user, PLATFORM_SCOPES.TENANT_LIFECYCLE);

  const [data, setData] = useState<FeaturesResponse | null>(null);
  const [flags, setFlags] = useState<Record<string, boolean | string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.features.get();
      setData(res);
      setFlags(res.flags);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load features');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Persist a single flag change immediately (matches the panel's ad-hoc style),
  // optimistically updating and rolling back on failure.
  const persist = useCallback(
    async (key: string, value: boolean | string[]) => {
      if (!canWrite) return;
      const prev = flags[key];
      setFlags((f) => ({ ...f, [key]: value }));
      setSaving(key);
      try {
        const res = await api.features.update({ [key]: value });
        setFlags(res.flags);
        toast.success('Saved');
      } catch (err) {
        setFlags((f) => ({ ...f, [key]: prev }));
        toast.error(err instanceof Error ? err.message : 'Failed to save');
      } finally {
        setSaving(null);
      }
    },
    [canWrite, flags, toast],
  );

  const groups = useMemo(() => {
    const reg = data?.registry || [];
    const order: string[] = [];
    const byGroup: Record<string, FeatureFlagDef[]> = {};
    for (const def of reg) {
      if (!byGroup[def.group]) {
        byGroup[def.group] = [];
        order.push(def.group);
      }
      byGroup[def.group].push(def);
    }
    return order.map((g) => ({ group: g, defs: byGroup[g] }));
  }, [data]);

  const catalogAll = flags['themes.catalogAll'] === true;
  const allowedSlugs = Array.isArray(flags['themes.allowedSlugs'])
    ? (flags['themes.allowedSlugs'] as string[])
    : [];

  if (loading) return <PageSpinner />;
  if (error) return <ErrorState error={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ToggleLeft className="h-6 w-6 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Features</h1>
          <p className="text-sm text-gray-500">
            Platform-wide feature flags. Toggles apply to every store. Off by default —
            open features gradually.
            {!canWrite && ' (read-only — you lack the tenant.lifecycle scope)'}
          </p>
        </div>
      </div>

      {groups.map(({ group, defs }) => (
        <Card key={group}>
          <CardHeader>
            <CardTitle>{group}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {defs.map((def) => {
              if (def.key === 'themes.allowedSlugs') {
                // Rendered as a slug checklist under the Themes group.
                return (
                  <div key={def.key} className="py-4">
                    <p className="text-sm font-medium">{def.label}</p>
                    <p className="text-xs text-gray-500 mb-3">{def.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {(data?.themeSlugs || []).map((slug) => {
                        const on = allowedSlugs.includes(slug);
                        return (
                          <button
                            key={slug}
                            type="button"
                            disabled={!canWrite || catalogAll || saving === def.key}
                            onClick={() =>
                              persist(
                                def.key,
                                on
                                  ? allowedSlugs.filter((s) => s !== slug)
                                  : [...allowedSlugs, slug],
                              )
                            }
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition disabled:opacity-50 ${
                              on
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                                : 'border-gray-300 text-gray-600 hover:border-gray-400'
                            }`}
                          >
                            {slug}
                          </button>
                        );
                      })}
                    </div>
                    {catalogAll && (
                      <p className="mt-2 text-xs text-amber-600">
                        Full catalog is on — the allowlist is ignored.
                      </p>
                    )}
                  </div>
                );
              }
              const on = flags[def.key] === true;
              return (
                <div key={def.key} className="flex items-start justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{def.label}</p>
                    {def.description && (
                      <p className="text-xs text-gray-500">{def.description}</p>
                    )}
                  </div>
                  <Toggle
                    checked={on}
                    disabled={!canWrite || saving === def.key}
                    onChange={(v) => persist(def.key, v)}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
