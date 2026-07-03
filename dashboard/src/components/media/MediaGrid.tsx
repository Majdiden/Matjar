/**
 * MediaGrid (audit 6.6 — media library core).
 *
 * Shared grid used by both the full-page MediaLibrary and the MediaPicker
 * dialog. Handles: paginated load, search, preset filter, upload dropzone,
 * alt-text editing, copy-URL, and delete (with a "may be referenced"
 * warning — usage tracking is out of scope). In `select` mode a click on
 * an asset returns it to the caller instead of opening the manage actions.
 *
 * RTL-safe: logical properties (ms/me/ps/pe/text-start) throughout.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Upload, Search, Trash2, Copy, Check, Loader2, ImageIcon, Pencil,
} from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { useConfirm } from '../ui/use-confirm';

export interface MediaAsset {
  _id: string;
  url: string;
  alt?: string;
  filename?: string;
  preset: string;
  width?: number | null;
  height?: number | null;
  bytes?: number;
  createdAt?: string;
}

const PRESET_FILTERS = ['all', 'content', 'product', 'category', 'logo', 'favicon', 'avatar'] as const;

interface MediaGridProps {
  /** 'manage' = library page (delete/alt/copy). 'select' = picker. */
  mode: 'manage' | 'select';
  /** Called in select mode when the merchant picks an asset. */
  onSelect?: (asset: MediaAsset) => void;
}

export const MediaGrid: React.FC<MediaGridProps> = ({ mode, onSelect }) => {
  const { t } = useTranslation(['media', 'common']);
  const confirm = useConfirm();

  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [preset, setPreset] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingAltId, setEditingAltId] = useState<string | null>(null);
  const [altDraft, setAltDraft] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = (await api.assets.list({
        limit: 60,
        preset: preset === 'all' ? undefined : preset,
        search: search.trim() || undefined,
      })) as { data?: { assets?: MediaAsset[] } };
      setAssets(res?.data?.assets || []);
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [preset, search]);

  // Debounce search; reload immediately on preset change.
  useEffect(() => {
    const id = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(id);
  }, [load, search]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      setUploading(true);
      const uploaded: MediaAsset[] = [];
      for (const file of Array.from(files)) {
        const res = (await api.upload.contentImage(file)) as { data?: MediaAsset };
        if (res?.data?.url) uploaded.push(res.data);
      }
      if (uploaded.length) {
        toast.success(t('media:toast.uploaded', { count: uploaded.length }));
        // Prepend so the just-uploaded assets are immediately visible.
        setAssets((prev) => [...uploaded, ...prev]);
      }
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || t('media:toast.error_upload'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const copyUrl = async (asset: MediaAsset) => {
    try {
      const abs = new URL(asset.url, window.location.origin).toString();
      await navigator.clipboard.writeText(abs);
      setCopiedId(asset._id);
      setTimeout(() => setCopiedId((c) => (c === asset._id ? null : c)), 1500);
    } catch {
      toast.error(t('media:toast.error_copy'));
    }
  };

  const handleDelete = async (asset: MediaAsset) => {
    if (!(await confirm({
      title: t('media:confirm.delete_title'),
      description: t('media:confirm.delete_description'),
      confirmText: t('common:action.delete'),
      variant: 'destructive',
    }))) return;
    try {
      await api.upload.deleteImage(asset.url);
      toast.success(t('media:toast.deleted'));
      setAssets((prev) => prev.filter((a) => a._id !== asset._id));
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || t('media:toast.error_delete'));
    }
  };

  const startEditAlt = (asset: MediaAsset) => {
    setEditingAltId(asset._id);
    setAltDraft(asset.alt || '');
  };

  const saveAlt = async (asset: MediaAsset) => {
    try {
      await api.assets.updateAlt(asset._id, altDraft);
      setAssets((prev) => prev.map((a) => (a._id === asset._id ? { ...a, alt: altDraft } : a)));
      setEditingAltId(null);
      toast.success(t('media:toast.alt_saved'));
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || t('media:toast.error_alt'));
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar: search + preset filter + upload */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('media:search_placeholder')}
            className="ps-8"
          />
        </div>
        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          aria-label={t('media:filter.label')}
        >
          {PRESET_FILTERS.map((p) => (
            <option key={p} value={p}>{t(`media:filter.${p}`)}</option>
          ))}
        </select>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading
            ? <><Loader2 className="h-4 w-4 me-2 animate-spin" />{t('media:uploading')}</>
            : <><Upload className="h-4 w-4 me-2" />{t('media:action.upload')}</>}
        </Button>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        className="rounded-lg border-2 border-dashed border-input p-6 text-center text-sm text-muted-foreground cursor-pointer hover:bg-muted/40 transition"
      >
        {t('media:dropzone')}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-square" />)}
        </div>
      ) : assets.length === 0 ? (
        <div className="flex flex-col items-center text-center py-12">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-3">
            <ImageIcon className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground max-w-xs">{t('media:empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {assets.map((asset) => (
            <div
              key={asset._id}
              className={cn(
                'group relative rounded-lg overflow-hidden border border-border bg-muted',
                mode === 'select' && 'cursor-pointer hover:ring-2 hover:ring-primary',
              )}
              onClick={mode === 'select' ? () => onSelect?.(asset) : undefined}
            >
              <div className="aspect-square">
                <img src={asset.url} alt={asset.alt || asset.filename || ''} className="w-full h-full object-cover" loading="lazy" />
              </div>
              <Badge variant="secondary" className="absolute top-1.5 start-1.5 text-[10px]">
                {asset.preset}
              </Badge>

              {mode === 'manage' && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-start justify-end p-1.5 gap-1 opacity-0 group-hover:opacity-100">
                  <Button size="icon" variant="secondary" className="h-7 w-7" title={t('media:action.copy')} onClick={() => copyUrl(asset)}>
                    {copiedId === asset._id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="icon" variant="secondary" className="h-7 w-7" title={t('media:action.edit_alt')} onClick={() => startEditAlt(asset)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="destructive" className="h-7 w-7" title={t('common:action.delete')} onClick={() => handleDelete(asset)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {/* Alt editor overlay */}
              {editingAltId === asset._id ? (
                <div className="absolute inset-x-0 bottom-0 bg-background/95 p-1.5 space-y-1" onClick={(e) => e.stopPropagation()}>
                  <Input
                    value={altDraft}
                    onChange={(e) => setAltDraft(e.target.value)}
                    placeholder={t('media:alt_placeholder')}
                    className="h-7 text-xs"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') saveAlt(asset); if (e.key === 'Escape') setEditingAltId(null); }}
                  />
                  <div className="flex gap-1">
                    <Button size="sm" className="h-6 text-[11px] flex-1" onClick={() => saveAlt(asset)}>{t('common:action.save')}</Button>
                    <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => setEditingAltId(null)}>{t('common:action.cancel')}</Button>
                  </div>
                </div>
              ) : (
                asset.alt && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1 text-[10px] text-white truncate">
                    {asset.alt}
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )}

      {mode === 'manage' && assets.length > 0 && (
        <p className="text-xs text-muted-foreground">{t('media:delete_warning')}</p>
      )}
    </div>
  );
};

export default MediaGrid;
