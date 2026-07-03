import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';
import { Input } from '../../components/ui/input';
import {
  Palette,
  CheckCircle2,
  Download,
  Loader2,
  Search,
  Eye,
  Sparkles,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import type { Theme } from '../../types';
import type { DomainInfoResponse } from '../domains/types';
import { useConfirm } from '../../components/ui/use-confirm';

type Filter = 'all' | 'free' | 'popular';

/**
 * Build the tenant's storefront origin from its domain host, mirroring how the
 * Domains page opens the live store (`https://<host>`). In local dev the
 * storefront is reached on the same port the dashboard is, over http.
 */
function storefrontOriginFromHost(host: string | null | undefined): string {
  if (!host) return window.location.origin;
  const isLocal =
    host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1';
  const protocol = isLocal ? 'http:' : 'https:';
  const port = isLocal && window.location.port ? `:${window.location.port}` : '';
  return `${protocol}//${host}${port}`;
}

interface ThemesListResponse {
  data?: {
    themes?: Theme[];
    currentTheme?: Theme | null;
  };
}

interface ApiErrorLike {
  message?: string;
  response?: { data?: { message?: string } };
}

function errorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null) {
    const e = err as ApiErrorLike;
    return e.response?.data?.message || e.message || fallback;
  }
  return fallback;
}

/**
 * Theme homepage screenshot with a graceful fallback: if the theme ships no
 * preview image or the request 404s (e.g. the theme hasn't been rebuilt with
 * one yet), render the palette placeholder instead of a broken image.
 */
const ThemeScreenshot: React.FC<{
  src?: string;
  alt: string;
  imgClassName: string;
  fallbackClassName: string;
  fallbackIconClassName: string;
}> = ({ src, alt, imgClassName, fallbackClassName, fallbackIconClassName }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={fallbackClassName}>
        <Palette className={fallbackIconClassName} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={imgClassName}
      onError={() => setFailed(true)}
    />
  );
};

