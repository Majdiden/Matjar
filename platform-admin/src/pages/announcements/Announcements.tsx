import { useCallback, useEffect, useMemo, useState } from 'react';
import { Megaphone, RefreshCw, Send, Bell, Mail, Smartphone, Search, X, AlertTriangle } from 'lucide-react';
import {
  announcementsApi,
  type Announcement,
  type AnnouncementTarget,
  type Audience,
  type TextPair,
} from '../../lib/api-announcements';
import { api, type TenantListRow } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import { Input, Textarea, Label } from '../../components/ui/Input';
import { Toggle } from '../../components/ui/Toggle';
import { DataList, type DataListColumn } from '../../components/ui/DataList';
import { PageSpinner, ErrorState, EmptyState } from '../../components/ui/Spinner';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useToast } from '../../components/ui/toast-context';
import { formatDate, formatRelative } from '../../lib/utils';

const TITLE_MAX = 120;
const BODY_MAX = 2000;
const HISTORY_POLL_MS = 3000;
const EMPTY: TextPair = { ar: '', en: '' };

const errorText = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
  (err instanceof Error ? err.message : fallback);

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const pct = (part: number, whole: number) => `${Math.round((100 * part) / Math.max(whole, 1))}%`;

/** Who a sent message went to, for the history. */
function toLabel(r: Announcement): string {
  if (r.target === 'all') return 'All stores';
  const names = r.tenantNames.length ? r.tenantNames : r.tenantName ? [r.tenantName] : [];
  const count = r.storeCount ?? names.length;
  if (count <= 2 && names.length === count) return names.join(', ') || 'One store';
  return `${names.slice(0, 2).join(', ')} +${count - Math.min(2, names.length)} more`;
}

/**
 * Notify stores (PBI 10-46): write a message once in English and Arabic,
 * send it to every store or one store, as an app notification (notifications
 * page, live popup, phone / desktop notification — like a new order) and/or
 * an email. Before sending, the page shows how many people, devices and
 * inboxes each channel reaches with the stores' own switches applied.
 */
