import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Label } from '../../components/ui/label';
import { Skeleton } from '../../components/ui/skeleton';
import { Switch } from '../../components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../../components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import {
  Webhook, Plus, MoreHorizontal, Edit, Trash2, Loader2, Save,
  CheckCircle, XCircle, RefreshCw, Copy,
} from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { useConfirm } from '../../components/ui/use-confirm';

interface WebhookEndpoint {
  _id: string;
  url: string;
  events: string[];
  secret: string;
  enabled: boolean;
  description?: string;
  lastDelivery?: { status: number; timestamp: string; success: boolean };
  createdAt: string;
}

interface WebhooksListResponse {
  webhooks?: WebhookEndpoint[];
}

const errMsg = (err: unknown, fallback: string): string => {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  if (typeof err === 'string') return err;
  return fallback;
};

const AVAILABLE_EVENTS = [
  { group: 'Orders', events: ['order.created', 'order.updated', 'order.cancelled', 'order.fulfilled', 'order.refunded'] },
  { group: 'Products', events: ['product.created', 'product.updated', 'product.deleted'] },
  { group: 'Customers', events: ['customer.created', 'customer.updated'] },
  { group: 'Inventory', events: ['inventory.low_stock', 'inventory.updated'] },
  { group: 'Payments', events: ['payment.succeeded', 'payment.failed', 'payment.refunded'] },
  { group: 'Themes', events: ['theme.published', 'theme.installed'] },
];

