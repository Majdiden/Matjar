/**
 * Homepage simple editor — PBI 10-13, behind `design.simpleMode`.
 * Route: /dashboard/store/homepage (permission `themes.write`).
 *
 * Phone-first: a phone-sized preview of the store's homepage, and under it
 * the homepage's parts in plain words (only sections the theme marks
 * `basic`, see isBasicSection). Each row has a show/hide switch and move
 * up / move down buttons; tapping it opens a bottom sheet with the section's
 * basic settings only (HomepageSectionSheet).
 *
 * There is no draft for the merchant: every change is saved and published
 * at once (useHomepageEditor), with "Saved — live on your store" and Undo.
 * The preview follows each change immediately through the full editor's
 * postMessage protocol (SECTION_UPDATE / SECTION_TOGGLE / SECTION_REORDER).
 * Everything else stays in the full editor, linked as "Advanced options".
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronLeft,
  CloudOff,
  Eye,
  EyeOff,
  Loader2,
  Monitor,
  RotateCw,
  SlidersHorizontal,
  Undo2,
} from 'lucide-react';
import type { SectionDefinition } from '@matjar/theme-shared/types/theme';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Switch } from '../../components/ui/switch';
import { useAuth } from '../../contexts/auth-context';
import { useSetBreadcrumbs } from '../../contexts/breadcrumb-context';
import { listedSections, useHomepageEditor, type HomepageSaveState } from '../../hooks/useHomepageEditor';
import { readJson, writeJson } from '../../hooks/useStoreProfile';
import {
  isShown,
  liveSettings,
  moveAmong,
  sortSections,
  type HomeSection,
  type HomepageOp,
} from '../../lib/homepageEditor';
import { cn } from '../../lib/utils';
import PhonePreview from './PhonePreview';
import HomepageSectionSheet from './HomepageSectionSheet';
import { usePartName } from './homepageNames';

const PREVIEW_HIDDEN_KEY = 'matjar.homepagePreviewHidden';
/** Phone screen shown above the list on phones: part of the screen height. */
const PHONE_PREVIEW_SHARE = 0.36;
const PHONE_PREVIEW_MIN_PX = 240;
const PHONE_PREVIEW_MAX_PX = 380;
const DESKTOP_QUERY = '(min-width: 1024px)';

function useIsDesktop() {
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia(DESKTOP_QUERY).matches);
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setDesktop(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return desktop;
}

/** Manifest defaults of a section type (what a removed key falls back to). */
function defaultsOf(def: SectionDefinition | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of def?.settings ?? []) if (s.default !== undefined) out[s.id] = s.default;
  return out;
}