export default function Announcements() {
  const toast = useToast();

  // ── Compose ──────────────────────────────────────────────
  const [scope, setScope] = useState<'all' | 'picked'>('all');
  const [picked, setPicked] = useState<TenantListRow[]>([]);
  const [title, setTitle] = useState<TextPair>(EMPTY);
  const [body, setBody] = useState<TextPair>(EMPTY);
  const [link, setLink] = useState('');
  const [channels, setChannels] = useState({ app: true, email: false });
  const [confirming, setConfirming] = useState(false);

  const target: AnnouncementTarget | null = useMemo(
    () => (scope === 'all' ? { target: 'all' } : picked.length ? { target: 'tenants', tenantIds: picked.map((p) => p._id) } : null),
    [scope, picked],
  );

  // ── Reach for the chosen target ──────────────────────────
  const [audience, setAudience] = useState<Audience | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  useEffect(() => {
    if (!target) {
      setAudience(null);
      return;
    }
    let live = true;
    setAudienceLoading(true);
    announcementsApi
      .audience(target)
      .then((a) => live && setAudience(a))
      .catch(() => live && setAudience(null))
      .finally(() => live && setAudienceLoading(false));
    return () => {
      live = false;
    };
  }, [target]);

  // ── History ──────────────────────────────────────────────
  const [rows, setRows] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      setRows((await announcementsApi.list()).announcements);
    } catch (err) {
      setError(errorText(err, 'Failed to load announcements'));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  // Follow deliveries still in progress.
  const sending = rows.some((r) => r.status === 'sending');
  useEffect(() => {
    if (!sending) return;
    const id = window.setInterval(() => void load(true), HISTORY_POLL_MS);
    return () => window.clearInterval(id);
  }, [sending, load]);

  // ── Validation ───────────────────────────────────────────
  const linkValid = !link.trim() || /^\/dashboard(\/[\w\-./?=&%]*)?$/.test(link.trim());
  const problems = [
    !target && 'Pick at least one store',
    !title.ar.trim() && !title.en.trim() && 'Write a title',
    !body.ar.trim() && !body.en.trim() && 'Write the message',
    !channels.app && !channels.email && 'Pick at least one channel',
    !linkValid && 'The link must be a dashboard path such as /dashboard/products',
  ].filter(Boolean) as string[];
  const oneLanguageOnly =
    (title.ar.trim() || body.ar.trim()) && (title.en.trim() || body.en.trim())
      ? null
      : title.ar.trim() || body.ar.trim()
        ? 'English'
        : title.en.trim() || body.en.trim()
          ? 'Arabic'
          : null;

  const send = async () => {
    if (!target) return;
    await announcementsApi.send({
      ...target,
      title,
      body,
      link: link.trim() || null,
      channels,
    });
    toast.success('Sending — follow the delivery in the history below');
    setTitle(EMPTY);
    setBody(EMPTY);
    setLink('');
    void load(true);
  };

  const whoLabel =
    scope === 'all'
      ? `all ${audience ? plural(audience.stores, 'store', 'stores') : 'stores'}`
      : picked.length === 1
        ? picked[0].name
        : plural(picked.length, 'store', 'stores');

  const columns: DataListColumn<Announcement>[] = [
    {
      id: 'message',
      header: 'Message',
      primary: true,
      cell: (r) => (
        <div className="min-w-0">
          <div className="font-medium">{r.title.en || r.title.ar}</div>
          {r.title.en && r.title.ar && (
            <div dir="rtl" className="text-sm text-muted-foreground">
              {r.title.ar}
            </div>
          )}
          <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{r.body.en || r.body.ar}</div>
        </div>
      ),
    },
    {
      id: 'to',
      header: 'To',
      cell: (r) => <span className="text-sm">{toLabel(r)}</span>,
    },
    {
      id: 'channels',
      header: 'Channels',
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.channels.app && <Badge variant="secondary">App</Badge>}
          {r.channels.email && <Badge variant="secondary">Email</Badge>}
        </div>
      ),
    },
    {
      id: 'reach',
      header: 'Delivered',
      cell: (r) => (
        <div className="text-xs leading-relaxed">
          <div>{plural(r.delivered.stores, 'store', 'stores')} of {r.audience.stores}</div>
          {r.channels.app && (
            <div className="text-muted-foreground">
              App: {plural(r.audience.recipients, 'person', 'people')}, {plural(r.audience.devices, 'device', 'devices')}
            </div>
          )}
          {r.channels.email && (
            <div className="text-muted-foreground">
              Email: {r.delivered.email} of {r.audience.email}
            </div>
          )}
          {r.delivered.failed > 0 && <div className="text-red-600">{r.delivered.failed} failed</div>}
        </div>
      ),
    },
    {
      id: 'opened',
      header: 'Opened',
      cell: (r) => (
        <div className="text-xs leading-relaxed">
          {r.channels.app && (
            <div title="People who read the notification on the notifications page or by tapping it on their phone / computer">
              App: {plural(r.engagement.appReadPeople, 'person', 'people')}
              {r.audience.recipients > 0 && <span className="text-muted-foreground"> ({pct(r.engagement.appReadPeople, r.audience.recipients)})</span>}
            </div>
          )}
          {r.channels.email && (
            <>
              <div title="Estimate: counted when the email's images load. Some mail apps block images, others load them for every email.">
                Email opened: {r.engagement.emailOpened}
                {r.delivered.email > 0 && <span className="text-muted-foreground"> ({pct(r.engagement.emailOpened, r.delivered.email)})</span>}
              </div>
              <div className="text-muted-foreground">Clicked: {r.engagement.emailClicked}</div>
            </>
          )}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (r) => (
        <Badge variant={r.status === 'sent' ? 'success' : r.status === 'failed' ? 'destructive' : 'warning'}>
          {r.status === 'sent' ? 'Sent' : r.status === 'failed' ? 'Failed' : 'Sending…'}
        </Badge>
      ),
    },
    {
      id: 'when',
      header: 'Sent',
      cell: (r) => (
        <div className="text-xs text-muted-foreground" title={formatDate(r.createdAt)}>
          {formatRelative(r.createdAt)}
          {r.createdByEmail && <div className="truncate">{r.createdByEmail}</div>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Megaphone className="mt-1 h-6 w-6 shrink-0 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Notify stores</h1>
            <p className="text-sm text-muted-foreground">
              Send a message to every store or to the stores you choose. Each person gets it on the channels you
              pick that they have not switched off in their notification settings.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader>
            <CardTitle>New message</CardTitle>
            <CardDescription>Write it in both languages; each store reads its own language.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Who */}
            <div className="space-y-2">
              <Label>Send to</Label>
              <div className="flex flex-wrap gap-2">
                {(['all', 'picked'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setScope(v)}
                    aria-pressed={scope === v}
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                      scope === v ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-border hover:bg-muted'
                    }`}
                  >
                    {v === 'all' ? 'All stores' : 'Chosen stores'}
                  </button>
                ))}
              </div>
              {scope === 'picked' && <StorePicker value={picked} onChange={setPicked} />}
            </div>

            {/* What */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="title-en">Title (English)</Label>
                <Input id="title-en" maxLength={TITLE_MAX} value={title.en} onChange={(e) => setTitle({ ...title, en: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="title-ar">Title (Arabic)</Label>
                <Input id="title-ar" dir="rtl" maxLength={TITLE_MAX} value={title.ar} onChange={(e) => setTitle({ ...title, ar: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="body-en">Message (English)</Label>
                <Textarea id="body-en" rows={5} maxLength={BODY_MAX} value={body.en} onChange={(e) => setBody({ ...body, en: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="body-ar">Message (Arabic)</Label>
                <Textarea id="body-ar" dir="rtl" rows={5} maxLength={BODY_MAX} value={body.ar} onChange={(e) => setBody({ ...body, ar: e.target.value })} />
              </div>
            </div>
            {oneLanguageOnly && (
              <p className="text-xs text-amber-700">
                No {oneLanguageOnly} text: stores in {oneLanguageOnly} will get the other language.
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="link">Opens (optional)</Label>
              <Input
                id="link"
                dir="ltr"
                placeholder="/dashboard/products"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                aria-invalid={!linkValid}
              />
              <p className="text-xs text-muted-foreground">
                A page in the merchant's dashboard. Empty: the notification opens their notifications page.
              </p>
            </div>

            {/* How */}
            <div className="space-y-2">
              <Label>Channels</Label>
              <ChannelRow
                icon={Bell}
                title="App notification"
                text="Notifications page, popup in an open dashboard, and a phone / desktop notification — like a new order."
                checked={channels.app}
                onChange={(app) => setChannels({ ...channels, app })}
                reach={
                  audience &&
                  `${plural(audience.app, 'person', 'people')} · ${plural(audience.devices, 'phone / computer', 'phones / computers')} with notifications on`
                }
                warning={audience && channels.app && !audience.pushReady ? 'Push is not set up on this server: only the notifications page and popup.' : null}
              />
              <ChannelRow
                icon={Mail}
                title="Email"
                text="A formatted email message in the store's language."
                checked={channels.email}
                onChange={(email) => setChannels({ ...channels, email })}
                reach={audience && `${plural(audience.email, 'inbox', 'inboxes')}`}
                warning={audience && channels.email && !audience.emailReady ? 'Email is not set up on this server: no email will be sent.' : null}
              />
              {audienceLoading && <p className="text-xs text-muted-foreground">Checking who this reaches…</p>}
            </div>

            {problems.length > 0 && <p className="text-xs text-muted-foreground">{problems[0]}.</p>}
            <div className="flex justify-end">
              <Button onClick={() => setConfirming(true)} disabled={problems.length > 0}>
                <Send className="h-4 w-4" /> Send
              </Button>
            </div>
          </CardContent>
        </Card>

        <Preview title={title} body={body} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sent</CardTitle>
          <CardDescription>The last 50 messages: what reached the stores and who opened them.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <PageSpinner />
          ) : error ? (
            <ErrorState error={error} onRetry={() => load()} />
          ) : rows.length === 0 ? (
            <EmptyState title="Nothing sent yet" description="Messages you send appear here." />
          ) : (
            <DataList columns={columns} rows={rows} rowKey={(r) => r.id} />
          )}
        </CardContent>
      </Card>

      <ConfirmModal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Send to ${whoLabel}?`}
        description={
          <span>
            {[channels.app && 'App notification', channels.email && 'Email'].filter(Boolean).join(' and ')}. This can't be
            taken back.
          </span>
        }
        confirmLabel="Send"
        onConfirm={async () => {
          try {
            await send();
            setConfirming(false);
          } catch (err) {
            toast.error(errorText(err, 'Could not send'));
          }
        }}
      />
    </div>
  );
}

function ChannelRow({
  icon: Icon,
  title,
  text,
  checked,
  onChange,
  reach,
  warning,
}: {
  icon: React.ElementType;
  title: string;
  text: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  reach: string | null | false;
  warning: string | null | false;
}) {
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 ${checked ? 'border-indigo-200 bg-indigo-50/40' : ''}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{text}</div>
        {reach && <div className="mt-1 text-xs font-medium text-indigo-700">Reaches {reach}</div>}
        {warning && (
          <div className="mt-1 flex items-center gap-1 text-xs text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" /> {warning}
          </div>
        )}
      </div>
      <Toggle checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

/** Store search: type a name or link, add stores one by one. */
function StorePicker({ value, onChange }: { value: TenantListRow[]; onChange: (t: TenantListRow[]) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<TenantListRow[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const id = window.setTimeout(() => {
      api.tenants
        .list({ q: q.trim(), limit: 8 }, { signal: ctrl.signal })
        .then((r) => setResults(r.tenants))
        .catch(() => {});
    }, 250);
    return () => {
      window.clearTimeout(id);
      ctrl.abort();
    };
  }, [q]);

  const chosen = new Set(value.map((t) => t._id));
  const add = (t: TenantListRow) => {
    if (!chosen.has(t._id)) onChange([...value, t]);
    setQ('');
  };
  const remove = (id: string) => onChange(value.filter((t) => t._id !== id));

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((t) => (
            <span key={t._id} className="inline-flex max-w-full items-center gap-1 rounded-full border bg-muted/50 py-1 pe-1 ps-3 text-sm">
              <span className="truncate">{t.name}</span>
              <button type="button" onClick={() => remove(t._id)} aria-label={`Remove ${t.name}`} className="rounded-full p-0.5 hover:bg-muted">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          {value.length > 1 && (
            <button type="button" onClick={() => onChange([])} className="text-xs text-muted-foreground underline">
              Clear all
            </button>
          )}
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="ps-9"
          placeholder={value.length ? 'Add another store' : 'Search stores by name, link or email'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {results.length > 0 && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-background shadow-lg">
            {results.map((t) => (
              <button
                key={t._id}
                type="button"
                onClick={() => add(t)}
                disabled={chosen.has(t._id)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start hover:bg-muted disabled:opacity-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{t.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{t.domains?.primary || t.slug}</span>
                </span>
                {chosen.has(t._id) && <span className="text-xs text-muted-foreground">Added</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** How the message looks as a phone notification and an email, in both languages. */
function Preview({ title, body }: { title: TextPair; body: TextPair }) {
  const langs = (['ar', 'en'] as const).filter((l) => title[l].trim() || body[l].trim());
  return (
    <Card className="h-fit lg:sticky lg:top-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="h-4 w-4" /> Preview
        </CardTitle>
        <CardDescription>Phone notification and email.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {langs.length === 0 && <p className="text-sm text-muted-foreground">Start writing to see it.</p>}
        {langs.map((l) => {
          const other = l === 'ar' ? 'en' : 'ar';
          const t = title[l].trim() || title[other].trim();
          const b = body[l].trim() || body[other].trim();
          return (
            <div key={l} dir={l === 'ar' ? 'rtl' : 'ltr'} className="space-y-2">
              <div className="flex gap-3 rounded-2xl bg-slate-100 p-3 shadow-sm">
                <img src="/dashboard/pwa-192x192.png" alt="" className="h-9 w-9 shrink-0 rounded-lg bg-white" />
                <div className="min-w-0 text-start">
                  <div className="text-[11px] text-slate-500">Matjar</div>
                  <div className="truncate text-sm font-semibold">{t}</div>
                  <div className="line-clamp-2 text-xs text-slate-700">{b}</div>
                </div>
              </div>
              <div className="rounded-lg border bg-white p-3 text-start">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Matjar</div>
                <div className="mt-1 text-sm font-bold">{t}</div>
                <div className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-700">{b}</div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
