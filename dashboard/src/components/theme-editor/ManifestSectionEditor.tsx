/**
 * ManifestSectionEditor — right-rail section settings panel.
 * Renders controls driven by the theme manifest's section schema.
 * Auto-saves on change (no manual save button) — the parent
 * VisualEditor handles debounced persistence.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ChevronDown, ChevronRight, Plus, Trash2, GripVertical, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import SettingControl from './SettingControl';
import { resolveSectionMeta } from './sectionMeta';
import { ScrollArea } from '../ui/scroll-area';
import { Button } from '../ui/button';
import type {
  BlockInstance,
  SectionDefinition,
  SectionInstance,
  SectionSetting,
} from '@matjar/theme-shared/types/theme';

interface ManifestSectionEditorProps {
  section: SectionInstance;
  sectionDefinition: SectionDefinition | null;
  onClose: () => void;
  onSave: (sectionId: string, settings: Record<string, unknown>, blocks?: BlockInstance[]) => void;
  /**
   * Fired synchronously on every edit, BEFORE the debounced save, so
   * the parent can live-render the change in the preview iframe
   * (audit 1.1). `kind` distinguishes plain setting edits (covered by
   * the SECTION_UPDATE protocol message) from block mutations (not
   * expressible in the protocol — the parent falls back to a refetch).
   */
  onLiveChange?: (
    sectionId: string,
    settings: Record<string, unknown>,
    kind: 'settings' | 'blocks'
  ) => void;
  /** `enable` is the desired visibility (wire format of the toggle API). */
  onToggle?: (sectionId: string, enable: boolean) => void;
}

