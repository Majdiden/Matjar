import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Loader2, Settings2, Code, Layers } from 'lucide-react';
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
} from '../../components/theme-editor/types';

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
  data?: { templates?: Array<{ id: string; declaredByTheme: boolean }> };
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
 * Friendly labels for the platform template ids. Kept in lockstep
 * with the backend allow-list in services/themeValidator.js.
 * Resolved via i18n in the component — the map is kept as a fallback
 * for contexts where the hook isn't available.
 */
const TEMPLATE_LABELS: Record<string, string> = {
  index: 'Home',
  product: 'Product page',
  collection: 'Collection / Category',
  cart: 'Cart',
  search: 'Search results',
  page: 'Static pages',
};

/**
 * Preview path for each template. Generic slugs are good enough for
 * the first render — the preview iframe's storefront routes know
 * how to resolve `:slug` to the first active product/category.
 */
const TEMPLATE_PREVIEW_PATHS: Record<string, string> = {
  index: '/',
  product: '/products',
  collection: '/categories',
  cart: '/cart',
  search: '/search',
  page: '/',
};

export default function VisualEditor() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { t } = useTranslation(['themes', 'common']);
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
  const [pageOptions, setPageOptions] = useState<Array<{ id: string; label: string }>>([
    { id: 'index', label: t('themes:editor.template.index', { defaultValue: TEMPLATE_LABELS.index }) },
  ]);
  const [previewReloadKey, setPreviewReloadKey] = useState(0);
  const [rightPanel, setRightPanel] = useState<RightPanelTab>('theme');
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Soft refresh: tell the preview iframe to refetch /store-info in place.
  // The storefront StoreContext listens for `theme-published` and calls its
  // internal refresh() — React tree, scroll position, and component state
  // are preserved (no iframe remount, no flicker). This replaces the old
  // key-based remount path for all auto-save triggered refreshes; the hard
  // remount is kept only as a fallback for publish/rollback when the
  // storefront bundle itself may have changed.
  const postPreviewRefresh = useCallback(() => {
    const frame = previewIframeRef.current;
    if (!frame || !frame.contentWindow) {
      console.warn('[theme-editor] preview iframe not ready, skipping refresh');
      return;
    }
    try {
      frame.contentWindow.postMessage({ type: 'theme-published' }, '*');
      console.log('[theme-editor] posted theme-published to preview iframe');
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
      const cust = response.data.customization;
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
        const list: Array<{ id: string; declaredByTheme: boolean }> =
          tplRes.data?.templates || [];
        if (Array.isArray(list) && list.length > 0) {
          setPageOptions(
            list.map((tpl) => ({
              id: tpl.id,
              label: t(`themes:editor.template.${tpl.id}`, {
                defaultValue: TEMPLATE_LABELS[tpl.id] || tpl.id,
              }),
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

  const scheduleAutoSave = useCallback((updater?: () => Promise<void>) => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    setSaveStatus('saving');
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        if (updater) await updater();
        setHasChanges(true);
        setSaveStatus('saved');
        schedulePreviewReload();
        setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 1500);
      } catch (err) {
        console.error('Auto-save failed:', err);
        setSaveStatus('idle');
      }
    }, 400);
  }, [schedulePreviewReload]);

  const handleAddSection = async (sectionType: string) => {
    if (!customization) return;
    try {
      const response = (await api.themeCustomization.addSection(
        sectionType,
        undefined,
        undefined,
        { template: currentPage }
      )) as CustomizationEnvelope;
      setCustomization(response.data.customization);
      setHasChanges(true);
      schedulePreviewReload();
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
    scheduleAutoSave(async () => {
      await api.themeCustomization.updateSections(reorderedSections, { template: currentPage });
    });
  };

  const handleToggleSection = async (sectionId: string, enabled: boolean) => {
    if (!customization) return;
    try {
      const response = (await api.themeCustomization.toggleSection(sectionId, enabled, {
        template: currentPage,
      })) as CustomizationEnvelope;
      setCustomization(response.data.customization);
      setHasChanges(true);
      schedulePreviewReload();
      if (selectedSection?.id === sectionId) {
        const byTpl = response.data.customization.sectionsByTemplate || {};
        const list = byTpl[currentPage] || response.data.customization.sections || [];
        const updated = list.find((s: Section) => s.id === sectionId);
        if (updated) setSelectedSection(updated);
      }
    } catch (error) {
      console.error('Failed to toggle section:', error);
      toast.error(t('themes:editor.toast.error_toggle_section'));
    }
  };

  const handleDuplicateSection = async (sectionId: string) => {
    if (!customization) return;
    try {
      const response = (await api.themeCustomization.duplicateSection(sectionId, {
        template: currentPage,
      })) as CustomizationEnvelope;
      setCustomization(response.data.customization);
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
      setCustomization(response.data.customization);
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
      scheduleAutoSave(async () => {
        await api.themeCustomization.updateSettings({ [category]: partial });
      });
    },
    [customization, scheduleAutoSave]
  );

  const handleUpdateThemeSetting = useCallback(
    (key: string, value: unknown) => {
      if (!customization) return;
      const nextTheme = { ...(customization.settings?.theme || {}), [key]: value };
      const nextSettings = { ...customization.settings, theme: nextTheme };
      setCustomization({ ...customization, settings: nextSettings, isDraft: true });
      scheduleAutoSave(async () => {
        await api.themeCustomization.updateThemeSetting(key, value);
      });
    },
    [customization, scheduleAutoSave]
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
    if (section) setRightPanel('section');
  }, []);

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
      setCustomization(response.data.customization);
      setHasChanges(true);
      setSaveStatus('saved');
      schedulePreviewReload();
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
          // even before they publish.
          const path = TEMPLATE_PREVIEW_PATHS[id] || '/';
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
                  defaultTypography={manifestSchema?.typography || {}}
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
