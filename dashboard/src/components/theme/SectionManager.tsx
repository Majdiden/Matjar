import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../../lib/api-client';
import { toast } from 'sonner';

interface Section {
  id: string;
  type: string;
  enabled: boolean;
  order: number;
  settings: Record<string, unknown>;
}

interface SectionManagerProps {
  sections: Section[];
  onUpdate: (sections: Section[]) => void;
}

export default function SectionManager({ sections, onUpdate }: SectionManagerProps) {
  const { t } = useTranslation('themes');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Sort sections by order
  const sortedSections = [...sections].sort((a, b) => a.order - b.order);
  console.log('sortedSections', sortedSections);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === index) return;

    const newSections = [...sortedSections];
    const draggedSection = newSections[draggedIndex];

    // Remove from old position
    newSections.splice(draggedIndex, 1);

    // Insert at new position
    newSections.splice(index, 0, draggedSection);

    // Update orders
    const reorderedSections = newSections.map((section, idx) => ({
      ...section,
      order: idx,
    }));

    onUpdate(reorderedSections);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    if (draggedIndex === null) return;

    try {
      setSaving(true);
      // Save the new order to backend
      const sectionIds = sortedSections.map(s => s.id);
      await api.themeCustomization.reorderSections(sectionIds);
    } catch (error) {
      console.error('Failed to save section order:', error);
      toast.error(t('themes:editor.section_manager.error_reorder'));
    } finally {
      setSaving(false);
      setDraggedIndex(null);
    }
  };

  const handleToggleVisibility = async (sectionId: string, currentEnabled: boolean) => {
    try {
      setSaving(true);
      await api.themeCustomization.toggleSection(sectionId, !currentEnabled);

      const updatedSections = sections.map(section =>
        section.id === sectionId
          ? { ...section, enabled: !currentEnabled }
          : section
      );
      onUpdate(updatedSections);
    } catch (error) {
      console.error('Failed to toggle section:', error);
      toast.error(t('themes:editor.section_manager.error_toggle'));
    } finally {
      setSaving(false);
    }
  };

  const toggleExpanded = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const getSectionDisplayName = (type: string) => {
    return type
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getSectionIcon = (type: string) => {
    // You can customize icons based on section type
    const iconMap: Record<string, string> = {
      'hero': '🎯',
      'featured-products': '⭐',
      'categories': '📁',
      'new-arrivals': '🆕',
      'banner': '🖼️',
      'features': '✨',
      'brands': '🏷️',
      'newsletter': '📧',
    };
    return iconMap[type] || '📄';
  };

  if (sections.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-2">{t('themes:editor.section_manager.no_sections')}</p>
        <p className="text-sm text-gray-400">
          {t('themes:editor.section_manager.no_sections_hint')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">
          {t('themes:editor.section_manager.drag_hint')}
        </p>
        {saving && (
          <span className="text-sm text-blue-600">{t('themes:editor.section_manager.saving')}</span>
        )}
      </div>

      <div className="space-y-2">
        {sortedSections.map((section, index) => (
          <div
            key={section.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`
              bg-white border border-gray-200 rounded-lg transition-all
              ${draggedIndex === index ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}
              ${!section.enabled ? 'bg-gray-50' : ''}
              hover:shadow-md cursor-move
            `}
          >
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  {/* Drag handle */}
                  <div className="cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-5 h-5 text-gray-400" />
                  </div>

                  {/* Section icon and info */}
                  <div className="flex items-center space-x-3 flex-1">
                    <span className="text-2xl">{getSectionIcon(section.type)}</span>
                    <div>
                      <h3 className={`font-medium ${!section.enabled ? 'text-gray-400' : 'text-gray-900'}`}>
                        {t(`themes:sections.${section.type}.name`, { defaultValue: getSectionDisplayName(section.type) })}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {t('themes:editor.section_manager.order_id', { order: section.order + 1, id: section.id })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  {/* Visibility toggle */}
                  <button
                    onClick={() => handleToggleVisibility(section.id, section.enabled)}
                    disabled={saving}
                    className={`
                      p-2 rounded-lg transition-colors
                      ${section.enabled
                        ? 'text-blue-600 hover:bg-blue-50'
                        : 'text-gray-400 hover:bg-gray-100'}
                      disabled:opacity-50
                    `}
                    title={section.enabled ? t('themes:editor.section_manager.hide_section') : t('themes:editor.section_manager.show_section')}
                  >
                    {section.enabled ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>

                  {/* Expand/collapse settings */}
                  {section.settings && Object.keys(section.settings).length > 0 && (
                    <button
                      onClick={() => toggleExpanded(section.id)}
                      className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                      title={expandedSections.has(section.id) ? t('themes:editor.section_manager.collapse') : t('themes:editor.section_manager.expand')}
                    >
                      {expandedSections.has(section.id) ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded settings */}
              {expandedSections.has(section.id) && section.settings && Object.keys(section.settings).length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">{t('themes:editor.section_editor.settings_title')}</h4>
                  <div className="space-y-2">
                    {Object.entries(section.settings).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}:
                        </span>
                        <span className="text-gray-900 font-mono text-xs">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Drag indicator */}
            {draggedIndex === index && (
              <div className="absolute inset-0 border-2 border-blue-500 rounded-lg pointer-events-none" />
            )}
          </div>
        ))}
      </div>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 mb-2">💡 {t('themes:editor.section_manager.tips_title')}</h4>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• {t('themes:editor.section_manager.tips.reorder')}</li>
          <li>• {t('themes:editor.section_manager.tips.visibility')}</li>
          <li>• {t('themes:editor.section_manager.tips.drafts')}</li>
          <li>• {t('themes:editor.section_manager.tips.publish')}</li>
        </ul>
      </div>
    </div>
  );
}
