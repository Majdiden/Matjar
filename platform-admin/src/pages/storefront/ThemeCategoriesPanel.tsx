import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { storefrontApi, type ThemeCategory } from '../../lib/api-storefront';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input, Label } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Toggle } from '../../components/ui/Toggle';
import { ConfirmModal } from '../../components/ConfirmModal';
import { PageSpinner, ErrorState } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/toast-context';

interface Props {
  canWrite: boolean;
  /** Called after any change, so the theme list (counts, chips) reloads. */
  onChanged: () => void | Promise<void>;
}

/** "Home & Living" → "home-living" (the key suggestion for a new category). */
const slugify = (v: string) =>
  v.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32).replace(/-+$/g, '');

const KEY_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

const errMsg = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

/**
 * Theme categories the platform owner manages: signup's "What do you sell"
 * choices and the merchant theme library's filter, in this order.
 */
export function ThemeCategoriesPanel({ canWrite, onChanged }: Props) {
  const toast = useToast();
  const [rows, setRows] = useState<ThemeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // New-category form
  const [en, setEn] = useState('');
  const [ar, setAr] = useState('');
  const [key, setKey] = useState('');
  const [keyTouched, setKeyTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  // Edit / delete
  const [editing, setEditing] = useState<ThemeCategory | null>(null);
  const [deleting, setDeleting] = useState<ThemeCategory | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setRows(await storefrontApi.themeCategories.list()); }
    catch (err) { setError(errMsg(err, 'Failed to load categories')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const afterChange = async () => { await load(); await onChanged(); };

  const create = async () => {
    const k = (keyTouched ? key : slugify(en)).trim();
    if (!en.trim() || !ar.trim()) { toast.error('Enter the English and Arabic names'); return; }
    if (!KEY_RE.test(k)) { toast.error('Key: 1-32 lowercase letters, digits or dashes'); return; }
    setCreating(true);
    try {
      await storefrontApi.themeCategories.create({ key: k, name: { en: en.trim(), ar: ar.trim() } });
      toast.success(`Category "${en.trim()}" added`);
      setEn(''); setAr(''); setKey(''); setKeyTouched(false);
      await afterChange();
    } catch (err) { toast.error(errMsg(err, 'Could not add the category')); }
    finally { setCreating(false); }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[index], next[j]] = [next[j], next[index]];
    setBusy(next[j].key);
    try { setRows(await storefrontApi.themeCategories.reorder(next.map((r) => r.key))); await onChanged(); }
    catch (err) { toast.error(errMsg(err, 'Could not reorder')); await load(); }
    finally { setBusy(null); }
  };

  const setActive = async (row: ThemeCategory, active: boolean) => {
    setBusy(row.key);
    try { await storefrontApi.themeCategories.update(row.key, { active }); toast.success(active ? 'Category shown' : 'Category hidden'); await afterChange(); }
    catch (err) { toast.error(errMsg(err, 'Update failed')); }
    finally { setBusy(null); }
  };

  const suggestedKey = keyTouched ? key : slugify(en);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Tags className="h-4 w-4 text-indigo-600" /> Categories</CardTitle>
        <CardDescription>
          The &quot;What do you sell&quot; choices at signup and the category filter in the merchant theme library, in this order. Hidden categories are not offered; stores that already picked one keep it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <ErrorState error={error} onRetry={load} />
          : loading && rows.length === 0 ? <PageSpinner />
          : (
            <ul className="divide-y rounded-md border">
              {rows.map((r, i) => (
                <li key={r.key} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`font-medium ${r.active ? '' : 'text-muted-foreground line-through'}`}>{r.name.en}</span>
                      <span className="text-sm text-muted-foreground" dir="rtl" lang="ar">{r.name.ar}</span>
                      {!r.active && <Badge variant="outline" className="text-[10px]">hidden</Badge>}
                      {r.protected && <Badge variant="secondary" className="text-[10px]" title="Catch-all category: can be renamed and moved, not hidden or deleted">catch-all</Badge>}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground"><span className="font-mono">{r.key}</span> · {r.themeCount} theme{r.themeCount === 1 ? '' : 's'}</div>
                  </div>
                  {canWrite && (
                    <div className="flex items-center gap-1">
                      <Toggle checked={r.active} disabled={r.protected || busy === r.key} onChange={(v) => void setActive(r, v)} label={r.active ? `Hide ${r.name.en}` : `Show ${r.name.en}`} />
                      <Button variant="ghost" size="sm" title="Move up" aria-label={`Move ${r.name.en} up`} disabled={i === 0 || !!busy} onClick={() => void move(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" title="Move down" aria-label={`Move ${r.name.en} down`} disabled={i === rows.length - 1 || !!busy} onClick={() => void move(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" title="Rename" aria-label={`Rename ${r.name.en}`} onClick={() => setEditing(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" title={r.protected ? 'The catch-all category cannot be deleted' : 'Delete'} aria-label={`Delete ${r.name.en}`} disabled={r.protected} onClick={() => setDeleting(r)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

        {canWrite && (
          <div className="rounded-md border border-dashed p-3">
            <div className="mb-2 text-sm font-medium">New category</div>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_12rem_auto] sm:items-end">
              <div><Label htmlFor="cat-en">English name</Label><Input id="cat-en" value={en} onChange={(e) => setEn(e.target.value)} maxLength={60} placeholder="Pet supplies" /></div>
              <div><Label htmlFor="cat-ar">Arabic name</Label><Input id="cat-ar" value={ar} onChange={(e) => setAr(e.target.value)} maxLength={60} dir="rtl" lang="ar" placeholder="مستلزمات الحيوانات" /></div>
              <div><Label htmlFor="cat-key">Key</Label><Input id="cat-key" value={suggestedKey} onChange={(e) => { setKeyTouched(true); setKey(e.target.value.toLowerCase()); }} maxLength={32} dir="ltr" className="font-mono" placeholder="pets" /></div>
              <Button onClick={() => void create()} loading={creating}><Plus className="h-3.5 w-3.5" /> Add</Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">The key is permanent (stores and themes refer to it); names can be changed any time.</p>
          </div>
        )}
      </CardContent>

      <CategoryEditModal category={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await afterChange(); }} />

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete category: ${deleting?.name.en ?? ''}`}
        description={deleting ? `Removes "${deleting.name.en}" from signup and the theme library and unassigns it from ${deleting.themeCount} theme(s). Stores that picked it keep their themes. To keep it for later, hide it instead.` : undefined}
        fields={[{ name: 'reason', label: 'Reason', type: 'textarea', help: 'Recorded in the audit ledger.' }]}
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={async (v) => {
          if (!deleting) return;
          try {
            const r = await storefrontApi.themeCategories.remove(deleting.key, v.reason?.trim() || undefined);
            toast.success(`Category deleted${r.themesUpdated ? ` · ${r.themesUpdated} theme(s) updated` : ''}`);
            setDeleting(null);
            await afterChange();
          } catch (err) { toast.error(errMsg(err, 'Delete failed')); throw err; }
        }}
      />
    </Card>
  );
}

function CategoryEditModal({ category, onClose, onSaved }: { category: ThemeCategory | null; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const toast = useToast();
  const [en, setEn] = useState('');
  const [ar, setAr] = useState('');
  const [icon, setIcon] = useState('');
  const [aliases, setAliases] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!category) return;
    setEn(category.name.en); setAr(category.name.ar); setIcon(category.icon ?? ''); setAliases((category.aliases ?? []).join(', '));
  }, [category]);

  if (!category) return null;

  const save = async () => {
    if (!en.trim() || !ar.trim()) { toast.error('Enter the English and Arabic names'); return; }
    const aliasList = aliases.split(',').map((a) => a.trim().toLowerCase()).filter(Boolean);
    setSaving(true);
    try {
      await storefrontApi.themeCategories.update(category.key, { name: { en: en.trim(), ar: ar.trim() }, icon: icon.trim(), aliases: aliasList });
      toast.success('Category saved');
      await onSaved();
    } catch (err) { toast.error(errMsg(err, 'Save failed')); }
    finally { setSaving(false); }
  };

  return (
    <Modal
      open={!!category}
      onClose={onClose}
      title={`Edit category — ${category.name.en}`}
      description={<>Key <span className="font-mono">{category.key}</span> stays the same.</>}
      className="max-w-lg"
      footer={<><Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button onClick={() => void save()} loading={saving}>Save</Button></>}
    >
      <div className="space-y-4">
        <div><Label htmlFor="edit-en">English name</Label><Input id="edit-en" value={en} onChange={(e) => setEn(e.target.value)} maxLength={60} /></div>
        <div><Label htmlFor="edit-ar">Arabic name</Label><Input id="edit-ar" value={ar} onChange={(e) => setAr(e.target.value)} maxLength={60} dir="rtl" lang="ar" /></div>
        <div>
          <Label htmlFor="edit-icon">Icon <span className="font-normal text-muted-foreground">(optional, Lucide name)</span></Label>
          <Input id="edit-icon" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={40} dir="ltr" placeholder="Shirt" />
        </div>
        <div>
          <Label htmlFor="edit-aliases">Manifest keywords <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="edit-aliases" value={aliases} onChange={(e) => setAliases(e.target.value)} dir="ltr" placeholder="apparel, clothing" />
          <p className="mt-1 text-xs text-muted-foreground">Themes you have not assigned by hand join this category when their manifest lists one of these words.</p>
        </div>
      </div>
    </Modal>
  );
}
