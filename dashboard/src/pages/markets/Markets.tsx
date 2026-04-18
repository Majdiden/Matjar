import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Skeleton } from '../../components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../../components/ui/dialog';
import { MapPin, Plus, Pencil, Trash2, Globe2 } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { useConfirm } from '../../components/ui/use-confirm';

interface Market {
  _id: string;
  name: string;
  countries: string[];
  currency: string;
  priceAdjustment?: number;
  taxBehavior?: string;
  catalogMode?: string;
  isActive?: boolean;
  createdAt: string;
}

export const Markets: React.FC = () => {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMarket, setEditingMarket] = useState<Market | null>(null);
  const [form, setForm] = useState({ name: '', countries: '', currency: 'SDG', priceAdjustment: 0 });
  const [saving, setSaving] = useState(false);
  const confirm = useConfirm();

  useEffect(() => { loadMarkets(); }, []);

  const loadMarkets = async () => {
    try {
      setLoading(true);
      const res = (await api.markets.getAll()) as {
        responseObject?: { markets?: Market[] } | Market[];
        data?: { markets?: Market[] };
      };
      const ro = res.responseObject;
      const list: Market[] = Array.isArray(ro)
        ? ro
        : ro?.markets || res.data?.markets || [];
      setMarkets(list);
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || 'Failed to load markets');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingMarket(null);
    setForm({ name: '', countries: '', currency: 'SDG', priceAdjustment: 0 });
    setDialogOpen(true);
  };

  const openEdit = (market: Market) => {
    setEditingMarket(market);
    setForm({
      name: market.name,
      countries: market.countries.join(', '),
      currency: market.currency,
      priceAdjustment: market.priceAdjustment || 0,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.countries) {
      toast.error('Name and countries are required');
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: form.name,
        countries: form.countries.split(',').map(c => c.trim()).filter(Boolean),
        currency: form.currency,
        priceAdjustment: Number(form.priceAdjustment) || 0,
      };
      if (editingMarket) {
        await api.markets.update(editingMarket._id, data);
        toast.success('Market updated');
      } else {
        await api.markets.create(data);
        toast.success('Market created');
      }
      setDialogOpen(false);
      loadMarkets();
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || 'Failed to save market');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm({
      title: 'Delete market?',
      description: 'Customers in this market\'s countries will fall back to your default market.',
      confirmText: 'Delete',
      variant: 'destructive',
    }))) return;
    try {
      await api.markets.delete(id);
      toast.success('Market deleted');
      setMarkets(prev => prev.filter(m => m._id !== id));
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || 'Failed to delete market');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Markets</h1>
          <p className="text-muted-foreground">Manage geographic markets, currencies, and pricing adjustments</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Market
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingMarket ? 'Edit Market' : 'Create Market'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Market Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="North America" />
              </div>
              <div className="space-y-2">
                <Label>Countries (comma-separated ISO codes)</Label>
                <Input value={form.countries} onChange={e => setForm(f => ({ ...f, countries: e.target.value }))} placeholder="US, CA, MX" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} placeholder="USD" />
                </div>
                <div className="space-y-2">
                  <Label>Price Adjustment (%)</Label>
                  <Input type="number" value={form.priceAdjustment} onChange={e => setForm(f => ({ ...f, priceAdjustment: Number(e.target.value) }))} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editingMarket ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : markets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Globe2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No markets configured</h3>
            <p className="text-sm text-muted-foreground mb-4">Create markets to target different geographic regions.</p>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Market
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {markets.map(market => (
            <Card key={market._id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{market.name}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(market)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(market._id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1">
                  {market.countries.map(c => (
                    <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                  ))}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Currency</span>
                  <span className="font-medium">{market.currency}</span>
                </div>
                {market.priceAdjustment !== 0 && market.priceAdjustment != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Price Adjustment</span>
                    <span className="font-medium">{market.priceAdjustment > 0 ? '+' : ''}{market.priceAdjustment}%</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
