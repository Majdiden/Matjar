import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Loader2, Settings2, Code, Layers, Monitor } from 'lucide-react';
import { useIsMobile } from '../../hooks/use-mobile';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';
import EditorTopBar, { type DeviceMode } from '../../components/theme-editor/EditorTopBar';
import PreviewFrame from '../../components/theme-editor/PreviewFrame';
import Canvas from '../../components/theme-editor/Canvas';
import SectionLibrary from '../../components/theme-editor/SectionLibrary';
import ManifestSectionEditor from '../../components/theme-editor/ManifestSectionEditor';
import ManifestGlobalSettings from '../../components/theme-editor/ManifestGlobalSettings';
import CustomCSSEditor from '../../components/theme-editor/CustomCSSEditor';
import { ScrollArea } from '../../components/ui/scroll-area';
import { useConfirm } from '../../components/ui/use-confirm';
import type {
  BlockInstance,
  ManifestSchema,
  SectionInstance as Section,
  SectionSetting,
} from '@matjar/theme-shared/types/theme';

interface ThemeCustomization {
  themeId: string | null;
  themeSlug?: string;
  isDraft: boolean;
  settings: {
    colors: Record<string, string>;
    typography: Record<string, string>;
    layout: Record<string, string>;
    /**
     * Manifest-level global settings (Shopify-style theme.settings[]).
     * Shape depends on the active theme; keys must match
     * manifest.settings[].id. Rendered via ManifestGlobalSettings →
     * SettingControl. Backend strictly validates on every write.
     */
    theme?: Record<string, unknown>;
  };
  sections: Section[];
  /**
   * Per-template section lists. Keys are template ids declared by
   * the backend allow-list (index, product, collection, cart,
   * search, page). The visual editor switches the active list when
   * the merchant picks a different page from the page selector.
   */
  sectionsByTemplate?: Record<string, Section[]>;
  availableTemplates?: string[];
  customCSS: string;
  /**
   * Manifest-declared global setting definitions (id/type/label/default).
   * Returned by GET /theme-customization alongside the draft so the
   * dashboard can render controls without a second request.
   */
  themeSettingsSchema?: SectionSetting[];
  previewToken: string | null;
  previewTokenExpiry: Date | null;
  lastPublishedAt: Date | null;
  updatedAt: Date;
}

interface CustomizationEnvelope {
  data: { customization: ThemeCustomization };
}
interface ManifestEnvelope {
  data: { schema: ManifestSchema };
}
interface TemplatesEnvelope {
  data?: {
    templates?: Array<{
      id: string;
      declaredByTheme: boolean;
      /** English fallback label from the backend template map (1.4.5) */
      label?: string;
      /** Storefront route the preview iframe should show for this template */
      previewPath?: string;
    }>;
  };
}
interface PreviewUrlEnvelope {
  data: { previewUrl: string };
}

/**
 * Right-panel mode. When a section is selected we flip to "section"
 * automatically so the section editor takes over; the merchant can
 * return to theme-level settings by clicking the Sections tab or by
 * deselecting the section.
 */
type RightPanelTab = 'section' | 'theme' | 'css';

/**
 * Page-selector entry. Labels and preview paths come from the backend
 * template endpoint (single source of truth next to the allow-list in
 * services/themeValidator.js); the dashboard translates by stable id
 * (`themes:editor.template.<id>`) and uses the backend label only as
 * the i18n fallback.
 */
interface PageOption {
  id: string;
  label: string;
  previewPath?: string;
}

/**
 * Read-compat shim (audit 1.5.3): older backend documents persist
 * section visibility as `enabled` while the SDK's canonical field is
 * `disabled`. Normalise every section list on read so editor code can
 * rely on `disabled` alone. The toggle API still speaks `enabled` on
 * the wire — that translation happens in exactly one place
 * (handleToggleSection).
 */