export const Themes: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation(['themes', 'common']);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [activeTheme, setActiveTheme] = useState<Theme | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [storefrontOrigin, setStorefrontOrigin] = useState<string | null>(null);
  const confirm = useConfirm();

  useEffect(() => {
    loadThemes();
    loadStorefrontOrigin();
  }, []);

  // Resolve the tenant's storefront origin (same source the Domains page uses)
  // so the Preview button can open the live store on the right host. Prefer the
  // platform subdomain — it always has SSL and is always reachable, even when a
  // custom domain is still verifying.
  const loadStorefrontOrigin = async () => {
    try {
      const res = (await api.domains.getInfo()) as {
        data?: DomainInfoResponse;
        responseObject?: DomainInfoResponse;
      };
      const info = res.data || res.responseObject;
      const host = info?.subdomain?.fullDomain || info?.activeDomain || '';
      setStorefrontOrigin(storefrontOriginFromHost(host));
    } catch {
      // Fall back to the current origin at click time — non-fatal.
      setStorefrontOrigin(null);
    }
  };

  // `<storefront origin>/?previewTheme=<slug>` — opens the storefront rendered
  // with this theme's bundle + ephemeral demo data (nothing is persisted).
  const previewUrl = (slug: string) =>
    `${storefrontOrigin || window.location.origin}/?previewTheme=${encodeURIComponent(slug)}`;

  const loadThemes = async () => {
    try {
      setLoading(true);
      const response = (await api.themes.getActive()) as ThemesListResponse;
      setThemes(response.data?.themes || []);
      setActiveTheme(response.data?.currentTheme || null);
    } catch (err: unknown) {
      toast.error(errorMessage(err, t('themes:list.toast.error_load')));
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (themeId: string) => {
    if (!(await confirm({
      title: t('themes:list.confirm.activate_title'),
      description: t('themes:list.confirm.activate_description'),
      confirmText: t('themes:list.confirm.activate_confirm'),
    }))) return;
    try {
      setActionLoading(themeId);
      await api.themes.install(themeId);
      toast.success(t('themes:list.toast.activated'));
      await loadThemes();
    } catch (err: unknown) {
      toast.error(errorMessage(err, t('themes:list.toast.error_install')));
    } finally {
      setActionLoading('');
    }
  };

  const handleUninstall = async (themeId: string) => {
    if (!(await confirm({
      title: t('themes:list.confirm.uninstall_title'),
      description: t('themes:list.confirm.uninstall_description'),
      confirmText: t('themes:list.confirm.uninstall_confirm'),
      variant: 'destructive',
    }))) return;
    try {
      setActionLoading(themeId);
      await api.themes.uninstall(themeId);
      toast.success(t('themes:list.toast.uninstalled'));
      await loadThemes();
    } catch (err: unknown) {
      toast.error(errorMessage(err, t('themes:list.toast.error_uninstall')));
    } finally {
      setActionLoading('');
    }
  };

  const filteredThemes = useMemo(() => {
    let list = themes;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.author?.name?.toLowerCase().includes(q),
      );
    }
    if (filter === 'popular') {
      list = [...list].sort(
        (a, b) => (b.statistics?.installCount || 0) - (a.statistics?.installCount || 0),
      );
    }
    return list;
  }, [themes, search, filter]);

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-80 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Page header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('themes:list.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('themes:list.subtitle')}
          </p>
        </div>
        <Button variant="outline" asChild>
          <a href="/" target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4 me-2" />
            {t('themes:list.view_live_store')}
          </a>
        </Button>
      </div>

      {/* Active theme hero */}
      {activeTheme && (
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/5 via-background to-background">
          <div className="absolute -top-20 -end-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="relative grid lg:grid-cols-[1.1fr,1fr] gap-8 p-6 lg:p-8">
            {/* Screenshot */}
            <div className="relative aspect-[16/10] rounded-xl overflow-hidden border bg-muted shadow-2xl shadow-primary/10">
              <ThemeScreenshot
                src={activeTheme.previewImage}
                alt={activeTheme.name}
                imgClassName="w-full h-full object-cover object-top"
                fallbackClassName="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 via-primary/5 to-transparent"
                fallbackIconClassName="h-20 w-20 text-primary/30"
              />
              <div className="absolute top-3 start-3">
                <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white border-0 shadow-lg">
                  <CheckCircle2 className="h-3 w-3 me-1" />
                  {t('themes:list.badge.live')}
                </Badge>
              </div>
            </div>

            {/* Meta + actions */}
            <div className="flex flex-col justify-center">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary mb-3">
                <Sparkles className="h-3.5 w-3.5" />
                {t('themes:list.current_theme_label')}
              </div>
              <h2 className="text-3xl font-bold tracking-tight mb-2">{activeTheme.name}</h2>
              <p className="text-muted-foreground mb-5 line-clamp-3">
                {activeTheme.description}
              </p>

              {/* Rating/install statistics and manifest feature chips are
                  intentionally not rendered until real data exists
                  (audit 3.9.7 — no fabricated marketplace stats). */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-6">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    {t('themes:list.meta.version')}
                  </div>
                  <div className="font-medium">v{activeTheme.version}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    {t('themes:list.meta.author')}
                  </div>
                  <div className="font-medium truncate">{activeTheme.author.name}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  size="lg"
                  onClick={() => navigate('/dashboard/themes/editor')}
                  className="shadow-lg shadow-primary/20"
                >
                  <Palette className="h-4 w-4 me-2" />
                  {t('themes:list.action.customize')}
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a href="/" target="_blank" rel="noreferrer">
                    <Eye className="h-4 w-4 me-2" />
                    {t('themes:list.action.preview')}
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Library header + filters */}
      <div className="space-y-4">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">{t('themes:list.library.title')}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t('themes:list.library.count', { count: filteredThemes.length })}
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('themes:list.search_placeholder')}
                className="ps-9"
              />
            </div>
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'popular', 'free'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 text-sm font-medium rounded-full border transition-colors ${
                filter === f
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-background hover:bg-muted border-border'
              }`}
            >
              {t(`themes:list.filter.${f}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Theme grid */}
      {filteredThemes.length === 0 ? (
        <Card>
          <CardContent className="p-16 text-center">
            <Palette className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-1">{t('themes:list.empty.title')}</h3>
            <p className="text-sm text-muted-foreground">
              {search ? t('themes:list.empty.hint_search') : t('themes:list.empty.hint_empty')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {filteredThemes.map((theme) => {
            const isActive = activeTheme?._id === theme._id;
            const isLoading = actionLoading === theme._id;

            return (
              <Card
                key={theme._id}
                className={`group overflow-hidden border transition-all hover:-translate-y-0.5 hover:shadow-xl ${
                  isActive ? 'ring-2 ring-primary border-primary/40' : ''
                }`}
              >
                {/* Screenshot */}
                <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-muted to-muted/40">
                  <ThemeScreenshot
                    src={theme.previewImage}
                    alt={theme.name}
                    imgClassName="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    fallbackClassName="w-full h-full flex items-center justify-center"
                    fallbackIconClassName="h-14 w-14 text-muted-foreground/30"
                  />

                  {/* Status badge */}
                  {isActive && (
                    <div className="absolute top-3 start-3">
                      <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white border-0 shadow">
                        <CheckCircle2 className="h-3 w-3 me-1" />
                        {t('themes:list.badge.active')}
                      </Badge>
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    {isActive ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate('/dashboard/themes/editor')}
                      >
                        <Palette className="h-4 w-4 me-1.5" />
                        {t('themes:list.action.customize')}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleInstall(theme._id)}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 me-1.5 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 me-1.5" />
                        )}
                        {t('themes:list.action.activate')}
                      </Button>
                    )}
                  </div>
                </div>

                <CardContent className="p-5 space-y-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-base truncate">{theme.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      v{theme.version} • {theme.author.name}
                    </p>
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                    {theme.description}
                  </p>

                  {/* Ratings and feature tag chips intentionally omitted until
                      real data exists (audit 3.9.7). */}

                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t">
                    {isActive ? (
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => navigate('/dashboard/themes/editor')}
                      >
                        <Palette className="h-4 w-4 me-1.5" />
                        {t('themes:list.action.customize')}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => handleInstall(theme._id)}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 me-1.5 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 me-1.5" />
                        )}
                        {t('themes:list.action.activate')}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" asChild>
                      <a
                        href={previewUrl(theme.slug)}
                        target="_blank"
                        rel="noreferrer"
                        title={t('themes:list.preview')}
                      >
                        <Eye className="h-4 w-4 me-1.5" />
                        {t('themes:list.preview')}
                      </a>
                    </Button>
                    {!isActive && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUninstall(theme._id)}
                        disabled={isLoading}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
