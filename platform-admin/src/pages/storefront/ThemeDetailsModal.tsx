import { useEffect, useRef, useState } from 'react';
import { Upload, RotateCcw } from 'lucide-react';
import { storefrontApi, type ThemeRow, type ThemeCategoryOption, type ThemeDetailsPatch } from '../../lib/api-storefront';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input, Label, Textarea } from '../../components/ui/Input';
import { useToast } from '../../components/ui/toast-context';

interface Props {
  theme: ThemeRow | null;
  categoryOptions: ThemeCategoryOption[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

/**
 * Edit a theme's presentation (name, description, cover, categories, tags).
 * Edits are stored as overrides on the catalog row so a manifest rebuild
 * never undoes them; "Reset" on a field sends null to fall back to the
 * manifest value.
 */
export function ThemeDetailsModal({ theme, categoryOptions, onClose, onSaved }: Props) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [previewImage, setPreviewImage] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!theme) return;
    setName(theme.name ?? '');
    setDescription(theme.description ?? '');
    setPreviewImage(theme.previewImage ?? '');
    setCategories(theme.categories ?? []);
    setTags((theme.tags ?? []).join(', '));
    setReason('');
  }, [theme]);

  if (!theme) return null;
  const ov = theme.overrides ?? {};
  const hasOverride = (k: keyof typeof ov) => ov[k] !== null && ov[k] !== undefined && !(Array.isArray(ov[k]) && (ov[k] as unknown[]).length === 0);

  const toggleCategory = (key: string) =>
    setCategories((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const save = async (patch: ThemeDetailsPatch) => {
    setSaving(true);
    try {
      await storefrontApi.themes.updateDetails(theme._id, { ...patch, reason: reason.trim() || undefined });
      toast.success('Theme details saved');
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // Send only what changed; an empty field clears its override (null).
  const submit = () => {
    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    const patch: ThemeDetailsPatch = {};
    if (name.trim() !== (theme.name ?? '')) patch.name = name.trim() || null;
    if (description.trim() !== (theme.description ?? '')) patch.description = description.trim() || null;
    if (previewImage.trim() !== (theme.previewImage ?? '')) patch.previewImage = previewImage.trim() || null;
    if (!same(categories, theme.categories ?? [])) patch.categories = categories.length ? categories : null;
    if (!same(tagList, theme.tags ?? [])) patch.tags = tagList.length ? tagList : null;
    if (Object.keys(patch).length === 0) { toast.info('Nothing changed'); return; }
    void save(patch);
  };

  const resetAll = () => void save({ name: null, description: null, previewImage: null, categories: null, tags: null });

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const updated = await storefrontApi.themes.uploadCover(theme._id, file);
      setPreviewImage(updated.previewImage ?? '');
      toast.success('Cover uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const Reset = ({ field }: { field: keyof typeof ov }) =>
    hasOverride(field) ? (
      <span className="ms-2 text-[11px] font-normal text-muted-foreground">(edited · manifest value restored on reset)</span>
    ) : null;

  return (
    <Modal
      open={!!theme}
      onClose={onClose}
      title={`Edit theme — ${theme.name}`}
      description="Shown to merchants in the theme library. Edits win over the theme's built manifest and survive rebuilds."
      className="max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="outline" onClick={resetAll} disabled={saving} title="Drop every console edit and use the manifest values"><RotateCcw className="h-3.5 w-3.5" /> Reset to manifest</Button>
          <Button onClick={submit} loading={saving}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>Cover image</Label>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="aspect-[16/10] w-full shrink-0 overflow-hidden rounded-md border bg-muted sm:w-40">
              {previewImage ? <img src={previewImage} alt="" className="h-full w-full object-cover object-top" /> : null}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <Input value={previewImage} onChange={(e) => setPreviewImage(e.target.value)} placeholder="https://… or leave empty for the built screenshot" dir="ltr" />
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
              <Button type="button" variant="outline" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}><Upload className="h-3.5 w-3.5" /> Upload image</Button>
              <p className="text-xs text-muted-foreground">JPEG, PNG or WebP. Landscape (16:10) looks best.<Reset field="previewImage" /></p>
            </div>
          </div>
        </div>
        <div>
          <Label>Name<Reset field="name" /></Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </div>
        <div>
          <Label>Description<Reset field="description" /></Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={1000} />
        </div>
        <div>
          <Label>Categories<Reset field="categories" /></Label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {categoryOptions.map((c) => {
              const on = categories.includes(c.key);
              return (
                <button key={c.key} type="button" onClick={() => toggleCategory(c.key)} aria-pressed={on}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${on ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}>
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <Label>Tags<Reset field="tags" /></Label>
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma, separated" />
        </div>
        <div>
          <Label>Reason <span className="font-normal text-muted-foreground">(audit log, optional)</span></Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </div>
      </div>
    </Modal>
  );
}
