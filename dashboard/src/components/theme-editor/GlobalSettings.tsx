import { useState } from 'react';
import { ChevronDown, ChevronRight, Palette, Type, Layout } from 'lucide-react';

interface GlobalSettingsProps {
    settings: {
        colors: Record<string, string>;
        typography: Record<string, string>;
        layout: Record<string, string>;
    };
    onUpdate: (category: 'colors' | 'typography' | 'layout', settings: Record<string, string>) => void;
}

export default function GlobalSettings({ settings, onUpdate }: GlobalSettingsProps) {
    const [expandedSection, setExpandedSection] = useState<string | null>('colors');

    const toggleSection = (section: string) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    return (
        <div className="p-4 space-y-4">
            {/* Colors */}
            <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                <button
                    onClick={() => toggleSection('colors')}
                    className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                    <div className="flex items-center space-x-2">
                        <Palette className="w-4 h-4 text-gray-500" />
                        <span className="font-medium text-sm text-gray-900">Colors</span>
                    </div>
                    {expandedSection === 'colors' ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400 rtl:rotate-180" />
                    )}
                </button>

                {expandedSection === 'colors' && (
                    <div className="p-4 space-y-4">
                        {Object.entries(settings.colors || {}).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between">
                                <label className="text-sm text-gray-600 capitalize">
                                    {key.replace(/([A-Z])/g, ' $1').trim()}
                                </label>
                                <div className="flex items-center space-x-2">
                                    <div className="w-8 h-8 rounded-full border border-gray-200 overflow-hidden shadow-sm relative">
                                        <input
                                            type="color"
                                            value={value || '#000000'}
                                            onChange={(e) => onUpdate('colors', { [key]: e.target.value })}
                                            className="absolute inset-0 w-[150%] h-[150%] -top-1/4 -start-1/4 cursor-pointer p-0 border-0"
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        value={value || '#000000'}
                                        onChange={(e) => onUpdate('colors', { [key]: e.target.value })}
                                        className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Typography */}
            <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                <button
                    onClick={() => toggleSection('typography')}
                    className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                    <div className="flex items-center space-x-2">
                        <Type className="w-4 h-4 text-gray-500" />
                        <span className="font-medium text-sm text-gray-900">Typography</span>
                    </div>
                    {expandedSection === 'typography' ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400 rtl:rotate-180" />
                    )}
                </button>

                {expandedSection === 'typography' && (
                    <div className="p-4 space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Body Font</label>
                            <select
                                value={settings.typography?.fontFamily || 'sans-serif'}
                                onChange={(e) => onUpdate('typography', { fontFamily: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="Inter, sans-serif">Inter</option>
                                <option value="'Roboto', sans-serif">Roboto</option>
                                <option value="'Open Sans', sans-serif">Open Sans</option>
                                <option value="'Lato', sans-serif">Lato</option>
                                <option value="system-ui, sans-serif">System UI</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Heading Font</label>
                            <select
                                value={settings.typography?.headingFontFamily || 'serif'}
                                onChange={(e) => onUpdate('typography', { headingFontFamily: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="'Playfair Display', serif">Playfair Display</option>
                                <option value="'Merriweather', serif">Merriweather</option>
                                <option value="'Montserrat', sans-serif">Montserrat</option>
                                <option value="Georgia, serif">Georgia</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Base Size</label>
                            <input
                                type="text"
                                value={settings.typography?.fontSizeBase || '16px'}
                                onChange={(e) => onUpdate('typography', { fontSizeBase: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Layout */}
            <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
                <button
                    onClick={() => toggleSection('layout')}
                    className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                    <div className="flex items-center space-x-2">
                        <Layout className="w-4 h-4 text-gray-500" />
                        <span className="font-medium text-sm text-gray-900">Layout</span>
                    </div>
                    {expandedSection === 'layout' ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400 rtl:rotate-180" />
                    )}
                </button>

                {expandedSection === 'layout' && (
                    <div className="p-4 space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Container Width</label>
                            <input
                                type="text"
                                value={settings.layout?.containerWidth || '1200px'}
                                onChange={(e) => onUpdate('layout', { containerWidth: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Header Height</label>
                            <input
                                type="text"
                                value={settings.layout?.headerHeight || '80px'}
                                onChange={(e) => onUpdate('layout', { headerHeight: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
