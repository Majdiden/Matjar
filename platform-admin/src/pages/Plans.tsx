import { useCallback, useEffect, useState } from 'react';
import {
  api,
  hasScope,
  PLATFORM_SCOPES,
  type SubscriptionPlan,
  type PlanInput,
} from '../lib/api';
import { useAuth } from '../contexts/auth-context';
import { Button } from '../components/ui/Button';
import { Input, Label, Textarea, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { Table, THead, TBody, TR, TH, TD } from '../components/ui/Table';
import { PageSpinner, ErrorState, EmptyState } from '../components/ui/Spinner';
import { ConfirmModal } from '../components/ConfirmModal';
import { useToast } from '../components/ui/toast-context';
import { RefreshCw, Plus, Pencil, Trash2 } from 'lucide-react';

export default function Plans() {
  const toast = useToast();
  const { user } = useAuth();
  // Mutations are gated on tenant.lifecycle (the platform write scope);
  // the server enforces, this just hides affordances.
  const canWrite = hasScope(user, PLATFORM_SCOPES.TENANT_LIFECYCLE);

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<SubscriptionPlan | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<SubscriptionPlan | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPlans(await api.plans.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const fmtPrice = (p: SubscriptionPlan) =>
    p.price > 0 ? `${p.currency} ${p.price.toLocaleString()}/${p.interval}` : 'Free';

  const fmtLimit = (v?: number | null) => (v == null ? '∞' : v.toLocaleString());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plans</h1>
          <p className="text-sm text-muted-foreground">
            Subscription plan catalog. Tenants are assigned to a plan by its key.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {canWrite && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5" /> New plan
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : loading && plans.length === 0 ? (
        <PageSpinner />
      ) : plans.length === 0 ? (
        <EmptyState
          title="No plans yet"
          description="Create a plan, or run `node scripts/seed-plans.js` to seed the defaults."
          action={
            canWrite ? (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="h-3.5 w-3.5" /> New plan
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <THead>
              <TR>
                <TH>Plan</TH>
                <TH>Key</TH>
                <TH>Price</TH>
                <TH>Limits</TH>
                <TH>Features</TH>
                <TH>Status</TH>
                {canWrite && <TH className="text-right">Actions</TH>}
              </TR>
            </THead>
            <TBody>
              {plans.map((p) => (
                <TR key={p._id}>
                  <TD>
                    <div className="font-medium">{p.name}</div>
                    {p.description && (
                      <div className="max-w-xs truncate text-xs text-muted-foreground">
                        {p.description}
                      </div>
                    )}
                  </TD>
                  <TD>
                    <code className="text-xs">{p.key}</code>
                  </TD>
                  <TD className="whitespace-nowrap text-sm">{fmtPrice(p)}</TD>
                  <TD className="whitespace-nowrap text-xs text-muted-foreground">
                    {fmtLimit(p.limits?.maxProducts)} products · {fmtLimit(p.limits?.maxStaff)} staff
                  </TD>
                  <TD className="text-xs text-muted-foreground">
                    {p.features?.length ? `${p.features.length} feature(s)` : '—'}
                  </TD>
                  <TD>
                    {p.isActive ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </TD>
                  {canWrite && (
                    <TD className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(p)}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleting(p)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      </div>
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      <PlanFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={async () => {
          setCreating(false);
          await load();
        }}
      />
      <PlanFormModal
        open={!!editing}
        plan={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await load();
        }}
      />

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete plan "${deleting?.name ?? ''}"`}
        description="This removes the plan from the catalog. Blocked if any tenant is currently on it."
        confirmLabel="Delete plan"
        confirmVariant="destructive"
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await api.plans.remove(deleting._id);
            toast.success('Plan deleted');
            setDeleting(null);
            await load();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Delete failed');
            throw err;
          }
        }}
      />
    </div>
  );
}

// --- Create / edit form ------------------------------------------------

const PlanFormModal: React.FC<{
  open: boolean;
  plan?: SubscriptionPlan | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}> = ({ open, plan, onClose, onSaved }) => {
  const toast = useToast();
  const isEdit = !!plan;

  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0');
  const [currency, setCurrency] = useState('SDG');
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [features, setFeatures] = useState('');
  const [maxProducts, setMaxProducts] = useState('');
  const [maxStaff, setMaxStaff] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form whenever it (re)opens or the target plan changes.
  useEffect(() => {
    if (!open) return;
    setKey(plan?.key ?? '');
    setName(plan?.name ?? '');
    setDescription(plan?.description ?? '');
    setPrice(String(plan?.price ?? 0));
    setCurrency(plan?.currency ?? 'SDG');
    setInterval(plan?.interval ?? 'month');
    setFeatures((plan?.features ?? []).join('\n'));
    setMaxProducts(plan?.limits?.maxProducts != null ? String(plan.limits.maxProducts) : '');
    setMaxStaff(plan?.limits?.maxStaff != null ? String(plan.limits.maxStaff) : '');
    setSortOrder(String(plan?.sortOrder ?? 0));
    setIsActive(plan?.isActive ?? true);
    setError(null);
    setSaving(false);
  }, [open, plan]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: PlanInput = {
        name: name.trim(),
        description: description.trim(),
        price: Number(price) || 0,
        currency: currency.trim().toUpperCase(),
        interval,
        features: features
          .split('\n')
          .map((f) => f.trim())
          .filter(Boolean),
        limits: {
          maxProducts: maxProducts === '' ? null : Number(maxProducts),
          maxStaff: maxStaff === '' ? null : Number(maxStaff),
        },
        sortOrder: Number(sortOrder) || 0,
        isActive,
      };
      if (isEdit && plan) {
        await api.plans.update(plan._id, payload);
        toast.success('Plan updated');
      } else {
        await api.plans.create({ ...payload, key: key.trim().toLowerCase() });
        toast.success('Plan created');
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title={isEdit ? `Edit plan` : 'New plan'}
      description={isEdit ? `Editing "${plan?.name}" (key is immutable).` : 'Create a subscription plan.'}
      className="max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} disabled={!name.trim() || (!isEdit && !key.trim())}>
            {isEdit ? 'Save changes' : 'Create plan'}
          </Button>
        </>
      }
    >
      <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="plan-key">
              Key <span className="text-destructive">*</span>
            </Label>
            <Input
              id="plan-key"
              value={key}
              disabled={isEdit}
              onChange={(e) => setKey(e.target.value)}
              placeholder="starter"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="plan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Starter"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="plan-desc">Description</Label>
          <Textarea
            id="plan-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short summary shown in the catalog."
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="plan-price">Price</Label>
            <Input
              id="plan-price"
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-currency">Currency</Label>
            <Input
              id="plan-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="SDG"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-interval">Interval</Label>
            <Select
              id="plan-interval"
              value={interval}
              onChange={(e) => setInterval(e.target.value as 'month' | 'year')}
            >
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="plan-maxproducts">Max products</Label>
            <Input
              id="plan-maxproducts"
              type="number"
              min={0}
              value={maxProducts}
              onChange={(e) => setMaxProducts(e.target.value)}
              placeholder="∞"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-maxstaff">Max staff</Label>
            <Input
              id="plan-maxstaff"
              type="number"
              min={0}
              value={maxStaff}
              onChange={(e) => setMaxStaff(e.target.value)}
              placeholder="∞"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-sort">Sort order</Label>
            <Input
              id="plan-sort"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="plan-features">Features (one per line)</Label>
          <Textarea
            id="plan-features"
            value={features}
            onChange={(e) => setFeatures(e.target.value)}
            placeholder={'Up to 500 products\n3 staff accounts'}
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          Active (selectable / shown as available)
        </label>
      </div>
    </Modal>
  );
};
