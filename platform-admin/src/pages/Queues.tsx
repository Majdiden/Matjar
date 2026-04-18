import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, QUEUES, hasScope, PLATFORM_SCOPES, type QueueName } from '../lib/api';
import { useAuth } from '../contexts/auth-context';
import { Button } from '../components/ui/Button';
import { Table, THead, TBody, TR, TH, TD } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { PageSpinner, EmptyState, ErrorState } from '../components/ui/Spinner';
import { useToast } from '../components/ui/toast-context';
import { formatDate, shortId } from '../lib/utils';
import { RefreshCw, RotateCcw, Eye } from 'lucide-react';

interface FailedJob {
  id: string | number;
  name: string;
  attemptsMade: number;
  failedReason?: string;
  data?: unknown;
  timestamp: number;
  finishedOn?: number;
}

export default function Queues() {
  const toast = useToast();
  const { user } = useAuth();
  const canRetry = hasScope(user, PLATFORM_SCOPES.QUEUE_RETRY);
  const [searchParams, setSearchParams] = useSearchParams();
  const queue = (searchParams.get('queue') as QueueName) || QUEUES[0];

  const [jobs, setJobs] = useState<FailedJob[]>([]);
  const [queueStats, setQueueStats] = useState<
    Array<{
      name: string;
      error?: string;
      counts: Partial<
        Record<'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused', number>
      >;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<FailedJob | null>(null);
  const [retrying, setRetrying] = useState<Record<string, boolean>>({});
  const [confirmJob, setConfirmJob] = useState<FailedJob | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, stats] = await Promise.all([
        api.queues.listFailed(queue, 0, 100),
        api.queues.stats().catch(() => []),
      ]);
      setJobs(data);
      setQueueStats(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [queue]);

  useEffect(() => {
    load();
  }, [load]);

  const setQueue = (q: QueueName) => {
    const next = new URLSearchParams(searchParams);
    next.set('queue', q);
    setSearchParams(next, { replace: true });
  };

  const retry = async (jobId: string | number) => {
    setRetrying((prev) => ({ ...prev, [String(jobId)]: true }));
    try {
      await api.queues.retry(queue, jobId);
      toast.success(`Job ${jobId} re-enqueued`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setRetrying((prev) => {
        const next = { ...prev };
        delete next[String(jobId)];
        return next;
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Queues</h1>
          <p className="text-sm text-muted-foreground">
            Inspect failed BullMQ jobs and retry them. Retries re-enter the queue and go through
            the worker's normal attempt + backoff pipeline.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {QUEUES.map((q) => {
          const s = queueStats.find((x) => x.name === q);
          const counts = s?.counts || {};
          const failed = counts.failed || 0;
          const active = q === queue;
          const hasError = !!s?.error;
          return (
            <button
              key={q}
              onClick={() => setQueue(q)}
              className={`rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent ${
                active ? 'ring-2 ring-primary' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="truncate text-xs font-medium">{q}</span>
                {failed > 0 && (
                  <Badge variant="destructive" className="text-[10px]">
                    {failed} failed
                  </Badge>
                )}
              </div>
              {hasError ? (
                <div className="mt-2 text-[11px] text-destructive">unavailable</div>
              ) : (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span>wait {counts.waiting ?? 0}</span>
                  <span>act {counts.active ?? 0}</span>
                  <span>delay {counts.delayed ?? 0}</span>
                  {counts.paused ? <span>paused</span> : null}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Viewing failed jobs for</span>
        <Badge variant="outline">{queue}</Badge>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : loading ? (
        <PageSpinner />
      ) : jobs.length === 0 ? (
        <EmptyState title="No failed jobs" description={`Queue "${queue}" has no failures.`} />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <THead>
              <TR>
                <TH>Job</TH>
                <TH>Name</TH>
                <TH>Attempts</TH>
                <TH>Reason</TH>
                <TH>Enqueued</TH>
                <TH>Failed</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {jobs.map((j) => (
                <TR key={String(j.id)}>
                  <TD className="font-mono text-xs">{String(j.id)}</TD>
                  <TD>
                    <Badge variant="outline">{j.name}</Badge>
                  </TD>
                  <TD className="text-xs">{j.attemptsMade}</TD>
                  <TD
                    className="max-w-[320px] truncate text-xs text-destructive/90"
                    title={j.failedReason || ''}
                  >
                    {j.failedReason || '—'}
                  </TD>
                  <TD className="text-xs text-muted-foreground">
                    {j.timestamp ? formatDate(new Date(j.timestamp)) : '—'}
                  </TD>
                  <TD className="text-xs text-muted-foreground">
                    {j.finishedOn ? formatDate(new Date(j.finishedOn)) : '—'}
                  </TD>
                  <TD className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setSelected(j)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    {canRetry && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmJob(j)}
                        loading={!!retrying[String(j.id)]}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Retry
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`Job ${selected?.id ? shortId(String(selected.id)) : ''}`}
        description={selected?.name}
        className="max-w-3xl"
      >
        {selected && (
          <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(selected, null, 2)}
          </pre>
        )}
      </Modal>

      <Modal
        open={!!confirmJob}
        onClose={() => setConfirmJob(null)}
        title={`Retry job ${confirmJob?.id ? shortId(String(confirmJob.id)) : ''}?`}
        description={`Queue: ${queue} • ${confirmJob?.name || ''}`}
        className="max-w-3xl"
      >
        {confirmJob && (
          <div className="space-y-3">
            <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-900 dark:text-yellow-200">
              Retrying re-enqueues the job. Side effects (emails, payments,
              tenant-lifecycle changes) will fire again. Review the payload below
              before confirming. Sensitive fields are already redacted by the
              server.
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Payload</div>
              <pre className="max-h-[40vh] overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(confirmJob.data ?? null, null, 2)}
              </pre>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmJob(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  const job = confirmJob;
                  setConfirmJob(null);
                  await retry(job.id);
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Confirm retry
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
