import { useState } from 'react';
import {
  bulkApi,
  bulkDeleteConfirmationPhrase,
  BULK_DELETE_MAX_TENANTS,
  type BulkResponse,
} from '../lib/api-bulk';
import type { TenantListRow } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input, Label, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/toast-context';

/**
 * Permanently delete the selected stores. Separate from the reversible bulk
 * actions on purpose: its own scope (tenant.delete), a typed "delete N
 * stores" phrase, a reason and the operator's password. Shows the outcome per
 * store so a partial failure is never silent.
 */
export function TenantsBulkDeleteModal({ open, selected, onClose, onDone }: {
  open: boolean;
  selected: TenantListRow[];
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [phrase, setPhrase] = useState('');
  const [password, setPassword] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkResponse | null>(null);

  const expected = bulkDeleteConfirmationPhrase(selected.length);
  const tooMany = selected.length > BULK_DELETE_MAX_TENANTS;
  const live = selected.filter((t) => t.lifecycle?.state !== 'archived' && t.lifecycle?.state !== 'closed');
  const canRun =
    !tooMany && reason.trim().length >= 4 && phrase.trim().toLowerCase() === expected && password.length > 0;

  const reset = () => {
    setReason('');
    setPhrase('');
    setPassword('');
    setError(null);
    setResult(null);
  };

  const close = () => {
    if (running) return;
    const hadResult = !!result;
    reset();
    onClose();
    if (hadResult) onDone();
  };

  const run = async () => {
    if (!canRun) return;
    setRunning(true);
    setError(null);
    try {
      const r = await bulkApi.deletePermanently({
        tenantIds: selected.map((t) => t._id),
        reason: reason.trim(),
        confirmation: phrase.trim().toLowerCase(),
        password,
      });
      setPassword('');
      setResult(r);
      if (r.summary.failed === 0) toast.success(`${r.summary.ok} store${r.summary.ok === 1 ? '' : 's'} permanently deleted`);
      else toast.error(`${r.summary.failed} of ${r.summary.total} could not be deleted`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deletion failed');
    } finally {
      setRunning(false);
    }
  };

  const nameOf = (id: string) => selected.find((t) => t._id === id)?.name || id;

  return (
    <Modal
      open={open}
      onClose={close}
      title={result ? 'Permanent deletion result' : `Delete ${selected.length} store${selected.length === 1 ? '' : 's'} permanently`}
      description={
        result
          ? `${result.summary.ok} deleted · ${result.summary.failed} failed`
          : "Deletes each store and everything in it: products, customers, pages, settings, staff logins, uploaded images and its web address. This cannot be undone. Orders and payments are kept as financial records, along with the platform audit log and billing records."
      }
      footer={
        result ? (
          <Button onClick={close}>Done</Button>
        ) : (
          <>
            <Button variant="outline" onClick={close} disabled={running}>Cancel</Button>
            <Button variant="destructive" onClick={run} loading={running} disabled={!canRun}>
              Delete {selected.length} permanently
            </Button>
          </>
        )
      }
    >
      {result ? (
        <ul className="max-h-[50vh] space-y-1 overflow-y-auto text-sm">
          {result.results.map((r) => (
            <li key={r.tenantId} className="flex items-start justify-between gap-2 rounded border px-2 py-1">
              <span className="min-w-0 truncate">{nameOf(r.tenantId)}</span>
              {r.ok ? (
                <span className="shrink-0 text-xs text-emerald-600">deleted</span>
              ) : (
                <span className="shrink-0 text-end text-xs text-destructive">{r.error || 'failed'}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-3 text-sm">
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-destructive">{error}</div>
          )}
          {tooMany && (
            <p className="text-destructive">Select at most {BULK_DELETE_MAX_TENANTS} stores per permanent deletion.</p>
          )}
          {live.length > 0 && (
            <p className="font-medium text-destructive">
              {live.length} of these stores {live.length === 1 ? 'is' : 'are'} still open. Customers lose access immediately.
            </p>
          )}
          <div className="rounded-md border p-2">
            <div className="mb-1 text-xs font-medium text-muted-foreground">Stores</div>
            <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs">
              {selected.map((t) => (
                <li key={t._id} className="truncate">
                  {t.name} <span className="text-muted-foreground">· {t.slug} · {t.lifecycle?.state || '—'}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-1">
            <Label htmlFor="bulk-delete-reason">Reason</Label>
            <Textarea id="bulk-delete-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why (audit log, ≥ 4 chars)" className="min-h-[60px]" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bulk-delete-phrase">
              Type <span className="font-mono font-semibold">{expected}</span> to confirm
            </Label>
            <Input id="bulk-delete-phrase" value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bulk-delete-password">Your password</Label>
            <Input id="bulk-delete-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
        </div>
      )}
    </Modal>
  );
}
