import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { StatCard, type StatCardDelta } from '../components/StatCard';
import { PageHeader } from '../components/PageHeader';
import { LiveStoreBanner, storefrontUrl } from '../components/LiveStoreBanner';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  Package, ShoppingCart, DollarSign, Plus, Globe, Users, Palette, Tag,
  Settings as SettingsIcon, CreditCard, CheckCircle2, Circle, ChevronDown,
  ChevronUp, ChevronRight, ExternalLink, X,
} from 'lucide-react';
import { api } from '../lib/api-client';
import { toast } from 'sonner';
import type { Order, PaginationMeta } from '../types';
import { getTenantCurrency, getTenantLocale } from '../lib/format';

interface DashboardDomainInfo {
  activeDomain: string;
  customDomain?: { name?: string } | null;
  registry?: Array<{ kind?: string }>;
}

interface PaginatedEnvelope<K extends string, T> {
  responseObject?: {
    pagination?: PaginationMeta;
  } & Partial<Record<K, T[]>>;
}

// GET /orders/stats (audit 5.4). Called without filters here, so the
// summary figures are all-time; the 30d pairs are fixed rolling windows.
interface OrderStats {
  totalOrders: number;
  orders30d: number;
  ordersPrev30d: number;
  revenue30d: number;
  revenuePrev30d: number;
}

const EMPTY_ORDER_STATS: OrderStats = {
  totalOrders: 0, orders30d: 0, ordersPrev30d: 0, revenue30d: 0, revenuePrev30d: 0,
};

interface DomainInfoResponse {
  data?: DashboardDomainInfo;
  responseObject?: { data?: DashboardDomainInfo } & Partial<DashboardDomainInfo>;
}

interface PaymentMethodsResponse {
  data?: { methods?: Array<{ enabled?: boolean }> };
  responseObject?: { methods?: Array<{ enabled?: boolean }> };
}

interface ThemeCustomizationResponse {
  responseObject?: {
    lastPublishedAt?: string | null;
    published?: { publishedAt?: string | null } | null;
  };
}

// "+12%" delta chip vs the previous period; hidden when there is no
// previous-period baseline to compare against. Same rule as Orders.tsx.
const pctDelta = (current: number, previous: number): StatCardDelta | undefined => {
  if (previous <= 0) return undefined;
  const pct = Math.round(((current - previous) / previous) * 100);
  return {
    label: `${pct > 0 ? '+' : ''}${pct}%`,
    trend: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral',
  };
};

// Daily point from GET /analytics/sales-over-time.
interface SalesPoint { date: string; revenue: number; orders: number }
interface SalesOverTimeResponse {
  data?: { salesData?: SalesPoint[] };
  responseObject?: { salesData?: SalesPoint[] };
}

// Daily new-count point from GET /analytics/counts-over-time.
interface CountPoint { date: string; count: number }
interface CountsOverTimeResponse {
  data?: { customers?: CountPoint[]; products?: CountPoint[] };
  responseObject?: { customers?: CountPoint[]; products?: CountPoint[] };
}

// Turn per-day NEW counts into a running total that ends at `total`, so a
// "total" stat card's sparkline rises to its current value. Falls back to a
// flat 2-point line at `total` when nothing changed in the window (an honest
// "no growth" line rather than an empty card).
const cumulativeSeries = (rows: CountPoint[], total: number): number[] => {
  const counts = rows.map((r) => r.count);
  const sumWindow = counts.reduce((a, b) => a + b, 0);
  const base = Math.max(0, total - sumWindow);
  if (counts.length === 0) return [total, total];
  let running = base;
  const out = [base];
  for (const c of counts) { running += c; out.push(running); }
  return out;
};

