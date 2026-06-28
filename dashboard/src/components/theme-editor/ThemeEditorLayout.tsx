import type { ReactNode } from 'react';
import { ArrowLeft, Monitor, Smartphone, Tablet, Save, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface ThemeEditorLayoutProps {
    children: ReactNode;
    sidebar: ReactNode;
    viewport: 'desktop' | 'tablet' | 'mobile';
    onViewportChange: (viewport: 'desktop' | 'tablet' | 'mobile') => void;
    onSave: () => void;
    onReset: () => void;
    hasChanges: boolean;
    saving: boolean;
    isDraft: boolean;
}

export default function ThemeEditorLayout({
    children,
    sidebar,
    viewport,
    onViewportChange,
    onSave,
    onReset,
    hasChanges,
    saving,
    isDraft,
}: ThemeEditorLayoutProps) {
    const navigate = useNavigate();
    const { t } = useTranslation('themes');

    return (
        <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
            {/* Top Bar */}
            <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0 z-10">
                <div className="flex items-center space-x-4 w-1/3">
                    <button
                        onClick={() => navigate('/dashboard/themes')}
                        className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                        title={t('themes:editor.topbar.exit')}
                    >
                        <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
                    </button>
                    <div>
                        <h1 className="font-semibold text-gray-900">{t('themes:editor.topbar.title')}</h1>
                        {isDraft && (
                            <span className="text-xs text-orange-600 font-medium flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                {t('themes:editor.topbar.unsaved_changes')}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-center space-x-2 w-1/3">
                    <button
                        onClick={() => onViewportChange('desktop')}
                        className={`p-2 rounded-lg transition-colors ${viewport === 'desktop' ? 'bg-gray-100 text-blue-600' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                        title={t('themes:editor.topbar.view_desktop')}
                    >
                        <Monitor className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => onViewportChange('tablet')}
                        className={`p-2 rounded-lg transition-colors ${viewport === 'tablet' ? 'bg-gray-100 text-blue-600' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                        title={t('themes:editor.topbar.view_tablet')}
                    >
                        <Tablet className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => onViewportChange('mobile')}
                        className={`p-2 rounded-lg transition-colors ${viewport === 'mobile' ? 'bg-gray-100 text-blue-600' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                        title={t('themes:editor.topbar.view_mobile')}
                    >
                        <Smartphone className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex items-center justify-end space-x-3 w-1/3">
                    <button
                        onClick={onReset}
                        disabled={saving}
                        className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <RotateCcw className="w-4 h-4" />
                        <span>{t('themes:editor.topbar.reset_short')}</span>
                    </button>
                    <button
                        onClick={onSave}
                        disabled={!hasChanges || saving}
                        className="flex items-center space-x-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        <Save className="w-4 h-4" />
                        <span>{saving ? t('themes:editor.topbar.publishing_ellipsis') : t('themes:editor.topbar.publish')}</span>
                    </button>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <aside className="w-[320px] bg-white border-e border-gray-200 flex flex-col shrink-0 z-10 shadow-sm">
                    {sidebar}
                </aside>

                {/* Main Preview Area */}
                <main className="flex-1 bg-gray-100 p-8 overflow-hidden flex items-center justify-center relative">
                    <div className="absolute inset-0 pattern-grid-lg text-gray-200/50" />
                    {children}
                </main>
            </div>
        </div>
    );
}
