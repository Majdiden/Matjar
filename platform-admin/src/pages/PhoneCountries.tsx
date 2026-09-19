import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  hasScope,
  PLATFORM_SCOPES,
  type PhoneCountry,
  type PhoneCountryCatalogEntry,
} from '../lib/api';
import { useAuth } from '../contexts/auth-context';
import { Button } from '../components/ui/Button';
import { Input, Label, Select } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Toggle } from '../components/ui/Toggle';
import { DataList, type DataListColumn } from '../components/ui/DataList';
import { PageSpinner, ErrorState } from '../components/ui/Spinner';
import { useToast } from '../components/ui/toast-context';
import { Phone, Plus, Trash2, Save, RefreshCw, Star } from 'lucide-react';

const CUSTOM = '__custom__';

type Draft = { countries: PhoneCountry[]; defaultCountry: string };

const emptyCustom = { iso2: '', name: '', nameAr: '', dialCode: '+', minDigits: '9', maxDigits: '9' };

export default function PhoneCountries() {
  const toast = useToast();
  const { user } = useAuth();
  const canWrite = hasScope(user, PLATFORM_SCOPES.TENANT_LIFECYCLE);

  const [catalog, setCatalog] = useState<PhoneCountryCatalogEntry[]>([]);
  const [saved, setSaved] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pick, setPick] = useState('');
  const [custom, setCustom] = useState(emptyCustom);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.phoneCountries.get();
      const d = { countries: res.countries, defaultCountry: res.defaultCountry };
      setCatalog(res.catalog);
      setSaved(d);
      setDraft(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load phone countries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(
    () => !!saved && !!draft && JSON.stringify(saved) !== JSON.stringify(draft),
    [saved, draft]
  );

  const available = useMemo(() => {
    const have = new Set((draft?.countries || []).map((c) => c.iso2));
    return catalog.filter((c) => !have.has(c.iso2));
  }, [catalog, draft]);

  const update = (fn: (d: Draft) => Draft) => setDraft((d) => (d ? fn(d) : d));

  const addCountry = () => {
    if (!draft) return;
    if (pick === CUSTOM) {
      const iso2 = custom.iso2.trim().toUpperCase();
      const dialCode = custom.dialCode.trim().startsWith('+')
        ? custom.dialCode.trim()
        : `+${custom.dialCode.trim()}`;
      const minDigits = Number(custom.minDigits);
      const maxDigits = Number(custom.maxDigits);
      if (!/^[A-Z]{2}$/.test(iso2)) return toast.error('ISO code must be two letters (e.g. SD).');
      if (!custom.name.trim()) return toast.error('Name is required.');
      if (!/^\+[1-9]\d{0,3}$/.test(dialCode)) return toast.error('Dial code must be + followed by 1–4 digits.');
      if (!Number.isInteger(minDigits) || !Number.isInteger(maxDigits) || minDigits < 4 || maxDigits > 15 || minDigits > maxDigits) {
        return toast.error('Digit bounds must satisfy 4 ≤ min ≤ max ≤ 15.');
      }
      if (draft.countries.some((c) => c.iso2 === iso2)) return toast.error(`${iso2} is already in the list.`);
      update((d) => ({
        ...d,
        countries: [
          ...d.countries,
          { iso2, name: custom.name.trim(), nameAr: custom.nameAr.trim(), dialCode, minDigits, maxDigits, enabled: true },
        ],
      }));
      setCustom(emptyCustom);
      setPick('');
      return;
    }
    const entry = catalog.find((c) => c.iso2 === pick);
    if (!entry) return;
    update((d) => ({ ...d, countries: [...d.countries, { ...entry, enabled: true }] }));
    setPick('');
  };

  const remove = (iso2: string) =>
    update((d) => ({ ...d, countries: d.countries.filter((c) => c.iso2 !== iso2) }));

  const setEnabled = (iso2: string, enabled: boolean) =>
    update((d) => ({
      ...d,
      countries: d.countries.map((c) => (c.iso2 === iso2 ? { ...c, enabled } : c)),
    }));

  const setDefault = (iso2: string) =>
    update((d) => ({
      ...d,
      defaultCountry: iso2,
      countries: d.countries.map((c) => (c.iso2 === iso2 ? { ...c, enabled: true } : c)),
    }));

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await api.phoneCountries.update(draft);
      const d = { countries: res.countries, defaultCountry: res.defaultCountry };
      setSaved(d);
      setDraft(d);
      setCatalog(res.catalog);
      toast.success('Phone countries saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSpinner />;
  if (error || !draft) return <ErrorState error={error || 'No data'} onRetry={load} />;

  const columns: DataListColumn<PhoneCountry>[] = [
    {
      id: 'country',
      header: 'Country',
      primary: true,
      cell: (c) => (
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="outline" className="shrink-0 font-mono">
            {c.iso2}
          </Badge>
          <div className="min-w-0">
            <div className="truncate">
              {c.name}
              {c.iso2 === draft.defaultCountry && (
                <Badge variant="secondary" className="ms-2 align-middle">
                  Default
                </Badge>
              )}
            </div>
            {c.nameAr && (
              <div className="truncate text-xs text-muted-foreground" dir="rtl">
                {c.nameAr}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'dial',
      header: 'Dial code',
      cell: (c) => (
        <span className="font-mono" dir="ltr">
          {c.dialCode}
        </span>
      ),
    },
    {
      id: 'digits',
      header: 'Digits',
      cell: (c) => (
        <span className="text-xs text-muted-foreground">
          {c.minDigits === c.maxDigits ? c.minDigits : `${c.minDigits}–${c.maxDigits}`}
        </span>
      ),
    },
    {
      id: 'enabled',
      header: 'Enabled',
      cell: (c) => (
        <Toggle
          checked={c.enabled}
          disabled={!canWrite || c.iso2 === draft.defaultCountry}
          onChange={(v) => setEnabled(c.iso2, v)}
          label={`Enable ${c.name}`}
        />
      ),
    },
    {
      id: 'actions',
      align: 'end',
      cell: (c) => (
        <div className="flex items-center justify-end gap-1">
          {c.iso2 !== draft.defaultCountry && (
            <Button
              variant="ghost"
              size="sm"
              disabled={!canWrite}
              onClick={() => setDefault(c.iso2)}
              title="Make default"
            >
              <Star className="h-3.5 w-3.5" /> Default
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={!canWrite || c.iso2 === draft.defaultCountry}
            onClick={() => remove(c.iso2)}
            title={c.iso2 === draft.defaultCountry ? 'Pick another default first' : 'Remove'}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Phone className="mt-0.5 h-6 w-6 shrink-0 text-indigo-600" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Phone countries</h1>
            <p className="text-sm text-gray-500">
              Dial codes offered on merchant signup and profile forms. Sudan is the launch
              default.
              {!canWrite && ' (read-only — you lack the tenant.lifecycle scope)'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={saving}>
            <RefreshCw className="h-3.5 w-3.5" /> Reload
          </Button>
          <Button size="sm" onClick={save} loading={saving} disabled={!dirty || !canWrite}>
            <Save className="h-3.5 w-3.5" /> Save changes
          </Button>
        </div>
      </div>

      {canWrite && (
        <div className="space-y-3 rounded-lg border bg-card p-4">
          <div className="text-sm font-medium">Add country</div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={pick} onChange={(e) => setPick(e.target.value)} className="sm:max-w-sm">
              <option value="">Pick a country…</option>
              {available.map((c) => (
                <option key={c.iso2} value={c.iso2}>
                  {c.name} ({c.dialCode})
                </option>
              ))}
              <option value={CUSTOM}>Custom…</option>
            </Select>
            <Button onClick={addCountry} disabled={!pick} className="sm:shrink-0">
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
          {pick === CUSTOM && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-iso2">ISO code</Label>
                <Input id="c-iso2" value={custom.iso2} maxLength={2} placeholder="SD"
                  onChange={(e) => setCustom((c) => ({ ...c, iso2: e.target.value.toUpperCase() }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-dial">Dial code</Label>
                <Input id="c-dial" value={custom.dialCode} placeholder="+249" dir="ltr"
                  onChange={(e) => setCustom((c) => ({ ...c, dialCode: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1.5 sm:col-span-1">
                <Label htmlFor="c-name">Name</Label>
                <Input id="c-name" value={custom.name} placeholder="Sudan"
                  onChange={(e) => setCustom((c) => ({ ...c, name: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1.5 sm:col-span-1">
                <Label htmlFor="c-namear">Arabic name</Label>
                <Input id="c-namear" value={custom.nameAr} placeholder="السودان" dir="rtl"
                  onChange={(e) => setCustom((c) => ({ ...c, nameAr: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-min">Min digits</Label>
                <Input id="c-min" type="number" min={4} max={15} value={custom.minDigits}
                  onChange={(e) => setCustom((c) => ({ ...c, minDigits: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-max">Max digits</Label>
                <Input id="c-max" type="number" min={4} max={15} value={custom.maxDigits}
                  onChange={(e) => setCustom((c) => ({ ...c, maxDigits: e.target.value }))} />
              </div>
            </div>
          )}
        </div>
      )}

      <DataList columns={columns} rows={draft.countries} rowKey={(c) => c.iso2} />

      {dirty && (
        <p className="text-xs text-amber-600">You have unsaved changes.</p>
      )}
    </div>
  );
}
