import { useState } from 'react';
import { incidentsApi, INCIDENT_SEVERITIES, SEVERITY_LABEL, type Incident, type IncidentSeverity } from '../../lib/api-incidents';
import { Button } from '../../components/ui/Button';
import { Input, Label, Select, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/toast-context';
import { OBJECT_ID } from '../../lib/list-helpers';

function nowLocal(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

/** Open a new incident. Owner defaults to the current operator on the server when omitted. */
export function IncidentFormModal({ onClose, onCreated }: { onClose: () => void; onCreated: (i: Incident) => void }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('sev3');
  const [startedAt, setStartedAt] = useState(nowLocal());
  const [services, setServices] = useState('');
  const [tenantIds, setTenantIds] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const parsedTenantIds = tenantIds.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  const badTenantIds = parsedTenantIds.filter((id) => !OBJECT_ID.test(id));
  const parsedServices = services.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);

  const submit = async () => {
    if (title.trim().length < 3 || badTenantIds.length) return;
    setSaving(true);
    try {
      const inc = await incidentsApi.create({
        title: title.trim(),
        severity,
        startedAt: new Date(startedAt).toISOString(),
        affectedServices: parsedServices,
        affectedTenantIds: parsedTenantIds,
        note: note.trim() || undefined,
      });
      toast.success('Incident opened');
      onCreated(inc);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open incident');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Open incident"
      description="Creates an internal incident record with you as the first timeline author."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} loading={saving} disabled={title.trim().length < 3 || badTenantIds.length > 0}>Open incident</Button>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="space-y-1">
          <Label htmlFor="inc-title">Title</Label>
          <Input id="inc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Checkout failing for COD orders" maxLength={200} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="inc-severity">Severity</Label>
            <Select id="inc-severity" value={severity} onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}>
              {INCIDENT_SEVERITIES.map((s) => (
                <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="inc-started">Started at</Label>
            <Input id="inc-started" type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="inc-services">Affected services (comma separated)</Label>
          <Input id="inc-services" value={services} onChange={(e) => setServices(e.target.value)} placeholder="checkout, payments, storefront" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="inc-tenants">Affected tenant ids (optional, comma or newline separated)</Label>
          <Textarea id="inc-tenants" value={tenantIds} onChange={(e) => setTenantIds(e.target.value)} className="min-h-[60px] font-mono text-xs" />
          {badTenantIds.length > 0 && <p className="text-xs text-destructive">Invalid id: {badTenantIds[0]}</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="inc-note">First update (optional)</Label>
          <Textarea id="inc-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What we know so far." />
        </div>
      </div>
    </Modal>
  );
}
