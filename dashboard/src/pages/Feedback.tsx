/**
 * Merchant → platform feedback. A simple form (type, subject, details) plus
 * the merchant's own submissions with their status and any reply. The page
 * path is captured client-side (no query string) so the platform can see
 * where the merchant was.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { api, type FeedbackItem, type FeedbackType } from '../lib/api-client';
import { formatDate } from '../lib/format';

const TYPES: FeedbackType[] = ['bug', 'feature_request', 'question', 'ux', 'other'];

function statusVariant(status: FeedbackItem['status']): React.ComponentProps<typeof Badge>['variant'] {
  if (status === 'resolved') return 'default';
  if (status === 'wont_fix') return 'outline';
  return 'secondary';
}

export const Feedback: React.FC = () => {
  const { t } = useTranslation(['feedback', 'common']);
  const [type, setType] = useState<FeedbackType>('bug');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.feedback.list({ limit: 20 });
      setItems(res.responseObject?.items ?? []);
    } catch {
      /* the list is secondary — keep the form usable */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const subjectError = touched && subject.trim().length < 3 ? t('feedback.form.error_subject') : null;
  const messageError = touched && message.trim().length < 5 ? t('feedback.form.error_message') : null;
  const canSend = subject.trim().length >= 3 && message.trim().length >= 5 && !sending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!canSend) return;
    setSending(true);
    try {
      // The server records the page from the Referer header; nothing is sent here.
      await api.feedback.submit({ type, subject: subject.trim(), message: message.trim() });
      toast.success(t('feedback.toast.sent'));
      setSubject('');
      setMessage('');
      setTouched(false);
      await load();
    } catch (err) {
      const msg = (err as { message?: string })?.message;
      toast.error(msg || t('feedback.toast.failed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t('feedback.title')} description={t('feedback.subtitle')} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" /> {t('feedback.title')}
          </CardTitle>
          <CardDescription>{t('feedback.form.page_hint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t('feedback.form.type')}</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {TYPES.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setType(k)}
                    className={`rounded-lg border px-3 py-2 text-start text-sm transition-colors ${
                      type === k ? 'border-primary bg-primary/5 font-medium' : 'hover:bg-accent'
                    }`}
                  >
                    {t(`feedback.type.${k}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fb-subject">{t('feedback.form.subject')}</Label>
              <Input
                id="fb-subject"
                value={subject}
                maxLength={200}
                placeholder={t('feedback.form.subject_placeholder')}
                aria-invalid={!!subjectError}
                onChange={(e) => setSubject(e.target.value)}
              />
              {subjectError && <p className="text-xs text-destructive">{subjectError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fb-message">{t('feedback.form.message')}</Label>
              <Textarea
                id="fb-message"
                value={message}
                maxLength={4000}
                rows={5}
                placeholder={t('feedback.form.message_placeholder')}
                aria-invalid={!!messageError}
                onChange={(e) => setMessage(e.target.value)}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{messageError && <span className="text-destructive">{messageError}</span>}</span>
                <span dir="ltr">{message.length}/4000</span>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={!canSend} className="w-full sm:w-auto">
                {sending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Send className="me-2 h-4 w-4" />}
                {sending ? t('feedback.form.sending') : t('feedback.form.submit')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('feedback.list.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('feedback.list.empty')}</p>
          ) : (
            <ul className="divide-y">
              {items.map((it) => (
                <li key={it._id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{it.subject}</span>
                    <Badge variant="outline">{t(`feedback.type.${it.type}`)}</Badge>
                    <Badge variant={statusVariant(it.status)}>{t(`feedback.status.${it.status}`)}</Badge>
                    <span className="ms-auto text-xs text-muted-foreground">
                      {t('feedback.list.sent', { date: formatDate(it.createdAt) })}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{it.message}</p>
                  {it.resolution && (
                    <div className="mt-2 rounded-md border bg-muted/40 p-2 text-sm">
                      <div className="text-xs font-medium text-muted-foreground">{t('feedback.list.resolution')}</div>
                      <div className="whitespace-pre-wrap">{it.resolution}</div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Feedback;
