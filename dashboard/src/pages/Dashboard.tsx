import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { StatCard } from '../components/StatCard';
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
  const { t } = useTranslation(['dashboard', 'common']);
  const [stats, setStats] = useState<Stats>({ totalProducts: 0, totalOrders: 0, revenue: 0, totalCustomers: 0 });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [domainInfo, setDomainInfo] = useState<DashboardDomainInfo | null>(null);
  const [starter, setStarter] = useState<{ hasDraftStarter?: boolean; previewUrl?: string } | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => { loadDashboardData(); }, []);

  // Draft starter-content state for the "preview & publish" banner.
  useEffect(() => {
    let active = true;
    api.storeSetup.starter()
      .then((r) => { if (active) setStarter((r as { responseObject?: { hasDraftStarter?: boolean; previewUrl?: string } }).responseObject || null); })
      .catch(() => { /* non-fatal — banner just won't show */ });
    return () => { active = false; };
  }, []);

  const publishStarter = async () => {
    setPublishing(true);
    try {
      await api.storeSetup.publishStarter();
      toast.success(t('dashboard:starter.published', { defaultValue: 'Your store is now live!' }));
      setStarter(null);
      loadDashboardData();
    } catch {
      toast.error(t('common:error.generic', { defaultValue: 'Something went wrong' }));
    } finally {
      setPublishing(false);
    }
  };

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
      toast.error(t('dashboard:toast.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat(getTenantLocale(), { style: 'currency', currency: getTenantCurrency() }).format(price);

  const statCards = [
    { title: t('dashboard:metric.revenue'), value: formatPrice(stats.revenue), icon: DollarSign, description: t('dashboard:metric.revenue_description') },
    { title: t('dashboard:metric.orders'), value: stats.totalOrders, icon: ShoppingCart, description: t('dashboard:metric.orders_description'), href: '/dashboard/orders' },
    { title: t('dashboard:metric.products'), value: stats.totalProducts, icon: Package, description: t('dashboard:metric.products_description'), href: '/dashboard/products' },
    { title: t('dashboard:metric.customers'), value: stats.totalCustomers, icon: Users, description: t('dashboard:metric.customers_description'), href: '/dashboard/customers' },
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
      {/* Draft starter content — preview the filled store, then publish it live */}
      {starter?.hasDraftStarter && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex-1">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              {t('dashboard:starter.title', { defaultValue: 'Your store has starter content in draft' })}
            </p>
            <p className="text-sm text-amber-800/80 dark:text-amber-300/80 mt-0.5">
              {t('dashboard:starter.description', { defaultValue: 'Preview your store filled with sample products and pages, then publish to take it live.' })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {starter.previewUrl && (
              <Button variant="outline" asChild>
                <a href={starter.previewUrl} target="_blank" rel="noopener noreferrer">
                  {t('dashboard:starter.preview', { defaultValue: 'Preview draft store' })}
                </a>
              </Button>
            )}
            <Button onClick={publishStarter} disabled={publishing}>
              {publishing
                ? t('dashboard:starter.publishing', { defaultValue: 'Publishing…' })
                : t('dashboard:starter.publish', { defaultValue: 'Publish store' })}
            </Button>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('dashboard:title')}</h1>
          <p className="text-muted-foreground">{t('dashboard:subtitle')}</p>
        </div>
        <Button asChild>
          <Link to="/dashboard/products/new">
            <Plus className="h-4 w-4 me-2" />
            {t('dashboard:add_product')}
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
                <p className="font-medium">{t('dashboard:domain_banner.live_at')}</p>
                <p className="text-sm text-muted-foreground">{domainInfo.activeDomain}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/dashboard/domains">
                {t('dashboard:domain_banner.manage')} <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats — shared StatCard (audit 3.8.4) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const content = (
            <StatCard label={card.title} value={card.value} icon={card.icon} description={card.description} />
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
              <CardTitle className="text-base">{t('dashboard:section.recent_orders.title')}</CardTitle>
              <CardDescription>{t('dashboard:section.recent_orders.description')}</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/dashboard/orders">{t('dashboard:section.recent_orders.view_all')}</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t('dashboard:section.recent_orders.empty')}</p>
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
                          {order.user?.name || t('dashboard:section.recent_orders.guest')} <span className="text-muted-foreground font-normal">#{String(order.orderNumber || '').replace(/^#+/, '')}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t('dashboard:section.recent_orders.item_count', { count: order.products.length })}
                        </p>
                      </div>
                    </div>
                    <div className="text-end">
                      <p className="text-sm font-medium">{formatPrice(order.totalAmount)}</p>
                      <Badge variant={order.status === 'Delivered' ? 'success' : order.status === 'Cancelled' ? 'destructive' : order.status === 'Pending' ? 'warning' : 'info'} className="text-xs">
                        {t(`common:status.${order.status}`, { defaultValue: order.status })}
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
            <CardTitle className="text-base">{t('dashboard:section.quick_actions.title')}</CardTitle>
            <CardDescription>{t('dashboard:section.quick_actions.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: t('dashboard:section.quick_actions.add_product'), icon: Package, href: '/dashboard/products/new' },
              { label: t('dashboard:section.quick_actions.view_orders'), icon: ShoppingCart, href: '/dashboard/orders' },
              { label: t('dashboard:section.quick_actions.manage_themes'), icon: BarChart3, href: '/dashboard/themes' },
              { label: t('dashboard:section.quick_actions.domain_settings'), icon: Globe, href: '/dashboard/domains' },
              { label: t('dashboard:section.quick_actions.discounts'), icon: TrendingUp, href: '/dashboard/marketing/discounts' },
              { label: t('dashboard:section.quick_actions.store_settings'), icon: ArrowUpRight, href: '/dashboard/settings' },
            ].map(action => (
              <Button key={action.label} variant="ghost" className="w-full justify-start h-10" asChild>
                <Link to={action.href}>
                  <action.icon className="me-3 h-4 w-4" />
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
            <CardTitle>{t('dashboard:section.getting_started.title')}</CardTitle>
            <CardDescription>{t('dashboard:section.getting_started.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { step: 1, title: t('dashboard:section.getting_started.step1_title'), desc: t('dashboard:section.getting_started.step1_desc'), href: '/dashboard/products/new', label: t('dashboard:section.getting_started.step1_label') },
              { step: 2, title: t('dashboard:section.getting_started.step2_title'), desc: t('dashboard:section.getting_started.step2_desc'), href: '/dashboard/themes', label: t('dashboard:section.getting_started.step2_label') },
              { step: 3, title: t('dashboard:section.getting_started.step3_title'), desc: t('dashboard:section.getting_started.step3_desc'), href: '/dashboard/domains', label: t('dashboard:section.getting_started.step3_label') },
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
