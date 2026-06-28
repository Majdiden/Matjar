import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GripVertical, Eye, EyeOff, Plus } from 'lucide-react';

interface Section {
    id: string;
    type: string;
    enabled: boolean;
    order: number;
    settings: Record<string, unknown>;
}

interface SectionListProps {
    sections: Section[];
    onReorder: (sections: Section[]) => void;
    onToggle: (sectionId: string, enabled: boolean) => void;
    onEdit: (sectionId: string) => void;
    onAdd: () => void;
}

export default function SectionList({ sections, onReorder, onToggle, onEdit, onAdd }: SectionListProps) {
    const { t } = useTranslation('themes');
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    // Sort sections by order
    const sortedSections = [...sections].sort((a, b) => a.order - b.order);

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

        // Update orders locally for visual feedback
        const reorderedSections = newSections.map((section, idx) => ({
            ...section,
            order: idx,
        }));

        onReorder(reorderedSections);
        setDraggedIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    const getSectionDisplayName = (type: string) => {
        return type
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const getSectionIcon = (type: string) => {
        const iconMap: Record<string, string> = {
            'hero': '🎯',
            'featured-products': '⭐',
            'categories': '📁',
            'new-arrivals': '🆕',
            'banner': '🖼️',
            'features': '✨',
            'brands': '🏷️',
            'newsletter': '📧',
            'product-grid': '📦',
            'text-block': '📝',
            'image-gallery': '🖼️',
        };
        return iconMap[type] || '📄';
    };

    return (
        <div className="p-4 space-y-4">
            <div className="space-y-2">
                {sortedSections.map((section, index) => (
                    <div
                        key={section.id}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`
              group flex items-center bg-white border border-gray-200 rounded-lg transition-all
              ${draggedIndex === index ? 'opacity-50 scale-95 shadow-lg' : 'hover:border-blue-300 hover:shadow-sm'}
              ${!section.enabled ? 'opacity-60 bg-gray-50' : ''}
            `}
                    >
                        {/* Drag Handle */}
                        <div className="p-3 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 border-e border-gray-100">
                            <GripVertical className="w-4 h-4" />
                        </div>

                        {/* Content */}
                        <div
                            className="flex-1 p-3 cursor-pointer flex items-center space-x-3"
                            onClick={() => onEdit(section.id)}
                        >
                            <span className="text-lg select-none">{getSectionIcon(section.type)}</span>
                            <span className="text-sm font-medium text-gray-700 select-none">
                                {t(`themes:sections.${section.type}.name`, { defaultValue: getSectionDisplayName(section.type) })}
                            </span>
                        </div>

                        {/* Actions */}
                        <div className="p-2 border-s border-gray-100">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggle(section.id, !section.enabled);
                                }}
                                className={`p-1.5 rounded-md transition-colors ${section.enabled
                                        ? 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                                    }`}
                                title={section.enabled ? t('themes:editor.section_manager.hide_section') : t('themes:editor.section_manager.show_section')}
                            >
                                {section.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <button
                onClick={onAdd}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 font-medium text-sm hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center space-x-2"
            >
                <Plus className="w-4 h-4" />
                <span>{t('themes:editor.section_library.add_section')}</span>
            </button>
        </div>
    );
}
