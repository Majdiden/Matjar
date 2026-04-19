/**
 * EditorTopBar — top navigation for the visual theme editor.
 * Holds: back nav, theme name + draft indicator, page selector,
 * device toggle, reset, preview, publish.
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Eye, RotateCcw, Smartphone, Tablet, Monitor, ChevronDown, Loader2, Check, History as HistoryIcon, RotateCw, PanelLeft, PanelRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import { useConfirm } from '../ui/use-confirm';
import type { ThemeVersionEntry } from './types';

// Axios-style error shape we receive from the api client. Kept local
// because api-client.ts is out of scope for this lint pass, but we still
// want a typed `catch` without reaching for `any`.
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

export type DeviceMode = 'desktop' | 'tablet' | 'mobile';

interface PageOption {
  id: string;
  label: string;
}

interface EditorTopBarProps {
  themeName: string;
  isDraft: boolean;
  hasChanges: boolean;
  saving: boolean;
  saveStatus: 'idle' | 'saving' | 'saved';
  deviceMode: DeviceMode;
  onDeviceChange: (mode: DeviceMode) => void;
  pageOptions: PageOption[];
  currentPage: string;
  onPageChange: (id: string) => void;
  onBack: () => void;
  onReset: () => void;
  onPreview: () => void;
  onPublish: () => void;
  // Optional callback fired after a rollback so the parent can refetch
  // the customization. If omitted, the bar will just close the dialog and
  // toast — VisualEditor passes loadCustomization here.
  onRollback?: () => void | Promise<void>;
  leftSidebarOpen: boolean;
  rightSidebarOpen: boolean;
  onToggleLeftSidebar: () => void;
  onToggleRightSidebar: () => void;
}

export default function EditorTopBar({
  themeName,
  isDraft,
  hasChanges,
  saving,
  saveStatus,
  deviceMode,
  onDeviceChange,
  pageOptions,
  currentPage,
  onPageChange,
  onBack,
  onReset,
  onPreview,
  onPublish,
  onRollback,
  leftSidebarOpen,
  rightSidebarOpen,
  onToggleLeftSidebar,
  onToggleRightSidebar,
}: EditorTopBarProps) {
  const { t } = useTranslation(['themes', 'common']);
  const currentPageLabel = pageOptions.find((p) => p.id === currentPage)?.label || t('themes:editor.template.index');

  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<ThemeVersionEntry[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [rollingBack, setRollingBack] = useState<number | null>(null);
  const confirm = useConfirm();

  useEffect(() => {
    if (!historyOpen) return;
    let alive = true;
    (async () => {
      try {
        setVersionsLoading(true);
        // Two wire shapes exist in the wild — newer endpoints return
        // `{ data: { versions } }`, legacy ones return `{ responseObject: { versions } }`.
        // We accept either so a partial API rollout doesn't break the dialog.
        const res = (await api.themeVersions.list()) as {
          data?: { versions?: ThemeVersionEntry[] };
          responseObject?: { versions?: ThemeVersionEntry[] };
        };
        const list = res?.data?.versions || res?.responseObject?.versions || [];
        if (alive) setVersions(list);
      } catch (err: unknown) {
        if (alive) toast.error(errorMessage(err, 'Failed to load versions'));
      } finally {
        if (alive) setVersionsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [historyOpen]);

  const handleRollback = async (version: number) => {
    if (!(await confirm({
      title: t('themes:editor.version_history.confirm_title', { version }),
      description: t('themes:editor.version_history.confirm_description'),
      confirmText: t('themes:editor.version_history.confirm_text'),
      variant: 'destructive',
    }))) return;
    try {
      setRollingBack(version);
      await api.themeVersions.rollback(version);
      toast.success(t('themes:editor.version_history.toast_restored', { version }));
      setHistoryOpen(false);
      if (onRollback) await onRollback();
    } catch (err: unknown) {
      toast.error(errorMessage(err, t('themes:editor.version_history.toast_error_rollback')));
    } finally {
      setRollingBack(null);
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <header className="h-14 shrink-0 bg-white border-b border-slate-200 px-3 flex items-center justify-between gap-3">
        {/* Left — back + theme info */}
        <div className="flex items-center gap-2 min-w-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('themes:editor.topbar.back')}</TooltipContent>
          </Tooltip>

          <div className="h-6 w-px bg-slate-200" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-9 w-9 ${leftSidebarOpen ? 'text-slate-900 bg-slate-100' : 'text-slate-500'}`}
                onClick={onToggleLeftSidebar}
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{leftSidebarOpen ? t('themes:editor.topbar.hide_sections') : t('themes:editor.topbar.show_sections')}</TooltipContent>
          </Tooltip>

          <div className="h-6 w-px bg-slate-200" />

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-slate-900 truncate">{themeName}</span>
            {isDraft && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-5 border-amber-300 bg-amber-50 text-amber-700 font-medium"
              >
                {t('themes:editor.topbar.unpublished_changes')}
              </Badge>
            )}
            <SaveIndicator status={saveStatus} />
          </div>
        </div>

        {/* Center — page selector + device toggle */}
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-2 font-medium">
                <span className="text-xs text-slate-500">{t('themes:editor.topbar.page_label')}</span>
                <span>{currentPageLabel}</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48">
              {pageOptions.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => onPageChange(p.id)}
                  className="flex items-center justify-between"
                >
                  {p.label}
                  {p.id === currentPage && <Check className="h-3.5 w-3.5 text-slate-500" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-6 w-px bg-slate-200" />

          <div className="flex items-center bg-slate-100 rounded-md p-0.5">
            <DeviceButton
              active={deviceMode === 'desktop'}
              icon={<Monitor className="h-3.5 w-3.5" />}
              label={t('themes:editor.topbar.device.desktop')}
              onClick={() => onDeviceChange('desktop')}
            />
            <DeviceButton
              active={deviceMode === 'tablet'}
              icon={<Tablet className="h-3.5 w-3.5" />}
              label={t('themes:editor.topbar.device.tablet')}
              onClick={() => onDeviceChange('tablet')}
            />
            <DeviceButton
              active={deviceMode === 'mobile'}
              icon={<Smartphone className="h-3.5 w-3.5" />}
              label={t('themes:editor.topbar.device.mobile')}
              onClick={() => onDeviceChange('mobile')}
            />
          </div>
        </div>

        {/* Right — actions */}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={`h-9 w-9 ${rightSidebarOpen ? 'text-slate-900 bg-slate-100' : 'text-slate-500'}`}
                onClick={onToggleRightSidebar}
              >
                <PanelRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{rightSidebarOpen ? t('themes:editor.topbar.hide_settings') : t('themes:editor.topbar.show_settings')}</TooltipContent>
          </Tooltip>

          <div className="h-6 w-px bg-slate-200" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onReset} disabled={saving}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('themes:editor.topbar.reset')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setHistoryOpen(true)}
              >
                <HistoryIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('themes:editor.topbar.version_history')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2" onClick={onPreview}>
                <Eye className="h-4 w-4" />
                <span className="hidden sm:inline">{t('themes:editor.topbar.preview')}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('themes:editor.topbar.open_preview')}</TooltipContent>
          </Tooltip>

          <Button
            size="sm"
            className={`h-9 px-4 transition-all ${
              hasChanges && !saving
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md ring-2 ring-emerald-200 animate-pulse-subtle'
                : ''
            }`}
            onClick={onPublish}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 me-1.5 animate-spin" />
                {t('themes:editor.topbar.publishing')}
              </>
            ) : hasChanges ? (
              <>
                <Check className="h-4 w-4 me-1.5" />
                {t('themes:editor.topbar.publish_changes')}
              </>
            ) : (
              t('themes:editor.topbar.publish')
            )}
          </Button>
        </div>
      </header>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('themes:editor.version_history.title')}</DialogTitle>
            <DialogDescription>
              {t('themes:editor.version_history.description')}
            </DialogDescription>
          </DialogHeader>
          {versionsLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> {t('themes:editor.version_history.loading')}
            </div>
          ) : versions.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {t('themes:editor.version_history.empty')}
            </div>
          ) : (
            <div className="border rounded-md divide-y">
              {versions.map((v) => (
                <div key={v.version} className="flex items-center justify-between p-3 gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">v{v.version}</span>
                      {v.source && (
                        <Badge variant="secondary" className="text-[10px] capitalize">{v.source}</Badge>
                      )}
                    </div>
                    {v.label && (
                      <p className="text-xs font-medium text-foreground/90 mt-1 truncate">
                        {v.label}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {v.themeSlug}
                      {v.publishedAt ? ` · ${new Date(v.publishedAt).toLocaleString()}` : ''}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRollback(v.version)}
                    disabled={rollingBack !== null}
                  >
                    {rollingBack === v.version ? (
                      <Loader2 className="h-4 w-4 me-2 animate-spin" />
                    ) : (
                      <RotateCw className="h-4 w-4 me-2" />
                    )}
                    {t('themes:editor.version_history.restore')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

function DeviceButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={`h-7 w-8 flex items-center justify-center rounded transition ${
            active
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function SaveIndicator({ status }: { status: 'idle' | 'saving' | 'saved' }) {
  const { t } = useTranslation(['themes']);
  if (status === 'idle') return null;
  return (
    <span className="text-[11px] text-slate-400 flex items-center gap-1 ms-1">
      {status === 'saving' ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          {t('themes:editor.topbar.save_status.saving')}
        </>
      ) : (
        <>
          <Check className="h-3 w-3 text-emerald-500" />
          {t('themes:editor.topbar.save_status.saved')}
        </>
      )}
    </span>
  );
}
