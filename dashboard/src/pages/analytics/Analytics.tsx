import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis,
} from 'recharts';
import { getTenantCurrency, getTenantLocale, formatDate } from '../../lib/format';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from '../../components/ui/chart';
import { StatCard } from '../../components/StatCard';
import { StatCardRow } from '../../components/StatCardRow';
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
  const { t, i18n } = useTranslation(['analytics']);
  // recharts lays cartesian axes left-to-right; under RTL we reverse the
  // x-axis and flip the y-axis to the start (right) edge so the series
  // reads newest-on-the-left like the rest of the Arabic UI.
  const isRTL = i18n.dir() === 'rtl';
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

  // Compact currency/number for axis ticks (e.g. "SDG 1.2K") — keeps the
  // axis legible when values run large, in the tenant's locale.
  const formatCompactCurrency = (v: number) => {
    try {
      return new Intl.NumberFormat(getTenantLocale(), {
        style: 'currency', currency: getTenantCurrency(),
        notation: 'compact', maximumFractionDigits: 1,
      }).format(v);
    } catch {
      return formatCurrency(v);
    }
  };
  const formatCompactNumber = (v: number) =>
    new Intl.NumberFormat(getTenantLocale(), { notation: 'compact', maximumFractionDigits: 1 }).format(v);
  // Short axis-tick date in the tenant locale (no raw toLocaleDateString).
  const formatAxisDate = (d: string) =>
    new Intl.DateTimeFormat(getTenantLocale(), { month: 'short', day: 'numeric' }).format(new Date(d));

  const revenueConfig = {
    revenue: { label: t('analytics.series.revenue'), color: 'hsl(var(--primary))' },
  } satisfies ChartConfig;
  const ordersConfig = {
    orders: { label: t('analytics.series.orders'), color: '#1baf7a' },
  } satisfies ChartConfig;

  // Icons render muted-foreground via StatCard — no ad-hoc per-stat
  // colouring (audit 3.8.7).
  const statCards = [
    { label: t('analytics.metric.total_revenue'), value: formatCurrency(stats?.totalRevenue || 0), icon: DollarSign },
    { label: t('analytics.metric.total_orders'), value: (stats?.totalOrders || 0).toLocaleString(), icon: ShoppingCart },
    { label: t('analytics.metric.avg_order_value'), value: formatCurrency(stats?.averageOrderValue || 0), icon: TrendingUp },
    { label: t('analytics.metric.total_products'), value: (stats?.totalProducts || 0).toLocaleString(), icon: Package },
  ];

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
          <h1 className="text-2xl font-semibold tracking-tight">{t('analytics.title')}</h1>
          <p className="text-muted-foreground">{t('analytics.subtitle')}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              {t(`analytics.range.${period as typeof PERIOD_VALUES[number]}`)}
              <ChevronDown className="h-4 w-4 ms-2" />
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

      {/* Stat Cards — horizontal snap-scroll on phones, grid on desktop */}
      <StatCardRow className="sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map(card => (
          <StatCard key={card.label} label={card.label} value={card.value} icon={card.icon} />
        ))}
      </StatCardRow>

      {/* Revenue over time — area chart (chart kit / recharts) */}
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
            <ChartContainer config={revenueConfig} className="h-64 w-full">
              <AreaChart accessibilityLayer data={salesData} margin={{ left: 8, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  reversed={isRTL}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                  tickFormatter={formatAxisDate}
                />
                <YAxis
                  orientation={isRTL ? 'right' : 'left'}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(v) => formatCompactCurrency(Number(v))}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(v) => formatDate(v as string, 'medium')}
                      formatter={(value) => formatCurrency(Number(value))}
                    />
                  }
                />
                <Area
                  dataKey="revenue"
                  type="monotone"
                  fill="url(#fillRevenue)"
                  stroke="var(--color-revenue)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Orders over time — bar chart. Separate chart (not a dual axis)
          because order counts and revenue live on different scales. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />{t('analytics.chart.orders_over_time.title')}
          </CardTitle>
          <CardDescription>
            {t(`analytics.range.${period as typeof PERIOD_VALUES[number]}`)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {salesData.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">{t('analytics.empty.no_sales')}</div>
          ) : (
            <ChartContainer config={ordersConfig} className="h-64 w-full">
              <BarChart accessibilityLayer data={salesData} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  reversed={isRTL}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                  tickFormatter={formatAxisDate}
                />
                <YAxis
                  orientation={isRTL ? 'right' : 'left'}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  allowDecimals={false}
                  tickFormatter={(v) => formatCompactNumber(Number(v))}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(v) => formatDate(v as string, 'medium')}
                      formatter={(value) =>
                        new Intl.NumberFormat(getTenantLocale()).format(Number(value))
                      }
                    />
                  }
                />
                <Bar dataKey="orders" fill="var(--color-orders)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
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
                  <TableHead className="text-end">{t('analytics.column.units_sold')}</TableHead>
                  <TableHead className="text-end">{t('analytics.column.revenue')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.map((product, i) => (
                  <TableRow key={product._id}>
                    <TableCell className="text-muted-foreground font-medium">{i + 1}</TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-end">
                      <Badge variant="secondary">{product.totalSold}</Badge>
                    </TableCell>
                    <TableCell className="text-end font-medium">
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
