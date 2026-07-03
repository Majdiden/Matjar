/**
 * Canvas — left-rail section tree for the visual theme editor.
 * Groups sections by visual area (header / template body / footer),
 * supports drag-to-reorder within the template area, click-to-select,
 * and quick actions (toggle visibility, duplicate, delete).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical, Eye, EyeOff, Copy, Trash2, Plus, MoreHorizontal, AlertTriangle } from 'lucide-react';
import { resolveSectionMeta } from './sectionMeta';
import type { SectionDefinition, SectionInstance } from '@matjar/theme-shared/types/theme';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { useConfirm } from '../ui/use-confirm';

type Section = SectionInstance;

interface CanvasProps {
  sections: Section[];
  /**
   * Section definitions from the active theme's manifest — the primary
   * source for icon / category / display name (1.4). Optional; rows
   * fall back to the static sectionMeta map.
   */
  sectionDefs?: SectionDefinition[];
  onReorder: (sections: Section[]) => void;
  /** `enable` is the desired visibility (wire format of the toggle API). */
  onToggleSection: (sectionId: string, enable: boolean) => void;
  onSelectSection: (section: Section) => void;
  onDuplicateSection: (sectionId: string) => void;
  onDeleteSection: (sectionId: string) => void;
  selectedSectionId: string | null;
  onAddSection?: () => void;
}

export default function Canvas({
  sections,
  sectionDefs,
  onReorder,
  onToggleSection,
  onSelectSection,
  onDuplicateSection,
  onDeleteSection,
  selectedSectionId,
  onAddSection,
}: CanvasProps) {
  const { t } = useTranslation('themes');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const defByType = new Map((sectionDefs || []).map((d) => [d.type, d]));
  // A section is "unsupported" (audit 1.7) when its type is no longer
  // declared by the active theme's manifest. Trust the backend `known`
  // annotation first; fall back to the loaded manifest schema when we
  // actually have one (an empty/absent schema means we simply can't tell,
  // so we must NOT flag everything as unknown).
  const hasManifestSchema = Array.isArray(sectionDefs) && sectionDefs.length > 0;
  const isUnknownType = (s: Section) =>
    s.known === false || (hasManifestSchema && !defByType.has(s.type));
  const sortedSections = [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // Bucket by area
  const buckets: { header: Section[]; template: Section[]; footer: Section[] } = {
    header: [],
    template: [],
    footer: [],
  };
  for (const s of sortedSections) {
    const area = resolveSectionMeta(s.type, defByType.get(s.type)).area;
    if (area === 'header') buckets.header.push(s);
    else if (area === 'footer') buckets.footer.push(s);
    else buckets.template.push(s);
  }

  // Drag operates on the flattened (template) bucket only.
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;
    setDropIndex(index);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex === null || dropIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDropIndex(null);
      return;
    }
    const newTemplate = [...buckets.template];
    const [moved] = newTemplate.splice(draggedIndex, 1);
    newTemplate.splice(dropIndex, 0, moved);

    // Reassemble all sections in order: header → template → footer
    const reassembled = [...buckets.header, ...newTemplate, ...buckets.footer].map((s, i) => ({
      ...s,
      order: i,
    }));

    onReorder(reassembled);
    setDraggedIndex(null);
    setDropIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropIndex(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header bucket */}
      <SectionGroup label={t('themes:editor.canvas.area_header')}>
        {buckets.header.length === 0 ? (
          <EmptyRow text={t('themes:editor.canvas.empty_header')} />
        ) : (
          buckets.header.map((s) => (
            <SectionRow
              key={s.id}
              section={s}
              sectionDef={defByType.get(s.type)}
              unknown={isUnknownType(s)}
              selected={selectedSectionId === s.id}
              onClick={() => onSelectSection(s)}
              onToggle={() => onToggleSection(s.id, s.disabled === true)}
              onDuplicate={() => onDuplicateSection(s.id)}
              onDelete={() => onDeleteSection(s.id)}
              draggable={false}
            />
          ))
        )}
      </SectionGroup>

      {/* Template bucket — draggable */}
      <SectionGroup label={t('themes:editor.canvas.area_template')}>
        <div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
          {buckets.template.length === 0 ? (
            <EmptyRow text={t('themes:editor.canvas.empty_template')} />
          ) : (
            buckets.template.map((s, idx) => (
              <div key={s.id}>
                {dropIndex === idx && draggedIndex !== null && draggedIndex > idx && (
                  <DropIndicator />
                )}
                <SectionRow
                  section={s}
                  sectionDef={defByType.get(s.type)}
                  unknown={isUnknownType(s)}
                  selected={selectedSectionId === s.id}
                  onClick={() => onSelectSection(s)}
                  onToggle={() => onToggleSection(s.id, s.disabled === true)}
                  onDuplicate={() => onDuplicateSection(s.id)}
                  onDelete={() => onDeleteSection(s.id)}
                  draggable
                  dragging={draggedIndex === idx}
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                />
                {dropIndex === idx && draggedIndex !== null && draggedIndex < idx && (
                  <DropIndicator />
                )}
              </div>
            ))
          )}
        </div>
        {onAddSection && (
          <button
            onClick={onAddSection}
            className="w-full mt-1 mx-2 flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition"
            style={{ width: 'calc(100% - 1rem)' }}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('themes:editor.canvas.add_section')}
          </button>
        )}
      </SectionGroup>

      {/* Footer bucket */}
      <SectionGroup label={t('themes:editor.canvas.area_footer')}>
        {buckets.footer.length === 0 ? (
          <EmptyRow text={t('themes:editor.canvas.empty_footer')} />
        ) : (
          buckets.footer.map((s) => (
            <SectionRow
              key={s.id}
              section={s}
              sectionDef={defByType.get(s.type)}
              unknown={isUnknownType(s)}
              selected={selectedSectionId === s.id}
              onClick={() => onSelectSection(s)}
              onToggle={() => onToggleSection(s.id, s.disabled === true)}
              onDuplicate={() => onDuplicateSection(s.id)}
              onDelete={() => onDeleteSection(s.id)}
              draggable={false}
            />
          ))
        )}
      </SectionGroup>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────

function SectionGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2">
      <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
        {label}
      </p>
      <div className="px-2">{children}</div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-2 py-1.5 text-xs text-slate-400 italic">{text}</p>;
}

function DropIndicator() {
  return <div className="h-0.5 bg-blue-500 rounded-full mx-2 my-0.5" />;
}

interface SectionRowProps {
  section: Section;
  sectionDef?: SectionDefinition;
  /** True when the section's type is no longer in the theme manifest (1.7). */
  unknown?: boolean;
  selected: boolean;
  onClick: () => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  draggable: boolean;
  dragging?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
}

function SectionRow({
  section,
  sectionDef,
  unknown,
  selected,
  onClick,
  onToggle,
  onDuplicate,
  onDelete,
  draggable,
  dragging,
  onDragStart,
  onDragOver,
  onDragEnd,
}: SectionRowProps) {
  const { t } = useTranslation('themes');
  const confirm = useConfirm();
  const meta = resolveSectionMeta(section.type, sectionDef);
  const Icon = meta.icon;
  const sectionName = t(`themes:sections.${section.type}.name`, { defaultValue: meta.name });
  // Sections declared in home variants can ship without a `settings` object
  // (settings fall through to the section-type defaults at render time).
  // The editor row just needs a display hint, so default to an empty bag.
  const settings = section.settings || {};
  const subtitle = (settings.heading as string) || (settings.title as string) || '';

  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (await confirm({
      title: t('themes:editor.canvas.delete_confirm_title'),
      description: t('themes:editor.canvas.delete_confirm_description'),
      confirmText: t('themes:editor.canvas.delete'),
      variant: 'destructive',
    })) onDelete();
  };

  // Unsupported section: its type was removed from a rebuilt manifest, so
  // it will NOT render on the storefront. Show a distinct amber warning
  // row with a delete affordance and no toggle/duplicate/settings (those
  // are meaningless for a type the theme can't render). Not draggable.
  if (unknown) {
    return (
      <div
        onClick={onClick}
        className="group relative flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition border border-amber-200 bg-amber-50 hover:bg-amber-100"
      >
        <div className="h-7 w-7 rounded shrink-0 flex items-center justify-center bg-amber-100 text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate text-amber-800">{sectionName}</p>
          <p className="text-[10px] text-amber-600 truncate">
            {t('themes:editor.canvas.unsupported_section')}
          </p>
        </div>
        <button
          onClick={handleDeleteClick}
          className="h-6 w-6 flex items-center justify-center rounded text-amber-500 hover:text-red-600 hover:bg-white opacity-0 group-hover:opacity-100 transition"
          title={t('themes:editor.canvas.delete')}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`group relative flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition ${
        selected
          ? 'bg-blue-50 border border-blue-200'
          : 'border border-transparent hover:bg-slate-50'
      } ${dragging ? 'opacity-40' : ''} ${section.disabled ? 'opacity-60' : ''}`}
    >
      {draggable && (
        <GripVertical className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-400 shrink-0 cursor-grab active:cursor-grabbing" />
      )}
      <div
        className={`h-7 w-7 rounded shrink-0 flex items-center justify-center ${
          selected ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-xs font-medium truncate ${
            selected ? 'text-blue-700' : 'text-slate-700'
          }`}
        >
          {sectionName}
        </p>
        {subtitle && <p className="text-[10px] text-slate-400 truncate">{subtitle}</p>}
      </div>

      {/* Quick actions */}
      <div className="flex items-center opacity-0 group-hover:opacity-100 transition">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="h-6 w-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-600 hover:bg-white"
          title={!section.disabled ? t('themes:editor.canvas.hide') : t('themes:editor.canvas.show')}
        >
          {!section.disabled ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="h-6 w-6 flex items-center justify-center rounded text-slate-400 hover:text-slate-600 hover:bg-white"
            >
              <MoreHorizontal className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={onToggle}>
              {!section.disabled ? (
                <>
                  <EyeOff className="h-3.5 w-3.5 me-2" />
                  {t('themes:editor.canvas.hide_section')}
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5 me-2" />
                  {t('themes:editor.canvas.show_section')}
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-3.5 w-3.5 me-2" />
              {t('themes:editor.canvas.duplicate')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                if (await confirm({
                  title: t('themes:editor.canvas.delete_confirm_title'),
                  description: t('themes:editor.canvas.delete_confirm_description'),
                  confirmText: t('themes:editor.canvas.delete'),
                  variant: 'destructive',
                })) onDelete();
              }}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5 me-2" />
              {t('themes:editor.canvas.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