export default function ManifestSectionEditor({
  section,
  sectionDefinition,
  onClose,
  onSave,
  onLiveChange,
  onToggle,
}: ManifestSectionEditorProps) {
  const { t } = useTranslation('themes');
  const [editedSettings, setEditedSettings] = useState<Record<string, unknown>>({});
  const [editedBlocks, setEditedBlocks] = useState<BlockInstance[]>([]);
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionIdRef = useRef(section.id);

  useEffect(() => {
    if (section) {
      const defaults: Record<string, unknown> = {};
      if (sectionDefinition) {
        for (const setting of sectionDefinition.settings) {
          if (setting.default !== undefined) {
            defaults[setting.id] = setting.default;
          }
        }
      }
      setEditedSettings({ ...defaults, ...(section.settings || {}) });
      setEditedBlocks(section.blocks || []);
      sectionIdRef.current = section.id;
    }
  }, [section, sectionDefinition]);

  // Debounced auto-save
  const scheduleSave = useCallback(
    (settings: Record<string, unknown>, blocks: BlockInstance[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSave(sectionIdRef.current, settings, blocks.length > 0 ? blocks : undefined);
      }, 350);
    },
    [onSave]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSettingChange = useCallback(
    (key: string, value: unknown) => {
      setEditedSettings((prev) => {
        const next = { ...prev, [key]: value };
        // Push into the live preview immediately (no debounce) — the
        // parent posts a SECTION_UPDATE protocol message to the iframe.
        onLiveChange?.(sectionIdRef.current, next, 'settings');
        scheduleSave(next, editedBlocks);
        return next;
      });
    },
    [scheduleSave, editedBlocks, onLiveChange]
  );

  const handleBlockSettingChange = useCallback(
    (blockId: string, key: string, value: unknown) => {
      setEditedBlocks((prev) => {
        const next = prev.map((b) =>
          b.id === blockId ? { ...b, settings: { ...b.settings, [key]: value } } : b
        );
        // Block edits aren't expressible in the live protocol — flag
        // them so the parent refetches after the debounced save.
        onLiveChange?.(sectionIdRef.current, editedSettings, 'blocks');
        scheduleSave(editedSettings, next);
        return next;
      });
    },
    [scheduleSave, editedSettings, onLiveChange]
  );

  const handleAddBlock = useCallback(
    (blockType: string) => {
      const blockDef = sectionDefinition?.blocks?.find((b) => b.type === blockType);
      if (!blockDef) return;
      const defaults: Record<string, unknown> = {};
      for (const setting of blockDef.settings) {
        if (setting.default !== undefined) defaults[setting.id] = setting.default;
      }
      const newBlock: BlockInstance = {
        id: `${section.id}-${blockType}-${Date.now().toString(36)}`,
        type: blockType,
        settings: defaults,
      };
      setEditedBlocks((prev) => {
        const next = [...prev, newBlock];
        onLiveChange?.(sectionIdRef.current, editedSettings, 'blocks');
        scheduleSave(editedSettings, next);
        return next;
      });
      setExpandedBlock(newBlock.id);
    },
    [section, sectionDefinition, scheduleSave, editedSettings, onLiveChange]
  );

  const handleRemoveBlock = useCallback(
    (blockId: string) => {
      setEditedBlocks((prev) => {
        const next = prev.filter((b) => b.id !== blockId);
        onLiveChange?.(sectionIdRef.current, editedSettings, 'blocks');
        scheduleSave(editedSettings, next);
        return next;
      });
      if (expandedBlock === blockId) setExpandedBlock(null);
    },
    [expandedBlock, scheduleSave, editedSettings, onLiveChange]
  );

  // A section whose type is no longer in the manifest (audit 1.7): the
  // backend annotates it `known: false`. We must NOT run inferSettings for
  // it — guessing controls for a type the theme can't render is exactly the
  // asymmetry 1.7 closes. inferSettings stays ONLY for the legitimate
  // fallback: a KNOWN section type whose manifest def lacks a settings array.
  const isUnknown = section.known === false;
  const settingsSchema: SectionSetting[] = isUnknown
    ? []
    : sectionDefinition?.settings || inferSettings(editedSettings);

  // Manifest definition wins for icon/name (1.4); static map is fallback.
  const meta = resolveSectionMeta(section.type, sectionDefinition);
  const Icon = meta.icon;
  const sectionName = t(`themes:sections.${section.type}.name`, { defaultValue: meta.name });
  const isVisible = section.disabled !== true;

  return (
    <aside className="h-full flex flex-col bg-white border-s border-slate-200">
      {/* Sticky header */}
      <div className="shrink-0 px-4 py-3 border-b border-slate-200 bg-white">
        <div className="flex items-start gap-2.5">
          <div className="h-8 w-8 rounded-md bg-blue-50 flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-900 truncate">
              {sectionDefinition?.name || sectionName}
            </h3>
            {sectionDefinition?.description && (
              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-snug">
                {sectionDefinition.description}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {onToggle && (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => onToggle(section.id, !isVisible)}
              className={`flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium rounded transition ${
                isVisible
                  ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {isVisible ? (
                <>
                  <Eye className="h-3 w-3" /> {t('themes:editor.section_editor.visible')}
                </>
              ) : (
                <>
                  <EyeOff className="h-3 w-3" /> {t('themes:editor.section_editor.hidden')}
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Scrollable settings */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {isUnknown && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-amber-800">
                    {t('themes:editor.section_editor.unsupported_title')}
                  </p>
                  <p className="text-[11px] text-amber-700 mt-1 leading-snug">
                    {t('themes:editor.section_editor.unsupported_description')}
                  </p>
                  <p className="text-[10px] text-amber-600 mt-1 font-mono">{section.type}</p>
                </div>
              </div>
            </div>
          )}

          {!isUnknown && settingsSchema.length === 0 && (!sectionDefinition?.blocks || sectionDefinition.blocks.length === 0) && (
            <p className="text-xs text-slate-400 italic">
              {t('themes:editor.section_editor.no_settings')}
            </p>
          )}

          {settingsSchema.map((setting) => (
            <SettingControl
              key={setting.id}
              setting={setting}
              value={editedSettings[setting.id]}
              onChange={(v) => handleSettingChange(setting.id, v)}
              arValue={editedSettings[`${setting.id}__ar`]}
              onArChange={(v) => handleSettingChange(`${setting.id}__ar`, v)}
            />
          ))}

          {sectionDefinition?.blocks && sectionDefinition.blocks.length > 0 && (
            <div className="pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {sectionDefinition.blocks[0]?.name || t('themes:editor.section_editor.items_label')}
                </h4>
                <button
                  onClick={() => handleAddBlock(sectionDefinition.blocks![0].type)}
                  className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Plus className="h-3 w-3" />
                  {t('themes:editor.section_editor.add_item')}
                </button>
              </div>

              <div className="space-y-1.5">
                {editedBlocks.map((block, idx) => {
                  const blockDef = sectionDefinition.blocks!.find((b) => b.type === block.type);
                  const isExpanded = expandedBlock === block.id;
                  const blockTitle =
                    block.settings?.title ||
                    block.settings?.heading ||
                    block.settings?.label ||
                    `${blockDef?.name || block.type} ${idx + 1}`;

                  return (
                    <div
                      key={block.id}
                      className="border border-slate-200 rounded-md overflow-hidden bg-white"
                    >
                      <div className="flex items-center gap-1 px-2 py-1.5 bg-slate-50 hover:bg-slate-100 transition">
                        <GripVertical className="h-3 w-3 text-slate-300 shrink-0" />
                        <button
                          onClick={() => setExpandedBlock(isExpanded ? null : block.id)}
                          className="flex-1 flex items-center gap-1.5 text-start min-w-0"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-slate-400 shrink-0 rtl:rotate-180" />
                          )}
                          <span className="text-xs font-medium text-slate-700 truncate">
                            {String(blockTitle)}
                          </span>
                        </button>
                        <button
                          onClick={() => handleRemoveBlock(block.id)}
                          className="text-slate-400 hover:text-red-500 transition p-1"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>

                      {isExpanded && blockDef && (
                        <div className="p-3 space-y-4 border-t border-slate-100">
                          {blockDef.settings.map((setting) => (
                            <SettingControl
                              key={setting.id}
                              setting={setting}
                              value={block.settings[setting.id]}
                              onChange={(v) => handleBlockSettingChange(block.id, setting.id, v)}
                              arValue={block.settings[`${setting.id}__ar`]}
                              onArChange={(v) => handleBlockSettingChange(block.id, `${setting.id}__ar`, v)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}

function inferSettings(data: Record<string, unknown>): SectionSetting[] {
  return Object.entries(data).map(([key, value]) => {
    const label = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^\w/, (c) => c.toUpperCase())
      .trim();

    if (typeof value === 'boolean') {
      return { id: key, type: 'checkbox', label, default: value };
    }
    if (typeof value === 'number') {
      return { id: key, type: 'number', label, default: value };
    }
    if (typeof value === 'string' && value.match(/^#[0-9a-fA-F]{3,8}$/)) {
      return { id: key, type: 'color', label, default: value };
    }
    if (typeof value === 'string' && (value.startsWith('http') || value.startsWith('/'))) {
      return { id: key, type: 'url', label, default: value };
    }
    return { id: key, type: 'text', label, default: value?.toString() || '' };
  });
}
