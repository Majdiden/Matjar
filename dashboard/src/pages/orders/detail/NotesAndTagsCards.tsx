import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Tag as TagIcon, Pin, StickyNote, X, Trash2, Loader2 } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { toast } from 'sonner';
import type { Order } from '../../../types';
import { formatDateTime } from '../../../lib/format';
import { useConfirm } from '../../../components/ui/use-confirm';
import { useOrderDetail } from './context';

// ── Internal notes & tags ─────────────────────────────────────
// Sidebar pair: the Tags card followed by the staff-only Internal Notes
// card. Both mutate the order via api and swap in the returned document.
export const NotesAndTagsCards: React.FC = () => {
  const { t } = useTranslation(['orders', 'common']);
  const confirm = useConfirm();
  const { order, setOrder, canWriteOrders } = useOrderDetail();

  const [noteDraft, setNoteDraft] = useState('');
  const [notePinned, setNotePinned] = useState(false);
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [tagSubmitting, setTagSubmitting] = useState(false);
  const [tagBusy, setTagBusy] = useState<string | null>(null);
  const [noteBusy, setNoteBusy] = useState<string | null>(null);

  const handleAddNote = async () => {
    if (!order) return;
    const body = noteDraft.trim();
    if (!body) {
      toast.error(t('orders:validation.note_empty'));
      return;
    }
    if (body.length > 2000) {
      toast.error(t('orders:validation.note_too_long'));
      return;
    }
    try {
      setNoteSubmitting(true);
      const res = await api.orders.addNote(order._id, body, notePinned) as { responseObject?: Order };
      setOrder(res?.responseObject || order);
      setNoteDraft('');
      setNotePinned(false);
      toast.success(t('orders:toast.note_added'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:toast.note_add_failed'));
    } finally {
      setNoteSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!order) return;
    const ok = await confirm({
      title: t('orders:dialog.delete_note.title'),
      description: t('orders:dialog.delete_note.description'),
      confirmText: t('orders:dialog.delete_note.confirm'),
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      setNoteBusy(noteId);
      const res = await api.orders.deleteNote(order._id, noteId) as { responseObject?: Order };
      setOrder(res?.responseObject || order);
      toast.success(t('orders:toast.note_deleted'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:toast.note_delete_failed'));
    } finally {
      setNoteBusy(null);
    }
  };

  const handleAddTag = async () => {
    if (!order) return;
    const tag = tagDraft.trim();
    if (!tag) {
      toast.error(t('orders:validation.tag_empty'));
      return;
    }
    if (tag.length > 32) {
      toast.error(t('orders:validation.tag_too_long'));
      return;
    }
    try {
      setTagSubmitting(true);
      const res = await api.orders.addTags(order._id, [tag]) as { responseObject?: Order };
      setOrder(res?.responseObject || order);
      setTagDraft('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:toast.tag_add_failed'));
    } finally {
      setTagSubmitting(false);
    }
  };

  const handleRemoveTag = async (tag: string) => {
    if (!order) return;
    try {
      setTagBusy(tag);
      const res = await api.orders.removeTag(order._id, tag) as { responseObject?: Order };
      setOrder(res?.responseObject || order);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : null;
      toast.error(msg || t('orders:toast.tag_remove_failed'));
    } finally {
      setTagBusy(null);
    }
  };

  return (
    <>
      {/* Tags Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TagIcon className="h-5 w-5" />{t('orders:detail.section.tags.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(order.tags && order.tags.length > 0) ? (
              order.tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
                >
                  {t}
                  {canWriteOrders && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      disabled={tagBusy === t}
                      className="ms-0.5 rounded-full p-0.5 hover:bg-background/60 disabled:opacity-50"
                      aria-label={`Remove tag ${t}`}
                    >
                      {tagBusy === t ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                    </button>
                  )}
                </span>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">{t('orders:detail.tags.none')}</p>
            )}
          </div>
          {canWriteOrders && (
            <div className="flex gap-2">
              <Input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                placeholder={t('orders:detail.tags.add_placeholder')}
                maxLength={32}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !tagSubmitting) {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                className="h-8 text-sm"
              />
              <Button
                size="sm"
                onClick={handleAddTag}
                disabled={tagSubmitting || !tagDraft.trim()}
              >
                {tagSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('orders:detail.tags.add')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Internal Notes Card — staff-only */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <StickyNote className="h-5 w-5" />{t('orders:detail.section.notes.title')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('orders:detail.section.notes.subtitle')}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {canWriteOrders && (
            <div className="space-y-2">
              <Textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder={t('orders:detail.notes.add_placeholder')}
                maxLength={2000}
                rows={3}
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={notePinned}
                    onChange={(e) => setNotePinned(e.target.checked)}
                    className="h-3.5 w-3.5"
                  />
                  {t('orders:detail.notes.pin_to_top')}
                </label>
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={noteSubmitting || !noteDraft.trim()}
                >
                  {noteSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('orders:detail.notes.add_button')}
                </Button>
              </div>
            </div>
          )}
          <div className="space-y-2">
            {(() => {
              const visible = (order.internalNotes || []).filter((n) => !n.deletedAt);
              if (visible.length === 0) {
                return (
                  <p className="text-xs text-muted-foreground">{t('orders:detail.notes.none')}</p>
                );
              }
              const sorted = [...visible].sort((a, b) => {
                if (Boolean(b.pinned) !== Boolean(a.pinned)) {
                  return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
                }
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              });
              return sorted.map((n) => (
                <div
                  key={n._id}
                  className="rounded-md border p-2.5 text-sm space-y-1 bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {n.pinned && <Pin className="h-3 w-3 text-amber-500" />}
                      <span className="font-medium text-foreground">
                        {n.createdByName || t('orders:detail.notes.staff')}
                      </span>
                      <span>·</span>
                      <span>{formatDateTime(n.createdAt)}</span>
                    </div>
                    {canWriteOrders && (
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(n._id)}
                        disabled={noteBusy === n._id}
                        className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                        aria-label={t('orders:detail.notes.delete_note_aria')}
                      >
                        {noteBusy === n._id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap break-words">{n.body}</p>
                </div>
              ));
            })()}
          </div>
        </CardContent>
      </Card>
    </>
  );
};