export const Webhooks: React.FC = () => {
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookEndpoint | null>(null);
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  const [formData, setFormData] = useState({
    url: '',
    description: '',
    events: [] as string[],
    enabled: true,
  });

  useEffect(() => { loadWebhooks(); }, []);

  const loadWebhooks = async () => {
    try {
      setLoading(true);
      const response = await api.get<WebhooksListResponse>('/webhooks') as {
        data?: WebhooksListResponse;
        responseObject?: WebhooksListResponse;
      };
      setWebhooks(response.responseObject?.webhooks || response.data?.webhooks || []);
    } catch {
      setWebhooks([]);
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditingWebhook(null);
    setFormData({ url: '', description: '', events: [], enabled: true });
    setDialogOpen(true);
  };

  const openEditDialog = (webhook: WebhookEndpoint) => {
    setEditingWebhook(webhook);
    setFormData({
      url: webhook.url,
      description: webhook.description || '',
      events: [...webhook.events],
      enabled: webhook.enabled,
    });
    setDialogOpen(true);
  };

  const toggleEvent = (event: string) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event],
    }));
  };

  const toggleGroupEvents = (events: string[]) => {
    const allSelected = events.every(e => formData.events.includes(e));
    setFormData(prev => ({
      ...prev,
      events: allSelected
        ? prev.events.filter(e => !events.includes(e))
        : [...new Set([...prev.events, ...events])],
    }));
  };

  const handleSave = async () => {
    if (!formData.url.trim()) { toast.error('URL is required'); return; }
    if (formData.events.length === 0) { toast.error('Select at least one event'); return; }
    try {
      setSaving(true);
      if (editingWebhook) {
        await api.put(`/webhooks/${editingWebhook._id}`, formData);
        toast.success('Webhook updated');
      } else {
        await api.post('/webhooks', formData);
        toast.success('Webhook created');
      }
      setDialogOpen(false);
      await loadWebhooks();
    } catch (err) {
      toast.error(errMsg(err, 'Failed to save webhook'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (webhook: WebhookEndpoint) => {
    try {
      await api.patch(`/webhooks/${webhook._id}`, { enabled: !webhook.enabled });
      setWebhooks(prev => prev.map(w => w._id === webhook._id ? { ...w, enabled: !w.enabled } : w));
      toast.success(webhook.enabled ? 'Webhook disabled' : 'Webhook enabled');
    } catch (err) {
      toast.error(errMsg(err, 'Failed to toggle webhook'));
    }
  };

  const handleDelete = async (webhook: WebhookEndpoint) => {
    if (!(await confirm({
      title: 'Delete webhook?',
      description: `The endpoint ${webhook.url} will stop receiving events.`,
      confirmText: 'Delete',
      variant: 'destructive',
    }))) return;
    try {
      await api.delete(`/webhooks/${webhook._id}`);
      toast.success('Webhook deleted');
      await loadWebhooks();
    } catch (err) {
      toast.error(errMsg(err, 'Failed to delete webhook'));
    }
  };

  const handleTest = async (webhook: WebhookEndpoint) => {
    try {
      await api.post(`/webhooks/${webhook._id}/test`);
      toast.success('Test event sent');
      await loadWebhooks();
    } catch (err) {
      toast.error(errMsg(err, 'Test failed'));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Webhooks</h1>
          <p className="text-muted-foreground">Configure event notifications to external services</p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Webhook
        </Button>
      </div>

      {webhooks.length === 0 ? (
        <Card>
          <CardContent className="p-12">
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Webhook className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No webhooks configured</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                Set up webhooks to receive real-time notifications when events happen in your store
              </p>
              <Button onClick={openAddDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Webhook
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Last Delivery</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map(webhook => (
                  <TableRow key={webhook._id}>
                    <TableCell>
                      <div>
                        <p className="font-mono text-sm truncate max-w-xs">{webhook.url}</p>
                        {webhook.description && (
                          <p className="text-xs text-muted-foreground">{webhook.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {webhook.events.slice(0, 3).map(e => (
                          <Badge key={e} variant="secondary" className="text-[10px]">{e}</Badge>
                        ))}
                        {webhook.events.length > 3 && (
                          <Badge variant="outline" className="text-[10px]">+{webhook.events.length - 3}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {webhook.lastDelivery ? (
                        <div className="flex items-center gap-1.5">
                          {webhook.lastDelivery.success ? (
                            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-destructive" />
                          )}
                          <span className="text-xs">
                            {webhook.lastDelivery.status} - {new Date(webhook.lastDelivery.timestamp).toLocaleString()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={webhook.enabled}
                        onCheckedChange={() => handleToggle(webhook)}
                      />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(webhook)}>
                            <Edit className="h-4 w-4 mr-2" />Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleTest(webhook)}>
                            <RefreshCw className="h-4 w-4 mr-2" />Send Test
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => { navigator.clipboard.writeText(webhook.secret); toast.success('Secret copied'); }}
                          >
                            <Copy className="h-4 w-4 mr-2" />Copy Secret
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(webhook)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Webhook Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingWebhook ? 'Edit Webhook' : 'Create Webhook'}</DialogTitle>
            <DialogDescription>
              Configure an endpoint to receive event notifications
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Endpoint URL</Label>
              <Input
                type="url"
                placeholder="https://example.com/webhooks"
                value={formData.url}
                onChange={e => setFormData(prev => ({ ...prev, url: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                placeholder="What does this webhook do?"
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.enabled}
                onCheckedChange={enabled => setFormData(prev => ({ ...prev, enabled }))}
              />
              <Label>Enabled</Label>
            </div>

            <div className="space-y-3">
              <Label>Events ({formData.events.length} selected)</Label>
              {AVAILABLE_EVENTS.map(group => {
                const allSelected = group.events.every(e => formData.events.includes(e));
                return (
                  <Card key={group.group}>
                    <CardHeader className="py-2 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">{group.group}</CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-6"
                          onClick={() => toggleGroupEvents(group.events)}
                        >
                          {allSelected ? 'Deselect all' : 'Select all'}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 pt-0">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {group.events.map(event => (
                          <label key={event} className="flex items-center gap-2 text-sm cursor-pointer">
                            <Switch
                              checked={formData.events.includes(event)}
                              onCheckedChange={() => toggleEvent(event)}
                              className="scale-75"
                            />
                            <code className="text-xs">{event}</code>
                          </label>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : <><Save className="h-4 w-4 mr-2" />Save</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Webhooks;
