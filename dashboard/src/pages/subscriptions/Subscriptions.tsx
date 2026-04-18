import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { Separator } from '../../components/ui/separator';
import { Progress } from '../../components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../../components/ui/dialog';
import {
  Crown, Check, Loader2, ArrowUpRight,
  Package, Users, Globe, ShoppingCart,
} from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';

interface Plan {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  limits: {
    products: number;
    orders: number;
    storage: number; // MB
    customDomains: number;
    teamMembers: number;
  };
  recommended?: boolean;
}

interface Subscription {
  plan: string;
  status: 'active' | 'trial' | 'past_due' | 'cancelled' | 'expired';
  currentPeriodEnd?: string;
  trialEndsAt?: string;
  usage: {
    products: number;
    orders: number;
    storage: number;
    teamMembers: number;
  };
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: 'month',
    features: ['Up to 10 products', '50 orders/month', '100MB storage', 'Subdomain only', 'Email support'],
    limits: { products: 10, orders: 50, storage: 100, customDomains: 0, teamMembers: 1 },
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 29,
    interval: 'month',
    features: ['Up to 100 products', '500 orders/month', '1GB storage', '1 custom domain', '2 team members', 'Basic analytics'],
    limits: { products: 100, orders: 500, storage: 1024, customDomains: 1, teamMembers: 2 },
  },
  {
    id: 'pro',
    name: 'Professional',
    price: 79,
    interval: 'month',
    recommended: true,
    features: ['Unlimited products', '5,000 orders/month', '10GB storage', '5 custom domains', '10 team members', 'Advanced analytics', 'B2B features', 'Priority support'],
    limits: { products: -1, orders: 5000, storage: 10240, customDomains: 5, teamMembers: 10 },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 299,
    interval: 'month',
    features: ['Everything in Pro', 'Unlimited orders', '100GB storage', 'Unlimited domains', 'Unlimited team', 'Custom integrations', 'Dedicated support', 'SLA guarantee'],
    limits: { products: -1, orders: -1, storage: 102400, customDomains: -1, teamMembers: -1 },
  },
];

export const Subscriptions: React.FC = () => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradeDialog, setUpgradeDialog] = useState<{ open: boolean; plan: Plan | null }>({ open: false, plan: null });
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => { loadSubscription(); }, []);

  const loadSubscription = async () => {
    try {
      setLoading(true);
      const response = (await api.get('/subscription')) as {
        responseObject?: Subscription;
        data?: Subscription;
      };
      setSubscription(response.responseObject || response.data || {
        plan: 'trial', status: 'trial', usage: { products: 0, orders: 0, storage: 0, teamMembers: 1 },
      });
    } catch {
      // Default to trial if no subscription endpoint
      setSubscription({
        plan: 'trial', status: 'trial',
        usage: { products: 0, orders: 0, storage: 0, teamMembers: 1 },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    if (!upgradeDialog.plan) return;
    try {
      setUpgrading(true);
      await api.post('/subscription/upgrade', { planId: upgradeDialog.plan.id });
      toast.success(`Upgraded to ${upgradeDialog.plan.name} plan!`);
      setUpgradeDialog({ open: false, plan: null });
      await loadSubscription();
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e?.message || 'Failed to upgrade plan');
    } finally {
      setUpgrading(false);
    }
  };

  const currentPlan = PLANS.find(p => p.id === subscription?.plan) || PLANS[0];

  const getUsagePercent = (used: number, limit: number) => {
    if (limit <= 0) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const formatLimit = (val: number) => (val < 0 ? 'Unlimited' : val.toLocaleString());

  const getStatusBadge = (status: string) => {
    const map: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      active: { variant: 'default', label: 'Active' },
      trial: { variant: 'secondary', label: 'Trial' },
      past_due: { variant: 'destructive', label: 'Past Due' },
      cancelled: { variant: 'outline', label: 'Cancelled' },
      expired: { variant: 'destructive', label: 'Expired' },
    };
    const s = map[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40" />
        <div className="grid gap-6 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-96" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Subscription & Plans</h1>
        <p className="text-muted-foreground">Manage your subscription and monitor usage limits</p>
      </div>

      {/* Current Plan */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Crown className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Current Plan: {currentPlan.name}</CardTitle>
                <CardDescription>
                  {subscription?.status === 'trial'
                    ? `Trial${subscription.trialEndsAt ? ` ends ${new Date(subscription.trialEndsAt).toLocaleDateString()}` : ''}`
                    : subscription?.currentPeriodEnd
                      ? `Renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                      : 'Active subscription'
                  }
                </CardDescription>
              </div>
            </div>
            {subscription && getStatusBadge(subscription.status)}
          </div>
        </CardHeader>
        {subscription && (
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5"><Package className="h-3.5 w-3.5" />Products</span>
                  <span>{subscription.usage.products} / {formatLimit(currentPlan.limits.products)}</span>
                </div>
                <Progress value={getUsagePercent(subscription.usage.products, currentPlan.limits.products)} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5"><ShoppingCart className="h-3.5 w-3.5" />Orders</span>
                  <span>{subscription.usage.orders} / {formatLimit(currentPlan.limits.orders)}</span>
                </div>
                <Progress value={getUsagePercent(subscription.usage.orders, currentPlan.limits.orders)} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />Storage</span>
                  <span>{subscription.usage.storage}MB / {formatLimit(currentPlan.limits.storage)}MB</span>
                </div>
                <Progress value={getUsagePercent(subscription.usage.storage, currentPlan.limits.storage)} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Team</span>
                  <span>{subscription.usage.teamMembers} / {formatLimit(currentPlan.limits.teamMembers)}</span>
                </div>
                <Progress value={getUsagePercent(subscription.usage.teamMembers, currentPlan.limits.teamMembers)} />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Plans Grid */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Available Plans</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map(plan => {
            const isCurrent = plan.id === subscription?.plan;
            return (
              <Card key={plan.id} className={plan.recommended ? 'border-primary shadow-lg relative' : ''}>
                {plan.recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary">Recommended</Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">${plan.price}</span>
                    <span className="text-sm text-muted-foreground">/{plan.interval}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>Current Plan</Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant={plan.recommended ? 'default' : 'outline'}
                      onClick={() => setUpgradeDialog({ open: true, plan })}
                    >
                      {plan.price > currentPlan.price ? 'Upgrade' : 'Switch'}
                      <ArrowUpRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Upgrade Dialog */}
      <Dialog open={upgradeDialog.open} onOpenChange={open => !open && setUpgradeDialog({ open: false, plan: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {upgradeDialog.plan && upgradeDialog.plan.price > currentPlan.price ? 'Upgrade' : 'Switch'} to {upgradeDialog.plan?.name}
            </DialogTitle>
            <DialogDescription>
              Your plan will change immediately. Billing will be prorated.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">New monthly price</span>
              <span className="font-semibold">${upgradeDialog.plan?.price}/{upgradeDialog.plan?.interval}</span>
            </div>
            <Separator />
            <p className="text-sm text-muted-foreground">
              You'll get access to all {upgradeDialog.plan?.name} features immediately.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeDialog({ open: false, plan: null })} disabled={upgrading}>
              Cancel
            </Button>
            <Button onClick={handleUpgrade} disabled={upgrading}>
              {upgrading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</> : 'Confirm Change'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Subscriptions;