export default function HomepageEditor() {
  const { t } = useTranslation(['storeDesign', 'nav']);
  const { can } = useAuth();
  const partName = usePartName();
  const isDesktop = useIsDesktop();

  useSetBreadcrumbs([
    { label: t('nav:sidebar.storefront.my_store'), href: '/dashboard/store' },
    { label: t('storeDesign:homepage.title') },
  ]);

  // ---- live preview --------------------------------------------------------

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewOriginRef = useRef<string | null>(null);
  const previewBoxRef = useRef<HTMLDivElement>(null);
  const definitionsRef = useRef<Map<string, SectionDefinition>>(new Map());

  const postToPreview = useCallback((msg: Record<string, unknown>) => {
    const frame = iframeRef.current;
    const origin = previewOriginRef.current;
    if (!frame?.contentWindow || !origin) return;
    try {
      frame.contentWindow.postMessage(msg, origin);
    } catch {
      /* the frame navigated away — the next load shows the saved state */
    }
  }, []);

  const onLive = useCallback(
    (op: HomepageOp, before: HomeSection[]) => {
      if (op.kind === 'visible') {
        postToPreview({ type: 'SECTION_TOGGLE', sectionId: op.sectionId, enabled: op.visible });
      } else if (op.kind === 'order') {
        postToPreview({ type: 'SECTION_REORDER', sectionIds: op.sectionIds });
      } else {
        const prev = before.find((s) => s.id === op.sectionId);
        const def = prev ? definitionsRef.current.get(prev.type) : undefined;
        postToPreview({
          type: 'SECTION_UPDATE',
          sectionId: op.sectionId,
          settings: liveSettings(prev?.settings ?? {}, op.settings, defaultsOf(def)),
        });
        postToPreview({ type: 'SCROLL_TO_SECTION', sectionId: op.sectionId });
      }
    },
    [postToPreview],
  );

  const { data, loading, loadFailed, reload, change, undo, canUndo, retry, saveState, lastWasUndo } =
    useHomepageEditor(onLive);

  const definitions = useMemo(
    () => new Map((data?.definitions ?? []).map((d) => [d.type, d])),
    [data?.definitions],
  );
  useEffect(() => {
    definitionsRef.current = definitions;
  }, [definitions]);

  const [previewHidden, setPreviewHidden] = useState(() => readJson<boolean>(PREVIEW_HIDDEN_KEY) === true);
  const togglePreview = () => {
    setPreviewHidden((hidden) => {
      writeJson(PREVIEW_HIDDEN_KEY, hidden ? null : true);
      return !hidden;
    });
  };
  const [phoneScreen] = useState(() =>
    Math.round(
      Math.min(PHONE_PREVIEW_MAX_PX, Math.max(PHONE_PREVIEW_MIN_PX, (typeof window !== 'undefined' ? window.innerHeight : 800) * PHONE_PREVIEW_SHARE)),
    ),
  );

  // ---- editing -------------------------------------------------------------

  const [openId, setOpenId] = useState<string | null>(null);
  const listed = data ? listedSections(data) : [];
  const allIds = data ? sortSections(data.sections).map((s) => s.id) : [];
  const listedIds = listed.map((s) => s.id);
  const openSection = listed.find((s) => s.id === openId) ?? null;

  const openSheet = (section: HomeSection) => {
    setOpenId(section.id);
    // Phones: bring the preview into view above the sheet, at this part.
    if (!isDesktop && !previewHidden) previewBoxRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    postToPreview({ type: 'SCROLL_TO_SECTION', sectionId: section.id });
  };

  const move = (id: string, delta: -1 | 1) => {
    const next = moveAmong(allIds, listedIds, id, delta);
    if (next) change({ kind: 'order', sectionIds: next });
  };

  const shown = listed.filter(isShown).length;

  // ---- render --------------------------------------------------------------

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-12 text-center text-muted-foreground">
        {loading ? (
          <Loader2 className="h-7 w-7 animate-spin" />
        ) : (
          <>
            <p>{t('storeDesign:load_failed')}</p>
            <Button variant="outline" className="h-11" onClick={() => void reload()}>
              <RotateCw className="h-4 w-4 me-2" />
              {t('storeDesign:try_again')}
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 pb-24 lg:pb-8">
      <Link
        to="/dashboard/store"
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4 ltr:rotate-180" />
        {t('nav:sidebar.storefront.my_store')}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('storeDesign:homepage.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('storeDesign:homepage.subtitle')}</p>
      </div>

      {loadFailed && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          {t('storeDesign:offline_copy')}
        </p>
      )}
      {data.isDraft && (
        <p className="rounded-lg border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200">
          {t('storeDesign:homepage.pending_advanced')}
        </p>
      )}

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-8">
        {/* Preview: first on phones (above the list), beside it on desktop. */}
        <div ref={previewBoxRef} className="scroll-mt-2 space-y-2 lg:sticky lg:top-4 lg:order-last">
          <div className="flex items-center justify-between gap-2 lg:hidden">
            <p className="text-sm font-medium text-muted-foreground">{t('storeDesign:preview.heading')}</p>
            <Button variant="ghost" className="h-11 px-3" onClick={togglePreview} aria-expanded={!previewHidden}>
              {previewHidden ? <Eye className="h-4 w-4 me-2" /> : <EyeOff className="h-4 w-4 me-2" />}
              {previewHidden ? t('storeDesign:homepage.preview.show') : t('storeDesign:homepage.preview.hide')}
            </Button>
          </div>
          <p className="hidden text-center text-sm font-medium text-muted-foreground lg:block">
            {t('storeDesign:preview.heading')}
          </p>
          {(isDesktop || !previewHidden) && (
            <PhonePreview
              iframeRef={iframeRef}
              screenHeight={isDesktop ? undefined : phoneScreen}
              onUrl={(url) => {
                try {
                  previewOriginRef.current = url ? new URL(url, window.location.origin).origin : null;
                } catch {
                  previewOriginRef.current = null;
                }
              }}
            />
          )}
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 className="text-base font-semibold">{t('storeDesign:homepage.list_title')}</h2>
            {listed.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {t('storeDesign:homepage.shown_count', { shown, total: listed.length })}
              </p>
            )}
          </div>

          {listed.length === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground shadow-sm">{t('storeDesign:homepage.empty')}</Card>
          ) : (
            <ol className="space-y-2">
              {listed.map((section, i) => (
                <SectionRow
                  key={section.id}
                  name={partName(section.type, definitions.get(section.type))}
                  shown={isShown(section)}
                  first={i === 0}
                  last={i === listed.length - 1}
                  onOpen={() => openSheet(section)}
                  onToggle={(visible) => change({ kind: 'visible', sectionId: section.id, visible })}
                  onMove={(delta) => move(section.id, delta)}
                />
              ))}
            </ol>
          )}

          {can('themes.write') && (
            <Link
              to="/dashboard/themes/editor"
              className="flex min-h-[64px] items-center gap-3 rounded-xl border bg-muted/30 p-3 transition-colors hover:bg-accent active:bg-accent"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <SlidersHorizontal className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold">{t('storeDesign:homepage.advanced.title')}</span>
                <span className="block text-sm text-muted-foreground">{t('storeDesign:homepage.advanced.help')}</span>
              </span>
              <Monitor className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <ChevronLeft className="h-5 w-5 shrink-0 text-muted-foreground ltr:rotate-180" aria-hidden />
            </Link>
          )}
        </div>
      </div>

      {!openSection && (
        <SaveBar state={saveState} undone={lastWasUndo} canUndo={canUndo} onUndo={undo} onRetry={retry} />
      )}

      <HomepageSectionSheet
        section={openSection}
        definition={openSection ? definitions.get(openSection.type) : undefined}
        onClose={() => setOpenId(null)}
        onChange={change}
        status={<SaveBar state={saveState} undone={lastWasUndo} canUndo={canUndo} onUndo={undo} onRetry={retry} inline />}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

interface SectionRowProps {
  name: string;
  shown: boolean;
  first: boolean;
  last: boolean;
  onOpen: () => void;
  onToggle: (visible: boolean) => void;
  onMove: (delta: -1 | 1) => void;
}

function SectionRow({ name, shown, first, last, onOpen, onToggle, onMove }: SectionRowProps) {
  const { t } = useTranslation('storeDesign');
  return (
    <li className={cn('flex items-stretch rounded-xl border bg-card shadow-sm', !shown && 'bg-muted/40')}>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-[64px] min-w-0 flex-1 flex-col justify-center rounded-s-xl px-3 py-2 text-start transition-colors hover:bg-accent active:bg-accent"
      >
        <span className={cn('block text-base font-semibold', !shown && 'text-muted-foreground')}>{name}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">
          {shown ? t('homepage.edit') : t('homepage.hidden')}
        </span>
      </button>
      <div className="flex shrink-0 items-center">
        <label className="flex h-full min-h-[48px] min-w-[52px] cursor-pointer items-center justify-center" title={t('homepage.show_part')}>
          <span className="sr-only">
            {t('homepage.show_part')}: {name}
          </span>
          <Switch checked={shown} onCheckedChange={onToggle} className="scale-125" />
        </label>
        <div className="flex flex-col border-s">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={first}
            aria-label={`${t('homepage.move_up')}: ${name}`}
            className="flex h-9 w-11 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={last}
            aria-label={`${t('homepage.move_down')}: ${name}`}
            className="flex h-9 w-11 items-center justify-center border-t text-muted-foreground hover:text-foreground disabled:opacity-30"
          >
            <ArrowDown className="h-5 w-5" />
          </button>
        </div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------

interface SaveBarProps {
  state: HomepageSaveState;
  undone: boolean;
  canUndo: boolean;
  onUndo: () => void;
  onRetry: () => void;
  /** Inside the edit sheet: in the flow instead of pinned to the screen bottom. */
  inline?: boolean;
}

/** "Saved — live on your store" + Undo, kept in view above the phone's bottom bar. */
function SaveBar({ state, undone, canUndo, onUndo, onRetry, inline }: SaveBarProps) {
  const { t } = useTranslation('storeDesign');
  if (state === 'idle') return null;
  const tone =
    state === 'saved'
      ? 'border-green-300 bg-green-50 text-green-900 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-100'
      : state === 'saving'
        ? 'border-border bg-card text-foreground'
        : state === 'retrying'
          ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100'
          : 'border-destructive/40 bg-destructive/10 text-destructive';
  const text =
    state === 'saved' ? t(undone ? 'homepage.status.undone' : 'homepage.status.saved') : t(`homepage.status.${state}`);
  const Icon = state === 'saving' ? Loader2 : state === 'saved' ? Check : CloudOff;
  return (
    <div
      className={cn(
        'flex min-h-[56px] items-center gap-2 rounded-xl border p-2 ps-3',
        !inline && 'sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 shadow-lg lg:bottom-4',
        tone,
      )}
      role="status"
      aria-live="polite"
    >
      <Icon className={cn('h-5 w-5 shrink-0', state === 'saving' && 'animate-spin')} aria-hidden />
      <p className="min-w-0 flex-1 text-sm font-medium">{text}</p>
      {state === 'saved' && canUndo && (
        <Button variant="outline" className="h-11 shrink-0 bg-background" onClick={onUndo}>
          <Undo2 className="h-4 w-4 me-2" />
          {t('homepage.undo')}
        </Button>
      )}
      {state === 'retrying' && (
        <Button variant="outline" className="h-11 shrink-0 bg-background" onClick={onRetry}>
          <RotateCw className="h-4 w-4 me-2" />
          {t('homepage.status.try_now')}
        </Button>
      )}
    </div>
  );
}