// Dependency-free area sparkline. We deliberately hand-draw an SVG here
// rather than pull recharts into the dashboard chunk — this page is the
// mobile-first landing surface and most Sudanese traffic is on slow phone
// networks, so keeping the bundle lean matters more than a charting lib.
const SalesSparkline: React.FC<{ points: number[] }> = ({ points }) => {
  // Unique gradient id per instance — several sparklines render on one screen
  // (revenue + orders), and a shared id would make them reference the same
  // (invalid duplicate) def.
  const gid = React.useId().replace(/:/g, '');
  if (points.length < 2) return null;
  const w = 100;
  const h = 36;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const coords = points.map((v, i) => [i * step, h - ((v - min) / range) * (h - 6) - 3] as const);
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  const [lastX, lastY] = coords[coords.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-10 w-full" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="hsl(var(--primary))" stopOpacity="0.22" />
          <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={line}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r="2.5" fill="hsl(var(--primary))" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

// Setup-checklist dismissal (collapsed-bar state only). Same key style
// as Orders.tsx's 'orders.viewMode'.
const SETUP_DISMISSED_KEY = 'dashboard.setupDismissed';

type SetupStepKey = 'add_product' | 'payments' | 'theme' | 'test_order' | 'domain';

interface SetupStepDef {
  key: SetupStepKey;
  done: boolean;
  icon: React.ElementType;
  /** Internal route, or external URL when `external` is true. */
  href: string;
  external?: boolean;
}

// Completion signals gathered from existing endpoints (audit 3.7.1) —
// no dedicated backend endpoint.
interface SetupSignals {
  hasProduct: boolean;      // products list pagination.total > 0
  paymentsEnabled: boolean; // any /payment-methods entry with enabled: true
  themePublished: boolean;  // themeCustomization.lastPublishedAt / published.publishedAt set
  hasOrder: boolean;        // /orders/stats totalOrders > 0 (falls back to list total)
  hasCustomDomain: boolean; // /domains/info customDomain or a custom_* registry row
}

export const Dashboard: React.FC = () => {
  const { t } = useTranslation(['dashboard', 'common']);
  const [totals, setTotals] = useState({ products: 0, customers: 0, orders: 0 });
  const [orderStats, setOrderStats] = useState<OrderStats>(EMPTY_ORDER_STATS);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [domainInfo, setDomainInfo] = useState<DashboardDomainInfo | null>(null);
  const [signals, setSignals] = useState<SetupSignals>({
    hasProduct: false, paymentsEnabled: false, themePublished: false, hasOrder: false, hasCustomDomain: false,
  });
  const [starter, setStarter] = useState<{ hasDraftStarter?: boolean; previewUrl?: string } | null>(null);
  // Last-14-days trends for the mobile stat-card sparklines: daily sales
  // (revenue + orders) and daily new customers/products.
  const [salesTrend, setSalesTrend] = useState<SalesPoint[]>([]);
  const [customerCounts, setCustomerCounts] = useState<CountPoint[]>([]);
  const [productCounts, setProductCounts] = useState<CountPoint[]>([]);
  // Whether the merchant actively PICKED a theme during onboarding. When true
  // the "customize theme" setup step is hidden (their look is already chosen);
  // when false the step is shown until they publish a customization. `null`
  // until the store-setup/starter call resolves. Read from the tenant via
  // GET /store-setup/starter (the dashboard already calls it on mount).
  const [themeSelected, setThemeSelected] = useState<boolean | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [setupDismissed, setSetupDismissed] = useState(
    () => localStorage.getItem(SETUP_DISMISSED_KEY) === '1'
  );
  // Collapsed-bar state can be expanded in place to review the steps.
  const [barExpanded, setBarExpanded] = useState(false);

  useEffect(() => { loadDashboardData(); }, []);

  // Draft starter-content state for the "preview & publish" banner.
  useEffect(() => {
    let active = true;
    api.storeSetup.starter()
      .then((r) => {
        if (!active) return;
        const ro = (r as { responseObject?: { hasDraftStarter?: boolean; previewUrl?: string; themeSelected?: boolean } }).responseObject || null;
        setStarter(ro);
        // Default to true (hide the theme step) when the flag is absent, so a
        // stale/older backend never nags a merchant who already has a theme.
        setThemeSelected(ro?.themeSelected !== false);
      })
      .catch(() => { /* non-fatal — banner just won't show */ });
    return () => { active = false; };
  }, []);

  // Last-14-day trends for the stat-card sparklines (sales + new counts).
  useEffect(() => {
    let active = true;
    const end = new Date().toISOString();
    const start = new Date(Date.now() - 13 * 86400000).toISOString();
    api.analytics.getSalesOverTime(start, end)
      .then((r) => {
        if (!active) return;
        const res = r as SalesOverTimeResponse;
        setSalesTrend(res.data?.salesData || res.responseObject?.salesData || []);
      })
      .catch(() => { /* non-fatal — sparkline just won't render */ });
    api.analytics.getCountsOverTime(start, end)
      .then((r) => {
        if (!active) return;
        const res = r as CountsOverTimeResponse;
        setCustomerCounts(res.data?.customers || res.responseObject?.customers || []);
        setProductCounts(res.data?.products || res.responseObject?.products || []);
      })
      .catch(() => { /* non-fatal — sparkline just won't render */ });
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

      // Everything the page needs — stats, recent orders, and the five
      // setup-checklist signals — comes from endpoints that already exist.
      const [productsRes, ordersRes, orderStatsRes, domainRes, customersRes, paymentsRes, themeRes] = await Promise.allSettled([
        api.products.getAll({ page: 1, limit: 1 }),
        api.orders.getAll({ page: 1, limit: 5 }),
        api.orders.getStats(),
        api.domains.getInfo(),
        api.customers.getAll({ page: 1, limit: 1 }),
        api.paymentMethods.list(),
        api.themeCustomization.get(),
      ]);

      const productsTotal = productsRes.status === 'fulfilled'
        ? ((productsRes.value as PaginatedEnvelope<'products', unknown>)?.responseObject?.pagination?.total || 0)
        : 0;
      const ordersData = ordersRes.status === 'fulfilled'
        ? (ordersRes.value as PaginatedEnvelope<'orders', Order>)
        : null;
      const ordersTotal = ordersData?.responseObject?.pagination?.total || 0;
      const recentOrdersList: Order[] = ordersData?.responseObject?.orders || [];
      const stats: OrderStats = orderStatsRes.status === 'fulfilled'
        ? { ...EMPTY_ORDER_STATS, ...(orderStatsRes.value as { responseObject?: Partial<OrderStats> })?.responseObject }
        : EMPTY_ORDER_STATS;
      const customersTotal = customersRes.status === 'fulfilled'
        ? ((customersRes.value as PaginatedEnvelope<'customers', unknown>)?.responseObject?.pagination?.total || 0)
        : 0;

      let domain: DashboardDomainInfo | null = null;
      if (domainRes.status === 'fulfilled') {
        const dr = domainRes.value as DomainInfoResponse;
        domain = dr?.data || dr?.responseObject?.data || (dr?.responseObject as DashboardDomainInfo | undefined) || null;
      }

      const methods = paymentsRes.status === 'fulfilled'
        ? ((paymentsRes.value as PaymentMethodsResponse)?.data?.methods
          || (paymentsRes.value as PaymentMethodsResponse)?.responseObject?.methods || [])
        : [];
      const themeCustomization = themeRes.status === 'fulfilled'
        ? (themeRes.value as ThemeCustomizationResponse)?.responseObject
        : null;

      // /orders/stats excludes drafts; fall back to the list total when
      // the stats endpoint is unavailable.
      const orderCount = orderStatsRes.status === 'fulfilled' ? stats.totalOrders : ordersTotal;

      setTotals({ products: productsTotal, customers: customersTotal, orders: orderCount });
      setOrderStats(stats);
      setRecentOrders(recentOrdersList.slice(0, 5));
      setDomainInfo(domain);
      setSignals({
        hasProduct: productsTotal > 0,
        paymentsEnabled: methods.some((m) => m?.enabled === true),
        themePublished: Boolean(themeCustomization?.lastPublishedAt || themeCustomization?.published?.publishedAt),
        hasOrder: orderCount > 0,
        hasCustomDomain: Boolean(
          domain?.customDomain
          || domain?.registry?.some((r) => r?.kind === 'custom_apex' || r?.kind === 'custom_subdomain')
        ),
      });
    } catch {
      toast.error(t('dashboard:toast.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat(getTenantLocale(), { style: 'currency', currency: getTenantCurrency() }).format(price);

  const copyStoreLink = (hostname: string) => {
    navigator.clipboard.writeText(hostname);
    toast.success(t('dashboard:toast.link_copied'));
  };

  const storeUrl = domainInfo?.activeDomain ? storefrontUrl(domainInfo.activeDomain) : '';

  // --- Setup checklist (audit 3.7.1) ---------------------------------
  // The "customize theme" step only applies to merchants who SKIPPED theme
  // selection during onboarding (themeSelected === false). A merchant who
  // actively picked a theme already has their look chosen, so the step is
  // hidden and never counts against their setup completion. It's marked done
  // once a customization is published OR the merchant selected a theme.
  const setupSteps: SetupStepDef[] = useMemo(() => {
    const steps: SetupStepDef[] = [
      { key: 'add_product', done: signals.hasProduct, icon: Package, href: '/dashboard/products/new' },
      { key: 'payments', done: signals.paymentsEnabled, icon: CreditCard, href: '/dashboard/payments/methods' },
      { key: 'theme', done: signals.themePublished || themeSelected === true, icon: Palette, href: '/dashboard/themes/editor' },
      // Test orders are placed on the storefront itself.
      { key: 'test_order', done: signals.hasOrder, icon: ShoppingCart, href: storeUrl || '/dashboard/orders', external: Boolean(storeUrl) },
      { key: 'domain', done: signals.hasCustomDomain, icon: Globe, href: '/dashboard/domains' },
    ];
    // Hide the theme step entirely for merchants who picked a theme (or while
    // the flag is still loading — default is "picked", so we don't flash it).
    return themeSelected === false
      ? steps
      : steps.filter((s) => s.key !== 'theme');
  }, [signals, storeUrl, themeSelected]);

  const doneCount = setupSteps.filter((s) => s.done).length;
  const setupComplete = doneCount === setupSteps.length;
  const hasOrders = signals.hasOrder;

  const dismissSetup = () => {
    localStorage.setItem(SETUP_DISMISSED_KEY, '1');
    setSetupDismissed(true);
  };

  // --- Stat cards: one honest time frame per group (audit 3.7.2) -----
  const ordersDelta = pctDelta(orderStats.orders30d, orderStats.ordersPrev30d);
  const revenueDelta = pctDelta(orderStats.revenue30d, orderStats.revenuePrev30d);
  const withTrend = (base: string, delta?: StatCardDelta) =>
    delta ? `${base} · ${t('dashboard:stats.vs_prev_30d')}` : base;

  // --- Shared checklist row (full card + expanded bar reuse it) ------
  const renderStepRow = (step: SetupStepDef) => {
    const title = t(`dashboard:setup.step.${step.key}.title`);
    const desc = t(`dashboard:setup.step.${step.key}.desc`);
    const inner = (
      <>
        {step.done
          ? <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
          : <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${step.done ? 'text-muted-foreground' : ''}`}>{title}</p>
          {!step.done && <p className="text-xs text-muted-foreground">{desc}</p>}
        </div>
        {step.done ? (
          <Badge variant="success" className="text-xs shrink-0">{t('dashboard:setup.done')}</Badge>
        ) : step.external ? (
          <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 rtl:rotate-180" />
        )}
      </>
    );
    const rowClass = 'flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors';
    if (step.done) {
      return <div key={step.key} className={rowClass}>{inner}</div>;
    }
    return step.external ? (
      <a key={step.key} href={step.href} target="_blank" rel="noopener noreferrer" className={rowClass}>{inner}</a>
    ) : (
      <Link key={step.key} to={step.href} className={rowClass}>{inner}</Link>
    );
  };

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

      {/* Page header (audit 3.7.5) — breadcrumb already states location */}
      <PageHeader
        title={t('dashboard:title')}
        description={t('dashboard:subtitle')}
        actions={
          <Button asChild>
            <Link to="/dashboard/products/new">
              <Plus className="h-4 w-4 me-2" />
              {t('dashboard:add_product')}
            </Link>
          </Button>
        }
      />

      {/* Live-store banner (audit 3.7.3): Visit + Copy primary, Manage demoted */}
      {domainInfo?.activeDomain && (
        <LiveStoreBanner
          hostname={domainInfo.activeDomain}
          onCopy={copyStoreLink}
          manageTo="/dashboard/domains"
        />
      )}

      {/* Setup checklist (audit 3.7.1) — dominant card until the first
          order, then a slim expandable bar; hidden once complete or
          dismissed. */}
      {!setupComplete && !hasOrders && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base">{t('dashboard:setup.title')}</CardTitle>
                <CardDescription>{t('dashboard:setup.description')}</CardDescription>
              </div>
              <span className="text-sm font-medium text-muted-foreground shrink-0">
                {t('dashboard:setup.progress', { done: doneCount, total: setupSteps.length })}
              </span>
            </div>
            {/* Thin progress track */}
            <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden="true">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(doneCount / setupSteps.length) * 100}%` }}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {setupSteps.map(renderStepRow)}
          </CardContent>
        </Card>
      )}

      {!setupComplete && hasOrders && !setupDismissed && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="flex items-center gap-3 flex-1 min-w-0 text-start"
                onClick={() => setBarExpanded((v) => !v)}
                aria-expanded={barExpanded}
              >
                <span className="text-sm font-medium">
                  {t('dashboard:setup.bar_label', { done: doneCount, total: setupSteps.length })}
                </span>
                <span className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-48" aria-hidden="true">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${(doneCount / setupSteps.length) * 100}%` }}
                  />
                </span>
                {barExpanded
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={dismissSetup}
                aria-label={t('dashboard:setup.dismiss')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {barExpanded && (
              <div className="mt-2 space-y-1">
                {setupSteps.map(renderStepRow)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats (audit 3.7.2): rolling-30-day group vs all-time group,
          labelled and visually separated. Hidden for pre-first-order
          stores — the checklist leads instead of all-zero decoration. */}
      {/* Mobile stats (audit): a single horizontal snap-scroll strip. Each
          card is 80% wide so the next one peeks in at the edge, signalling
          there's more to swipe. `items-stretch` + `h-full` on every card
          keeps them all the same height regardless of content. The first
          card sits flush with the page's other cards (no start bleed); the
          strip bleeds only at the end (`-me-4`) so the peek reaches the edge.
          A sales-trend chart rides in the middle. The grouped two-column
          grid below takes over from md upward. */}
      {hasOrders && (
        <div className="md:hidden -me-4 flex snap-x snap-mandatory items-stretch gap-3 overflow-x-auto pb-1 scrollbar-hide">
          <div className="w-[80%] shrink-0 snap-start">
            <StatCard
              className="h-full"
              label={t('dashboard:metric.revenue')}
              value={formatPrice(orderStats.revenue30d)}
              icon={DollarSign}
              delta={revenueDelta}
              description={t('dashboard:metric.revenue_description')}
              chart={salesTrend.length >= 2 ? <SalesSparkline points={salesTrend.map((p) => p.revenue)} /> : undefined}
            />
          </div>
          <Link to="/dashboard/orders" className="w-[80%] shrink-0 snap-start">
            <StatCard
              className="h-full"
              label={t('dashboard:metric.orders')}
              value={orderStats.orders30d.toLocaleString()}
              icon={ShoppingCart}
              delta={ordersDelta}
              description={t('dashboard:metric.orders_description')}
              chart={salesTrend.length >= 2 ? <SalesSparkline points={salesTrend.map((p) => p.orders)} /> : undefined}
            />
          </Link>
          <Link to="/dashboard/products" className="w-[80%] shrink-0 snap-start">
            <StatCard
              className="h-full"
              label={t('dashboard:metric.products')}
              value={totals.products.toLocaleString()}
              icon={Package}
              description={t('dashboard:metric.products_description')}
              chart={<SalesSparkline points={cumulativeSeries(productCounts, totals.products)} />}
            />
          </Link>
          <Link to="/dashboard/customers" className="w-[80%] shrink-0 snap-start">
            <StatCard
              className="h-full"
              label={t('dashboard:metric.customers')}
              value={totals.customers.toLocaleString()}
              icon={Users}
              description={t('dashboard:metric.customers_description')}
              chart={<SalesSparkline points={cumulativeSeries(customerCounts, totals.customers)} />}
            />
          </Link>
        </div>
      )}

      {hasOrders && (
        <div className="hidden gap-6 md:grid lg:grid-cols-2">
          <section>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              {t('dashboard:stats.last_30_days')}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard
                label={t('dashboard:metric.revenue')}
                value={formatPrice(orderStats.revenue30d)}
                icon={DollarSign}
                delta={revenueDelta}
                description={withTrend(t('dashboard:metric.revenue_description'), revenueDelta)}
              />
              <Link to="/dashboard/orders">
                <StatCard
                  label={t('dashboard:metric.orders')}
                  value={orderStats.orders30d.toLocaleString()}
                  icon={ShoppingCart}
                  delta={ordersDelta}
                  description={withTrend(t('dashboard:metric.orders_description'), ordersDelta)}
                />
              </Link>
            </div>
          </section>
          <section className="lg:border-s lg:ps-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
              {t('dashboard:stats.all_time')}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Link to="/dashboard/products">
                <StatCard
                  label={t('dashboard:metric.products')}
                  value={totals.products.toLocaleString()}
                  icon={Package}
                  description={t('dashboard:metric.products_description')}
                />
              </Link>
              <Link to="/dashboard/customers">
                <StatCard
                  label={t('dashboard:metric.customers')}
                  value={totals.customers.toLocaleString()}
                  icon={Users}
                  description={t('dashboard:metric.customers_description')}
                />
              </Link>
            </div>
          </section>
        </div>
      )}

      {/* Recent orders + quick actions — only once orders exist */}
      {hasOrders && (
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

          {/* Quick actions (audit 3.7.4): top incomplete setup actions
              while the checklist is unfinished, static links after. Icons
              match each destination's sidebar icon. */}
          <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">
                {setupComplete
                  ? t('dashboard:section.quick_actions.title')
                  : t('dashboard:setup.next_steps')}
              </CardTitle>
              <CardDescription>
                {setupComplete
                  ? t('dashboard:section.quick_actions.description')
                  : t('dashboard:setup.next_steps_description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {setupComplete ? (
                [
                  { label: t('dashboard:section.quick_actions.add_product'), icon: Package, href: '/dashboard/products/new' },
                  { label: t('dashboard:section.quick_actions.view_orders'), icon: ShoppingCart, href: '/dashboard/orders' },
                  { label: t('dashboard:section.quick_actions.manage_themes'), icon: Palette, href: '/dashboard/themes' },
                  { label: t('dashboard:section.quick_actions.domain_settings'), icon: Globe, href: '/dashboard/domains' },
                  { label: t('dashboard:section.quick_actions.discounts'), icon: Tag, href: '/dashboard/marketing/discounts' },
                  { label: t('dashboard:section.quick_actions.store_settings'), icon: SettingsIcon, href: '/dashboard/settings' },
                ].map(action => (
                  <Button key={action.label} variant="ghost" className="w-full justify-start h-10" asChild>
                    <Link to={action.href}>
                      <action.icon className="me-3 h-4 w-4" />
                      {action.label}
                    </Link>
                  </Button>
                ))
              ) : (
                setupSteps.filter((s) => !s.done).slice(0, 3).map((step) => (
                  <Button key={step.key} variant="ghost" className="w-full justify-start h-10" asChild>
                    {step.external ? (
                      <a href={step.href} target="_blank" rel="noopener noreferrer">
                        <step.icon className="me-3 h-4 w-4" />
                        {t(`dashboard:setup.step.${step.key}.title`)}
                      </a>
                    ) : (
                      <Link to={step.href}>
                        <step.icon className="me-3 h-4 w-4" />
                        {t(`dashboard:setup.step.${step.key}.title`)}
                      </Link>
                    )}
                  </Button>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
