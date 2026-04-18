/**
 * EditorTopBar — top navigation for the visual theme editor.
 * Holds: back nav, theme name + draft indicator, page selector,
 * device toggle, reset, preview, publish.
 */
import { useState, useEffect } from 'react';
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
  const currentPageLabel = pageOptions.find((p) => p.id === currentPage)?.label || 'Home';

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
      title: `Restore version ${version}?`,
      description: 'This will overwrite your current draft. Any unsaved changes will be lost.',
      confirmText: 'Restore',
      variant: 'destructive',
    }))) return;
    try {
      setRollingBack(version);
      await api.themeVersions.rollback(version);
      toast.success(`Restored draft to version ${version}`);
      setHistoryOpen(false);
      if (onRollback) await onRollback();
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Rollback failed'));
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
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Back to themes</TooltipContent>
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
            <TooltipContent>{leftSidebarOpen ? 'Hide sections' : 'Show sections'}</TooltipContent>
          </Tooltip>

          <div className="h-6 w-px bg-slate-200" />

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-slate-900 truncate">{themeName}</span>
            {isDraft && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-5 border-amber-300 bg-amber-50 text-amber-700 font-medium"
              >
                Unpublished changes
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
                <span className="text-xs text-slate-500">Page:</span>
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
              label="Desktop"
              onClick={() => onDeviceChange('desktop')}
            />
            <DeviceButton
              active={deviceMode === 'tablet'}
              icon={<Tablet className="h-3.5 w-3.5" />}
              label="Tablet"
              onClick={() => onDeviceChange('tablet')}
            />
            <DeviceButton
              active={deviceMode === 'mobile'}
              icon={<Smartphone className="h-3.5 w-3.5" />}
              label="Mobile"
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
            <TooltipContent>{rightSidebarOpen ? 'Hide settings' : 'Show settings'}</TooltipContent>
          </Tooltip>

          <div className="h-6 w-px bg-slate-200" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onReset} disabled={saving}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset to theme defaults</TooltipContent>
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
            <TooltipContent>Version history</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2" onClick={onPreview}>
                <Eye className="h-4 w-4" />
                <span className="hidden sm:inline">Preview</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open preview in new tab</TooltipContent>
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
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Publishing
              </>
            ) : hasChanges ? (
              <>
                <Check className="h-4 w-4 mr-1.5" />
                Publish changes
              </>
            ) : (
              'Publish'
            )}
          </Button>
        </div>
      </header>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version history</DialogTitle>
            <DialogDescription>
              Every publish creates a snapshot. Restoring brings the snapshot
              into your draft — you'll still need to publish it to make it
              live.
            </DialogDescription>
          </DialogHeader>
          {versionsLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : versions.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No published versions yet. Hit Publish to create your first snapshot.
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
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RotateCw className="h-4 w-4 mr-2" />
                    )}
                    Restore
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
  if (status === 'idle') return null;
  return (
    <span className="text-[11px] text-slate-400 flex items-center gap-1 ml-1">
      {status === 'saving' ? (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving…
        </>
      ) : (
        <>
          <Check className="h-3 w-3 text-emerald-500" />
          Saved
        </>
      )}
    </span>
  );
}
