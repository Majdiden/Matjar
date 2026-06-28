/**
 * Canvas — left-rail section tree for the visual theme editor.
 * Groups sections by visual area (header / template body / footer),
 * supports drag-to-reorder within the template area, click-to-select,
 * and quick actions (toggle visibility, duplicate, delete).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical, Eye, EyeOff, Copy, Trash2, Plus, MoreHorizontal } from 'lucide-react';
import { getSectionMeta } from './sectionMeta';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { useConfirm } from '../ui/use-confirm';

interface Section {
  id: string;
  type: string;
  enabled: boolean;
  order: number;
  layout?: string;
  settings: Record<string, unknown>;
  elements?: Array<{
    id: string;
    type: string;
    order: number;
    content: unknown;
    styles: Record<string, string>;
  }>;
}

interface CanvasProps {
  sections: Section[];
  onReorder: (sections: Section[]) => void;
  onToggleSection: (sectionId: string, enabled: boolean) => void;
  onSelectSection: (section: Section) => void;
  onDuplicateSection: (sectionId: string) => void;
  onDeleteSection: (sectionId: string) => void;
  selectedSectionId: string | null;
  onAddSection?: () => void;
}

export default function Canvas({
  sections,
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

  const sortedSections = [...sections].sort((a, b) => a.order - b.order);

  // Bucket by area
  const buckets: { header: Section[]; template: Section[]; footer: Section[] } = {
    header: [],
    template: [],
    footer: [],
  };
  for (const s of sortedSections) {
    const area = getSectionMeta(s.type).area;
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
              selected={selectedSectionId === s.id}
              onClick={() => onSelectSection(s)}
              onToggle={() => onToggleSection(s.id, !s.enabled)}
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
                  selected={selectedSectionId === s.id}
                  onClick={() => onSelectSection(s)}
                  onToggle={() => onToggleSection(s.id, !s.enabled)}
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
              selected={selectedSectionId === s.id}
              onClick={() => onSelectSection(s)}
              onToggle={() => onToggleSection(s.id, !s.enabled)}
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
  const meta = getSectionMeta(section.type);
  const Icon = meta.icon;
  const sectionName = t(`themes:sections.${section.type}.name`, { defaultValue: meta.name });
  // Sections declared in home variants can ship without a `settings` object
  // (settings fall through to the section-type defaults at render time).
  // The editor row just needs a display hint, so default to an empty bag.
  const settings = section.settings || {};
  const subtitle = (settings.heading as string) || (settings.title as string) || '';

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
      } ${dragging ? 'opacity-40' : ''} ${!section.enabled ? 'opacity-60' : ''}`}
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
          title={section.enabled ? t('themes:editor.canvas.hide') : t('themes:editor.canvas.show')}
        >
          {section.enabled ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
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
              {section.enabled ? (
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
