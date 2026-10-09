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
 * at once (useHomepageEditor), with a short "Saved — live on your store"
 * message and Undo floating above the bottom bar. The preview follows each
 * change, and each keystroke, through the full editor's postMessage
 * protocol (SECTION_UPDATE / SECTION_TOGGLE / SECTION_REORDER /
 * SETTINGS_UPDATE). Tapping a part in the preview opens its sheet
 * (PICK_MODE → SECTION_PICKED, see the storefront ThemeProvider).
 *
 * On phones the preview is pinned at the top of the page at full width, so
 * it stays in view above the list and above an open sheet. The store's top
 * strip (a theme-level setting, shown on every page) is the first row.
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
  Pencil,
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
  isTopStripShown,
  liveSettings,
  moveAmong,
  readBilingual,
  sortSections,
  TOP_STRIP_ID,
  TOP_STRIP_KEYS,
  type HomeSection,
  type HomepageOp,
} from '../../lib/homepageEditor';
import { cn } from '../../lib/utils';
import PhonePreview from './PhonePreview';
import HomepageSectionSheet from './HomepageSectionSheet';
import TopStripSheet from './TopStripSheet';
import { usePartName } from './homepageNames';

const PREVIEW_HIDDEN_KEY = 'matjar.homepagePreviewHidden';
const DESKTOP_QUERY = '(min-width: 1024px)';
/** How long "Saved" stays on screen. Saving, retrying and errors stay until resolved. */
const SAVED_MESSAGE_MS = 3500;

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
  const { t, i18n } = useTranslation(['storeDesign', 'nav']);
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

  /** Unsaved section settings (typing) → preview. */
  const previewSection = useCallback(
    (sectionId: string, settings: Record<string, unknown>, before?: HomeSection[]) => {
      const prev = (before ?? sectionsRef.current).find((s) => s.id === sectionId);
      const def = prev ? definitionsRef.current.get(prev.type) : undefined;
      postToPreview({
        type: 'SECTION_UPDATE',
        sectionId,
        settings: liveSettings(prev?.settings ?? {}, settings, defaultsOf(def)),
      });
    },
    [postToPreview],
  );
  /** Theme-level values (the top strip) → preview. */
  const previewTheme = useCallback(
    (theme: Record<string, unknown>) => postToPreview({ type: 'SETTINGS_UPDATE', settings: { theme } }),
    [postToPreview],
  );

  const onLive = useCallback(
    (op: HomepageOp, before: HomeSection[], theme: Record<string, unknown>) => {
      if (op.kind === 'theme') {
        previewTheme(theme);
      } else if (op.kind === 'visible') {
        postToPreview({ type: 'SECTION_TOGGLE', sectionId: op.sectionId, enabled: op.visible });
      } else if (op.kind === 'order') {
        postToPreview({ type: 'SECTION_REORDER', sectionIds: op.sectionIds });
      } else {
        previewSection(op.sectionId, op.settings, before);
      }
    },
    [postToPreview, previewSection, previewTheme],
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
  const sectionsRef = useRef<HomeSection[]>([]);
  useEffect(() => {
    sectionsRef.current = data?.sections ?? [];
  }, [data?.sections]);

  const [previewHidden, setPreviewHidden] = useState(() => readJson<boolean>(PREVIEW_HIDDEN_KEY) === true);
  const togglePreview = () => {
    setPreviewHidden((hidden) => {
      writeJson(PREVIEW_HIDDEN_KEY, hidden ? null : true);
      return !hidden;
    });
  };

  // ---- editing -------------------------------------------------------------

  const [openId, setOpenId] = useState<string | null>(null);
  const listed = data ? listedSections(data) : [];
  const allIds = data ? sortSections(data.sections).map((s) => s.id) : [];
  const listedIds = listed.map((s) => s.id);
  const openSection = listed.find((s) => s.id === openId) ?? null;
  const hasTopStrip = !!data?.hasTopStrip;
  const topStripOpen = hasTopStrip && openId === TOP_STRIP_ID;
  const theme = data?.theme ?? {};

  // The part being edited is outlined and scrolled to in the preview.
  useEffect(() => {
    postToPreview({ type: 'HIGHLIGHT_SECTION', sectionId: openId });
    if (openId) postToPreview({ type: 'SCROLL_TO_SECTION', sectionId: openId });
  }, [openId, postToPreview]);

  // Tap a part in the preview → open its sheet (listed parts and the strip only).
  const pickableRef = useRef<Set<string>>(new Set());
  pickableRef.current = new Set([...listedIds, ...(hasTopStrip ? [TOP_STRIP_ID] : [])]);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      const msg = event.data as { type?: string; sectionId?: unknown } | null;
      if (msg?.type !== 'SECTION_PICKED' || typeof msg.sectionId !== 'string') return;
      if (pickableRef.current.has(msg.sectionId)) setOpenId(msg.sectionId);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  const onPreviewLoad = () => {
    postToPreview({ type: 'PICK_MODE', enabled: true });
    if (openId) postToPreview({ type: 'HIGHLIGHT_SECTION', sectionId: openId });
  };

  const openSheet = (section: HomeSection) => setOpenId(section.id);

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
        {/* Preview: pinned at the top on phones (full width, above the list
            and any open sheet), beside the list on desktop. */}
        <div
          ref={previewBoxRef}
          className="sticky top-0 z-20 -mx-4 space-y-1 bg-background/95 px-4 pb-3 pt-1 backdrop-blur lg:static lg:top-4 lg:order-last lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none lg:sticky"
        >
          <div className="flex items-center justify-between gap-2 lg:hidden">
            <p className="text-sm font-medium text-muted-foreground">{t('storeDesign:homepage.preview.tap_hint')}</p>
            <Button variant="ghost" className="h-10 px-3" onClick={togglePreview} aria-expanded={!previewHidden}>
              {previewHidden ? <Eye className="h-4 w-4 me-2" /> : <EyeOff className="h-4 w-4 me-2" />}
              {previewHidden ? t('storeDesign:homepage.preview.show') : t('storeDesign:homepage.preview.hide')}
            </Button>
          </div>
          <p className="hidden text-center text-sm font-medium text-muted-foreground lg:block">
            {t('storeDesign:homepage.preview.tap_hint')}
          </p>
          {(isDesktop || !previewHidden) && (
            <PhonePreview
              iframeRef={iframeRef}
              fill={!isDesktop}
              className={isDesktop ? undefined : 'h-[38dvh]'}
              onLoad={onPreviewLoad}
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

          {hasTopStrip && (
            <ol className="space-y-2">
              <SectionRow
                name={t('storeDesign:homepage.top_strip.name')}
                detail={t('storeDesign:homepage.top_strip.everywhere')}
                preview={topStripPreview(theme, i18n.language) || t('storeDesign:homepage.top_strip.empty_prompt')}
                previewEmpty={!topStripPreview(theme, i18n.language)}
                shown={isTopStripShown(theme)}
                onOpen={() => setOpenId(TOP_STRIP_ID)}
                onToggle={(visible) => change({ kind: 'theme', settings: { [TOP_STRIP_KEYS.show]: visible } })}
              />
            </ol>
          )}

          {listed.length === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground shadow-sm">{t('storeDesign:homepage.empty')}</Card>
          ) : (
            <ol className="space-y-2">
              {listed.map((section, i) => (
                <SectionRow
                  key={section.id}
                  name={partName(section.type, definitions.get(section.type), section.settings)}
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

      {!openSection && !topStripOpen && (
        <SaveBar state={saveState} undone={lastWasUndo} canUndo={canUndo} onUndo={undo} onRetry={retry} />
      )}

      <HomepageSectionSheet
        section={openSection}
        definition={openSection ? definitions.get(openSection.type) : undefined}
        onClose={() => setOpenId(null)}
        onChange={change}
        onPreview={(sectionId, settings) => previewSection(sectionId, settings)}
        status={<SaveBar state={saveState} undone={lastWasUndo} canUndo={canUndo} onUndo={undo} onRetry={retry} inline />}
      />

      <TopStripSheet
        open={topStripOpen}
        values={theme}
        onClose={() => setOpenId(null)}
        onChange={change}
        onPreview={(settings) => previewTheme({ ...theme, ...settings })}
        status={<SaveBar state={saveState} undone={lastWasUndo} canUndo={canUndo} onUndo={undo} onRetry={retry} inline />}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

/** The top strip's text in the dashboard language (else the other one), for its row. */
function topStripPreview(values: Record<string, unknown>, lang: string): string {
  const text = readBilingual(values, TOP_STRIP_KEYS.text);
  const first = lang.startsWith('ar') ? text.ar : text.en;
  return (first || text.ar || text.en || '').trim();
}

interface SectionRowProps {
  name: string;
  /** Second line (e.g. "On every page"). */
  detail?: string;
  /** What the part says now, quoted under its name (e.g. the top strip text). */
  preview?: string;
  /** `preview` is a prompt to write something, not the text itself. */
  previewEmpty?: boolean;
  shown: boolean;
  first?: boolean;
  last?: boolean;
  onOpen: () => void;
  onToggle: (visible: boolean) => void;
  /** Omitted for rows that can't move (the top strip). */
  onMove?: (delta: -1 | 1) => void;
}

function SectionRow({ name, detail, preview, previewEmpty, shown, first, last, onOpen, onToggle, onMove }: SectionRowProps) {
  const { t } = useTranslation('storeDesign');
  return (
    <li className={cn('flex items-stretch rounded-xl border bg-card shadow-sm', !shown && 'bg-muted/40')}>
      <button
        type="button"
        onClick={onOpen}
        className="group flex min-h-[64px] min-w-0 flex-1 items-center gap-2 rounded-s-xl px-3 py-2 text-start transition-colors hover:bg-accent active:bg-accent"
      >
        <span className="min-w-0 flex-1">
          <span className={cn('block text-base font-semibold', !shown && 'text-muted-foreground')}>{name}</span>
          {preview && (
            <bdi className={cn('mt-0.5 block truncate text-sm', previewEmpty ? 'italic text-muted-foreground' : 'text-foreground')}>
              {previewEmpty ? preview : `«${preview}»`}
            </bdi>
          )}
          {(!shown || detail) && (
            <span className="mt-0.5 block text-xs text-muted-foreground">{shown ? detail : t('homepage.hidden')}</span>
          )}
        </span>
        {/* Says plainly that tapping the row opens it for editing. */}
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary transition-colors group-hover:bg-primary/15">
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          {t('homepage.edit')}
        </span>
      </button>
      <div className="flex shrink-0 items-center">
        <label className="flex h-full min-h-[48px] min-w-[52px] cursor-pointer items-center justify-center" title={t('homepage.show_part')}>
          <span className="sr-only">
            {t('homepage.show_part')}: {name}
          </span>
          <Switch checked={shown} onCheckedChange={onToggle} className="scale-125" />
        </label>
        {onMove && (
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
        )}
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

/**
 * "Saved — live on your store" + Undo. On the page it floats above the
 * phone's bottom bar (never over the list) and "Saved" fades after a few
 * seconds; saving, retrying and errors stay until they resolve. Inside a
 * sheet it sits in the sheet's footer.
 */
function SaveBar({ state, undone, canUndo, onUndo, onRetry, inline }: SaveBarProps) {
  const { t } = useTranslation('storeDesign');
  const [savedVisible, setSavedVisible] = useState(true);
  useEffect(() => {
    setSavedVisible(true);
    if (state !== 'saved' || inline) return;
    const timer = setTimeout(() => setSavedVisible(false), SAVED_MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [state, undone, inline]);
  if (state === 'idle' || (state === 'saved' && !savedVisible)) return null;
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
        'flex min-h-[52px] items-center gap-2 rounded-xl border p-1.5 ps-3',
        !inline &&
          'fixed inset-x-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md shadow-lg animate-in fade-in slide-in-from-bottom-2 lg:bottom-6',
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
