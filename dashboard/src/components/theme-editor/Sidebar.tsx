import type { ReactNode } from 'react';
import { Layers, Settings, Code, ChevronLeft } from 'lucide-react';

interface SidebarProps {
    activeTab: 'sections' | 'settings' | 'css';
    onTabChange: (tab: 'sections' | 'settings' | 'css') => void;
    children: ReactNode;
    onBack?: () => void;
    title?: string;
}

export default function Sidebar({ activeTab, onTabChange, children, onBack, title }: SidebarProps) {
    return (
        <div className="flex flex-col h-full">
            {/* Sidebar Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center space-x-2 bg-gray-50">
                {onBack ? (
                    <button
                        onClick={onBack}
                        className="p-1 -ml-1 text-gray-500 hover:text-gray-900 rounded hover:bg-gray-200 transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                ) : null}
                <h2 className="font-semibold text-gray-900 text-sm">
                    {title || (
                        activeTab === 'sections' ? 'Sections' :
                        activeTab === 'settings' ? 'Theme Settings' :
                        'Custom CSS'
                    )}
                </h2>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto">
                {children}
            </div>

            {/* Bottom Navigation */}
            {!onBack && (
                <div className="border-t border-gray-200 bg-white flex">
                    <button
                        onClick={() => onTabChange('sections')}
                        className={`flex-1 flex flex-col items-center justify-center py-3 text-xs font-medium transition-colors ${
                            activeTab === 'sections'
                                ? 'text-blue-600 bg-blue-50/50'
                                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                    >
                        <Layers className="w-5 h-5 mb-1" />
                        Sections
                    </button>
                    <div className="w-px bg-gray-200" />
                    <button
                        onClick={() => onTabChange('settings')}
                        className={`flex-1 flex flex-col items-center justify-center py-3 text-xs font-medium transition-colors ${
                            activeTab === 'settings'
                                ? 'text-blue-600 bg-blue-50/50'
                                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                    >
                        <Settings className="w-5 h-5 mb-1" />
                        Settings
                    </button>
                    <div className="w-px bg-gray-200" />
                    <button
                        onClick={() => onTabChange('css')}
                        className={`flex-1 flex flex-col items-center justify-center py-3 text-xs font-medium transition-colors ${
                            activeTab === 'css'
                                ? 'text-blue-600 bg-blue-50/50'
                                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                    >
                        <Code className="w-5 h-5 mb-1" />
                        CSS
                    </button>
                </div>
            )}
        </div>
    );
}
