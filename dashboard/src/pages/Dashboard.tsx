import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  Package, ShoppingCart, DollarSign, TrendingUp, Plus, Globe, ArrowRight,
  Users, BarChart3, ArrowUpRight,
} from 'lucide-react';
import { api } from '../lib/api-client';
import { toast } from 'sonner';
import type { Order, PaginationMeta } from '../types';
import { getTenantCurrency, getTenantLocale } from '../lib/format';

interface Stats {
  totalProducts: number;
  totalOrders: number;
  revenue: number;
  totalCustomers: number;
}

interface DashboardDomainInfo {
  activeDomain: string;
}

interface PaginatedEnvelope<K extends string, T> {
  responseObject?: {
    pagination?: PaginationMeta;
  } & Partial<Record<K, T[]>>;
}

interface AnalyticsStatsResponse {
  totalSales?: number;
}

interface DomainInfoResponse {
  data?: DashboardDomainInfo;
  responseObject?: { data?: DashboardDomainInfo };
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<Stats>({ totalProducts: 0, totalOrders: 0, revenue: 0, totalCustomers: 0 });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [domainInfo, setDomainInfo] = useState<DashboardDomainInfo | null>(null);

  useEffect(() => { loadDashboardData(); }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const [productsRes, ordersRes, domainRes, analyticsRes, customersRes] = await Promise.allSettled([
        api.products.getAll({ page: 1, limit: 1 }),
        api.orders.getAll({ page: 1, limit: 5 }),
        api.domains.getInfo(),
        api.analytics.getStats(
          new Date(Date.now() - 30 * 86400000).toISOString(),
          new Date().toISOString()
        ),
        api.customers.getAll({ page: 1, limit: 1 }),
      ]);

      const productsTotal = productsRes.status === 'fulfilled'
        ? ((productsRes.value as PaginatedEnvelope<'products', unknown>)?.responseObject?.pagination?.total || 0)
        : 0;
      const ordersData = ordersRes.status === 'fulfilled'
        ? (ordersRes.value as PaginatedEnvelope<'orders', Order>)
        : null;
      const ordersTotal = ordersData?.responseObject?.pagination?.total || 0;
      const recentOrdersList: Order[] = ordersData?.responseObject?.orders || [];
      const revenue = analyticsRes.status === 'fulfilled'
        ? ((analyticsRes.value as AnalyticsStatsResponse)?.totalSales || 0)
        : 0;
      const customersTotal = customersRes.status === 'fulfilled'
        ? ((customersRes.value as PaginatedEnvelope<'customers', unknown>)?.responseObject?.pagination?.total || 0)
        : 0;

      setStats({ totalProducts: productsTotal, totalOrders: ordersTotal, revenue, totalCustomers: customersTotal });
      setRecentOrders(recentOrdersList.slice(0, 5));
      if (domainRes.status === 'fulfilled') {
        const dr = domainRes.value as DomainInfoResponse;
        setDomainInfo(dr?.data || dr?.responseObject?.data || null);
      } else {
        setDomainInfo(null);
      }
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat(getTenantLocale(), { style: 'currency', currency: getTenantCurrency() }).format(price);

  const statCards = [
    { title: 'Revenue', value: formatPrice(stats.revenue), icon: DollarSign, description: 'Last 30 days' },
    { title: 'Orders', value: stats.totalOrders, icon: ShoppingCart, description: 'Total orders', href: '/dashboard/orders' },
    { title: 'Products', value: stats.totalProducts, icon: Package, description: 'Active products', href: '/dashboard/products' },
    { title: 'Customers', value: stats.totalCustomers, icon: Users, description: 'Registered users', href: '/dashboard/customers' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your store performance</p>
        </div>
        <Button asChild>
          <Link to="/dashboard/products/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Link>
        </Button>
      </div>

      {/* Domain banner */}
      {domainInfo && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Your store is live at</p>
                <p className="text-sm text-muted-foreground">{domainInfo.activeDomain}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/dashboard/domains">
                Manage <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          const content = (
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
              </CardContent>
            </Card>
          );
          return card.href ? (
            <Link key={card.title} to={card.href}>{content}</Link>
          ) : (
            <div key={card.title}>{content}</div>
          );
        })}
      </div>

      {/* Recent orders + quick actions */}
      <div className="grid gap-4 md:grid-cols-7">
        {/* Recent orders */}
        <Card className="md:col-span-4">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Orders</CardTitle>
              <CardDescription>Latest customer orders</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/dashboard/orders">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No orders yet</p>
            ) : (
              <div className="space-y-4">
                {recentOrders.map(order => (
                  <Link key={order._id} to={`/dashboard/orders/${order._id}`} className="flex items-center justify-between hover:bg-muted/50 -mx-2 px-2 py-2 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                        {(order.user?.name || 'G').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {order.user?.name || 'Guest'} <span className="text-muted-foreground font-normal">#{String(order.orderNumber || '').replace(/^#+/, '')}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{order.products.length} item{order.products.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatPrice(order.totalAmount)}</p>
                      <Badge variant={order.status === 'Delivered' ? 'default' : order.status === 'Cancelled' ? 'destructive' : 'secondary'} className="text-xs">
                        {order.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
            <CardDescription>Common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: 'Add Product', icon: Package, href: '/dashboard/products/new' },
              { label: 'View Orders', icon: ShoppingCart, href: '/dashboard/orders' },
              { label: 'Manage Themes', icon: BarChart3, href: '/dashboard/themes' },
              { label: 'Domain Settings', icon: Globe, href: '/dashboard/domains' },
              { label: 'Discounts', icon: TrendingUp, href: '/dashboard/marketing/discounts' },
              { label: 'Store Settings', icon: ArrowUpRight, href: '/dashboard/settings' },
            ].map(action => (
              <Button key={action.label} variant="ghost" className="w-full justify-start h-10" asChild>
                <Link to={action.href}>
                  <action.icon className="mr-3 h-4 w-4" />
                  {action.label}
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Getting started — only show if no products */}
      {stats.totalProducts === 0 && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>Set up your store in a few steps</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { step: 1, title: 'Add your first product', desc: 'Start selling by adding products', href: '/dashboard/products/new', label: 'Add Now' },
              { step: 2, title: 'Customize your theme', desc: 'Make your store look professional', href: '/dashboard/themes', label: 'Browse Themes' },
              { step: 3, title: 'Set up your domain', desc: 'Use your own domain for better branding', href: '/dashboard/domains', label: 'Configure' },
            ].map(item => (
              <div key={item.step} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold ${item.step === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {item.step}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Button size="sm" variant={item.step === 1 ? 'default' : 'outline'} asChild>
                  <Link to={item.href}>{item.label}</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
