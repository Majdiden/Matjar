import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';

interface LivePreviewProps {
    url: string | null;
    viewport: 'desktop' | 'tablet' | 'mobile';
    onRefresh: () => void;
}

export default function LivePreview({ url, viewport, onRefresh }: LivePreviewProps) {
    const { t } = useTranslation('themes');
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (url) {
            setLoading(true);
        }
    }, [url]);

    const getViewportStyle = () => {
        switch (viewport) {
            case 'mobile':
                return { width: '375px', height: '100%', borderRadius: '12px' };
            case 'tablet':
                return { width: '768px', height: '100%', borderRadius: '12px' };
            case 'desktop':
            default:
                return { width: '100%', height: '100%', borderRadius: '0px' };
        }
    };

    const handleIframeLoad = () => {
        setLoading(false);
    };

    if (!url) {
        return (
            <div className="flex flex-col items-center justify-center text-gray-400">
                <Eye className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg font-medium">{t('themes:editor.preview_unavailable')}</p>
                <button
                    onClick={onRefresh}
                    className="mt-4 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
                >
                    {t('themes:editor.generate_preview')}
                </button>
            </div>
        );
    }

    return (
        <div
            className={`relative transition-all duration-300 ease-in-out shadow-2xl bg-white overflow-hidden ring-1 ring-gray-900/5 ${viewport !== 'desktop' ? 'my-4' : ''
                }`}
            style={getViewportStyle()}
        >
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
            )}
            <iframe
                ref={iframeRef}
                src={url}
                className="w-full h-full border-0"
                onLoad={handleIframeLoad}
                title={t('themes:editor.topbar.preview_iframe')}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
        </div>
    );
}
