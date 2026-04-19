import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getTenantCurrency, getTenantLocale } from '../../lib/format';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import {
  DollarSign, ShoppingCart, TrendingUp, Package, ChevronDown, BarChart3,
} from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';

interface Stats {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  totalProducts: number;
}

interface SalesPoint { date: string; revenue: number; orders: number; }
interface TopProduct { _id: string; name: string; totalSold: number; totalRevenue: number; }

const PERIOD_VALUES = ['7', '30', '90', '365'] as const;

export default function Analytics() {
  const { t } = useTranslation(['analytics']);
  const [stats, setStats] = useState<Stats | null>(null);
  const [salesData, setSalesData] = useState<SalesPoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - parseInt(period) * 86400000).toISOString();

      try {
        const [statsRes, salesRes, productsRes] = await Promise.allSettled([
          api.analytics.getStats(startDate, endDate),
          api.analytics.getSalesOverTime(startDate, endDate),
          api.analytics.getTopProducts(10),
        ]);

        if (statsRes.status === 'fulfilled') {
          const d = statsRes.value as { data?: Partial<Stats>; responseObject?: Partial<Stats> };
          setStats((d.data || d.responseObject || {}) as Stats);
        }
        if (salesRes.status === 'fulfilled') {
          const d = salesRes.value as {
            data?: { salesData?: SalesPoint[] };
            responseObject?: { salesData?: SalesPoint[] };
          };
          setSalesData(d.data?.salesData || d.responseObject?.salesData || []);
        }
        if (productsRes.status === 'fulfilled') {
          const d = productsRes.value as {
            data?: { products?: TopProduct[] };
            responseObject?: { products?: TopProduct[] };
          };
          setTopProducts(d.data?.products || d.responseObject?.products || []);
        }
      } catch {
        toast.error(t('analytics.toast.load_failed'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [period, t]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat(getTenantLocale(), { style: 'currency', currency: getTenantCurrency() }).format(v);

  const statCards = [
    { label: t('analytics.metric.total_revenue'), value: formatCurrency(stats?.totalRevenue || 0), icon: DollarSign, color: 'text-green-600' },
    { label: t('analytics.metric.total_orders'), value: (stats?.totalOrders || 0).toLocaleString(), icon: ShoppingCart, color: 'text-blue-600' },
    { label: t('analytics.metric.avg_order_value'), value: formatCurrency(stats?.averageOrderValue || 0), icon: TrendingUp, color: 'text-purple-600' },
    { label: t('analytics.metric.total_products'), value: (stats?.totalProducts || 0).toLocaleString(), icon: Package, color: 'text-orange-600' },
  ];

  const maxRevenue = Math.max(...salesData.map(d => d.revenue), 1);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('analytics.title')}</h1>
          <p className="text-muted-foreground">{t('analytics.subtitle')}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              {t(`analytics.range.${period as typeof PERIOD_VALUES[number]}`)}
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {PERIOD_VALUES.map(p => (
              <DropdownMenuItem key={p} onClick={() => setPeriod(p)}>
                {t(`analytics.range.${p}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(card => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />{t('analytics.chart.revenue_over_time.title')}
          </CardTitle>
          <CardDescription>
            {t(`analytics.range.${period as typeof PERIOD_VALUES[number]}`)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {salesData.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">{t('analytics.empty.no_sales')}</div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-end gap-[2px] h-48">
                {salesData.map((point, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center" title={
                    `${new Date(point.date).toLocaleDateString()}: ${formatCurrency(point.revenue)} (${point.orders} orders)`
                  }>
                    <div
                      className="w-full bg-primary/80 rounded-t hover:bg-primary transition-colors min-h-[2px]"
                      style={{ height: `${(point.revenue / maxRevenue) * 100}%` }}
                    />
                  </div>
                ))}
              </div>
              {salesData.length <= 31 && (
                <div className="flex gap-[2px]">
                  {salesData.map((point, i) => {
                    const show = i === 0 || i === salesData.length - 1 || i % Math.ceil(salesData.length / 7) === 0;
                    return (
                      <div key={i} className="flex-1 text-center">
                        {show && (
                          <span className="text-[9px] text-muted-foreground">
                            {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('analytics.chart.top_products.title')}</CardTitle>
          <CardDescription>{t('analytics.chart.top_products.description')}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {topProducts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">{t('analytics.empty.no_products')}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">{t('analytics.column.rank')}</TableHead>
                  <TableHead>{t('analytics.column.product')}</TableHead>
                  <TableHead className="text-right">{t('analytics.column.units_sold')}</TableHead>
                  <TableHead className="text-right">{t('analytics.column.revenue')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.map((product, i) => (
                  <TableRow key={product._id}>
                    <TableCell className="text-muted-foreground font-medium">{i + 1}</TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{product.totalSold}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(product.totalRevenue || 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