function normalizeSection(s: Section): Section {
  const disabled = s.disabled === true || s.enabled === false;
  return { ...s, disabled, enabled: !disabled };
}

function normalizeCustomization(cust: ThemeCustomization): ThemeCustomization {
  const byTpl = cust.sectionsByTemplate
    ? Object.fromEntries(
        Object.entries(cust.sectionsByTemplate).map(([k, list]) => [
          k,
          (list || []).map(normalizeSection),
        ])
      )
    : cust.sectionsByTemplate;
  return {
    ...cust,
    sections: (cust.sections || []).map(normalizeSection),
    sectionsByTemplate: byTpl,
  };
}

export default function VisualEditor() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { t } = useTranslation(['themes', 'common']);
  const isMobile = useIsMobile();
  const [customization, setCustomization] = useState<ThemeCustomization | null>(null);
  const [manifestSchema, setManifestSchema] = useState<ManifestSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [showSectionLibrary, setShowSectionLibrary] = useState(false);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [currentPage, setCurrentPage] = useState('index');
  const [pageOptions, setPageOptions] = useState<PageOption[]>([
    { id: 'index', label: t('themes:editor.template.index', { defaultValue: 'Home' }), previewPath: '/' },
  ]);
  const [previewReloadKey, setPreviewReloadKey] = useState(0);
  const [rightPanel, setRightPanel] = useState<RightPanelTab>('theme');
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Origin of the preview iframe, derived from the generated preview URL.
  // Every postMessage into the frame uses this as targetOrigin (never
  // '*') so protocol messages can't leak to a frame that navigated away.
  // The storefront side (ThemeProvider) mirrors this with a
  // source===parent check plus an origin allowlist.
  const previewOriginRef = useRef<string | null>(null);
  useEffect(() => {
    try {
      previewOriginRef.current = previewUrl
        ? new URL(previewUrl, window.location.origin).origin
        : null;
    } catch {
      previewOriginRef.current = null;
    }
  }, [previewUrl]);

  /**
   * Live-preview channel (audit 1.1). Sends one of the ThemeProvider
   * protocol messages (THEME_UPDATE / SECTION_UPDATE / SECTION_TOGGLE /
   * SECTION_REORDER / SETTINGS_UPDATE) into the preview iframe so edits
   * render in-memory without a server round-trip. Returns whether the
   * message was actually posted — callers fall back to the debounced
   * `theme-published` refetch when it wasn't (iframe not ready yet).
   */
  const postToPreview = useCallback((msg: Record<string, unknown>): boolean => {
    const frame = previewIframeRef.current;
    const origin = previewOriginRef.current;
    if (!frame?.contentWindow || !origin) return false;
    try {
      frame.contentWindow.postMessage(msg, origin);
      return true;
    } catch {
      return false;
    }
  }, []);

  // Soft refresh: tell the preview iframe to refetch /store-info in place.
  // The storefront StoreContext listens for `theme-published` and calls its
  // internal refresh() — React tree, scroll position, and component state
  // are preserved (no iframe remount, no flicker). Since 1.1 this is only
  // used for structural changes the live protocol can't express (add /
  // duplicate / delete section, block edits, custom CSS, non-index
  // templates); simple setting edits go through postToPreview instead.
  const postPreviewRefresh = useCallback(() => {
    const frame = previewIframeRef.current;
    if (!frame || !frame.contentWindow) {
      console.warn('[theme-editor] preview iframe not ready, skipping refresh');
      return;
    }
    const origin = previewOriginRef.current;
    if (!origin) {
      // No known preview origin — hard remount rather than posting with '*'.
      setPreviewReloadKey((k) => k + 1);
      return;
    }
    try {
      frame.contentWindow.postMessage({ type: 'theme-published' }, origin);
    } catch (err) {
      console.warn('[theme-editor] postMessage failed, falling back to reload', err);
      try {
        frame.contentWindow.location.reload();
      } catch {
        setPreviewReloadKey((k) => k + 1);
      }
    }
  }, []);

  useEffect(() => {
    loadCustomization();
  }, []);

  // Generate a fresh preview URL once after load
  useEffect(() => {
    if (customization && !previewUrl) {
      generatePreview();
    }
  }, [customization, previewUrl]);

  const loadCustomization = async () => {
    try {
      setLoading(true);
      const response = (await api.themeCustomization.get()) as CustomizationEnvelope;
      const cust = normalizeCustomization(response.data.customization);
      setCustomization(cust);

      const themeSlug = cust?.themeSlug || 'modern';
      try {
        const schemaRes = (await api.themeCustomization.getManifestSchema(themeSlug)) as ManifestEnvelope;
        setManifestSchema(schemaRes.data.schema);
      } catch {
        console.warn(`No manifest for theme "${themeSlug}"`);
      }

      // Fetch the allow-listed templates for the active theme and
      // populate the page selector. Fall back to home-only if the
      // endpoint fails so the editor still works offline.
      try {
        const tplRes = (await api.themeCustomization.listTemplates()) as TemplatesEnvelope;
        const list = tplRes.data?.templates || [];
        if (Array.isArray(list) && list.length > 0) {
          setPageOptions(
            list.map((tpl) => ({
              id: tpl.id,
              // Stable-id i18n first; the backend's English label is only
              // the defaultValue so untranslated ids still read well.
              label: t(`themes:editor.template.${tpl.id}`, {
                defaultValue: tpl.label || tpl.id,
              }),
              previewPath: tpl.previewPath || '/',
            }))
          );
        }
      } catch (e) {
        console.warn('Failed to load template list, defaulting to Home only', e);
      }
    } catch (error) {
      console.error('Failed to load customization:', error);
      toast.error(t('themes:editor.toast.error_load'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Resolve the section list for the currently-selected page. Falls
   * back to the legacy flat `sections` array when the merchant's
   * tenant doc hasn't been migrated to `sectionsByTemplate` yet (the
   * server-side shim does this too, but the dashboard needs to be
   * resilient against any shape the API returns).
   */
  const currentSections: Section[] = (() => {
    if (!customization) return [];
    const byTpl = customization.sectionsByTemplate || {};
    const list = byTpl[currentPage];
    if (Array.isArray(list)) return list;
    if (currentPage === 'index') return customization.sections || [];
    return [];
  })();

  const generatePreview = async () => {
    try {
      const response = (await api.themeCustomization.generatePreview(60)) as PreviewUrlEnvelope;
      setPreviewUrl(response.data.previewUrl);
    } catch (error) {
      console.error('Failed to generate preview:', error);
    }
  };

  // Schedule a debounced soft refresh of the preview iframe. Posts the
  // `theme-published` message once the auto-save has settled — the storefront
  // refetches /store-info and re-renders in place. No iframe remount, so the
  // merchant's scroll position and any in-page state (hovered nav, open
  // accordion, carousel slide) are preserved across edits.
  const schedulePreviewReload = useCallback(() => {
    if (previewReloadTimerRef.current) clearTimeout(previewReloadTimerRef.current);
    previewReloadTimerRef.current = setTimeout(() => {
      postPreviewRefresh();
    }, 800);
  }, [postPreviewRefresh]);

  const scheduleAutoSave = useCallback((
    updater?: () => Promise<void>,
    opts: { refreshPreview?: boolean } = {}
  ) => {
    // `refreshPreview: false` is passed by edit paths that already
    // pushed the change into the iframe via the live postMessage
    // protocol — re-fetching /store-info would be redundant network
    // noise (and is what the audit's <100 ms / no-fetch criterion bans).
    const { refreshPreview = true } = opts;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setSaveStatus('saving');
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        if (updater) await updater();
        setHasChanges(true);
        setSaveStatus('saved');
        if (refreshPreview) schedulePreviewReload();
        setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 1500);
      } catch (err) {
        console.error('Auto-save failed:', err);
        setSaveStatus('idle');
      }
    }, 400);
  }, [schedulePreviewReload]);

  const handleAddSection = async (sectionType: string) => {
    if (!customization) return;
    const prevIds = new Set(
      ((customization.sectionsByTemplate?.[currentPage] as Section[] | undefined) ||
        (customization.sections as Section[] | undefined) ||
        []).map((s) => s.id)
    );
    try {
      const response = (await api.themeCustomization.addSection(
        sectionType,
        undefined,
        undefined,
        { template: currentPage }
      )) as CustomizationEnvelope;
      const cust = normalizeCustomization(response.data.customization);
      setCustomization(cust);
      setHasChanges(true);
      schedulePreviewReload();
      // Select + scroll the preview to the newly added section.
      const list = (cust.sectionsByTemplate?.[currentPage] as Section[] | undefined) ||
        (cust.sections as Section[] | undefined) || [];
      const added = list.find((s) => !prevIds.has(s.id));
      if (added) {
        setSelectedSection(added);
        setRightPanel('section');
        postToPreview({ type: 'SCROLL_TO_SECTION', sectionId: added.id });
      }
      toast.success(t('themes:editor.toast.section_added'));
    } catch (error) {
      console.error('Failed to add section:', error);
      toast.error(t('themes:editor.toast.error_add_section'));
    }
  };

  const handleReorderSections = (reorderedSections: Section[]) => {
    if (!customization) return;
    // Patch only the active template's bucket in local state so
    // switching pages doesn't clobber unsaved work on another template.
    const byTpl = { ...(customization.sectionsByTemplate || {}) };
    byTpl[currentPage] = reorderedSections;
    setCustomization({
      ...customization,
      sections: currentPage === 'index' ? reorderedSections : customization.sections,
      sectionsByTemplate: byTpl,
      isDraft: true,
    });
    // Live preview: SECTION_REORDER carries the new ordered id list.
    // The ThemeProvider protocol only maps the flat (index) section
    // bucket, so other templates fall back to the debounced refetch.
    const covered =
      currentPage === 'index' &&
      postToPreview({
        type: 'SECTION_REORDER',
        sectionIds: reorderedSections.map((s) => s.id),
      });
    scheduleAutoSave(async () => {
      await api.themeCustomization.updateSections(reorderedSections, { template: currentPage });
    }, { refreshPreview: !covered });
  };

  /** `enable` = desired visibility; the wire API still calls it `enabled`. */
  const handleToggleSection = async (sectionId: string, enable: boolean) => {
    if (!customization) return;
    // Live preview first — instant feedback while the API call runs.
    const covered =
      currentPage === 'index' &&
      postToPreview({ type: 'SECTION_TOGGLE', sectionId, enabled: enable });
    try {
      const response = (await api.themeCustomization.toggleSection(sectionId, enable, {
        template: currentPage,
      })) as CustomizationEnvelope;
      const cust = normalizeCustomization(response.data.customization);
      setCustomization(cust);
      setHasChanges(true);
      if (!covered) schedulePreviewReload();
      if (selectedSection?.id === sectionId) {
        const byTpl = cust.sectionsByTemplate || {};
        const list = byTpl[currentPage] || cust.sections || [];
        const updated = list.find((s: Section) => s.id === sectionId);
        if (updated) setSelectedSection(updated);
      }
    } catch (error) {
      console.error('Failed to toggle section:', error);
      // The optimistic live toggle is now wrong — reconcile the iframe.
      if (covered) schedulePreviewReload();
      toast.error(t('themes:editor.toast.error_toggle_section'));
    }
  };

  const handleDuplicateSection = async (sectionId: string) => {
    if (!customization) return;
    try {
      const response = (await api.themeCustomization.duplicateSection(sectionId, {
        template: currentPage,
      })) as CustomizationEnvelope;
      setCustomization(normalizeCustomization(response.data.customization));
      setHasChanges(true);
      schedulePreviewReload();
      toast.success(t('themes:editor.toast.section_duplicated'));
    } catch (error) {
      console.error('Failed to duplicate section:', error);
      toast.error(t('themes:editor.toast.error_duplicate'));
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!customization) return;
    try {
      const response = (await api.themeCustomization.removeSection(sectionId, {
        template: currentPage,
      })) as CustomizationEnvelope;
      setCustomization(normalizeCustomization(response.data.customization));
      setHasChanges(true);
      schedulePreviewReload();
      if (selectedSection?.id === sectionId) setSelectedSection(null);
    } catch (error) {
      console.error('Failed to delete section:', error);
      toast.error(t('themes:editor.toast.error_delete'));
    }
  };

  // ── Global settings handlers ─────────────────────────────────────
  //
  // All three panels (colors/typography/layout, manifest theme settings,
  // custom CSS) flow through the same optimistic-update pattern: merge
  // the change into local state immediately so the editor feels instant,
  // then fire the API call in the background with the debounced
  // auto-save timer. On failure we surface a toast but keep the local
  // state — the merchant will see it diverge at publish time.

  const handleUpdateGlobalSettings = useCallback(
    (category: 'colors' | 'typography' | 'layout', partial: Record<string, string>) => {
      if (!customization) return;
      const nextBucket = { ...(customization.settings?.[category] || {}), ...partial };
      const nextSettings = { ...customization.settings, [category]: nextBucket };
      setCustomization({ ...customization, settings: nextSettings, isDraft: true });
      // Live preview: THEME_UPDATE with the FULL accumulated bucket —
      // the ThemeProvider replaces each bucket wholesale in its live
      // override state, so a partial would drop earlier unfetched edits.
      const covered = postToPreview({
        type: 'THEME_UPDATE',
        settings: { [category]: nextBucket },
      });
      scheduleAutoSave(async () => {
        await api.themeCustomization.updateSettings({ [category]: partial });
      }, { refreshPreview: !covered });
    },
    [customization, scheduleAutoSave, postToPreview]
  );

  const handleUpdateThemeSetting = useCallback(
    (key: string, value: unknown) => {
      if (!customization) return;
      const nextTheme = { ...(customization.settings?.theme || {}), [key]: value };
      const nextSettings = { ...customization.settings, theme: nextTheme };
      setCustomization({ ...customization, settings: nextSettings, isDraft: true });
      // Live preview: manifest-level globals ride the SETTINGS_UPDATE
      // message under the `theme` bucket (requires the ThemeProvider
      // merge to include `theme` — fixed as part of 1.1).
      const covered = postToPreview({
        type: 'SETTINGS_UPDATE',
        settings: { theme: nextTheme },
      });
      scheduleAutoSave(async () => {
        await api.themeCustomization.updateThemeSetting(key, value);
      }, { refreshPreview: !covered });
    },
    [customization, scheduleAutoSave, postToPreview]
  );

  const handleSaveCustomCSS = useCallback(
    async (css: string) => {
      if (!customization) return;
      setSaveStatus('saving');
      try {
        await api.themeCustomization.updateCustomCSS(css);
        setCustomization((prev) => (prev ? { ...prev, customCSS: css, isDraft: true } : prev));
        setHasChanges(true);
        setSaveStatus('saved');
        schedulePreviewReload();
        setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 1500);
        toast.success(t('themes:editor.toast.css_saved'));
      } catch (err: unknown) {
        console.error('Failed to save custom CSS:', err);
        const e = err as { response?: { data?: { message?: string } }; message?: string } | null;
        const msg = e?.response?.data?.message || e?.message || t('themes:editor.toast.error_save_css');
        toast.error(msg);
        setSaveStatus('idle');
      }
    },
    [customization, schedulePreviewReload]
  );

  // Selecting a section auto-switches the right panel to the section
  // editor. Deselecting falls back to whatever the merchant last had
  // open at the theme level. This mirrors Shopify's editor — you click
  // a section and its settings take focus.
  const handleSelectSection = useCallback((section: Section | null) => {
    setSelectedSection(section);
    if (section) {
      setRightPanel('section');
      // Scroll the preview to the section being edited (Shopify-style).
      postToPreview({ type: 'SCROLL_TO_SECTION', sectionId: section.id });
    }
  }, [postToPreview]);

  // Live-coverage bookkeeping for section edits. `SECTION_UPDATE` only
  // expresses setting changes; block add/remove/edit has no protocol
  // message, so any pending block change forces the refetch path on the
  // next save.
  const liveSettingsPostedRef = useRef(false);
  const pendingBlockChangesRef = useRef(false);

  /**
   * Called synchronously by ManifestSectionEditor on every keystroke,
   * BEFORE its debounced save. Pushes the change into the iframe via
   * SECTION_UPDATE (<100 ms, no network).
   */
  const handleSectionLiveChange = useCallback(
    (sectionId: string, settings: Record<string, unknown>, kind: 'settings' | 'blocks') => {
      if (kind === 'blocks') {
        pendingBlockChangesRef.current = true;
        return;
      }
      liveSettingsPostedRef.current =
        currentPage === 'index' &&
        postToPreview({ type: 'SECTION_UPDATE', sectionId, settings });
    },
    [currentPage, postToPreview]
  );

  const handleSaveSectionSettings = async (
    sectionId: string,
    settings: Record<string, unknown>,
    blocks?: BlockInstance[]
  ) => {
    if (!customization) return;
    setSaveStatus('saving');
    try {
      const response = (await api.themeCustomization.updateSectionSettings(
        sectionId,
        settings,
        blocks,
        { template: currentPage }
      )) as CustomizationEnvelope;
      setCustomization(normalizeCustomization(response.data.customization));
      setHasChanges(true);
      setSaveStatus('saved');
      // Skip the /store-info refetch when the whole batch was already
      // live-rendered via SECTION_UPDATE (settings-only edits on index).
      const covered =
        currentPage === 'index' &&
        liveSettingsPostedRef.current &&
        !pendingBlockChangesRef.current;
      if (!covered) schedulePreviewReload();
      liveSettingsPostedRef.current = false;
      pendingBlockChangesRef.current = false;
      setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 1500);
      // Don't reset selectedSection from response — local state already has fresh values
    } catch (error) {
      console.error('Failed to save section settings:', error);
      toast.error(t('themes:editor.toast.error_save_section'));
      setSaveStatus('idle');
    }
  };

  const handlePublish = async () => {
    try {
      setPublishing(true);
      await api.themeCustomization.publish();
      setHasChanges(false);
      await loadCustomization();
      // Force the preview iframe to refetch /store-info so newly added
      // sections render immediately. Reload key bump triggers an iframe
      // remount in PreviewFrame.
      setPreviewReloadKey((k) => k + 1);
      toast.success(t('themes:editor.toast.published'));
    } catch (error) {
      console.error('Failed to publish:', error);
      toast.error(t('themes:editor.toast.error_publish'));
    } finally {
      setPublishing(false);
    }
  };

  const handleReset = async () => {
    if (!(await confirm({
      title: t('themes:editor.confirm.reset_title'),
      description: t('themes:editor.confirm.reset_description'),
      confirmText: t('themes:editor.confirm.reset_confirm'),
      variant: 'destructive',
    }))) return;
    try {
      setPublishing(true);
      await api.themeCustomization.reset();
      setHasChanges(false);
      await loadCustomization();
      setSelectedSection(null);
      setPreviewReloadKey((k) => k + 1);
      toast.success(t('themes:editor.toast.reset_done'));
    } catch (error) {
      console.error('Failed to reset:', error);
      toast.error(t('themes:editor.toast.error_reset'));
    } finally {
      setPublishing(false);
    }
  };

  // The visual editor is a drag-heavy, multi-pane desktop tool — it's
  // unusable on a phone. Rather than ship a broken cramped layout, block it
  // on small screens and tell the merchant to switch to a desktop. Checked
  // before `loading` so we never even fetch/render the editor on mobile.
  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-6 text-center">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-5">
          <Monitor className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 max-w-xs">
          {t('themes:editor.mobile_blocked.title')}
        </h1>
        <p className="mt-2 text-sm text-slate-600 max-w-sm">
          {t('themes:editor.mobile_blocked.description')}
        </p>
        <button
          onClick={() => navigate('/dashboard/themes')}
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          {t('themes:editor.mobile_blocked.back')}
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('themes:editor.loading')}
        </div>
      </div>
    );
  }

  if (!customization) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-slate-600 text-sm">{t('themes:editor.no_data')}</p>
          <button
            onClick={() => navigate('/dashboard/themes')}
            className="mt-3 text-blue-600 hover:underline text-sm"
          >
            {t('themes:editor.back_to_themes')}
          </button>
        </div>
      </div>
    );
  }

  const themeName =
    manifestSchema && manifestSchema.name
      ? manifestSchema.name
      : customization.themeSlug
      ? customization.themeSlug.charAt(0).toUpperCase() + customization.themeSlug.slice(1) + ' theme'
      : 'Theme editor';

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <EditorTopBar
        themeName={themeName}
        isDraft={customization.isDraft}
        hasChanges={hasChanges}
        saving={publishing}
        saveStatus={saveStatus}
        deviceMode={deviceMode}
        onDeviceChange={setDeviceMode}
        pageOptions={pageOptions}
        currentPage={currentPage}
        onPageChange={(id) => {
          setCurrentPage(id);
          // Deselect whatever section was active on the previous
          // template — its id isn't meaningful on a different page.
          setSelectedSection(null);
          setRightPanel('theme');
          // Point the preview iframe at the route that renders the
          // selected template so the merchant sees the right page
          // even before they publish. The route comes from the backend
          // template metadata (1.4.5).
          const path = pageOptions.find((p) => p.id === id)?.previewPath || '/';
          if (previewUrl) {
            try {
              const u = new URL(previewUrl);
              // Preserve the preview token query param; replace the path.
              const newUrl = `${u.origin}${path}${u.search}`;
              setPreviewUrl(newUrl);
              setPreviewReloadKey((k) => k + 1);
            } catch {
              /* malformed preview URL — ignore, next generatePreview() call will reset it */
            }
          }
        }}
        onBack={() => navigate('/dashboard/themes')}
        onReset={handleReset}
        onPreview={() => window.open(previewUrl || '/', '_blank')}
        onPublish={handlePublish}
        onRollback={loadCustomization}
        leftSidebarOpen={leftSidebarOpen}
        rightSidebarOpen={rightSidebarOpen}
        onToggleLeftSidebar={() => setLeftSidebarOpen((v) => !v)}
        onToggleRightSidebar={() => setRightSidebarOpen((v) => !v)}
      />

      {/* Main 3-column body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left rail — section tree. Collapsible via the top-bar toggle
            so merchants can reclaim the full preview width when eyeballing
            layout. We render `null` rather than `hidden` to drop the DOM
            cost (Canvas subscribes to drag events) while collapsed. */}
        {leftSidebarOpen && (
        <aside className="w-72 shrink-0 bg-white border-e border-slate-200 flex flex-col">
          <div className="px-3 py-2.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t('themes:editor.sections_panel.title')}
            </h2>
            <button
              onClick={() => setShowSectionLibrary(true)}
              className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700"
            >
              <Plus className="h-3 w-3" />
              {t('themes:editor.sections_panel.add')}
            </button>
          </div>
          <ScrollArea className="flex-1">
            <Canvas
              sections={currentSections}
              sectionDefs={manifestSchema?.sections}
              onReorder={handleReorderSections}
              onToggleSection={handleToggleSection}
              onSelectSection={handleSelectSection}
              onDuplicateSection={handleDuplicateSection}
              onDeleteSection={handleDeleteSection}
              selectedSectionId={selectedSection?.id || null}
              onAddSection={() => setShowSectionLibrary(true)}
            />
          </ScrollArea>
        </aside>
        )}

        {/* Center — live preview */}
        <PreviewFrame
          url={previewUrl}
          deviceMode={deviceMode}
          reloadKey={previewReloadKey}
          iframeRef={previewIframeRef}
        />

        {/* Right rail — tabbed panel: Section / Theme Settings / Custom CSS.
            Section tab is enabled only when a section is selected. Theme
            Settings and Custom CSS are always reachable so merchants can
            edit colors/typography/layout/manifest-level settings and
            custom CSS without having to click on a section first. */}
        {rightSidebarOpen && (
        <aside className="w-80 shrink-0 bg-white border-s border-slate-200 flex flex-col">
          <div className="border-b border-slate-200 flex">
            {([
              { id: 'theme' as const, label: t('themes:editor.right_panel.tab.theme'), icon: Settings2, disabled: false },
              { id: 'section' as const, label: t('themes:editor.right_panel.tab.section'), icon: Layers, disabled: !selectedSection },
              { id: 'css' as const, label: t('themes:editor.right_panel.tab.css'), icon: Code, disabled: false },
            ]).map((tab) => {
              const Icon = tab.icon;
              const active = rightPanel === tab.id;
              const disabled = tab.disabled;
              return (
                <button
                  key={tab.id}
                  onClick={() => !disabled && setRightPanel(tab.id)}
                  disabled={disabled}
                  className={
                    'flex-1 px-3 py-2.5 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors ' +
                    (active
                      ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50/50'
                      : disabled
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-500 hover:text-slate-700 border-b-2 border-transparent')
                  }
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-hidden">
            {rightPanel === 'section' && selectedSection && (
              <ManifestSectionEditor
                section={selectedSection}
                sectionDefinition={
                  manifestSchema?.sections.find((s) => s.type === selectedSection.type) || null
                }
                onClose={() => {
                  setSelectedSection(null);
                  setRightPanel('theme');
                }}
                onSave={handleSaveSectionSettings}
                onLiveChange={handleSectionLiveChange}
                onToggle={handleToggleSection}
              />
            )}

            {rightPanel === 'theme' && (
              <ScrollArea className="h-full">
                <ManifestGlobalSettings
                  settings={{
                    colors: customization.settings?.colors || {},
                    typography: customization.settings?.typography || {},
                    layout: customization.settings?.layout || {},
                  }}
                  themeSettings={customization.themeSettingsSchema || []}
                  themeSettingValues={
                    (customization.settings?.theme as Record<string, unknown>) || {}
                  }
                  defaultColors={manifestSchema?.colors || {}}
                  colorLabels={manifestSchema?.colorLabels || {}}
                  defaultTypography={manifestSchema?.typography || {}}
                  defaultLayout={manifestSchema?.layout || {}}
                  manifestFonts={manifestSchema?.fonts || []}
                  onUpdate={handleUpdateGlobalSettings}
                  onUpdateThemeSetting={handleUpdateThemeSetting}
                />
              </ScrollArea>
            )}

            {rightPanel === 'css' && (
              <div className="h-full">
                <CustomCSSEditor
                  css={customization.customCSS || ''}
                  onSave={handleSaveCustomCSS}
                />
              </div>
            )}
          </div>
        </aside>
        )}
      </div>

      {/* Section library slide-in */}
      <SectionLibrary
        isOpen={showSectionLibrary}
        onClose={() => setShowSectionLibrary(false)}
        onAddSection={handleAddSection}
      />
    </div>
  );
}
